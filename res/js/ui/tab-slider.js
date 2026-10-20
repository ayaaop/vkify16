(function () {
'use strict';

function findHorizontalScroller(element) {
    let el = element;
    while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

function scrollActiveTabIntoView(container, tabAnchor, animate = true) {
    const scroller = findHorizontalScroller(container);
    if (!scroller || !tabAnchor) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const tabRect = tabAnchor.getBoundingClientRect();
    const scrollerStyle = window.getComputedStyle(scroller);
    const borderLeft = parseFloat(scrollerStyle.borderLeftWidth) || 0;
    const paddingLeft = parseFloat(scrollerStyle.paddingLeft) || 0;

    const contentLeft = scrollerRect.left + borderLeft + paddingLeft;
    const tabLeft = tabRect.left - contentLeft;
    const tabRight = tabLeft + tabRect.width;
    const visibleLeft = scroller.scrollLeft;
    const visibleRight = visibleLeft + scroller.clientWidth;

    let targetScroll = scroller.scrollLeft;
    if (tabRight > visibleRight) {
        targetScroll = tabRight - scroller.clientWidth;
    } else if (tabLeft < visibleLeft) {
        targetScroll = tabLeft;
    } else {
        return;
    }

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollTo({
        left: Math.max(0, Math.min(targetScroll, maxScroll)),
        behavior: animate ? 'smooth' : 'auto'
    });
}

function moveTabSlider(container, tabAnchor, animate = true) {
    const slider = container?.querySelector('.ui_tabs_slider');
    if (!slider || !tabAnchor) return;

    const { offsetLeft, offsetWidth } = tabAnchor;

    if (animate) {
        container.classList.add('ui_tabs_sliding');
        slider.style.transform = `translateX(${offsetLeft}px)`;
        slider.style.width = `${offsetWidth}px`;
    } else {
        container.classList.remove('ui_tabs_sliding');
        slider.style.transform = `translateX(${offsetLeft}px)`;
        slider.style.width = `${offsetWidth}px`;
    }

    scrollActiveTabIntoView(container, tabAnchor, animate);
}

vkify.moveTabSlider = moveTabSlider;

function repositionInitializedTabSliders() {
    document.querySelectorAll('.ui_tabs[data-vkify-tab-slider-init="1"]').forEach(container => {
        const activeTab = container.querySelector('.ui_tab_sel');
        if (activeTab) {
            moveTabSlider(container, activeTab, false);
        }
    });
}

if (!vkify.tabSliderResizeBound) {
    vkify.tabSliderResizeBound = true;
    let resizeRafPending = false;
    window.addEventListener('resize', () => {
        if (resizeRafPending) return;
        resizeRafPending = true;
        requestAnimationFrame(() => {
            resizeRafPending = false;
            repositionInitializedTabSliders();
        });
    });
}

vkify.initTabSliderSafe = vkify.initTabSliderSafe || function () {
    const tabContainers = document.querySelectorAll('.ui_tabs');

    tabContainers.forEach(container => {
        if (container.dataset.vkifyTabSliderInit === '1') {
            return;
        }

        const slider = container.querySelector('.ui_tabs_slider');
        if (!slider) return;

        container.dataset.vkifyTabSliderInit = '1';

        if (!container._tabSliderState) {
            container._tabSliderState = {
                isAnimating: false,
                pendingTab: null,
                animationTimeout: null,
                transitionEndHandler: null
            };
        }

        const state = container._tabSliderState;

        function initSliderPosition() {
            const activeTab = container.querySelector('.ui_tab_sel');
            if (activeTab) {
                moveTabSlider(container, activeTab, false);
            }
        }

        function finishTabSwitch(targetTab) {
            if (!targetTab) return;

            if (state.animationTimeout) {
                clearTimeout(state.animationTimeout);
                state.animationTimeout = null;
            }

            const currentActive = container.querySelector('.ui_tab_sel');
            if (currentActive) {
                currentActive.classList.remove('ui_tab_sel');
            }
            targetTab.classList.add('ui_tab_sel');

            const href = targetTab.getAttribute('href');
            let handled = false;

            if (typeof vkify.onWallTabSwitch === 'function') {
                handled = vkify.onWallTabSwitch(targetTab) === true;
            }

            if (!handled && href && !href.startsWith('#')) {
                const fullUrl = new URL(href, window.location.href).href;
                vkify.navigate(fullUrl);
            }

            state.isAnimating = false;
            state.pendingTab = null;

            setTimeout(() => {
                container.classList.remove('ui_tabs_sliding');
            }, 50);
        }

        container.addEventListener('click', function (e) {
            const clickedTab = e.target.closest('.ui_tab');
            if (!clickedTab || clickedTab.classList.contains('ui_tab_sel')) return;

            e.preventDefault();

            if (state.isAnimating) {
                state.pendingTab = clickedTab;
                moveTabSlider(container, clickedTab, true);
                return;
            }

            state.isAnimating = true;
            state.pendingTab = clickedTab;

            moveTabSlider(container, clickedTab, true);

            state.animationTimeout = setTimeout(() => {
                finishTabSwitch(state.pendingTab);
            }, 200);
        });

        slider.addEventListener('transitionend', function (e) {
            if (e.target === slider && state.isAnimating) {
                if (state.pendingTab) {
                    if (state.animationTimeout) {
                        clearTimeout(state.animationTimeout);
                        state.animationTimeout = null;
                    }

                    setTimeout(() => {
                        finishTabSwitch(state.pendingTab);
                    }, 50);
                }
            }
        });

        initSliderPosition();
    });
};

if (window.initTabSlider !== vkify.initTabSliderSafe) {
    window.initTabSlider = vkify.initTabSliderSafe;
}

function getTabScrollKey(el, index) {
    return el.id || `__vkify_tab_${index}`;
}

vkify.captureTabScrolls = function (container) {
    const scrolls = {};
    if (!container) return scrolls;

    container.querySelectorAll('.ui_tabs').forEach((el, i) => {
        scrolls[getTabScrollKey(el, i)] = el.scrollLeft;
    });

    return scrolls;
};

vkify.restoreTabScrolls = function (container, scrolls) {
    if (!container || !scrolls) return;

    container.querySelectorAll('.ui_tabs').forEach((el, i) => {
        const key = getTabScrollKey(el, i);
        if (key in scrolls) {
            el.scrollLeft = scrolls[key];
        }
    });
};

function isSublistVisible(sublist) {
    return !!(sublist && sublist.style.display !== 'none' && getComputedStyle(sublist).display !== 'none');
}

function getRelativeTop(el, menu) {
    if (!el || !menu) return 0;
    return el.getBoundingClientRect().top - menu.getBoundingClientRect().top;
}

const uiRightMenu = {
    initMenu(menu) {
        if (!menu || menu.classList.contains('ui_rmenu_sliding')) return;
        const scroller = menu.querySelector('._ui_rmenu_slider, .ui_rmenu_slider');
        const firstItem = menu.querySelector('.ui_rmenu_item');
        const selectedItem = menu.querySelector('.ui_rmenu_item_sel');
        const curItem = selectedItem || firstItem;
        if (!scroller || !curItem) return;

        const height = curItem.offsetHeight || 32;
        const top = selectedItem ? Math.round(getRelativeTop(curItem, menu)) : 0;
        scroller.style.height = `${height}px`;
        scroller.style.top = `${top}px`;
        scroller.style.transform = '';
        menu.classList.add('ui_rmenu_sliding');
    },

    switchMenu(el, force = false) {
        const menu = el?.closest?.('.ui_rmenu');
        if (!menu) return false;
        const curItem = menu.querySelector('.ui_rmenu_item_sel');
        if (el === curItem && !force) return false;

        uiRightMenu.initMenu(menu);

        const height = el.offsetHeight || 32;
        let top = Math.round(getRelativeTop(el, menu));
        const hidden = [];
        const shown = [];

        if (menu.classList.contains('_ui_rmenu_auto_expand')) {
            const sublists = Array.from(menu.querySelectorAll('._ui_rmenu_sublist'));
            const nextSibling = el.nextElementSibling;
            const newSublist = el.classList.contains('_ui_rmenu_subitem')
                ? el.closest('._ui_rmenu_sublist')
                : (nextSibling?.classList.contains('_ui_rmenu_sublist') ? nextSibling : null);

            sublists.forEach(sub => {
                if (isSublistVisible(sub) && sub !== newSublist) {
                    hidden.push(sub);
                    sub.style.display = 'none';
                }
            });
            if (newSublist && !isSublistVisible(newSublist)) {
                shown.push(newSublist);
                newSublist.style.display = 'block';
            }
            top = Math.round(getRelativeTop(el, menu));
            hidden.forEach(sub => { sub.style.display = 'block'; });
            shown.forEach(sub => { sub.style.display = 'none'; });
        }

        const scroller = menu.querySelector('._ui_rmenu_slider, .ui_rmenu_slider');
        if (scroller) {
            const mtop = parseInt(scroller.style.top, 10) || 0;
            scroller.style.height = `${height}px`;
            scroller.style.transform = `translateY(${top - mtop}px)`;
        }

        if (curItem) curItem.classList.remove('ui_rmenu_item_sel');
        el.classList.add('ui_rmenu_item_sel');

        if (menu.classList.contains('_ui_rmenu_auto_expand')) {
            hidden.forEach(sub => {
                if (window.jQuery) window.jQuery(sub).stop(true, true).slideUp(100);
                else sub.style.display = 'none';
            });
            shown.forEach(sub => {
                if (window.jQuery) window.jQuery(sub).stop(true, true).slideDown(100);
                else sub.style.display = 'block';
            });
        } else if (el.classList.contains('_ui_rmenu_subitem')) {
            const parentSub = el.closest('._ui_rmenu_sublist');
            if (parentSub && !isSublistVisible(parentSub)) {
                if (window.jQuery) window.jQuery(parentSub).stop(true, true).slideDown(100);
                else parentSub.style.display = 'block';
            }
        }
        return true;
    },

    fixScroller(el) {
        const menu = el?.closest?.('.ui_rmenu');
        if (!menu || !el) return;
        const scroller = menu.querySelector('._ui_rmenu_slider, .ui_rmenu_slider');
        if (!scroller) return;
        const wasSliding = menu.classList.contains('ui_rmenu_sliding');
        if (wasSliding) menu.classList.remove('ui_rmenu_sliding');
        const height = el.offsetHeight || 32;
        const top = Math.round(getRelativeTop(el, menu));
        const mtop = parseInt(scroller.style.top, 10) || 0;
        scroller.style.height = `${height}px`;
        scroller.style.transform = `translateY(${top - mtop}px)`;
        void el.offsetLeft;
        if (wasSliding) menu.classList.add('ui_rmenu_sliding');
    }
};

window.uiRightMenu = uiRightMenu;
vkify.uiRightMenu = uiRightMenu;

let pendingRmenuTransition = null;

document.addEventListener('click', (e) => {
    if (e.defaultPrevented || (typeof e.button === 'number' && e.button !== 0) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (e.target.closest('.ui_rmenu_extra_item')) return;
    const item = e.target.closest('.ui_rmenu .ui_rmenu_item:not(.ui_ownblock), .ui_rmenu .ui_rmenu_subitem');
    if (!item) return;
    const href = item.getAttribute('href');
    if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) return;
    const menu = item.closest('.ui_rmenu');
    if (!menu) return;

    uiRightMenu.initMenu(menu);
    const scroller = menu.querySelector('._ui_rmenu_slider, .ui_rmenu_slider');
    const scrollerRect = scroller?.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const startTop = scrollerRect ? Math.round(scrollerRect.top - menuRect.top) : (parseInt(scroller?.style.top, 10) || 0);
    const startHeight = scrollerRect ? Math.round(scrollerRect.height) : (parseInt(scroller?.style.height, 10) || 32);

    pendingRmenuTransition = {
        menuId: menu.id || 'wall_rmenu',
        menuEl: menu,
        startTop,
        startHeight,
        targetHref: href,
        startedAt: performance.now()
    };
    uiRightMenu.switchMenu(item);
}, true);

vkify.onPageLifecycle('afterPageSwap', () => {
    if (!pendingRmenuTransition) return;
    const { menuId, startTop, startHeight, targetHref, startedAt } = pendingRmenuTransition;
    pendingRmenuTransition = null;
    if (performance.now() - startedAt > 1500) return;

    const newMenu = document.getElementById(menuId) || document.querySelector('.nomobile.ui_rmenu');
    if (!newMenu || !newMenu.parentNode) return;

    const scroller = newMenu.querySelector('._ui_rmenu_slider, .ui_rmenu_slider');
    const targetItem = Array.from(newMenu.querySelectorAll('.ui_rmenu_item, .ui_rmenu_subitem'))
        .find(a => a.getAttribute('href') === targetHref) || newMenu.querySelector('.ui_rmenu_item_sel');
    if (!scroller || !targetItem) return;

    const duration = 200;
    const elapsed = performance.now() - startedAt;
    if (elapsed >= duration) {
        uiRightMenu.initMenu(newMenu);
        return;
    }

    const endHeight = targetItem.offsetHeight || 32;
    const endTop = Math.round(getRelativeTop(targetItem, newMenu));
    const t = Math.min(1, Math.max(0, elapsed / duration));
    const eased = 1 - Math.pow(1 - t, 2.2);
    const currentTop = Math.round(startTop + (endTop - startTop) * eased);
    const remainingMs = Math.max(40, Math.round(duration - elapsed));

    scroller.style.transition = 'none';
    scroller.style.height = `${startHeight}px`;
    scroller.style.top = `${currentTop}px`;
    scroller.style.transform = '';
    newMenu.classList.add('ui_rmenu_sliding');
    void scroller.offsetHeight;
    scroller.style.transition = `margin-top ${remainingMs}ms ease-out, transform ${remainingMs}ms ease-out`;

    scroller.style.height = `${endHeight}px`;
    scroller.style.transform = `translateY(${endTop - currentTop}px)`;
});

})();
