(function () {
'use strict';

if (!window.vkifyTextareaAutosize) {
    window.vkifyTextareaAutosize = {};
}

if (window.vkifyTextareaAutosize.__initialized) return;
window.vkifyTextareaAutosize.__initialized = true;

const BOOST = 5;
const MOBILE_MAX_TOTAL = 120;

function toPx(value) {
    const n = parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
}

function getMaxTotal(el, isBorderBox, paddingY, borderY) {
    const raw = window.getComputedStyle(el).maxHeight;
    let max = (raw === 'none' || raw === '') ? Infinity : toPx(raw);
    if (max === 0) {
        max = Infinity;
    }

    if (max === Infinity && window.isMobile && window.isMobile()) {
        max = MOBILE_MAX_TOTAL;
    }

    if (max === Infinity) {
        return Infinity;
    }

    return isBorderBox ? max : max + paddingY + borderY;
}

function applyAutosize(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    if (el.hasAttribute('data-no-autosize')) return;

    const cs = window.getComputedStyle(el);
    if (cs.display === 'none') return;

    const isBorderBox = cs.boxSizing === 'border-box';
    const paddingY = toPx(cs.paddingTop) + toPx(cs.paddingBottom);
    const borderY = toPx(cs.borderTopWidth) + toPx(cs.borderBottomWidth);
    const maxTotal = getMaxTotal(el, isBorderBox, paddingY, borderY);

    const currentTotal = el.clientHeight + borderY;
    const scrollTotal = el.scrollHeight + borderY;

    if (scrollTotal <= currentTotal + BOOST) {
        const visibleTotal = el.clientHeight + borderY;
        if (el.style.overflowY === 'auto' && visibleTotal >= scrollTotal) {
            el.style.overflowY = 'hidden';
        }
        return;
    }

    let neededTotal = scrollTotal + BOOST;

    if (maxTotal !== Infinity && neededTotal > maxTotal) {
        neededTotal = maxTotal;
    }

    const newHeight = isBorderBox
        ? neededTotal
        : neededTotal - paddingY - borderY;

    // !important so the inline height beats stylesheet rules like stock's
    // .expanded-textarea { height: auto !important } that would clamp it.
    el.style.setProperty('height', Math.max(newHeight, 0) + 'px', 'important');

    // If the height could not actually grow (e.g. an !important CSS rule),
    // keep the scrollbar so content remains reachable.
    const visibleTotal = el.clientHeight + borderY;
    el.style.overflowY = visibleTotal < scrollTotal ? 'auto' : 'hidden';
}

function initAll(container) {
    const root = container && container.querySelectorAll ? container : document;
    root.querySelectorAll('textarea').forEach(function (ta) {
        applyAutosize(ta);
    });
}

window.vkifyTextareaAutosize.apply = applyAutosize;
window.vkifyTextareaAutosize.initAll = initAll;

const bindInputHandlerOnce = () => {
    if (window.vkifyTextareaAutosize.__inputBound) return;
    window.vkifyTextareaAutosize.__inputBound = true;

    document.addEventListener('input', function (e) {
        if (e.target && e.target.tagName === 'TEXTAREA') {
            applyAutosize(e.target);
        }
    });
};

vkify.onPageLifecycle('afterPageReady', ({ container = document }) => {
    bindInputHandlerOnce();
    initAll(container);
}, 'after');

vkify.ready(() => {
    bindInputHandlerOnce();
    initAll(document);
});

})();
