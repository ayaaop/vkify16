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

export function imImport(relUrl) {
    // Query-less URLs so we share upstream's module instances (its ?mod=
    // cache-buster would give us a second copy; patching a copy does nothing).
    const base = new URL('/assets/packages/static/openvk/js/messages/', location.href);
    return import(String(new URL(relUrl, base)));
}

// Safari resolves concurrent import() of a top-level-await module early/rejected
// (WebKit bug 242740), so no stock module may be imported before im.js finishes.
export function waitForStockIm() {
    return new Promise((resolve) => {
        if (window.im_class != null) {
            resolve(window.im_class);
            return;
        }
        let value;
        Object.defineProperty(window, 'im_class', {
            configurable: true,
            enumerable: true,
            get() {
                return value;
            },
            set(v) {
                Object.defineProperty(window, 'im_class', { value: v, writable: true, configurable: true, enumerable: true });
                resolve(v);
            },
        });
    });
}

export const BANNER_HIDE_FLAG = 'tw.im.hide_new_interface_banner';

// Keeps `no-scroll` on <body> exactly while a chat page is open (upstream
// dropped this); idempotent, safe to call from any render path.
export function syncBodyNoScroll() {
    try {
        const im = (typeof window !== 'undefined') ? window.im : null;
        const messenger = im && im.messenger;
        let inChat = false;
        if (messenger && im && typeof im.getSelectedTab === 'function') {
            const tab = im.getSelectedTab();
            const tabId = tab && typeof tab.getPageId === 'function' ? tab.getPageId() : '';
            inChat = tabId === 'messenger'
                && !!(messenger.getCurrentChat && messenger.getCurrentChat());
        }
        document.body.classList.toggle('no-scroll', inChat);
    } catch (e) {
        try {
            document.body.classList.remove('no-scroll');
        } catch (_) {
        }
    }
}
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
        if (typeof msg.getText === 'function') return String(msg.getText(true, true) || '').slice(0, 120);
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
    return html`<img class="${className}" src="/assets/packages/static/openvk/img/im/chat_default_100.png" loading="lazy" onClick=${onClick} />`;
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

// Upstream month_day_string() throws on PHP-style locales like "en_US.UTF-8"
// and takes the render down; reimplement the day divider via Intl instead.
export function patchMonthDayString() {
    const toBcp47 = (raw) => {
        const tag = String(raw || '').split(';')[0].split('.')[0].split('@')[0].replace(/_/g, '-');
        if (!tag) return null;
        try {
            new Intl.DateTimeFormat(tag);
            return tag;
        } catch (e) {
            return null;
        }
    };
    window.month_day_string = function (date) {
        try {
            if (!(date instanceof Date) || isNaN(date.getTime())) {
                return '';
            }
            const ovk = window.openvk || {};
            const locale = toBcp47(ovk.locale) || toBcp47(ovk.lang) || undefined;
            const options = date.getFullYear() === new Date().getFullYear()
                ? { day: 'numeric', month: 'long' }
                : { day: 'numeric', month: 'long', year: 'numeric' };
            return date.toLocaleDateString(locale, options);
        } catch (e) {
            return '';
        }
    };
}
