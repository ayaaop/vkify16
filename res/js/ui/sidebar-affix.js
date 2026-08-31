(function () {
'use strict';

vkify.once("updateNarrow", () => {
    let __narrowBar = { bar: null, barBlock: null, wideCol: null, pl: null };

    function getNarrowRefs() {
        if (!__narrowBar.bar || !__narrowBar.bar.isConnected) {
            const bar = document.querySelector('.narrow_column');
            __narrowBar = {
                bar: bar,
                barBlock: bar ? bar.querySelector('.page_block') : null,
                wideCol: document.querySelector('.wide_column'),
                pl: document.querySelector('.layout')
            };
        }
        return __narrowBar;
    }

    window.updateNarrow = function () {
        if (window.isMobile && window.isMobile()) return;

        const { bar, barBlock, wideCol, pl } = getNarrowRefs();
        if (!bar || !barBlock || !wideCol || !pl) return;
        if (document.querySelector('#ajloader.shown')) return;
        if (document.body.classList.contains('dimmed')) return;

        const doc = document.documentElement;
        const wh = Math.round(window.lastWindowHeight || window.innerHeight || 0);
        const st = Math.round(window.scrollY || 0);
        const headH = 57;
        const delta = 1;

        const isFixed = bar.classList.contains('fixed');
        const barMT = parseFloat(window.getComputedStyle(barBlock).marginTop) || 0;
        const barH = Math.round(bar.offsetHeight) - (isFixed ? barMT : 0);
        const pageH = Math.round(wideCol.offsetHeight);
        const pagePos = Math.round(wideCol.getBoundingClientRect().top + st);
        const tooBig = barH >= pageH - barMT;

        const barMB = barMT;
        const barBottom = st + wh - pageH - pagePos - barMB;
        const barPB = Math.max(0, barBottom);
        const barPT = pagePos - headH;
        const barPos = Math.round(bar.getBoundingClientRect().top + st) + (isFixed ? barMT : 0);

        const lastSt = window._lastSt || 0;
        const lastStyles = window._lastStyles || {};
        let styles = {};
        let needFix = false;

        const smallEnough = headH + barMB + barH + barMT + barPB <= wh;

        const scrollLeft = (document.body.scrollLeft || doc.scrollLeft || window.scrollX || 0);
        const layoutW = Math.round(pl.offsetWidth);
        const bodyW = Math.round(document.body.clientWidth);
        const marginLeft = Math.round(Math.min(-scrollLeft, Math.max(-scrollLeft, bodyW - layoutW)));

        const toPx = (value) => Math.round(value) + 'px';

        if (st - delta < barPT && !(smallEnough && barPos < headH + barMT) || tooBig) {
            styles = { marginTop: '0px' };
            needFix = false;
        } else if (st - delta < Math.min(lastSt, barPos - headH - barMT) || smallEnough) {
            styles = { top: toPx(headH), marginLeft: toPx(marginLeft) };
            needFix = true;
        } else if (st + delta > Math.max(lastSt, barPos + barH + barMB - wh) && barBottom < 0) {
            styles = { bottom: toPx(barMB), marginLeft: toPx(marginLeft) };
            needFix = true;
        } else {
            const marginTopValue = (barBottom >= 0)
                ? (pageH - barH)
                : Math.min(barPos - pagePos, pageH - barH + (pagePos - headH));
            styles = { marginTop: toPx(marginTopValue) };
        }

        const allKeys = ['top', 'bottom', 'marginTop', 'marginLeft'];
        const same = allKeys.every((key) => (styles[key] || '') === (lastStyles[key] || ''));
        if (!same) {
            for (let i = 0; i < allKeys.length; i++) {
                bar.style[allKeys[i]] = styles[allKeys[i]] || '';
            }
            window._lastStyles = styles;
        }

        if (needFix !== isFixed) {
            bar.classList.toggle('fixed', needFix);
        }

        window._lastSt = st;
    };
});

vkify.once('affixedNavigation', () => {
    const HEAD_H = 57;
    const SCROLL_TOLERANCE = 4;

    let state = null;

    function getMenu() {
        return document.querySelector('.sidebar > .sidebar_inner');
    }

    function getPageBody() {
        return document.querySelector('.page_body');
    }

    function getScrollTop() {
        return window.scrollY || 0;
    }

    function getDocumentTop(el) {
        const rect = el.getBoundingClientRect();
        return rect.top + window.scrollY;
    }

    function setStyles(el, styles) {
        el.style.position = styles.position || '';
        el.style.top = styles.top != null ? styles.top + 'px' : '';
        el.style.width = styles.width != null ? styles.width + 'px' : '';
        el.style.marginTop = styles.marginTop != null ? styles.marginTop + 'px' : '';
    }

    function resetMenu(menu) {
        setStyles(menu, {
            position: 'relative',
            top: null,
            width: null,
            marginTop: null
        });
    }

    function affixMenu(menu, hiddenOffset) {
        setStyles(menu, {
            position: 'fixed',
            top: HEAD_H - hiddenOffset,
            width: state.anchor.offsetWidth,
            marginTop: null
        });
    }

    function updateLeftMenu() {
        const menu = getMenu();
        const pageBody = getPageBody();
        if (!menu || !pageBody || !state) {
            return;
        }

        if (window.isMobile && window.isMobile()) {
            resetMenu(menu);
            return;
        }

        if (menu.querySelector('#fastLogin')) {
            resetMenu(menu);
            return;
        }

        const scrollTop = getScrollTop();
        const menuHeight = menu.offsetHeight;
        const pageHeight = pageBody.offsetHeight;

        if (menuHeight >= pageHeight) {
            resetMenu(menu);
            state.lastScrollTop = scrollTop;
            state.hiddenOffset = 0;
            return;
        }

        const shouldAffix = scrollTop > state.initialTop - HEAD_H;
        const delta = scrollTop - state.lastScrollTop;
        const maxHiddenOffset = Math.max(0, menuHeight + HEAD_H);

        if (!shouldAffix) {
            resetMenu(menu);
            state.hiddenOffset = 0;
        } else {
            if (Math.abs(delta) >= SCROLL_TOLERANCE) {
                state.hiddenOffset = Math.max(0, Math.min(maxHiddenOffset, state.hiddenOffset + delta));
            }

            affixMenu(menu, state.hiddenOffset);
        }

        state.lastScrollTop = scrollTop;
    }

    function init() {
        const menu = getMenu();
        const anchor = menu ? menu.parentElement : null;
        if (!menu || !anchor) {
            state = null;
            return;
        }

        const scrollTop = getScrollTop();
        const previousState = state;
        const preserveOffset = previousState && previousState.anchor === anchor;
        const hiddenOffset = preserveOffset ? previousState.hiddenOffset : 0;
        const lastScrollTop = preserveOffset ? previousState.lastScrollTop : scrollTop;

        if (!preserveOffset) {
            resetMenu(menu);
        }

        state = {
            anchor: anchor,
            initialTop: getDocumentTop(anchor),
            hiddenOffset: hiddenOffset,
            lastScrollTop: lastScrollTop
        };

        updateLeftMenu();
    }

    window.updateLeftMenu = updateLeftMenu;
    window.updateLeftMenuInit = init;
});

vkify.once('bodyScroll', () => {
    let __scrLeft = 0;
    let __toTopEl = null;
    let __lastHidden = null;
    let __lastHasDown = null;
    let __lastScrolled = null;
    let __lastInactive = null;
    let __lastWidth = null;
    let __lastOpacity = null;

    window.updSideTopLink = function (resized) {
        const toTop = document.querySelector('.toTop');
        if (!toTop) {
            __toTopEl = null;
            return;
        }
        if (window.isMobile && window.isMobile()) return;

        const toTopChanged = toTop !== __toTopEl;
        __toTopEl = toTop;

        const doc = document.documentElement;
        const body = document.body;
        const st = window.scrollY || 0;
        const scl = body.scrollLeft || doc.scrollLeft || window.scrollX || 0;
        const mx = 200;

        if (resized || scl !== __scrLeft) {
            const layout = document.querySelector('.layout');
            const width = layout ? Math.max(Math.round(layout.getBoundingClientRect().left), 114) : 114;
            if (width !== __lastWidth) {
                doc.style.setProperty('--to-top-width', width + 'px');
                __lastWidth = width;
            }
            __scrLeft = scl;
        }

        const hidden = st < 100 && !window.temp_y_scroll;
        const hasDown = st < 100 && !!window.temp_y_scroll;
        const scrolled = st >= 100;

        if (toTopChanged || hidden !== __lastHidden) {
            toTop.classList.toggle('hidden', hidden);
            __lastHidden = hidden;
        }
        if (toTopChanged || hasDown !== __lastHasDown) {
            toTop.classList.toggle('has_down', hasDown);
            __lastHasDown = hasDown;
        }
        if (scrolled !== __lastScrolled) {
            body.classList.toggle('scrolled', scrolled);
            __lastScrolled = scrolled;
        }

        const opacity = Math.min(Math.max((st - mx) / mx, 0), 1);
        const opacityStr = opacity.toFixed(3);
        if (opacityStr !== __lastOpacity) {
            doc.style.setProperty('--to-top-opacity', opacityStr);
            __lastOpacity = opacityStr;
        }

        const inactive = opacity < 1;
        if (toTopChanged || inactive !== __lastInactive) {
            toTop.classList.toggle('inactive', inactive);
            __lastInactive = inactive;
        }
    };

    window.onBodyResize = function () {
        const w = window;
        const de = document.documentElement;
        window.lastWindowHeight = Math.max(Math.round(w.innerHeight || 0), de.clientHeight);
        window.lastWindowWidth = Math.max(Math.round(w.innerWidth || 0), de.clientWidth);

        if (typeof window.updateLeftMenuInit === 'function') {
            window.updateLeftMenuInit();
        }
        if (typeof window.updateLeftMenu === 'function') {
            window.updateLeftMenu();
        }
        if (typeof window.updateNarrow === 'function') {
            window.updateNarrow();
        }
        if (typeof window.updSideTopLink === 'function') {
            window.updSideTopLink(true);
        }
    };

    window.onBodyScroll = function () {
        if (typeof window.updateLeftMenu === 'function') {
            window.updateLeftMenu();
        }
        if (typeof window.updateNarrow === 'function') {
            window.updateNarrow();
        }
        if (typeof window.updSideTopLink === 'function') {
            window.updSideTopLink();
        }
    };

    document.body.addEventListener('click', (e) => {
        const toTop = e.target.closest('.toTop');
        if (!toTop || toTop.classList.contains('inactive')) {
            return;
        }

        const y_scroll = window.scrollY;
        const scroll_margin = 20;

        if (y_scroll > 100) {
            window.temp_y_scroll = y_scroll;
            window.scrollTo(0, scroll_margin);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (window.temp_y_scroll) {
            window.scrollTo(0, window.temp_y_scroll - scroll_margin);
            window.scrollTo({ top: window.temp_y_scroll, behavior: 'smooth' });
        }
    });

    window.addEventListener('scroll', window.onBodyScroll, { passive: true });
    window.addEventListener('resize', window.onBodyResize);

    vkify.onPageLifecycle('afterPageReady', () => setTimeout(window.onBodyResize, 0), 'after');

    if (document.readyState === 'complete') {
        setTimeout(window.onBodyResize, 0);
    } else {
        window.addEventListener('load', () => setTimeout(window.onBodyResize, 0), { once: true });
    }
});

})();