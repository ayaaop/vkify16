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
