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
    // Plain (query-less) URLs so we land on the same module instances as
    // upstream: its internal es6import_Im() resolves relative to import.meta
    // (query is dropped), and the chandler {script}/{script_module} ?mod=
    // cache-buster would otherwise give us a second copy of every module
    // (notably preact.mjs's shared `options`). Patching a copy's prototype
    // leaves the live upstream classes untouched, i.e. stock renders.
    const base = new URL('/assets/packages/static/openvk/js/messages/', location.href);
    return import(String(new URL(relUrl, base)));
}

export const BANNER_HIDE_FLAG = 'tw.im.hide_new_interface_banner';

// Restores the old upstream behaviour (dropped when upstream moved to an
// internally-scrolling chat): `no-scroll` is present on <body> exactly while
// a chat page (history + input visible) is open, and removed the moment the
// user leaves it. Idempotent; safe to call from every render path.
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

// Upstream month_day_string() feeds window.openvk.locale (a PHP-style locale
// like "en_US.UTF-8") straight into toLocaleDateString whenever the active
// locale has no day_template string - which is every locale except ru -
// throwing RangeError and taking the whole messenger render down with it.
// Reimplement the day-divider label on top of Intl directly: localized
// "12 September" / "12 September 2020" in every language, correct month case
// and order for free, and no dependence on tr keys upstream may not ship.
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
