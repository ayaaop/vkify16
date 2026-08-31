vkify.once('uiActionsMenu', function() {
    const dataStore = new WeakMap();
    const HIDE_DURATION = 100;
    const DEFAULT_HIDE_DELAY = 200;
    const DEFAULT_AUTOPOS_GAP = 10;

    function data(el, key, value) {
        if (!el) return undefined;
        if (!dataStore.has(el)) dataStore.set(el, {});
        const store = dataStore.get(el);
        if (typeof value !== 'undefined') {
            store[key] = value;
            return value;
        }
        return store[key];
    }

    function hasClass(el, cls) {
        return el && el.classList.contains(cls);
    }
    function addClass(el, cls) {
        if (el) el.classList.add(cls);
    }
    function removeClass(el, cls) {
        if (el) el.classList.remove(cls);
    }
    function toggleClass(el, cls, s) {
        if (!el) return;
        if (typeof s === 'undefined' || s === null) {
            el.classList.toggle(cls);
        } else {
            el.classList.toggle(cls, !!s);
        }
    }
    function domClosest(cls, el) {
        if (!el) return null;
        return el.closest('.' + cls);
    }
    function geByClass1(cls, el) {
        if (!el) return null;
        return el.querySelector('.' + cls);
    }
    function getStyle(el, prop) {
        return el ? window.getComputedStyle(el)[prop] : '';
    }
    function intval(v) {
        v = parseInt(v, 10);
        return isNaN(v) ? 0 : v;
    }
    function checkKeyboardEvent(ev) {
        return ev && (ev.key === 'Enter' || ev.key === ' ');
    }
    function se(html) {
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        return div.firstChild;
    }
    function runHandler(code, scope) {
        if (!code) return;
        try {
            const fn = new Function(code);
            fn.call(scope);
        } catch (e) {
            console.error('uiActionsMenu handler error:', e);
        }
    }

    function rectOf(el) {
        if (!el) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
        return el.getBoundingClientRect();
    }

    function computeBounds(el) {
        const header = document.getElementById('page_header_wrap');
        const bounds = {
            top: header ? rectOf(header).height : 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            left: 0
        };

        for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const style = window.getComputedStyle(parent);
            const clipsX = /(auto|scroll|hidden|clip)/.test(style.overflowX);
            const clipsY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
            if (!clipsX && !clipsY) continue;

            const rect = rectOf(parent);
            if (clipsY) {
                bounds.top = Math.max(bounds.top, rect.top);
                bounds.bottom = Math.min(bounds.bottom, rect.bottom);
            }
            if (clipsX) {
                bounds.right = Math.min(bounds.right, rect.right);
                bounds.left = Math.max(bounds.left, rect.left);
            }
        }

        return bounds;
    }

    function clampToBounds(pos, size, bounds) {
        const maxLeft = Math.max(bounds.left, bounds.right - size.width);
        const maxTop = Math.max(bounds.top, bounds.bottom - size.height);
        return {
            left: Math.min(Math.max(pos.left, bounds.left), maxLeft),
            top: Math.min(Math.max(pos.top, bounds.top), maxTop)
        };
    }

    function shouldFlipAbove(triggerRect, menuHeight, bounds, gap) {
        const spaceAbove = triggerRect.top - bounds.top - gap;
        const spaceBelow = bounds.bottom - triggerRect.bottom - gap;
        return menuHeight > spaceBelow && spaceAbove > spaceBelow;
    }

    function firstNonMenuChild(wrap) {
        for (let i = 0; i < wrap.children.length; i++) {
            const child = wrap.children[i];
            if (!child.classList.contains('ui_actions_menu')) return child;
        }
        return null;
    }

    function ensureMenu(el, menuId) {
        let menu = geByClass1('ui_actions_menu', el);
        if (!menu && menuId) {
            const srcMenu = document.getElementById(menuId);
            if (srcMenu) {
                menu = srcMenu.cloneNode(true);
                menu.removeAttribute('id');
                menu.style.display = '';
                el.appendChild(menu);
            }
        }
        return menu;
    }

    function positionArrow(el, options) {
        const menu = geByClass1('ui_actions_menu', el);
        if (!menu || hasClass(el, 'ui_actions_menu_no_chevron')) return;

        const triggerWrap = data(el, 'origMenu') || el;
        const trigger = firstNonMenuChild(triggerWrap) || triggerWrap;

        const wrapRect = rectOf(el);
        const triggerRect = rectOf(trigger);

        const verticalOffset = Math.max(triggerRect.bottom - wrapRect.top, wrapRect.height);
        menu.style.setProperty('--ui-actions-menu-vertical-offset', verticalOffset + 'px');

        let alignLeft = false;
        if (hasClass(el, 'ui_actions_menu_left')) {
            alignLeft = true;
        } else {
            let align = options && options.align;
            if (!align) align = data(el, 'uiActionsMenuAlign');
            if (align === 'left') {
                alignLeft = true;
            } else if (align === 'right') {
                alignLeft = false;
            } else if (wrapRect.width >= triggerRect.width) {
                const leftSpace = triggerRect.left - wrapRect.left;
                const rightSpace = wrapRect.right - triggerRect.right;
                alignLeft = leftSpace <= rightSpace;
            }
            data(el, 'uiActionsMenuAlign', align);
        }

        toggleClass(el, 'ui_actions_menu_left_align', alignLeft);

        const menuRect = rectOf(menu);
        const center = triggerRect.left + triggerRect.width / 2;
        menu.style.setProperty('--ui-actions-menu-arrow-offset', (menuRect.right - center) + 'px');
        menu.style.setProperty('--ui-actions-menu-arrow-offset-left', (center - menuRect.left) + 'px');
    }

    function positionDummyMenu(dummyWrap) {
        const origEl = data(dummyWrap, 'origMenu');
        const menu = geByClass1('ui_actions_menu', dummyWrap);
        const appendEl = domClosest(data(dummyWrap, 'appendParentCls'), menu);
        if (!menu || !appendEl || !origEl) return;

        menu.style.display = 'block';

        const origRect = rectOf(origEl);
        const appendRect = rectOf(appendEl);
        const appendPos = getStyle(appendEl, 'position');

        dummyWrap.style.position = 'absolute';
        dummyWrap.style.width = origRect.width + 'px';
        dummyWrap.style.height = origRect.height + 'px';
        dummyWrap.style.zIndex = 'calc(var(--action-menu-z-index, 5) + 1)';

        if (appendPos === 'static' || appendPos === '') {
            dummyWrap.style.top = (origRect.top + window.scrollY) + 'px';
            dummyWrap.style.left = (origRect.left + window.scrollX) + 'px';
        } else {
            dummyWrap.style.top = (origRect.top - appendRect.top) + 'px';
            dummyWrap.style.left = (origRect.left - appendRect.left) + 'px';
        }

        menu.style.top = '';
        menu.style.left = '';
        menu.style.right = '';
    }

    window.uiActionsMenu = {
        keyToggle: function(el, ev) {
            if (!checkKeyboardEvent(ev)) {
                return false;
            }
            const wrap = domClosest('ui_actions_menu_wrap', el);
            wrap && uiActionsMenu.toggle(wrap, !hasClass(wrap, 'shown'));
        },

        toggle: function(el, s, options) {
            const dummyMenu = data(el, 'dummyMenu');
            if (dummyMenu) {
                el = dummyMenu;
            }

            if ((typeof s === 'undefined' || s === null) && window.event && window.event.type === 'click') {
                const clickTarget = window.event.target;
                if (clickTarget && clickTarget.closest && clickTarget.closest('.ui_actions_menu')) {
                    s = false;
                }
            }

            const isShown = hasClass(el, 'shown');
            const willShow = (typeof s === 'undefined' || s === null) ? !isShown : !!s;
            const menu = geByClass1('ui_actions_menu', el);
            const noAnimate = !!(options && options.noAnimate);
            const immediate = !!(options && options.immediate);

            let hideTimer = data(el, 'hideTimer');
            if (hideTimer) {
                clearTimeout(hideTimer);
                data(el, 'hideTimer', 0);
                if (menu) removeClass(menu, 'ui_actions_menu_hiding');
            }

            if (options && typeof options.noChevron !== 'undefined') {
                toggleClass(el, 'ui_actions_menu_no_chevron', !!options.noChevron);
            }
            if (options && typeof options.noAnimate !== 'undefined') {
                toggleClass(el, 'ui_actions_menu_no_animate', !!options.noAnimate);
            }

            if (willShow) {
                if (menu) removeClass(menu, 'ui_actions_menu_hiding');
                if (options && options.menuId) {
                    ensureMenu(el, options.menuId);
                }
                positionArrow(el, options);
                addClass(el, 'shown');
            } else {
                if (!isShown) {
                    return;
                }
                if (immediate || noAnimate) {
                    removeClass(el, 'shown');
                    if (menu) removeClass(menu, 'ui_actions_menu_hiding');
                    const onhide = el.getAttribute('onHide');
                    if (onhide) runHandler(onhide, el);
                } else {
                    if (menu) addClass(menu, 'ui_actions_menu_hiding');
                    data(el, 'hideTimer', setTimeout(function() {
                        data(el, 'hideTimer', 0);
                        removeClass(el, 'shown');
                        if (menu) removeClass(menu, 'ui_actions_menu_hiding');
                        const onhide = el.getAttribute('onHide');
                        if (onhide) runHandler(onhide, el);
                    }, HIDE_DURATION));
                }
            }

            if (options && options.onToggle) {
                const script = options.onToggle.replace('{isShow}', '' + willShow);
                runHandler(script, el);
            }
        },

        show: function(el, ev, options) {
            if (window.isMobile && window.isMobile()) {
                return;
            }
            let ht = data(el, 'hidetimer');
            if (ht) {
                clearTimeout(ht);
                data(el, 'hidetimer', 0);
            }
            const _m = data(el, 'origMenu');
            if (_m && (ht = data(_m, 'hidetimer'))) {
                clearTimeout(ht);
                data(el, 'hidetimer', 0);
            }

            if (options && options.delay) {
                if (window.__uiActionsMenuShowTimeout) {
                    clearTimeout(window.__uiActionsMenuShowTimeout);
                }
                const delay = options.delay;
                delete options.delay;
                window.__uiActionsMenuShowTimeout = setTimeout(uiActionsMenu.show.bind(uiActionsMenu, el, ev, options), delay);
                return;
            } else if (window.__uiActionsMenuShowTimeout) {
                clearTimeout(window.__uiActionsMenuShowTimeout);
                delete window.__uiActionsMenuShowTimeout;
            }

            if (options && options.menuId) {
                ensureMenu(el, options.menuId);
            }

            if (options && options.appendParentCls) {
                let menu = geByClass1('ui_actions_menu', el);
                if (menu) {
                    const appendEl = domClosest(options.appendParentCls, menu);
                    const menuWrap = domClosest('ui_actions_menu_wrap', el);
                    const newWrap = se(
                        '<div class="' + (menuWrap ? menuWrap.className : 'ui_actions_menu_wrap') +
                        ' ui_actions_menu_dummy_wrap" ' +
                        'onmouseover="uiActionsMenu.show(this);" ' +
                        'onmouseout="uiActionsMenu.hide(this);"></div>'
                    );
                    newWrap.appendChild(menu);
                    appendEl && appendEl.appendChild(newWrap);
                    data(el, 'dummyMenu', newWrap);
                    data(newWrap, 'origMenu', el);
                    data(newWrap, 'appendParentCls', options.appendParentCls);
                    el = newWrap;

                    data(menu, 'top', intval(getStyle(menu, 'top')));
                    data(menu, 'left', intval(getStyle(menu, 'left')));
                    data(menu, 'right', intval(getStyle(menu, 'right')));

                    if (options.processHoverCls) {
                        const row = domClosest(options.processHoverCls, menuWrap);
                        if (row) {
                            newWrap.addEventListener('mouseover', () => addClass(row, 'hover'));
                            newWrap.addEventListener('mouseout', () => removeClass(row, 'hover'));
                        }
                    }
                } else {
                    el = data(el, 'dummyMenu');
                }

                positionDummyMenu(el);
            }

            const menu = geByClass1('ui_actions_menu', el);
            if (options && options.autopos) {
                if (menu && !hasClass(el, 'shown')) {
                    removeClass(el, 'ui_actions_menu_left');
                    removeClass(el, 'ui_actions_menu_top');
                    addClass(el, 'no_transition');

                    const elRect = rectOf(el);
                    const menuHeight = menu.offsetHeight;
                    const gap = options.dy || DEFAULT_AUTOPOS_GAP;
                    const bounds = computeBounds(el);

                    if (shouldFlipAbove(elRect, menuHeight, bounds, gap)) {
                        addClass(el, 'ui_actions_menu_top');
                    }

                    const menuRect = rectOf(menu);
                    toggleClass(el, 'ui_actions_menu_left', menuRect.left < bounds.left);

                    setTimeout(() => removeClass(el, 'no_transition'), 0);
                }
            }

            if (options && options.scroll && options.maxHeight) {
                if (menu) {
                    menu.style.maxHeight = (intval(options.maxHeight) || 200) + 'px';
                    if (!menu.__uiScroll__) {
                        menu.style.overflowY = 'auto';
                        menu.__uiScroll__ = true;
                    }
                }
            }

            uiActionsMenu.toggle(el, true, options);
        },

        hide: function(el, ev, options) {
            if (window.isMobile && window.isMobile()) {
                return;
            }
            if (window.__uiActionsMenuShowTimeout) {
                clearTimeout(window.__uiActionsMenuShowTimeout);
                delete window.__uiActionsMenuShowTimeout;
            }
            let delay = data(el, 'hidedelay');
            if (delay) {
                data(el, 'hidedelay', false);
            } else {
                delay = DEFAULT_HIDE_DELAY;
            }
            const ht = data(el, 'hidetimer');
            if (ht) {
                return;
            }
            data(el, 'hidetimer', setTimeout(function() {
                uiActionsMenu.toggle(el, false, options);
                data(el, 'hidetimer', 0);
            }, delay));
        },

        hideDelay: function(el, delay) {
            data(el, 'hidedelay', delay);
        }
    };

    window.addEventListener('resize', function() {
        document.querySelectorAll('.ui_actions_menu_wrap.shown').forEach(function(wrap) {
            positionArrow(wrap, { align: data(wrap, 'uiActionsMenuAlign') });
            const dummyMenu = data(wrap, 'dummyMenu');
            if (dummyMenu) positionDummyMenu(dummyMenu);
        });
    });

    document.addEventListener('click', function(ev) {
        const wrap = ev.target.closest('.ui_actions_menu_wrap');
        const menu = ev.target.closest('.ui_actions_menu');

        if (window.isMobile && window.isMobile()) {
            if (wrap && !wrap.getAttribute('onclick') && !menu) {
                uiActionsMenu.toggle(wrap, null);
            }
        }

        if (wrap && menu) {
            const item = ev.target.closest('a, input[type="button"], input[type="submit"], button');
            if (item && !item.classList.contains('ui_actions_menu')) {
                uiActionsMenu.toggle(wrap, false, { immediate: true });
            }
        }

        const openWraps = document.querySelectorAll('.ui_actions_menu_wrap.shown');
        for (let i = 0; i < openWraps.length; i++) {
            const openWrap = openWraps[i];
            if (openWrap.contains(ev.target)) continue;
            uiActionsMenu.toggle(openWrap, false);
        }
    }, true);
});
