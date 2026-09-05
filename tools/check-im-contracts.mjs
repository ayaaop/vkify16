// Checks that the messenger override still preserves the selector contracts
// stock IM handlers query (see .devin/adapting_messages.md "Selectors we have
// to keep"). Run after `node build.mjs`: `node tools/check-im-contracts.mjs`.
// Exits non-zero listing any missing contract.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(__dirname, '..', 'res', 'js', 'dist', 'vkify16.bundle.js');

const contracts = [
    '#write',
    'small-textarea',
    'content-editable',
    'messenger-app--input---messagebox',
    'post-horizontal',
    'post-vertical',
    'emoji_picker_entrypoint',
    'post-buttons',
    'messenger-app-end',
    'm-mountain',
    'im-to-end',
    'messenger-app--header-wrap',
    'messages--peers-header-wrap',
    'im-new-interface-banner',
    'im-compact-placeholder',
];

let src;
try {
    src = fs.readFileSync(bundle, 'utf8');
} catch (e) {
    console.error(`[im-contracts] Bundle not found at ${bundle}. Run \`node build.mjs\` first.`);
    process.exit(2);
}

const missing = contracts.filter((s) => !src.includes(s));
if (missing.length > 0) {
    console.error(`[im-contracts] FAIL: missing selector contracts in bundle:\n  - ${missing.join('\n  - ')}`);
    process.exit(1);
}
console.log(`[im-contracts] OK: ${contracts.length} selector contracts present.`);
