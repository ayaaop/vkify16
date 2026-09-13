#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LAYOUT = path.join(ROOT, 'tpl', '_mobileIcons.latte');
const ICONS_ROOT = path.join(
  ROOT,
  'VKUI-repos/icons-master/packages/icons/src/svg',
);
const SCAN_DIRS = [
  path.join(ROOT, 'tpl'),
  path.join(ROOT, 'res'),
];
const SCAN_EXTENSIONS = new Set(['.latte', '.js', '.hbs']);
const SKIP_DIR_NAMES = new Set([
  'VKUI-repos',
  'temp',
  'node_modules',
  'vendor',
]);

const USE_HREF_RE =
  /<use\b[^>]*(?:xlink:)?href="#([a-z0-9][a-z0-9-]*)"[^>]*>/gi;
const SYMBOL_RE = /<symbol\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/g;
const SPRITE_BLOCK_RE =
  /(<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display: none;">)([\s\S]*?)(\n\s*<\/svg>)/;
const ICONS_56_COMMENT =
  '                <!-- VK Icons 56 — placeholder empty states -->';
const SYMBOL_INDENT = '                ';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const reorder = args.has('--reorder');
const prune = !args.has('--no-prune');

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      walkFiles(fullPath, files);
      continue;
    }

    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function fileNameToIconId(fileName) {
  return fileName.replace(/\.svg$/i, '').replace(/_/g, '-');
}

function pathToCanonicalId(svgPath) {
  return fileNameToIconId(path.basename(svgPath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildIconIndex(iconsRoot) {
  const exact = new Map();
  const bySize = new Map();

  if (!fs.existsSync(iconsRoot)) {
    throw new Error(`Icons directory not found: ${iconsRoot}`);
  }

  for (const sizeDir of fs.readdirSync(iconsRoot, { withFileTypes: true })) {
    if (!sizeDir.isDirectory()) {
      continue;
    }

    const sizePath = path.join(iconsRoot, sizeDir.name);
    const bucket = [];

    for (const file of fs.readdirSync(sizePath)) {
      if (!file.endsWith('.svg')) {
        continue;
      }

      const iconId = fileNameToIconId(file);
      const fullPath = path.join(sizePath, file);
      exact.set(iconId, fullPath);
      bucket.push({ iconId, fullPath, file });
    }

    bySize.set(sizeDir.name, bucket);
  }

  return { exact, bySize };
}

function scoreIconMatch(referencedId, canonicalId) {
  const referencedParts = referencedId.split('-');
  const canonicalParts = new Set(canonicalId.split('-'));
  let score = 0;

  for (const part of referencedParts) {
    if (canonicalParts.has(part)) {
      score += 2;
    }
  }

  if (referencedId.endsWith('-outline') && canonicalId.includes('-outline')) {
    score += 1;
  }

  return score;
}

function pickBestMatch(referencedId, matches) {
  return matches
    .slice()
    .sort((a, b) => {
      const scoreDiff =
        scoreIconMatch(referencedId, b.iconId) -
        scoreIconMatch(referencedId, a.iconId);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.iconId.length - b.iconId.length;
    })[0];
}

function singularVariants(value) {
  const variants = new Set([value]);
  if (value.endsWith('s')) {
    variants.add(value.slice(0, -1));
  } else {
    variants.add(`${value}s`);
  }
  return [...variants];
}

function resolveIconPath(referencedId, index, iconsRoot) {
  const direct = index.exact.get(referencedId);
  if (direct) {
    return { path: direct, strategy: 'exact' };
  }

  const sizeMatch = referencedId.match(/-(\d+)$/);
  const size = sizeMatch?.[1];
  const baseId = sizeMatch ? referencedId.slice(0, -(size.length + 1)) : referencedId;
  const baseName = baseId.replace(/-outline$/, '');
  const baseSnake = baseName.replace(/-/g, '_');

  if (size) {
    const bucket = index.bySize.get(size) ?? [];
    const sizedMatches = bucket.filter(({ file }) =>
      file.startsWith(`${baseSnake}_`) || file === `${baseSnake}.svg`,
    );
    if (sizedMatches.length === 1) {
      return { path: sizedMatches[0].fullPath, strategy: 'size-prefix' };
    }
    if (sizedMatches.length > 1) {
      const bestMatch = pickBestMatch(referencedId, sizedMatches);
      return { path: bestMatch.fullPath, strategy: 'size-prefix-best' };
    }

    for (const suffix of ['square_outline', 'circle_outline', 'outline']) {
      const candidateFile = `${baseSnake}_${suffix}_${size}.svg`;
      const candidatePath = path.join(iconsRoot, size, candidateFile);
      if (fs.existsSync(candidatePath)) {
        return { path: candidatePath, strategy: `alt-${suffix}` };
      }
    }
  }

  for (const variant of singularVariants(baseId)) {
    const candidateId = size ? `${variant}-${size}` : variant;
    const candidate = index.exact.get(candidateId);
    if (candidate) {
      return { path: candidate, strategy: 'singular-variant' };
    }
  }

  return null;
}

function collectUsedIconIds(files) {
  const used = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(USE_HREF_RE)) {
      used.add(match[1]);
    }
  }

  return used;
}

function normalizeSymbolMarkup(symbolHtml) {
  return `${SYMBOL_INDENT}${symbolHtml.trim()}`;
}

function iconIdToSize(iconId) {
  const match = iconId.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function compareIconIds(a, b) {
  const sizeDiff = iconIdToSize(a) - iconIdToSize(b);
  if (sizeDiff !== 0) {
    return sizeDiff;
  }
  return a.localeCompare(b);
}

function collectExistingSymbolData(layoutContent) {
  const symbols = new Map();
  let minified = 0;
  for (const match of layoutContent.matchAll(SYMBOL_RE)) {
    const cleaned = minifySymbolMarkup(match[0].trim());
    if (cleaned !== match[0].trim()) minified++;
    symbols.set(match[1], normalizeSymbolMarkup(cleaned));
  }
  return { symbols, minified };
}

function formatSpriteSymbols(symbolMap) {
  const sortedIds = [...symbolMap.keys()].sort(compareIconIds);
  const lines = [];
  let prevSize = null;

  for (const id of sortedIds) {
    const size = iconIdToSize(id);
    if (prevSize !== null && size !== prevSize) {
      lines.push('');
      if (size === 56) {
        lines.push(ICONS_56_COMMENT);
      }
    }
    lines.push(normalizeSymbolMarkup(symbolMap.get(id)));
    prevSize = size;
  }

  return `\n${lines.join('\n')}`;
}

function rebuildSpriteSheet(layoutContent, symbolMap) {
  if (!SPRITE_BLOCK_RE.test(layoutContent)) {
    throw new Error('Could not find sprite sheet block in _mobileIcons.latte');
  }

  const block = formatSpriteSymbols(symbolMap);
  return layoutContent.replace(SPRITE_BLOCK_RE, `$1${block}$3`);
}

function parseSvgDimensions(attrs, iconId) {
  const viewBox =
    attrs.match(/\bviewBox="([^"]+)"/i)?.[1] ?? '0 0 24 24';
  let width = attrs.match(/\bwidth="([^"]+)"/i)?.[1]?.replace(/px$/i, '');
  let height = attrs.match(/\bheight="([^"]+)"/i)?.[1]?.replace(/px$/i, '');
  const sizeMatch = iconId.match(/-(\d+)$/);
  const fallbackSize = sizeMatch?.[1] ?? '24';

  width = width || fallbackSize;
  height = height || fallbackSize;

  return { viewBox, width, height };
}

