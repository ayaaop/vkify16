export function isModernMode() {
    return localStorage.getItem('tw.im.modern_mode') === '1';
}

export function isCompactMode(im) {
    const target = im ?? (typeof window !== 'undefined' ? window.im : undefined);
    if (target && target.state && typeof target.state.is_compact_mode_enabled !== 'undefined') {
        return target.state.is_compact_mode_enabled;
    }
    try {
        return localStorage.getItem('tw.im.modern_mode') === '1';
    } catch (e) {
        return false;
    }
}

let _imMod = null;

function getImMod() {
    if (_imMod !== null) {
        return _imMod;
    }
    const scripts = Array.from(document.querySelectorAll('script[src*="/js/messages/"]'));
    const candidate = scripts.find((s) => s.src && (s.src.includes('/js/messages/related.js') || s.src.includes('/js/messages/im.js')));
    let mod = '';
    if (candidate) {
        try {
            const url = new URL(candidate.src);
            mod = url.searchParams.get('mod') || '';
        } catch (e) {
        }
    }
    _imMod = mod;
    return _imMod;
}

export function imImport(relUrl) {
    const base = new URL('/assets/packages/static/openvk/js/messages/', location.href);
    const mod = getImMod();
    const url = new URL(relUrl + (mod ? `?mod=${mod}` : ''), base);
    return import(String(url));
}

export const BANNER_HIDE_FLAG = 'tw.im.hide_new_interface_banner';

export function shouldShowBanner(page = null, { checkForward = true } = {}) {
    try {
        if (checkForward && page && typeof page.isForward === 'function' && page.isForward()) {
            return false;
        }
    } catch (e) {
    }
    try {
        if (window.im && window.im.state && window.im.state.isFastchat) {
            return false;
        }
    } catch (e) {
    }
    try {
        if (localStorage.getItem(BANNER_HIDE_FLAG) === '1') {
            return false;
        }
    } catch (e) {
        return false;
    }
    return true;
}

export function dismissBanner(refreshFn) {
    try {
        localStorage.setItem(BANNER_HIDE_FLAG, '1');
    } catch (err) {
    }
    try {
        if (window.im && window.im.updateTabs) {
            window.im.updateTabs();
        }
    } catch (err) {
        console.error('vkify16 | updateTabs failed:', err);
    }
    try {
        if (typeof refreshFn === 'function') {
            refreshFn();
        }
    } catch (err) {
        console.error('vkify16 | banner dismiss refresh failed:', err);
    }
}

export function fallbackReplySnippet(msg) {
    try {
        if (!msg) return '';
        if (typeof msg.getText === 'function') return String(msg.getText(true) || '').slice(0, 120);
        if (msg.data && msg.data.text) return String(msg.data.text).slice(0, 120);
    } catch (e) {
    }
    return '';
}

export function fallbackEmojiHex(s) {
    try {
        const cp = Array.from(String(s || ''))[0];
        return cp ? cp.codePointAt(0).toString(16) : '';
    } catch (e) {
        return '';
    }
}

export function fallbackRecentSmiles() {
    return [];
}

export function fallbackRecentSmileClick() {
}

export function fallbackPeerAvatar({ html, className = '', onClick = null }) {
    return html`<img class="${className}" src="/assets/packages/static/openvk/img/camera_100.png" loading="lazy" onClick=${onClick} />`;
}

const VIDEO_PREVIEW_FALLBACK = '/assets/packages/static/openvk/img/camera_200.png';

export function ensureVideoPreviews(dayDividedChunks) {
    try {
        if (!dayDividedChunks || typeof dayDividedChunks.forEach !== 'function') {
            return;
        }
        dayDividedChunks.forEach((chunk) => {
            const list = chunk && chunk.messages;
            if (!list || typeof list.forEach !== 'function') {
                return;
            }
            list.forEach((msg) => {
                let atts = null;
                try {
                    atts = (msg && typeof msg.getAttachments === 'function') ? msg.getAttachments() : null;
                } catch (e) {
                    return;
                }
                if (!atts || typeof atts.forEach !== 'function') {
                    return;
                }
                atts.forEach((att) => {
                    try {
                        if (!att || att.type !== 'video' || !att.video) {
                            return;
                        }
                        if (!att.video.image || att.video.image.length === 0 || !att.video.image[0] || !att.video.image[0].url) {
                            att.video.image = [{ url: VIDEO_PREVIEW_FALLBACK }];
                        }
                    } catch (e) {
                    }
                });
            });
        });
    } catch (e) {
    }
}
