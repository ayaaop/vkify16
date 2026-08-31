(function () {
'use strict';

if (!vkify.simpleTooltips) {
    vkify.simpleTooltips = {};
}

vkify.once('simpleTooltips', () => {

    function getPlacement(element) {
        const align = element.getAttribute('data-align');
        if (align === 'top-center') return 'top';
        if (align === 'bottom-center') return 'bottom';
        return align || vkify.getOptimalPlacement(element);
    }

    function getDelayMs(element) {
        const raw = element.getAttribute('data-delay');
        if (raw == null || raw === '') return 50;
        const seconds = parseFloat(raw);
        if (!Number.isFinite(seconds) || seconds < 0) return 50;
        return Math.round(seconds * 1000);
    }

    function getOffset(element) {
        const raw = element.getAttribute('data-tipoffset');
        if (!raw) return [2, 4];
        const parts = raw.split(',').map(p => parseFloat((p || '').trim()));
        if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return [2, 4];
        return [parts[0], parts[1]];
    }

    function getAppendTo(element) {
        const fs = document.fullscreenElement;
        return fs || document.body;
    }

    function getBoundary(element) {
        return element.closest('[data-tip-boundary]') || 'clippingParents';
    }

    function getTheme(element) {
        const extra = element.getAttribute('data-tiptheme');
        return extra ? ('special vk small ' + extra) : 'special vk small';
    }

    function initializeSimpleTooltips(container = document) {
        const root = container && container.querySelectorAll ? container : document;
        const elements = Array.from(root.querySelectorAll('[data-tip="simple-black"]'));
        if (root !== document && root.matches && root.matches('[data-tip="simple-black"]')) {
            elements.unshift(root);
        }
        elements.forEach(element => {
            if (element._tippy || element.hasAttribute('aria-describedby') || element.dataset.vkifySimpleTipInit === '1') {
                return;
            }

            const title = element.getAttribute('data-tiptitle');
            if (!title || title.trim() === '') {
                return;
            }

            const placement = getPlacement(element);
            const delayMs = getDelayMs(element);
            const theme = getTheme(element);
            const offset = getOffset(element);
            const boundary = getBoundary(element);
            const zIndex = element.closest('.ovk-msg-all') ? 9999 : 99;

            element.dataset.vkifySimpleTipInit = '1';
            tippy(element, {
                content: title,
                theme: theme,
                placement: placement,
                animation: 'fade',
                duration: [100, 100],
                delay: [delayMs, 0],
                offset: offset,
                zIndex: zIndex,
                appendTo: () => getAppendTo(element),
                popperOptions: {
                    strategy: 'fixed',
                    modifiers: boundary ? [
                        { name: 'preventOverflow', options: { boundary: boundary, padding: 4 } },
                    ] : [],
                },
            });
        });
    }

    vkify.simpleTooltips.init = initializeSimpleTooltips;

    const bindObserverOnce = () => {
        if (vkify.simpleTooltips.observerBound) return;
        vkify.simpleTooltips.observerBound = true;

        vkify.observeDOM((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        initializeSimpleTooltips(node);
                    }
                }
            }
        }, {
            filter: m => m.type === 'childList' && m.addedNodes.length > 0
        });
    };

    vkify.onPageLifecycle('afterPageReady', ({ pageBody, container = document }) => {
        bindObserverOnce();
        initializeSimpleTooltips(pageBody || container);
    }, 'after');

    vkify.ready(() => {
        bindObserverOnce();
        initializeSimpleTooltips(document);
    });
});

})();
