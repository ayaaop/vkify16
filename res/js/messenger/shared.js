export const messengerPatch = {
    peerTabs: null,
};

// Plain (query-less) URLs so we land on the same module instances as
// upstream's static imports — notably preact.mjs's shared `options`.
export function imImport(relUrl) {
    const base = new URL('/assets/packages/static/openvk/js/messages/', location.href);
    return import(String(new URL(relUrl, base)));
}
