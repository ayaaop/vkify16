/**
 * Dismissable onboarding popups (Tippy-backed) and shared helpers for the
 * remaining Tippy consumers (tooltips-simple.js, notifications-popup.js,
 * music-popup.js). Declarative interactive action menus used to live here
 * too, but they're now handled by action-menu.js (see that file for why:
 * Tippy's DOM relocation vs. document stacking order trade-off couldn't be
 * solved in a way that didn't either break stock OpenVK's `.closest()`-based
 * JS or turn into an unbounded z-index/isolation bookkeeping exercise).
 */

function getTippyZIndex(triggerElement) {
    return triggerElement?.closest('.ovk-msg-all, .sidebar') ? 9999 : 99;
}

const dismissablePopupInstances = new Map();
const dismissableShownThisSession = new Set();
const POPUP_COOKIE_PREFIX = 'vkify_popup_';
const POPUP_LOCAL_PREFIX = 'vkify_popup_shown_';

function isPopupDismissed(id) {
    return vkify.getCookie(POPUP_COOKIE_PREFIX + id) === '1';
}

function setPopupDismissed(id, days) {
    vkify.setCookie(POPUP_COOKIE_PREFIX + id, '1', days || 365);
}

function clearPopupDismissed(id) {
    vkify.setCookie(POPUP_COOKIE_PREFIX + id, '', -1);
}

function isPopupShownThisSession(id) {
    return dismissableShownThisSession.has(id) || localStorage.getItem(POPUP_LOCAL_PREFIX + id) === '1';
}

function markPopupShownThisSession(id) {
    dismissableShownThisSession.add(id);
    try { localStorage.setItem(POPUP_LOCAL_PREFIX + id, '1'); } catch (e) {}
}

function clearPopupSessionState(id) {
    dismissableShownThisSession.delete(id);
    try { localStorage.removeItem(POPUP_LOCAL_PREFIX + id); } catch (e) {}
}

function createDismissablePopup(options) {
    const {
        trigger,
        content,
        id,
        placement = 'bottom-end',
        theme = 'light vk dismissable',
        offset = [0, 8],
        closeSelector = '.popup-close',
        persistDismiss = false,
        persistDays = 365,
        autoShow = true,
        hideOnTriggerClick = true,
        onShow = null,
        onHide = null,
        onDismiss = null
    } = options;

    if (!trigger || !content) {
        console.warn('[DismissablePopup] trigger and content required');
        return null;
    }

    const triggerEl = typeof trigger === 'string' ? ge(trigger) : trigger;
    if (!triggerEl) {
        console.warn('[DismissablePopup] trigger element not found');
        return null;
    }

    let contentEl;
    if (typeof content === 'string') {
        const template = ge(content);
        if (template) {
            contentEl = template.cloneNode(true);
            contentEl.style.display = '';
            contentEl.removeAttribute('id');
        } else {
            const div = document.createElement('div');
            div.innerHTML = content;
            contentEl = div;
        }
    } else {
        contentEl = content.cloneNode(true);
        contentEl.style.display = '';
    }

    if (!contentEl) {
        console.warn('[DismissablePopup] content not found');
        return null;
    }

    if (id && dismissablePopupInstances.has(id)) {
        return dismissablePopupInstances.get(id);
    }

    if (persistDismiss && id && isPopupDismissed(id)) {
        return null;
    }

    if (id && isPopupShownThisSession(id)) {
        return null;
    }

    const anchor = document.createElement('div');
    anchor.style.cssText = 'position:fixed;pointer-events:none;';
    document.body.appendChild(anchor);

    function updateAnchorPosition() {
        const rect = triggerEl.getBoundingClientRect();
        anchor.style.left = rect.left + 'px';
        anchor.style.top = rect.top + 'px';
        anchor.style.width = rect.width + 'px';
        anchor.style.height = rect.height + 'px';
    }
    updateAnchorPosition();

    const instance = {
        id,
        triggerEl,
        contentEl,
        tippyInstance: null,
        options,
        dismissed: false,

        show() {
            this.tippyInstance?.show();
        },

        hide() {
            this.tippyInstance?.hide();
        },

        dismiss() {
            if (this.dismissed) return;
            this.dismissed = true;
            this.tippyInstance?.destroy();
            this.tippyInstance = null;
            anchor.remove();
            if (id) {
                markPopupShownThisSession(id);
                if (persistDismiss) setPopupDismissed(id, persistDays);
                dismissablePopupInstances.delete(id);
            }
            onDismiss?.();
        },

        destroy() {
            this.tippyInstance?.destroy();
            this.tippyInstance = null;
            anchor.remove();
            if (id && dismissablePopupInstances.has(id)) {
                dismissablePopupInstances.delete(id);
            }
        },

        reset() {
            if (id) {
                clearPopupDismissed(id);
                clearPopupSessionState(id);
            }
            this.dismissed = false;
        }
    };

    instance.tippyInstance = tippy(anchor, {
        theme,
        placement,
        trigger: 'manual',
        interactive: true,
        hideOnClick: false,
        appendTo: document.body,
        content: contentEl,
        offset,
        zIndex: getTippyZIndex(triggerEl),
        showOnCreate: autoShow,
        onShow(tippyInst) {
            const closeBtn = tippyInst.popper.querySelector(closeSelector);
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.preventDefault();
                    instance.dismiss();
                };
            }
            onShow?.(instance);
        },
        onHide() {
            onHide?.(instance);
        }
    });

    if (hideOnTriggerClick) {
        triggerEl.addEventListener('click', () => {
            if (instance.tippyInstance?.state.isVisible && !instance.dismissed) {
                instance.dismiss();
            }
        });
    }

    if (id) {
        dismissablePopupInstances.set(id, instance);
    }

    return instance;
}

