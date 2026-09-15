(function () {
'use strict';

vkify.once("updateNarrow", () => {
    let __narrowBar = {
        bar: null, barBlock: null, wideCol: null, pl: null, ajloader: null,
        barMT: 0, dirty: true, isFixed: false, lastSt: 0, lastStyles: {}
    };
    let __barObserver = null;

    function observeBar(bar) {
        if (__barObserver) {
            __barObserver.disconnect();
            __barObserver = null;
        }
        if (bar) {
            __barObserver = new MutationObserver(() => { __narrowBar.dirty = true; });
            __barObserver.observe(bar, { childList: true });
        }
    }

    function getNarrowRefs() {
        const s = __narrowBar;
        if (!s.bar || !s.bar.isConnected) {
            s.bar = document.querySelector('.narrow_column');
            s.isFixed = s.bar ? s.bar.classList.contains('fixed') : false;
            s.lastStyles = {};
            s.dirty = true;
            observeBar(s.bar);
        }
        if (!s.barBlock || !s.barBlock.isConnected) {
            s.dirty = true;
        }
        if (s.dirty) {
            s.barBlock = s.bar ? s.bar.querySelector('.page_block') : null;
            s.barMT = s.barBlock ? (parseFloat(getComputedStyle(s.barBlock).marginTop) || 0) : 0;
            s.dirty = false;
        }
        if (!s.wideCol || !s.wideCol.isConnected) {
            s.wideCol = document.querySelector('.wide_column');
        }
        if (!s.pl || !s.pl.isConnected) {
            s.pl = document.querySelector('.layout');
        }
        if (!s.ajloader || !s.ajloader.isConnected) {
            s.ajloader = document.getElementById('ajloader');
        }
        return s;
    }

    window.updateNarrow = function () {
        if (window.isMobile && window.isMobile()) return;

        const s = getNarrowRefs();
        const { bar, wideCol, pl } = s;
        if (!bar || !s.barBlock || !wideCol || !pl) return;
        if (s.ajloader && s.ajloader.classList.contains('shown')) return;
        if (document.body.classList.contains('dimmed')) return;

        const wh = Math.round(window.lastWindowHeight || window.innerHeight || 0);
        const st = Math.round(window.scrollY || 0);
        const headH = 57;
        const delta = 1;

        const isFixed = s.isFixed;
        const barMT = s.barMT;
        const barH = Math.round(bar.offsetHeight) - (isFixed ? barMT : 0);
        const pageH = Math.round(wideCol.offsetHeight);
        const pagePos = Math.round(wideCol.getBoundingClientRect().top + st);
        const tooBig = barH >= pageH - barMT;

        const barMB = barMT;
        const barBottom = st + wh - pageH - pagePos - barMB;
        const barPB = Math.max(0, barBottom);
        const barPT = pagePos - headH;
        const barPos = Math.round(bar.getBoundingClientRect().top + st) + (isFixed ? barMT : 0);

        const lastSt = s.lastSt;
        const lastStyles = s.lastStyles;
        let styles = {};
        let needFix = false;

        const smallEnough = headH + barMB + barH + barMT + barPB <= wh;

        const scrollLeft = (document.body.scrollLeft || document.documentElement.scrollLeft || window.scrollX || 0);
        const layoutW = Math.round(pl.offsetWidth);
        const bodyW = Math.round(document.body.clientWidth);
        const marginLeft = Math.round(Math.min(-scrollLeft, Math.max(-scrollLeft, bodyW - layoutW)));

        const toPx = (value) => Math.round(value) + 'px';

        if (st - delta < barPT && !(smallEnough && barPos < headH + barMT) || tooBig) {
            styles = {
                marginTop: '0px',
                marginLeft: toPx(marginLeft),
                right: ''
            };
            needFix = false;
        } else if (st - delta < Math.min(lastSt, barPos - headH - barMT) || smallEnough) {
            styles = {
                top: toPx(headH),
                marginTop: '',
                marginLeft: toPx(marginLeft),
                right: ''
            };
            needFix = true;
        } else if (st + delta > Math.max(lastSt, barPos + barH + barMB - wh) && barBottom < 0) {
            styles = {
                bottom: toPx(barMB),
                marginTop: '',
                marginLeft: toPx(marginLeft),
                right: ''
            };
            needFix = true;
        } else {
            const marginTopValue = (barBottom >= 0)
                ? (pageH - barH)
                : Math.min(barPos - pagePos, pageH - barH + (pagePos - headH));
            styles = {
                marginTop: toPx(marginTopValue),
                marginLeft: toPx(marginLeft),
                right: ''
            };
        }

        const allKeys = ['top', 'bottom', 'marginTop', 'marginLeft', 'right'];
        const same = allKeys.every((key) => (styles[key] || '') === (lastStyles[key] || ''));
        if (!same) {
            for (let i = 0; i < allKeys.length; i++) {
                bar.style[allKeys[i]] = styles[allKeys[i]] || '';
            }
            s.lastStyles = styles;
        }

        if (needFix !== isFixed) {
            bar.classList.toggle('fixed', needFix);
            bar.style.position = needFix ? 'fixed' : '';
            s.isFixed = needFix;
        }

        s.lastSt = st;
    };
});

vkify.once('affixedNavigation', () => {
    const HEAD_H = 57;
    const SCROLL_TOLERANCE = 4;

    let state = null;
    const refs = { menu: null, pageBody: null, hasFastLogin: false };

    function getRefs() {
        if (!refs.menu || !refs.menu.isConnected) {
            refs.menu = document.querySelector('.sidebar > .sidebar_inner');
            refs.hasFastLogin = refs.menu ? !!refs.menu.querySelector('#fastLogin') : false;
        }
        if (!refs.pageBody || !refs.pageBody.isConnected) {
            refs.pageBody = document.querySelector('.page_body');
        }
        return refs;
    }

    function getScrollTop() {
        return window.scrollY || 0;
    }

    function getDocumentTop(el) {
        const rect = el.getBoundingClientRect();
        return rect.top + window.scrollY;
    }

    function setStyles(el, styles) {
        const apply = {
            position: styles.position || '',
            top: styles.top != null ? styles.top + 'px' : '',
            width: styles.width != null ? styles.width + 'px' : '',
            marginTop: styles.marginTop != null ? styles.marginTop + 'px' : ''
        };
        const last = state && state.menuStyles;
        if (last
            && last.position === apply.position
            && last.top === apply.top
            && last.width === apply.width
            && last.marginTop === apply.marginTop) {
            return;
        }
        el.style.position = apply.position;
        el.style.top = apply.top;
        el.style.width = apply.width;
        el.style.marginTop = apply.marginTop;
        if (state) state.menuStyles = apply;
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
            width: state.anchorWidth,
            marginTop: null
        });
    }

    function updateLeftMenu() {
        const { menu, pageBody, hasFastLogin } = getRefs();
        if (!menu || !pageBody || !state) {
            return;
        }

        if (window.isMobile && window.isMobile()) {
            resetMenu(menu);
            return;
        }

        if (hasFastLogin) {
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
        const menu = getRefs().menu;
        const anchor = menu ? menu.parentElement : null;
        if (!menu || !anchor) {
            state = null;
            return;
        }

        const scrollTop = getScrollTop();
        const previousState = state;
        const preserveOffset = previousState && previousState.anchor === anchor;

        state = {
            anchor: anchor,
            anchorWidth: anchor.offsetWidth,
            initialTop: getDocumentTop(anchor),
            hiddenOffset: preserveOffset ? previousState.hiddenOffset : 0,
            lastScrollTop: preserveOffset ? previousState.lastScrollTop : scrollTop,
            menuStyles: preserveOffset ? previousState.menuStyles : null
        };

        if (!preserveOffset) {
            resetMenu(menu);
        }

        updateLeftMenu();
    }

    window.updateLeftMenu = updateLeftMenu;
    window.updateLeftMenuInit = init;
});

vkify.once('bodyScroll', () => {
    let __scrLeft = 0;
    let __toTopEl = null;
    let __layoutEl = null;
    let __lastHidden = null;
    let __lastHasDown = null;
    let __lastScrolled = null;
    let __lastInactive = null;
    let __lastWidth = null;
    let __lastOpacity = null;
    let __scheduled = false;
    let __lastY = null;
    let __lastX = null;

    function getToTop() {
        if (!__toTopEl || !__toTopEl.isConnected) {
            __toTopEl = document.querySelector('.toTop');
            __lastHidden = __lastHasDown = __lastScrolled = __lastInactive = __lastWidth = __lastOpacity = null;
        }
        return __toTopEl;
    }

    function getLayout() {
        if (!__layoutEl || !__layoutEl.isConnected) {
            __layoutEl = document.querySelector('.layout');
        }
        return __layoutEl;
    }

    window.updSideTopLink = function (resized) {
        const toTop = getToTop();
        if (!toTop) {
            return;
        }
        if (window.isMobile && window.isMobile()) return;

        const doc = document.documentElement;
        const body = document.body;
        const st = window.scrollY || 0;
        const scl = body.scrollLeft || doc.scrollLeft || window.scrollX || 0;
        const mx = 200;

        if (resized || scl !== __scrLeft) {
            const layout = getLayout();
            const width = layout ? Math.max(Math.round(layout.getBoundingClientRect().left), 114) : 114;
            if (width !== __lastWidth) {
                toTop.style.setProperty('--to-top-width', width + 'px');
                __lastWidth = width;
            }
            __scrLeft = scl;
        }

        const hidden = st < 100 && !window.temp_y_scroll;
        const hasDown = st < 100 && !!window.temp_y_scroll;
        const scrolled = st >= 100;

        if (hidden !== __lastHidden) {
            toTop.classList.toggle('hidden', hidden);
            __lastHidden = hidden;
        }
        if (hasDown !== __lastHasDown) {
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
            toTop.style.setProperty('--to-top-opacity', opacityStr);
            __lastOpacity = opacityStr;
        }

        const inactive = opacity < 1;
        if (inactive !== __lastInactive) {
            toTop.classList.toggle('inactive', inactive);
            __lastInactive = inactive;
        }
    };

    function runScrollPass() {
        __scheduled = false;
        const y = window.scrollY || 0;
        const x = window.scrollX || 0;
        if (y === __lastY && x === __lastX) return;
        __lastY = y;
        __lastX = x;

        if (typeof window.updateNarrow === 'function') {
            window.updateNarrow();
        }
        if (typeof window.updSideTopLink === 'function') {
            window.updSideTopLink();
        }
        if (typeof window.updateLeftMenu === 'function') {
            window.updateLeftMenu();
        }
    }

    window.onBodyScroll = function () {
        if (__scheduled) return;
        __scheduled = true;
        requestAnimationFrame(runScrollPass);
    };

    window.onBodyResize = function () {
        const w = window;
        const de = document.documentElement;
        window.lastWindowHeight = Math.max(Math.round(w.innerHeight || 0), de.clientHeight);
        window.lastWindowWidth = Math.max(Math.round(w.innerWidth || 0), de.clientWidth);

        if (typeof window.updateLeftMenuInit === 'function') {
            window.updateLeftMenuInit();
        }
        if (typeof window.updateNarrow === 'function') {
            window.updateNarrow();
        }
        if (typeof window.updSideTopLink === 'function') {
            window.updSideTopLink(true);
        }
        if (typeof window.updateLeftMenu === 'function') {
            window.updateLeftMenu();
        }

        __lastY = window.scrollY || 0;
        __lastX = window.scrollX || 0;
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