function cleanSvgInner(inner) {
  let out = inner
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '')
    .replace(/<defs>\s*<\/defs>/gi, '')
    .replace(/<polygon\b[^>]*points="(?:\d+\s*){4,}"[^>]*>\s*<\/polygon>/gi, '')
    .replace(/\s+id="[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Unwrap attribute-less <g> layers (what remains after layer-name ids are
  // stripped); repeat until no bare groups are left.
  let prev;
  do {
    prev = out;
    out = out.replace(/<g\s*>([\s\S]*?)<\/g>/g, '$1');
  } while (out !== prev);

  return out.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}

function minifySymbolMarkup(symbolHtml) {
  return symbolHtml.replace(
    /^(<symbol\b[^>]*>)([\s\S]*?)(<\/symbol>)$/,
    (m, open, inner, close) => open + cleanSvgInner(inner) + close,
  );
}

function svgFileToSymbol(iconId, svgPath) {
  const raw = fs.readFileSync(svgPath, 'utf8');
  const openTagMatch = raw.match(/<svg\b([^>]*)>/i);
  if (!openTagMatch) {
    throw new Error(`No <svg> root element in ${svgPath}`);
  }

  const inner = raw
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
  const { viewBox, width, height } = parseSvgDimensions(openTagMatch[1], iconId);
  const body = cleanSvgInner(inner);

  return normalizeSymbolMarkup(
    `<symbol id="${iconId}" width="${width}" height="${height}" viewBox="${viewBox}">${body}</symbol>`,
  );
}

function getIconViewBox(iconId, svgPath) {
  const raw = fs.readFileSync(svgPath, 'utf8');
  const openTagMatch = raw.match(/<svg\b([^>]*)>/i);
  if (!openTagMatch) {
    return null;
  }
  return parseSvgDimensions(openTagMatch[1], iconId);
}