function getDismissablePopup(id) {
    return dismissablePopupInstances.get(id) || null;
}

function dismissAllPopups() {
    dismissablePopupInstances.forEach(inst => inst.dismiss());
}

function discoverDismissablePopups(container = document) {
    const triggers = container.querySelectorAll('[data-dismissable-popup]');
    triggers.forEach(trigger => {
        const contentId = trigger.getAttribute('data-dismissable-popup');
        const id = trigger.getAttribute('data-popup-id') || contentId;
        if (dismissablePopupInstances.has(id)) return;

        createDismissablePopup({
            trigger,
            content: contentId,
            id,
            placement: trigger.getAttribute('data-popup-placement') || 'bottom-end',
            theme: trigger.getAttribute('data-popup-theme') || 'light vk dismissable',
            closeSelector: trigger.getAttribute('data-popup-close') || '.popup-close',
            persistDismiss: trigger.hasAttribute('data-popup-persist'),
            autoShow: !trigger.hasAttribute('data-popup-manual'),
            hideOnTriggerClick: !trigger.hasAttribute('data-popup-no-trigger-hide')
        });
    });
}

window.DismissablePopup = {
    create: createDismissablePopup,
    get: getDismissablePopup,
    dismissAll: dismissAllPopups,
    discover: discoverDismissablePopups,
    isDismissed: isPopupDismissed,
    clearDismissed: clearPopupDismissed,
    isShownThisSession: isPopupShownThisSession,
    clearSessionState: clearPopupSessionState
};

vkify.onPageLifecycle('afterPageReady', ({ container = document }) => {
    discoverDismissablePopups(container);
}, 'after');

vkify.ready(() => {
    discoverDismissablePopups(document);
});

document.addEventListener('click', (event) => {
    if (event.target.closest('.tippy-content .top_notify_show_all')) {
        tippy.hideAll({ duration: 0 });
        return;
    }

    const link = event.target.closest('a');
    if (!link) return;

    const tooltipBox = link.closest('.tippy-box');
    if (!tooltipBox) return;

    const themeTokens = (tooltipBox.dataset.theme?.trim() ?? '').split(/\s+/);
    const persistentThemes = ['musicpopup', 'dismissable'];
    if (!persistentThemes.some(t => themeTokens.includes(t))) {
        tippy.hideAll({ duration: 0.25 });
    }
}, true);
