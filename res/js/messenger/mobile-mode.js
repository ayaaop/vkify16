export const MOBILE_MAX_WIDTH = 770;
export const COMPACT_FLAG = 'tw.im.modern_mode';
export const FORCE_CLASSIC_BODY_CLASS = 'vkify-force-classic';
const MODERN_TWEAK_NAME = 'im.modern_mode';

export function isMobileViewport() {
    try {
        return typeof window !== 'undefined'
            && typeof window.innerWidth === 'number'
            && window.innerWidth < MOBILE_MAX_WIDTH;
    } catch (e) {
        return false;
    }
}

function markForced() {
    try {
        if (document && document.body) {
            document.body.classList.add(FORCE_CLASSIC_BODY_CLASS);
        }
    } catch (e) {
    }
}

function unmarkForced() {
    try {
        if (document && document.body) {
            document.body.classList.remove(FORCE_CLASSIC_BODY_CLASS);
        }
    } catch (e) {
    }
}

export function forceClassicModeOnMobile() {
    if (!isMobileViewport()) {
        return false;
    }
    try {
        localStorage.setItem(COMPACT_FLAG, '0');
    } catch (e) {
        unmarkForced();
        return false;
    }
    markForced();
    return true;
}

let vvWatcherInstalled = false;

// Publishes visual-viewport metrics on :root so mobile IM heights track the
// on-screen keyboard where only the visual viewport shrinks (Chromium is
// already covered by interactive-widget=resizes-content).
export function watchImVisualViewport() {
    if (vvWatcherInstalled) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    vvWatcherInstalled = true;

    let nearBottom = true;
    const scrollerOf = (el) => el && el.matches && el.matches('.im_page.page-other:not(.hidden)');
    document.addEventListener('scroll', (e) => {
        if (scrollerOf(e.target)) {
            nearBottom = e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 48;
        }
    }, true);

    const apply = () => {
        const root = document.documentElement;
        const onIm = Boolean(document.body && document.body.classList.contains('body_im'));
        if (root && onIm && isMobileViewport()) {
            const scroller = document.querySelector('.im_page.page-other:not(.hidden)');
            const stickToBottom = scroller && (nearBottom
                || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 48);
            root.style.setProperty('--ovk-vv-height', vv.height + 'px');
            root.style.setProperty('--ovk-vv-top', vv.offsetTop + 'px');
            if (stickToBottom) {
                requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
            }
        } else if (root) {
            root.style.removeProperty('--ovk-vv-height');
            root.style.removeProperty('--ovk-vv-top');
        }
    };

    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.vkify?.onPageLifecycle?.('afterPageReady', apply);
    window.vkify?.onPageLifecycle?.('beforePageLeave', apply);
    apply();
}

export function watchModernModeTweak() {
    let observer = null;
    try {
        if (typeof MutationObserver === 'undefined') {
            return null;
        }
        observer = new MutationObserver(() => hideModernModeTweakRow());
        const root = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement : null;
        if (!root) {
            return null;
        }
        observer.observe(root, { childList: true, subtree: true });
    } catch (e) {
        return null;
    }
    try {
        hideModernModeTweakRow();
    } catch (e) {
    }
    return observer;
}

export function hideModernModeTweakRow(scope) {
    try {
        const root = scope || (typeof document !== 'undefined' ? document : null);
        if (!root || !root.getElementById) {
            return false;
        }
        const body = root.body || (typeof document !== 'undefined' ? document.body : null);
        if (!body || !body.classList || !body.classList.contains(FORCE_CLASSIC_BODY_CLASS)) {
            return false;
        }
        const slot = root.getElementById('plugin_settings');
        if (!slot || typeof slot.querySelectorAll !== 'function') {
            return false;
        }
        let hidden = false;
        slot.querySelectorAll('label').forEach((label) => {
            try {
                const name = label.querySelector('span');
                if (name && name.textContent === MODERN_TWEAK_NAME) {
                    label.style.display = 'none';
                    hidden = true;
                }
            } catch (e) {
            }
        });
        return hidden;
    } catch (e) {
        return false;
    }
}