function getSymbolViewBox(symbolHtml, iconId) {
  const attrs = symbolHtml.match(/<symbol\b([^>]*)>/i)?.[1];
  return attrs ? parseSvgDimensions(attrs, iconId) : null;
}

function buildViewBoxMap(usedIds, index, symbolMap) {
  const map = new Map();
  for (const id of usedIds) {
    const svgPath = index.exact.get(id);
    if (svgPath) {
      const dims = getIconViewBox(id, svgPath);
      if (dims) {
        map.set(id, dims);
      }
      continue;
    }

    const symbol = symbolMap.get(id);
    if (symbol) {
      const dims = getSymbolViewBox(symbol, id);
      if (dims) {
        map.set(id, dims);
      }
    }
  }
  return map;
}

function replaceIconReferences(content, renameMap) {
  let updated = content;
  const renames = [...renameMap.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [from, to] of renames) {
    updated = updated.replace(
      new RegExp(`((?:xlink:)?href="#)${escapeRegExp(from)}(")`, 'g'),
      `$1${to}$2`,
    );
  }

  return updated;
}

function syncSvgViewBoxes(files, viewBoxMap, write = true) {
  const updatedFiles = new Set();
  const syncedIcons = new Set();
  const svgUseRe = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi;

  for (const file of files) {
    if (file === LAYOUT) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    let changed = false;
    const updated = content.replace(svgUseRe, (svgMatch, svgAttrs, svgBody) => {
      const useMatch = svgBody.match(
        /<use\b[^>]*(?:xlink:)?href="#([a-z0-9][a-z0-9-]*)"/i,
      );
      if (!useMatch) {
        return svgMatch;
      }

      const iconId = useMatch[1];
      const dims = viewBoxMap.get(iconId);
      if (!dims) {
        return svgMatch;
      }

      const existingViewBox = svgAttrs.match(/\bviewBox="([^"]*)"/i);
      if (existingViewBox && existingViewBox[1] === dims.viewBox) {
        return svgMatch;
      }

      changed = true;
      syncedIcons.add(iconId);
      if (existingViewBox) {
        const newAttrs = svgAttrs.replace(
          /\bviewBox="[^"]*"/i,
          `viewBox="${dims.viewBox}"`,
        );
        return `<svg${newAttrs}>${svgBody}</svg>`;
      }

      return `<svg${svgAttrs} viewBox="${dims.viewBox}">${svgBody}</svg>`;
    });

    if (changed) {
      if (write) {
        fs.writeFileSync(file, updated, 'utf8');
      }
      updatedFiles.add(file);
    }
  }

  return { updatedFiles: [...updatedFiles], syncedIcons: [...syncedIcons] };
}

