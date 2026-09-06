#!/usr/bin/env python3
"""Report and clean unused CSS variables and dead class selectors.

Counts classes referenced from themepack files, OpenVK stock templates and
static JS, plus the Preact-rendered IM (upstream Web/static/js/messages and
the themepack messenger override), whose class names are often composed
dynamically (cls arrays, ternaries, class=${var}) rather than written as
literal class="..." attributes.
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_DIR = ROOT / "res" / "css"
STYLESHEET_PATH = ROOT / "stylesheet.css"

SKIP_PARTS = frozenset({"vendor", "node_modules", "jquery"})

CLASS_RE = re.compile(r"\.([a-zA-Z_][a-zA-Z0-9_-]*)")
COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)


def strip_comments(sel):
    return COMMENT_RE.sub("", sel).strip()
VAR_DEF_RE = re.compile(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)")
VAR_REF_RE = re.compile(r"var\(\s*(--[a-zA-Z0-9_-]+)")


def collect_consumer_files():
    files = []

    def scan(base, exts):
        if not base.is_dir():
            return
        for p in base.rglob("*"):
            if p.suffix not in exts:
                continue
            if any(part in SKIP_PARTS for part in p.parts):
                continue
            files.append(p)

    # Theme files
    scan(ROOT / "res", {".latte", ".js", ".hbs"})
    scan(ROOT / "tpl", {".latte", ".js", ".hbs"})

    # OpenVK stock files
    ovk = Path(__file__).resolve().parents[3]
    scan(ovk / "Web" / "Presenters" / "templates", {".latte", ".js", ".hbs"})
    scan(ovk / "Web" / "static", {".latte", ".js", ".hbs"})

    return sorted(files)


def collect_preact_text():
    """Concatenated source of Preact-rendered IM components.

    Their class names rarely appear as literal class="..." attributes, so
    they are matched textually (word boundaries) against classes defined in
    the audited stylesheets instead of going through collect_class_tokens.
    """
    ovk = Path(__file__).resolve().parents[3]
    dirs = [ovk / "Web" / "static" / "js" / "messages", ROOT / "res" / "js" / "messenger"]
    parts = []
    for base in dirs:
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if p.suffix not in {".js", ".mjs"}:
                continue
            if any(part in SKIP_PARTS for part in p.parts):
                continue
            parts.append(p.read_text(errors="replace"))
    return "\n".join(parts)


def find_word_hits(text, classes):
    """Subset of classes occurring in text on word boundaries."""
    classes = sorted(set(classes))
    if not classes or not text:
        return set()
    pattern = re.compile(r"\b(?:" + "|".join(re.escape(c) for c in classes) + r")\b")
    return set(pattern.findall(text))


def read_consumer_text(files):
    return "\n".join(p.read_text(errors="replace") for p in files)


def collect_class_tokens(text):
    tokens = set()

    # class=, className=, n:class=
    for m in re.finditer(r'(?:class|className|n:class)\s*=\s*(["\'`])((?:(?!\1).)*)\1', text):
        tokens.update(re.findall(r"[a-zA-Z_][a-zA-Z0-9_-]*", m.group(2)))

    # space-separated classes in strings
    for m in re.finditer(r'(["\'`])([a-zA-Z_][a-zA-Z0-9_-]*(?:\s+[a-zA-Z_][a-zA-Z0-9_-]*)+)\1', text):
        for part in m.group(2).split():
            cleaned = re.sub(r"[^a-zA-Z0-9_-]+$", "", part)
            if re.match(r"^[a-zA-Z_]", cleaned):
                tokens.add(cleaned)

    # JS dot notation
    for m in re.finditer(r"\.([a-zA-Z_][a-zA-Z0-9_-]+)", text):
        tokens.add(m.group(1))

    return tokens


def collect_dynamic_prefixes(text):
    prefixes = set()
    for m in re.finditer(r"([a-zA-Z_][a-zA-Z0-9_-]*)--\$\{", text):
        prefixes.add(m.group(1) + "--")
    return prefixes


def parse_defined_vars(css):
    return {m.group(1): m.group(2).strip() for m in VAR_DEF_RE.finditer(css)}


def reachable_vars(defined, roots):
    reachable = set()

    def expand(name):
        if name in reachable:
            return
        reachable.add(name)
        for ref in VAR_REF_RE.findall(defined.get(name, "")):
            expand(ref)

    for root in roots:
        expand(root)
    return reachable


def find_dead_vars(css, stylesheet, consumer):
    defined = parse_defined_vars(css)
    roots = set(VAR_REF_RE.findall(css + "\n" + stylesheet))
    roots.update(re.findall(r'["\'](--[a-zA-Z0-9_-]+)["\']', consumer))
    roots.update(re.findall(r"setProperty\(\s*['\"](--[a-zA-Z0-9_-]+)", consumer))

    return sorted(set(defined) - reachable_vars(defined, roots))


# Simple CSS block parser
def parse_css_blocks(css):
    blocks = []
    i = 0
    n = len(css)
    depth = 0
    block_start = selector_end = body_start = 0
    in_comment = in_string = False
    string_char = ''

    while i < n:
        c = css[i]

        if in_comment:
            if c == '*' and i+1 < n and css[i+1] == '/':
                in_comment = False
                i += 1
            i += 1
            continue

        if in_string:
            if c == '\\':
                i += 2
                continue
            if c == string_char:
                in_string = False
            i += 1
            continue

        if c == '/' and i+1 < n and css[i+1] == '*':
            in_comment = True
            i += 2
            continue

        if c in ("'", '"'):
            in_string = True
            string_char = c
            i += 1
            continue

        if c == '{':
            if depth == 0:
                selector_end = i
                body_start = i + 1
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                blocks.append({
                    'selector': css[block_start:selector_end].strip(),
                    'body': css[body_start:i],
                    'start': block_start,
                    'end': i + 1,
                    'selector_start': block_start,
                    'selector_end': selector_end,
                    'body_start': body_start
                })
                block_start = i + 1
                while block_start < n and css[block_start].isspace():
                    block_start += 1
        i += 1

    return blocks


def split_selectors(sel):
    """Split on top-level commas only."""
    parts = []
    depth = 0
    start = 0
    in_str = False
    quote = ''

    for i, c in enumerate(sel):
        if in_str:
            if c == '\\':
                continue
            if c == quote:
                in_str = False
            continue
        if c in ("'", '"'):
            in_str = True
            quote = c
            continue
        if c == '(': depth += 1
        elif c == ')': depth -= 1
        elif c == ',' and depth == 0:
            parts.append(sel[start:i])
            start = i + 1

    parts.append(sel[start:])
    return [p.strip() for p in parts if p.strip()]


def find_removals(css, offset, is_unused):
    blocks = parse_css_blocks(css)
    removals = []

    for b in blocks:
        sel = b['selector']
        comments = " ".join(COMMENT_RE.findall(sel))
        if comments:
            comments += " "
        # Comments are section headers, not selectors: they pollute display,
        # fake CLASS_RE hits, and break the @media check below.
        sel = strip_comments(sel)

        if sel.startswith('@') and any(x in sel for x in ('media', 'supports', 'layer')):
            removals.extend(find_removals(b['body'], offset + b['body_start'], is_unused))
            continue
        if sel.startswith('@') or not sel:
            continue

        subs = split_selectors(sel)
        kept = []
        dead = []

        for sub in subs:
            classes = set(CLASS_RE.findall(sub))
            if classes and any(is_unused(c) for c in classes):
                dead.append(sub)
            else:
                kept.append(sub)

        if not kept and dead:
            removals.append({'type': 'block', 'start': offset + b['start'],
                            'end': offset + b['end'], 'sel': sel,
                            'dead_classes': sorted({c for sub in dead for c in CLASS_RE.findall(sub) if is_unused(c)})})
        elif dead:
            sep = ",\n" if '\n' in sel else ", "
            new_sel = comments + sep.join(kept) + " "
            removals.append({'type': 'selector', 'start': offset + b['selector_start'],
                            'end': offset + b['selector_end'], 'new_sel': new_sel, 'sel': sel,
                            'dead_classes': sorted({c for sub in dead for c in CLASS_RE.findall(sub) if is_unused(c)})})

    return removals


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fail-on-dead", action="store_true")
    parser.add_argument("--css-path", type=str)
    parser.add_argument("--delete-unused", action="store_true")
    args = parser.parse_args()

    if args.css_path:
        css_files = [Path(args.css_path).resolve()]
    else:
        css_files = sorted(CSS_DIR.glob("*.css"))

    if not css_files:
        print("No CSS files found", file=sys.stderr)
        return 2

    stylesheet = STYLESHEET_PATH.read_text(errors="replace") if STYLESHEET_PATH.is_file() else ""
    consumer_files = collect_consumer_files()
    consumer = read_consumer_text(consumer_files)

    classes = collect_class_tokens(consumer)
    dynamic = collect_dynamic_prefixes(consumer)

    css_classes = set()
    css_texts = {}
    for path in css_files:
        text = path.read_text(errors="replace")
        css_texts[path] = text
        css_classes.update(CLASS_RE.findall(text))
    preact_hits = find_word_hits(collect_preact_text(), css_classes)
    classes |= preact_hits
    print(f"consumer files: {len(consumer_files)}, preact-covered classes: {len(preact_hits)}")

    total_dead_vars = 0
    total_removals = 0

    for path in css_files:
        css = css_texts[path]
        dead_vars = find_dead_vars(css, stylesheet, consumer)

        # Classes used in pseudo-elements shouldn't be removed
        protected = {m.group(1) for m in re.finditer(
            r"\.([a-zA-Z_][a-zA-Z0-9_-]*)(?:::[a-zA-Z0-9_-]+|:[a-zA-Z0-9_-]+)", css)}

        def is_unused(cls):
            if cls in protected or cls in classes:
                return False
            base = cls.split("__")[0].split("--")[0]
            if base in classes:
                return False
            return not any(cls.startswith(p) for p in dynamic)

        removals = find_removals(css, 0, is_unused)

        print(f"\n{path.name}:")
        print(f"  {len(dead_vars)} dead variables")
        print(f"  {len(removals)} dead rules/selectors")

        if dead_vars:
            print("  Vars:", ", ".join(dead_vars[:8]))
        if removals:
            for r in removals[:5]:
                culprits = " unused=" + ",".join(r.get('dead_classes', [])[:4]) if r.get('dead_classes') else ""
                print(f"  - {r['sel'].replace(chr(10), ' ')[:80]}{culprits}")

        total_dead_vars += len(dead_vars)
        total_removals += len(removals)

        if args.delete_unused and removals:
            new_css = css
            for r in sorted(removals, key=lambda x: x['start'], reverse=True):
                s, e = r['start'], r['end']
                if r['type'] == 'block':
                    while s > 0 and new_css[s-1].isspace():
                        s -= 1
                    new_css = new_css[:s] + new_css[e:]
                else:
                    new_css = new_css[:s] + r['new_sel'] + new_css[e:]

            path.write_text(new_css, errors="replace")
            print(f"  → Cleaned {len(removals)} items")

    if args.fail_on_dead and (total_dead_vars or total_removals):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())