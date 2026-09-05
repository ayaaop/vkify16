import { shouldShowBanner as upstreamShouldShowBanner, dismissBanner } from '../shared.js';

let installed = false;
let bannerRenderer = null;
let observer = null;
let observedTarget = null;

const PLACEHOLDER_CLASS = 'im-compact-placeholder';
const BANNER_SLOT_CLASS = 'im-compact-placeholder--banner';
const FALLBACK_TEXT = 'Select a peer to view the chat history';

function shouldShowBanner() {
    return upstreamShouldShowBanner(null, { checkForward: false });
}

function handleDismissBanner(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    dismissBanner(update);
}

function resolveLabel() {
    try {
        if (typeof window.tr === 'function') {
            const v = window.tr('select_peer_to_view_history');
            if (v && v !== 'select_peer_to_view_history') {
                return v;
            }
        }
    } catch (e) {
    }
    return FALLBACK_TEXT;
}

function isCompactRoot() {
    const root = document.querySelector('#im_container');
    return root && root.classList.contains('compact') ? root : null;
}

function hasVisibleChat(containers) {
    return !!containers.querySelector(
        '.im_page.page-other:not(.' + PLACEHOLDER_CLASS + '):not(.hidden)'
    );
}

function renderBanner(ph) {
    const slot = ph.querySelector('.' + BANNER_SLOT_CLASS);
    if (!slot) {
        return;
    }
    const { html, render, commonMod } = bannerRenderer || {};
    const Banner = commonMod && commonMod.MessagesNewInterfaceBanner;
    if (!html || !render || !Banner || !shouldShowBanner()) {
        try {
            render ? render(null, slot) : (slot.innerHTML = '');
        } catch (e) {
            slot.innerHTML = '';
        }
        return;
    }
    try {
        render(html`<${Banner} onClose=${handleDismissBanner} />`, slot);
    } catch (e) {
        console.error('vkify16 | compact placeholder banner failed:', e);
    }
}

function ensurePlaceholder(containers, show) {
    let ph = containers.querySelector('.' + PLACEHOLDER_CLASS);
    if (!show) {
        if (ph) {
            ph.classList.add('hidden');
        }
        return;
    }
    if (!ph) {
        ph = document.createElement('div');
        ph.className = 'im_page page-other ' + PLACEHOLDER_CLASS;
        const bannerSlot = document.createElement('div');
        bannerSlot.className = BANNER_SLOT_CLASS;
        ph.appendChild(bannerSlot);
        const inner = document.createElement('div');
        inner.className = PLACEHOLDER_CLASS + '--inner';
        inner.textContent = resolveLabel();
        ph.appendChild(inner);
        containers.appendChild(ph);
    } else {
        const inner = ph.querySelector('.' + PLACEHOLDER_CLASS + '--inner');
        if (inner && !inner.textContent) {
            inner.textContent = resolveLabel();
        }
        if (!ph.querySelector('.' + BANNER_SLOT_CLASS)) {
            const bannerSlot = document.createElement('div');
            bannerSlot.className = BANNER_SLOT_CLASS;
            ph.insertAdjacentElement('afterbegin', bannerSlot);
        }
        ph.classList.remove('hidden');
    }
    renderBanner(ph);
}

function update() {
    const root = isCompactRoot();
    if (!root) {
        const stale = document.querySelector('#im_page_containers .' + PLACEHOLDER_CLASS);
        if (stale) {
            stale.classList.add('hidden');
        }
        return;
    }
    const containers = root.querySelector('#im_page_containers');
    if (!containers) {
        return;
    }
    ensurePlaceholder(containers, !hasVisibleChat(containers));
}

export function installCompactPlaceholder(opts = {}) {
    if (opts && opts.html && opts.render && opts.commonMod) {
        bannerRenderer = opts;
        if (installed) {
            try {
                update();
            } catch (e) {
                console.error('vkify16 | compact placeholder update failed:', e);
            }
        }
    }
    if (installed) {
        update();
        return;
    }
    installed = true;

    let scheduled = false;
    const schedule = () => {
        if (scheduled) {
            return;
        }
        scheduled = true;
        const run = () => {
            scheduled = false;
            try {
                update();
            } catch (e) {
                console.error('vkify16 | compact placeholder update failed:', e);
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(run);
        } else {
            setTimeout(run, 0);
        }
    };

    observer = new MutationObserver(schedule);
    retargetObserver(observer);
    observeImRoot(observer);

    schedule();
}

function observeImRoot(obs) {
    const containers = document.querySelector('#im_page_containers');
    const target = containers || document.documentElement;
    if (observedTarget === target) {
        return;
    }
    try {
        if (observedTarget) {
            obs.disconnect();
        }
    } catch (e) {
    }
    observedTarget = target;
    obs.observe(target, containers
        ? { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }
        : { childList: true, subtree: true });
}

function retargetObserver(obs) {
    const retarget = () => {
        try {
            if (!document.querySelector('#im_page_containers')) {
                setTimeout(retarget, 1000);
                return;
            }
            observeImRoot(obs);
        } catch (e) {
        }
    };
    if (!document.querySelector('#im_page_containers')) {
        setTimeout(retarget, 1000);
    }
}
