vkify.once('uiActionsMenu', function () {
  const dataStore = new WeakMap();
  const HIDE_DURATION = 100;
  const DEFAULT_HIDE_DELAY = 200;
  const DEFAULT_AUTOPOS_GAP = 10;

  // ——— helpers ———
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

  function hasClass(el, cls) { return el?.classList.contains(cls); }
  function addClass(el, cls) { el?.classList.add(cls); }
  function removeClass(el, cls) { el?.classList.remove(cls); }
  function toggleClass(el, cls, force) {
    if (!el) return;
    el.classList.toggle(cls, force === undefined ? undefined : !!force);
  }

  function geByClass1(cls, el) { return el?.querySelector('.' + cls) || null; }
  function domClosest(cls, el) { return el?.closest('.' + cls) || null; }
  function getStyle(el, prop) { return el ? getComputedStyle(el)[prop] : ''; }
  function intval(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function checkKeyboardEvent(ev) {
    return ev && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar');
  }

  function se(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  function runHandler(code, scope) {
    if (!code) return;
    try {
      new Function(code).call(scope);
    } catch (e) {
      console.error('uiActionsMenu handler error:', e);
    }
  }

  function rectOf(el) {
    return el ? el.getBoundingClientRect() : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ——— positioning helpers ———
  function computeBounds(el) {
    // Dialog case – constrain to the dialog body
    const diag = el.closest?.('.ovk-diag');
    if (diag) {
      const body = diag.querySelector('.ovk-diag-body') || diag;
      const rect = rectOf(body);
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      };
    }

    // Everything else – full screen space
    const header = document.getElementById('page_header_wrap');
    return {
      top: header ? rectOf(header).height : 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
      left: 0
    };
  }

  function shouldFlipAbove(triggerRect, menuHeight, bounds, gap) {
    const spaceAbove = triggerRect.top - bounds.top - gap;
    const spaceBelow = bounds.bottom - triggerRect.bottom - gap;

    if (menuHeight > spaceBelow) {
      return true;
    }

    const availableHeight = bounds.bottom - bounds.top;
    const triggerMid = triggerRect.top + triggerRect.height / 2;
    const relativePos = (triggerMid - bounds.top) / availableHeight;

    if (relativePos > 0.6 && spaceAbove > spaceBelow) {
      return true;
    }

    return false;
  }

  function isInsideScrollableContainer(el) {
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) || /(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        return true;
      }
    }
    return false;
  }

  function firstNonMenuChild(wrap) {
    for (const child of wrap.children) {
      if (!child.classList.contains('ui_actions_menu')) return child;
    }
    return null;
  }

  function ensureMenu(el, menuId) {
    let menu = geByClass1('ui_actions_menu', el);
    if (!menu && menuId) {
      const src = document.getElementById(menuId);
      if (src) {
        menu = src.cloneNode(true);
        menu.removeAttribute('id');
        menu.style.display = '';
        el.appendChild(menu);
      }
    }
    return menu;
  }

  function getMenuItems(menu) {
    if (!menu) return [];
    return Array.from(menu.querySelectorAll(
      'a[href], button:not([disabled]), input[type="button"], input[type="submit"], [role="menuitem"], .ui_actions_menu_item'
    )).filter(el => el.offsetParent !== null); // visible only
  }

  function getPageBlock(el) {
    return el?.closest?.('.page_block') || null;
  }

  function elevatePageBlock(pageBlock, elevate) {
    if (!pageBlock) return;
    if (elevate) {
      pageBlock.style.zIndex = 'calc(var(--action-menu-z-index, 5) + 1)';
    } else {
      // only remove if no other open menus remain inside this page_block
      const stillOpen = pageBlock.querySelector('.ui_actions_menu_wrap.shown');
      if (!stillOpen) {
        pageBlock.style.zIndex = '';
      }
    }
  }

  // ——— ARIA & focus ———
  function setAria(el, shown) {
    const trigger = firstNonMenuChild(el) || el;
    const menu = geByClass1('ui_actions_menu', el);

    if (trigger) {
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', shown ? 'true' : 'false');
    }
    if (menu) {
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-hidden', shown ? 'false' : 'true');
      if (shown) {
        // make items focusable
        getMenuItems(menu).forEach(item => {
          if (!item.hasAttribute('tabindex')) item.tabIndex = -1;
        });
      }
    }
  }

  function focusFirstItem(menu) {
    const items = getMenuItems(menu);
    if (items.length) items[0].focus({ preventScroll: true });
  }

  function handleMenuKeydown(ev, wrap) {
    const menu = geByClass1('ui_actions_menu', wrap);
    if (!menu || !hasClass(wrap, 'shown')) return;

    const items = getMenuItems(menu);
    if (!items.length) return;

    const current = document.activeElement;
    let idx = items.indexOf(current);

    switch (ev.key) {
      case 'Escape':
        ev.preventDefault();
        uiActionsMenu.toggle(wrap, false, { immediate: true });
        (firstNonMenuChild(wrap) || wrap).focus();
        break;
      case 'ArrowDown':
        ev.preventDefault();
        idx = idx < items.length - 1 ? idx + 1 : 0;
        items[idx].focus();
        break;
      case 'ArrowUp':
        ev.preventDefault();
        idx = idx > 0 ? idx - 1 : items.length - 1;
        items[idx].focus();
        break;
      case 'Home':
        ev.preventDefault();
        items[0].focus();
        break;
      case 'End':
        ev.preventDefault();
        items[items.length - 1].focus();
        break;
      case 'Tab':
        // allow natural tab, but close menu
        uiActionsMenu.toggle(wrap, false, { immediate: true });
        break;
    }
  }

  // ——— positioning ———
  function positionArrow(el, options) {
    const menu = geByClass1('ui_actions_menu', el);
    if (!menu || hasClass(el, 'ui_actions_menu_no_chevron')) return;

    menu.style.display = 'block';

    const triggerWrap = data(el, 'origMenu') || el;
    const trigger = firstNonMenuChild(triggerWrap) || triggerWrap;

    const wrapRect = rectOf(el);
    const triggerRect = rectOf(trigger);

    const verticalOffset = Math.max(triggerRect.bottom - wrapRect.top, wrapRect.height);
    menu.style.setProperty('--ui-actions-menu-vertical-offset', verticalOffset + 'px');

    if (!options?.autopos) {
      let align = options?.align;
      if (hasClass(el, 'ui_actions_menu_left')) align = 'left';
      else if (!align) align = data(el, 'uiActionsMenuAlign');

      removeClass(el, 'ui_actions_menu_left_align');
      removeClass(el, 'ui_actions_menu_center_align');

      if (align === 'left') {
        addClass(el, 'ui_actions_menu_left_align');
      } else if (align === 'center') {
        addClass(el, 'ui_actions_menu_center_align');
      } else if (align !== 'right' && wrapRect.width >= triggerRect.width) {
        const leftSpace = triggerRect.left - wrapRect.left;
        const rightSpace = wrapRect.right - triggerRect.right;
        if (leftSpace <= rightSpace) addClass(el, 'ui_actions_menu_left_align');
      }
      data(el, 'uiActionsMenuAlign', align);
    }

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

    menu.style.top = menu.style.left = menu.style.right = '';
  }

  function positionAutopos(el, options, menu) {
    if (!menu) return;

    // Force layout so offsetHeight is accurate
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';
    menu.offsetHeight;

    menu.style.maxWidth = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.transform = '';

    removeClass(el, 'ui_actions_menu_left_align');
    removeClass(el, 'ui_actions_menu_center_align');
    removeClass(el, 'ui_actions_menu_top');
    addClass(el, 'no_transition');

    const trigger = firstNonMenuChild(el) || el;
    const triggerRect = rectOf(trigger);
    const elRect = rectOf(el);
    const menuHeight = menu.offsetHeight;
    const menuWidth  = menu.offsetWidth;
    const gap = options.dy ?? DEFAULT_AUTOPOS_GAP;
    const bounds = computeBounds(el);

    // Restore visibility
    menu.style.visibility = '';

    // Vertical decision – use the TRIGGER rect
    if (shouldFlipAbove(triggerRect, menuHeight, bounds, gap)) {
      addClass(el, 'ui_actions_menu_top');
    }

    // vertical flip
    if (shouldFlipAbove(elRect, menuHeight, bounds, gap)) {
      addClass(el, 'ui_actions_menu_top');
    }

    // side menus keep their own horizontal rules
    if (hasClass(el, 'ui_actions_menu_left')) {
      requestAnimationFrame(() => removeClass(el, 'no_transition'));
      return;
    }

    const preferred = options.align;
    const triggerCenter = triggerRect.left + triggerRect.width / 2;

    // Ideal centered position (relative to the viewport)
    let desiredLeft = triggerCenter - menuWidth / 2;

    // Does a true center fit inside the bounds?
    const centerFits =
      desiredLeft >= bounds.left &&
      desiredLeft + menuWidth <= bounds.right;

    let finalLeft;

    if (centerFits && preferred !== 'left' && preferred !== 'right') {
      // Prefer center
      finalLeft = desiredLeft;
      addClass(el, 'ui_actions_menu_center_align');
    } else {
      // Fall back to left / right preference
      const leftAvailable = bounds.right - triggerRect.left;   // space to the right of trigger
      const rightAvailable = triggerRect.right - bounds.left;   // space to the left of trigger

      const leftFits = menuWidth <= leftAvailable;
      const rightFits = menuWidth <= rightAvailable;

      let alignLeft;
      if (preferred === 'left' && leftFits) {
        alignLeft = true;
      } else if (preferred === 'right' && rightFits) {
        alignLeft = false;
      } else if (leftFits && rightFits) {
        // pick the side that has more room
        alignLeft = leftAvailable > rightAvailable;
      } else if (leftFits) {
        alignLeft = true;
      } else if (rightFits) {
        alignLeft = false;
      } else {
        alignLeft = leftAvailable > rightAvailable;
      }

      if (alignLeft) {
        // left edge of menu = left edge of trigger
        finalLeft = triggerRect.left;
        addClass(el, 'ui_actions_menu_left_align');
      } else {
        // right edge of menu = right edge of trigger
        finalLeft = triggerRect.right - menuWidth;
      }
    }

    // Final clamp so we never overflow the bounds
    finalLeft = Math.max(bounds.left, Math.min(finalLeft, bounds.right - menuWidth));

    // Apply the position relative to the wrap
    menu.style.left = (finalLeft - elRect.left) + 'px';
    menu.style.right = 'auto';
    menu.style.transform = 'none';

    // If the menu is still too wide, constrain it
    if (menuWidth > bounds.right - bounds.left) {
      menu.style.maxWidth = (bounds.right - bounds.left) + 'px';
    }

    requestAnimationFrame(() => removeClass(el, 'no_transition'));
  }

  // ——— public API ———
  window.uiActionsMenu = {
    keyToggle(el, ev) {
      if (!checkKeyboardEvent(ev)) return false;
      const wrap = domClosest('ui_actions_menu_wrap', el);
      if (wrap) this.toggle(wrap, !hasClass(wrap, 'shown'));
    },

    toggle(el, s, options = {}) {
      const dummyMenu = data(el, 'dummyMenu');
      if (dummyMenu) el = dummyMenu;

      // clicking inside an open menu should close it
      if ((s === undefined || s === null) && window.event?.type === 'click') {
        const target = window.event.target;
        if (target?.closest?.('.ui_actions_menu')) s = false;
      }

      const isShown = hasClass(el, 'shown');
      const willShow = (s === undefined || s === null) ? !isShown : !!s;
      let menu = geByClass1('ui_actions_menu', el);
      const noAnimate = !!(options.noAnimate || prefersReducedMotion());
      const immediate = !!options.immediate;

      // clear pending hide
      const hideTimer = data(el, 'hideTimer');
      if (hideTimer) {
        clearTimeout(hideTimer);
        data(el, 'hideTimer', 0);
        if (menu) removeClass(menu, 'ui_actions_menu_hiding');
      }

      if (typeof options.noChevron !== 'undefined') {
        toggleClass(el, 'ui_actions_menu_no_chevron', !!options.noChevron);
      }
      if (typeof options.noAnimate !== 'undefined') {
        toggleClass(el, 'ui_actions_menu_no_animate', !!options.noAnimate);
      }

      if (willShow) {
        if (menu) removeClass(menu, 'ui_actions_menu_hiding');
        if (options.menuId) {
          ensureMenu(el, options.menuId);
          menu = geByClass1('ui_actions_menu', el);
        }
        if (menu) menu.style.display = 'block';

        const pageBlock = getPageBlock(el);
        if (pageBlock) {
          data(el, 'pageBlock', pageBlock);
          elevatePageBlock(pageBlock, true);
        }

        const isMobile = window.isMobile && window.isMobile();
        const shouldAutopos =
          isMobile ||
          options.autopos === true ||
          (options.autopos !== false && !options.align);

        if (shouldAutopos) {
          options.autopos = true;               // tell positionArrow to stay hands-off
          data(el, 'autoposOptions', options);
          positionAutopos(el, options, menu);
        }

        positionArrow(el, options);
        addClass(el, 'shown');
        setAria(el, true);

        if (menu && !options.noFocus) {
          requestAnimationFrame(() => focusFirstItem(menu));
        }
      } else {
        if (!isShown) return;

        const doHide = () => {
          removeClass(el, 'shown');
          if (menu) {
            removeClass(menu, 'ui_actions_menu_hiding');
            menu.style.display = 'none';
          }
          const pageBlock = data(el, 'pageBlock');
          elevatePageBlock(pageBlock, false);
          data(el, 'pageBlock', null);

          const onhide = el.getAttribute('onHide');
          if (onhide) runHandler(onhide, el);
        };

        if (immediate || noAnimate) {
          doHide();
        } else {
          if (menu) addClass(menu, 'ui_actions_menu_hiding');
          data(el, 'hideTimer', setTimeout(() => {
            data(el, 'hideTimer', 0);
            doHide();
          }, HIDE_DURATION));
        }
      }

      if (options.onToggle) {
        const script = options.onToggle.replace('{isShow}', String(willShow));
        runHandler(script, el);
      }
    },

    show(el, ev, options = {}) {
      if (window.isMobile && window.isMobile()) return;

      // cancel any pending hide
      let ht = data(el, 'hidetimer');
      if (ht) {
        clearTimeout(ht);
        data(el, 'hidetimer', 0);
      }
      const orig = data(el, 'origMenu');
      if (orig && (ht = data(orig, 'hidetimer'))) {
        clearTimeout(ht);
        data(el, 'hidetimer', 0);
      }

      // delayed show
      if (options.delay) {
        if (window.__uiActionsMenuShowTimeout) clearTimeout(window.__uiActionsMenuShowTimeout);
        const delay = options.delay;
        delete options.delay;
        window.__uiActionsMenuShowTimeout = setTimeout(
          () => uiActionsMenu.show(el, ev, options),
          delay
        );
        return;
      }
      if (window.__uiActionsMenuShowTimeout) {
        clearTimeout(window.__uiActionsMenuShowTimeout);
        delete window.__uiActionsMenuShowTimeout;
      }

      if (options.menuId) ensureMenu(el, options.menuId);

      // dummy menu (portal-like)
      if (options.appendParentCls) {
        let menu = geByClass1('ui_actions_menu', el);
        if (menu) {
          const appendEl = domClosest(options.appendParentCls, menu);
          const menuWrap = domClosest('ui_actions_menu_wrap', el);
          const newWrap = se(
            `<div class="${menuWrap ? menuWrap.className : 'ui_actions_menu_wrap'} ui_actions_menu_dummy_wrap"
                  onmouseover="uiActionsMenu.show(this);"
                  onmouseout="uiActionsMenu.hide(this);"></div>`
          );
          newWrap.appendChild(menu);
          appendEl?.appendChild(newWrap);

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
          el = data(el, 'dummyMenu') || el;
        }
        positionDummyMenu(el);
      }

      const menu = geByClass1('ui_actions_menu', el);
      if (options.scroll && options.maxHeight && menu) {
        menu.style.maxHeight = (intval(options.maxHeight) || 200) + 'px';
        if (!menu.__uiScroll__) {
          menu.style.overflowY = 'auto';
          menu.__uiScroll__ = true;
        }
      }

      this.toggle(el, true, options);
    },

    hide(el, ev, options) {
      if (window.isMobile && window.isMobile()) return;

      if (window.__uiActionsMenuShowTimeout) {
        clearTimeout(window.__uiActionsMenuShowTimeout);
        delete window.__uiActionsMenuShowTimeout;
      }

      let delay = data(el, 'hidedelay');
      if (delay) data(el, 'hidedelay', false);
      else delay = DEFAULT_HIDE_DELAY;

      if (data(el, 'hidetimer')) return; // already scheduled

      data(el, 'hidetimer', setTimeout(() => {
        this.toggle(el, false, options);
        data(el, 'hidetimer', 0);
      }, delay));
    },

    hideDelay(el, delay) {
      data(el, 'hidedelay', delay);
    },

    // new helper for dynamic menus
    destroy(el) {
      const dummy = data(el, 'dummyMenu');
      if (dummy) {
        dummy.remove();
        data(el, 'dummyMenu', null);
      }
      this.toggle(el, false, { immediate: true });
      dataStore.delete(el);
    }
  };

  // ——— global listeners ———
  window.addEventListener('resize', () => {
    document.querySelectorAll('.ui_actions_menu_wrap.shown').forEach(wrap => {
      const dummy = data(wrap, 'dummyMenu');
      if (dummy) positionDummyMenu(dummy);

      const autoposOptions = data(wrap, 'autoposOptions');
      const menu = geByClass1('ui_actions_menu', wrap);
      if (autoposOptions && menu) {
        positionAutopos(wrap, autoposOptions, menu);
        positionArrow(wrap, autoposOptions);
      } else if (menu) {
        positionArrow(wrap, { align: data(wrap, 'uiActionsMenuAlign') });
      }
    });
  }, { passive: true });

  document.addEventListener('keydown', ev => {
    const open = document.querySelector('.ui_actions_menu_wrap.shown');
    if (open) handleMenuKeydown(ev, open);
  });

  document.addEventListener('click', ev => {
    const wrap = ev.target.closest('.ui_actions_menu_wrap');
    const menu = ev.target.closest('.ui_actions_menu');

    // mobile toggle
    if (window.isMobile && window.isMobile()) {
      if (wrap && !wrap.getAttribute('onclick') && !menu) {
        uiActionsMenu.toggle(wrap, null);
      }
    }

    // click on actionable item → close immediately
    if (wrap && menu) {
      const item = ev.target.closest('a, button, input[type="button"], input[type="submit"], .ui_actions_menu_item');
      if (item && !item.classList.contains('ui_actions_menu')) {
        uiActionsMenu.toggle(wrap, false, { immediate: true });
      }
    }

    // outside click
    document.querySelectorAll('.ui_actions_menu_wrap.shown').forEach(openWrap => {
      if (!openWrap.contains(ev.target)) {
        uiActionsMenu.toggle(openWrap, false);
      }
    });
  }, true);
});