function main() {
  const scanFiles = SCAN_DIRS.flatMap((dir) => walkFiles(dir));
  const usedIconIds = collectUsedIconIds(scanFiles);
  let layoutContent = fs.readFileSync(LAYOUT, 'utf8');
  const symbolData = collectExistingSymbolData(layoutContent);
  const symbolMap = symbolData.symbols;
  const minifiedCount = symbolData.minified;
  const existingIconIds = new Set(symbolMap.keys());
  const index = buildIconIndex(ICONS_ROOT);

  const renameMap = new Map();
  const unresolved = [];
  const requiredCanonical = new Set();
  const resolved = [];

  for (const referencedId of [...usedIconIds].sort((a, b) => a.localeCompare(b))) {
    if (existingIconIds.has(referencedId)) {
      continue;
    }

    const match = resolveIconPath(referencedId, index, ICONS_ROOT);
    if (!match) {
      unresolved.push(referencedId);
      continue;
    }

    const canonicalId = pathToCanonicalId(match.path);
    requiredCanonical.add(canonicalId);

    if (referencedId !== canonicalId) {
      renameMap.set(referencedId, canonicalId);
    }

    resolved.push({
      referencedId,
      canonicalId,
      svgPath: match.path,
      strategy: match.strategy,
    });
  }

  const missingCanonical = [...requiredCanonical]
    .filter((iconId) => !existingIconIds.has(iconId))
    .sort((a, b) => a.localeCompare(b));

  const finalUsedIds = new Set(
    [...usedIconIds].map((id) => renameMap.get(id) || id),
  );
  for (const id of unresolved) {
    if (existingIconIds.has(id)) {
      finalUsedIds.add(id);
    }
  }

  const unusedIconIds = new Set();
  if (prune) {
    for (const id of existingIconIds) {
      if (!finalUsedIds.has(id)) {
        unusedIconIds.add(id);
        symbolMap.delete(id);
      }
    }
  }

  const symbolsToAdd = missingCanonical.map((canonicalId) => {
    const svgPath = index.exact.get(canonicalId);
    if (!svgPath) {
      throw new Error(`Missing indexed SVG for canonical icon ${canonicalId}`);
    }

    return {
      canonicalId,
      svgPath,
      symbol: svgFileToSymbol(canonicalId, svgPath),
    };
  });

  const viewBoxMap = buildViewBoxMap(finalUsedIds, index, symbolMap);

  console.log(`Referenced icons: ${usedIconIds.size}`);
  console.log(`Existing sprites: ${existingIconIds.size}`);
  console.log(`Canonical icons required: ${requiredCanonical.size}`);
  console.log(`Sprites minified: ${minifiedCount}`);
  if (prune) {
    console.log(`Unused sprites: ${unusedIconIds.size}`);
  } else {
    console.log('Pruning disabled (--no-prune)');
  }

  if (renameMap.size > 0) {
    console.log(`\nRename usages (${renameMap.size}):`);
    for (const [from, to] of [...renameMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      console.log(`  ${from} -> ${to}`);
    }
  }

  if (symbolsToAdd.length > 0) {
    console.log(`\nAdd sprites (${symbolsToAdd.length}):`);
    for (const item of symbolsToAdd) {
      const relSvg = path.relative(ROOT, item.svgPath);
      console.log(`  + ${item.canonicalId} <- ${relSvg}`);
    }
  }

  if (prune && unusedIconIds.size > 0) {
    console.log(`\nRemove sprites (${unusedIconIds.size}):`);
    for (const iconId of [...unusedIconIds].sort((a, b) =>
      a.localeCompare(b),
    )) {
      console.log(`  - ${iconId}`);
    }
  }

  if (unresolved.length > 0) {
    console.log(`\nUnresolved (${unresolved.length}):`);
    for (const iconId of unresolved) {
      console.log(`  ! ${iconId}`);
    }
  }

  const shouldReorderSprites =
    symbolsToAdd.length > 0 ||
    reorder ||
    (prune && unusedIconIds.size > 0) ||
    minifiedCount > 0;

  const viewBoxSync = syncSvgViewBoxes(scanFiles, viewBoxMap, false);

  if (
    renameMap.size === 0 &&
    symbolsToAdd.length === 0 &&
    unresolved.length === 0 &&
    minifiedCount === 0 &&
    !shouldReorderSprites &&
    viewBoxSync.syncedIcons.length === 0
  ) {
    console.log('\nAll referenced icons already match the iconpack and layout.');
    return;
  }

  if (shouldReorderSprites && reorder && symbolsToAdd.length === 0) {
    console.log('\nReorder sprites by size');
  }

  if (prune && unusedIconIds.size > 0 && !reorder && symbolsToAdd.length === 0) {
    console.log('\nPrune unused sprites');
  }

  if (viewBoxSync.syncedIcons.length > 0) {
    console.log(`\nWill sync viewBox for ${viewBoxSync.syncedIcons.length} icon(s):`);
    for (const iconId of viewBoxSync.syncedIcons.sort((a, b) =>
      a.localeCompare(b),
    )) {
      console.log(`  ${iconId} -> ${viewBoxMap.get(iconId).viewBox}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run: no changes written.');
    if (unresolved.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (renameMap.size > 0) {
    for (const file of scanFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const updated = replaceIconReferences(content, renameMap);
      if (updated !== content) {
        fs.writeFileSync(file, updated, 'utf8');
      }
    }
    console.log(`\nUpdated icon references in ${scanFiles.length} scanned file(s).`);
  }

  if (shouldReorderSprites) {
    for (const item of symbolsToAdd) {
      symbolMap.set(item.canonicalId, item.symbol);
    }
    layoutContent = rebuildSpriteSheet(layoutContent, symbolMap);
    fs.writeFileSync(LAYOUT, layoutContent, 'utf8');
    if (symbolsToAdd.length > 0) {
      console.log(`Added ${symbolsToAdd.length} symbol(s) to tpl/_mobileIcons.latte`);
    }
    if (prune && unusedIconIds.size > 0) {
      console.log(`Removed ${unusedIconIds.size} unused symbol(s) from tpl/_mobileIcons.latte`);
    }
    if (reorder) {
      console.log('Reordered sprites in tpl/_mobileIcons.latte by size');
    }
  }

  const appliedViewBoxSync = syncSvgViewBoxes(scanFiles, viewBoxMap, true);
  if (appliedViewBoxSync.syncedIcons.length > 0) {
    console.log(`\nSynced viewBox in ${appliedViewBoxSync.updatedFiles.length} file(s).`);
  }

  if (unresolved.length > 0) {
    process.exit(1);
  }
}

main();
