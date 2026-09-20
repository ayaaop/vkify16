(function() {
    vkify.musicPopup = vkify.musicPopup || {};
    let profileAppbarScrollHandler = null;
    let appbarElevationScrollHandler = null;

    window.vkify.ready(() => {
        const body = document.body;

        u(document).on('click', (e) => {
            const target = u(e.target);

            if (target.closest('#mobileMenuTrigger').length > 0) {
                e.preventDefault();
                e.stopPropagation();
                if (body.classList.contains('menu-expanded')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
                return;
            }
        });

        document.addEventListener('click', (e) => {
            const t = e.target;
            if (!t) return;
            if (body.classList.contains('menu-expanded') && (t.classList?.contains('dimmer') || t.id === 'clickable')) {
                e.stopImmediatePropagation();
                closeSidebar();
            }
        }, true);

        u(document).on('click', '.sidebar a:not([href^="javascript:"])', () => {
            if (body.classList.contains('menu-expanded')) {
                closeSidebar();
            }
        });

        function openSidebar() {
            body.classList.add('menu-expanded');
            body.classList.add('dimmed');
        }

        function closeSidebar() {
            body.classList.remove('menu-expanded');
            body.classList.remove('dimmed');
        }

        function updateHamburgerBadge() {
            const sidebar = document.querySelector('.sidebar');
            const badge = document.getElementById('hamburgerBadge');
            if (!sidebar || !badge) return;

            let total = 0;
            sidebar.querySelectorAll('.link b').forEach(el => {
                const value = parseInt(el.textContent.trim(), 10);
                if (!isNaN(value)) {
                    total += value;
                }
            });

            badge.textContent = total > 0 ? total : '';
        }

        updateHamburgerBadge();

        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            new MutationObserver(updateHamburgerBadge).observe(sidebar, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }

        setupSidebarPlayerOnce();
    });

    vkify.onPage(bindSidebarPlayerDOM);

    function setupTransparentAppbar() {
        if (!isMobileViewport()) return;

        const appbar = document.getElementById('appbar');
        if (!appbar || !appbar.classList.contains('appbar--transparent')) return;

        const hero = document.querySelector('.mobile-profile-hero');

        document.body.classList.add('has-transparent-appbar');
        const heroHeight = hero ? hero.offsetHeight : 200;
        const applyAppbarScrollState = function() {
            const scrollY = window.scrollY || window.pageYOffset;
            const progress = Math.min(scrollY / Math.max(heroHeight - 56, 1), 1);
            appbar.style.setProperty('--appbar-bg-alpha', progress);
            if (progress <= 0) {
                appbar.classList.add('appbar--transparent');
                appbar.classList.remove('appbar--scrolled');
            } else if (progress >= 1) {
                appbar.classList.remove('appbar--transparent');
                appbar.classList.add('appbar--scrolled');
            } else {
                appbar.classList.remove('appbar--transparent', 'appbar--scrolled');
            }
        };

        let appbarScrollRafPending = false;
        if (profileAppbarScrollHandler) {
            window.removeEventListener('scroll', profileAppbarScrollHandler);
        }
        profileAppbarScrollHandler = function() {
            if (appbarScrollRafPending) return;
            appbarScrollRafPending = true;
            requestAnimationFrame(() => {
                appbarScrollRafPending = false;
                applyAppbarScrollState();
            });
        };
        applyAppbarScrollState();
        window.addEventListener('scroll', profileAppbarScrollHandler, {'passive': true});
    }

    function setupAppbarElevation() {
        if (!isMobileViewport()) return;

        const appbar = document.getElementById('appbar');
        if (!appbar || appbar.classList.contains('appbar--transparent')) return;

        const applyAppbarElevation = function() {
            appbar.classList.toggle('appbar--elevated',
                (window.scrollY || window.pageYOffset) > 0);
        };

        let rafPending = false;
        if (appbarElevationScrollHandler) {
            window.removeEventListener('scroll', appbarElevationScrollHandler);
        }
        appbarElevationScrollHandler = function() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                applyAppbarElevation();
            });
        };
        applyAppbarElevation();
        window.addEventListener('scroll', appbarElevationScrollHandler, {'passive': true});
    }

    function resetTransparentAppbar() {
        if (profileAppbarScrollHandler) {
            window.removeEventListener('scroll', profileAppbarScrollHandler);
            profileAppbarScrollHandler = null;
        }
        if (appbarElevationScrollHandler) {
            window.removeEventListener('scroll', appbarElevationScrollHandler);
            appbarElevationScrollHandler = null;
        }
        document.body.classList.remove('has-transparent-appbar');
        const appbar = document.getElementById('appbar');
        if (appbar) {
            appbar.classList.remove('appbar--transparent', 'appbar--scrolled', 'appbar--elevated');
            appbar.style.removeProperty('--appbar-bg-alpha');
        }
    }

    vkify.onPageLifecycle('beforePageLeave', () => {
        resetTransparentAppbar();
    });
    vkify.onPageLifecycle('afterPageReady', () => {
        setupTransparentAppbar();
        setupAppbarElevation();
    });

    let tabsMenuState = null;

    function isMobileViewport() {
        if (typeof window.isMobile === 'function') {
            return window.isMobile();
        }
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function teardownTabsMenu() {
        if (!tabsMenuState) return;
        const state = tabsMenuState;
        tabsMenuState = null;
        try {
            if (state.keydownHandler && state.titleEl) {
                state.titleEl.removeEventListener('keydown', state.keydownHandler);
            }
            if (state.wrap && state.wrap.parentNode && state.titleEl) {
                state.wrap.parentNode.insertBefore(state.titleEl, state.wrap);
                state.wrap.remove();
            }
            if (state.appbarExtraEl && state.appbarExtraEl.parentNode) {
                state.appbarExtraEl.remove();
            }
            if (state.titleEl) {
                state.titleEl.classList.remove('appbar-title--tabs-menu');
                state.titleEl.removeAttribute('tabindex');
                state.titleEl.removeAttribute('role');
                if (typeof state.originalTitleHTML === 'string') {
                    state.titleEl.innerHTML = state.originalTitleHTML;
                }
            }
        } catch (e) {
            /* appbar may already be gone during teardown */
        }
    }

    function setupTabsMenu() {
        if (tabsMenuState && tabsMenuState.wrap && document.contains(tabsMenuState.wrap)) return;
        teardownTabsMenu();
        if (!isMobileViewport()) return;

        const appbar = document.getElementById('appbar');
        const titleEl = appbar ? appbar.querySelector('.appbar-title') : null;
        if (!appbar || !titleEl) return;

        const tabsRoot = document.querySelector('.tabs_header.show_as_menu_on_mobile');
        if (!tabsRoot) return;

        const items = [];
        tabsRoot.querySelectorAll('ul > li > a.ui_tab').forEach((anchor) => {
            if (anchor.classList.contains('nomobile')) return;
            const li = anchor.closest('li');
            if (li && li.classList.contains('ui_tabs_extra')) return;
            const href = anchor.getAttribute('href');
            if (!href) return;
            const isSubitem = anchor.classList.contains('ui_tab_subitem') || !!anchor.closest('.ui_tab_subitem_wrap');
            const labelClone = anchor.cloneNode(true);
            labelClone.querySelectorAll('img, .ui_tab_count, .ui_tab_extra_item').forEach((node) => node.remove());
            const label = (labelClone.textContent || '').trim().replace(/\s+/g, ' ');
            if (!label) return;
            const countEl = anchor.querySelector('.ui_tab_count');
            const extraEl = anchor.querySelector('.ui_tab_extra_item');
            items.push({
                href: href,
                label: label,
                count: countEl ? countEl.textContent.trim() : '',
                active: anchor.classList.contains('ui_tab_sel'),
                onclick: anchor.getAttribute('onclick'),
                isSubitem: isSubitem,
                extraHtml: extraEl ? extraEl.innerHTML : '',
                extraClass: extraEl ? extraEl.className : '',
            });
        });
        if (items.length === 0) return;

        const activeItem = items.find((item) => item.active) || null;
        const originalTitleHTML = titleEl.innerHTML;
        const originalTitleText = (titleEl.textContent || '').trim();

        const wrap = document.createElement('div');
        wrap.className = 'ui_actions_menu_wrap ui_actions_menu_no_chevron appbar-tabs-menu-wrap';
        wrap.setAttribute('onclick', 'if (event.target.closest(\'.ui_actions_menu\')) return; uiActionsMenu.toggle(this, null, {align: \'left\', noChevron: true});');

        const menu = document.createElement('div');
        menu.className = 'ui_actions_menu appbar-tabs-menu';
        menu.setAttribute('role', 'menu');
        items.forEach((item) => {
            const row = document.createElement('div');
            let itemCls = 'appbar-tabs-menu-item';
            if (item.active) itemCls += ' appbar-tabs-menu-item--active';
            if (item.isSubitem) itemCls += ' appbar-tabs-menu-item--subitem';
            row.className = itemCls;

            const link = document.createElement('a');
            link.setAttribute('href', item.href);
            if (item.onclick) link.setAttribute('onclick', item.onclick);
            link.className = 'appbar-tabs-menu-link';
            if (item.active) link.setAttribute('aria-current', 'page');

            const labelSpan = document.createElement('span');
            labelSpan.className = 'appbar-tabs-menu-label';
            labelSpan.textContent = item.label;
            link.appendChild(labelSpan);

            if (item.count) {
                const badge = document.createElement('span');
                badge.className = 'appbar-tabs-menu-count';
                badge.textContent = item.count;
                link.appendChild(badge);
            }
            row.appendChild(link);

            if (item.extraHtml) {
                const extraSpan = document.createElement('span');
                extraSpan.className = 'appbar-tabs-menu-extra ' + (item.extraClass || '');
                extraSpan.innerHTML = item.extraHtml;
                extraSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                row.appendChild(extraSpan);
            }
            menu.appendChild(row);
        });

        titleEl.innerHTML = '';
        titleEl.classList.add('appbar-title--tabs-menu');
        titleEl.setAttribute('tabindex', '0');
        titleEl.setAttribute('role', 'button');
        const titleLabel = document.createElement('span');
        titleLabel.className = 'appbar-title-label';
        titleLabel.textContent = activeItem ? activeItem.label : originalTitleText;
        const chevron = document.createElement('span');
        chevron.className = 'appbar-title-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><use href="#chevron-down-24"></use></svg>';
        titleEl.appendChild(titleLabel);
        titleEl.appendChild(chevron);

        const keydownHandler = (e) => {
            if (window.uiActionsMenu && typeof window.uiActionsMenu.keyToggle === 'function') {
                window.uiActionsMenu.keyToggle(titleEl, e);
            }
        };
        titleEl.addEventListener('keydown', keydownHandler);

        titleEl.parentNode.insertBefore(wrap, titleEl);
        wrap.appendChild(titleEl);
        wrap.appendChild(menu);

        let appbarExtraEl = null;
        let appbarExtraContainer = appbar.querySelector('.appbar-extra');
        if (!appbarExtraContainer) {
            appbarExtraContainer = document.createElement('div');
            appbarExtraContainer.className = 'appbar-extra';
            appbar.appendChild(appbarExtraContainer);
        }

        const existingExtraBtn = appbarExtraContainer.querySelector('.appbar-extra-btn, a, button');
        if (!existingExtraBtn) {
            const tabsExtraLi = tabsRoot.querySelector('li.ui_tabs_extra');
            if (activeItem && activeItem.extraHtml && activeItem.extraHtml.includes('ui_actions_menu_wrap')) {
                const extraWrap = document.createElement('div');
                extraWrap.className = 'appbar-extra-btn-wrap';
                extraWrap.innerHTML = activeItem.extraHtml;
                const innerTrigger = extraWrap.querySelector('.ui_actions_menu_wrap');
                if (innerTrigger) {
                    innerTrigger.classList.add('appbar-extra-btn');
                }
                appbarExtraContainer.appendChild(extraWrap);
                appbarExtraEl = extraWrap;
            } else if (tabsExtraLi && tabsExtraLi.firstElementChild) {
                const extraBtnWrap = document.createElement('div');
                extraBtnWrap.className = 'appbar-extra-btn-wrap';
                const clonedExtra = tabsExtraLi.firstElementChild.cloneNode(true);
                clonedExtra.classList.add('appbar-extra-btn');
                extraBtnWrap.appendChild(clonedExtra);
                appbarExtraContainer.appendChild(extraBtnWrap);
                appbarExtraEl = extraBtnWrap;
            }
        }

        tabsRoot.remove();

        tabsMenuState = {
            wrap: wrap,
            titleEl: titleEl,
            originalTitleHTML: originalTitleHTML,
            keydownHandler: keydownHandler,
            appbarExtraEl: appbarExtraEl,
        };
    }

    vkify.onPage(setupTabsMenu);
    vkify.onPageLifecycle('beforePageLeave', teardownTabsMenu);

    function setupSidebarPlayerOnce() {
        if (!vkify.bindOnce('sidebarPlayerSetup', setupSidebarPlayerOnce)) return;

        function updateSidebarPlayer() {
            const sidebarPlayer = document.querySelector('#sidebar_audio_player');
            if (!sidebarPlayer) return;
            const sidebarTrackName = sidebarPlayer.querySelector('.sidebar_ap_track_name');
            const sidebarTrackPerformer = sidebarPlayer.querySelector('.sidebar_ap_track_performer');

            if (window.player && window.player.currentTrack) {
                sidebarPlayer.classList.add('sidebar_audio_player_active');

                const trackId = window.player.currentTrack.id;
                if (sidebarPlayer.dataset.currentTrackId !== String(trackId)) {
                    sidebarPlayer.dataset.currentTrackId = trackId;
                    if (sidebarTrackName) sidebarTrackName.style.opacity = '0';
                    if (sidebarTrackPerformer) sidebarTrackPerformer.style.opacity = '0';
                    setTimeout(() => {
                        if (sidebarTrackName) {
                            sidebarTrackName.textContent = window.player.currentTrack.name;
                            sidebarTrackName.style.opacity = '1';
                        }
                        if (sidebarTrackPerformer) {
                            sidebarTrackPerformer.textContent = window.player.currentTrack.performer;
                            sidebarTrackPerformer.style.opacity = '1';
                        }
                    }, 80);
                }

                sidebarPlayer.classList.toggle('sidebar_audio_player_playing', !window.player.audioPlayer.paused);
            } else {
                sidebarPlayer.classList.remove('sidebar_audio_player_active', 'sidebar_audio_player_playing');
                sidebarPlayer.dataset.currentTrackId = '';
                if (sidebarTrackName) sidebarTrackName.textContent = '';
                if (sidebarTrackPerformer) sidebarTrackPerformer.textContent = '';
            }
        }

        vkify.musicPopup.updateSidebarPlayer = updateSidebarPlayer;

        function attachAudioListeners() {
            if (!window.player?.audioPlayer) return;
            window.player.audioPlayer.addEventListener('play', updateSidebarPlayer);
            window.player.audioPlayer.addEventListener('pause', updateSidebarPlayer);
        }

        const tryWrapUpdateFace = () => {
            if (!window.player || typeof window.player.__updateFace !== 'function') return false;
            if (window.player.__vkifyMusicPopupWrappedUpdateFaceSidebar) return true;
            window.player.__vkifyMusicPopupWrappedUpdateFaceSidebar = true;
            vkify.hook(window.player, '__updateFace', updateSidebarPlayer, 'after');
            return true;
        };

        if (window.player && typeof window.player.initEvents === 'function' && !window.player.__vkifySidebarPatchedInitEvents) {
            window.player.__vkifySidebarPatchedInitEvents = true;
            vkify.hook(window.player, 'initEvents', function() {
                attachAudioListeners();
                tryWrapUpdateFace();
                updateSidebarPlayer();
            }, 'after');
        }

        attachAudioListeners();
        tryWrapUpdateFace();
        updateSidebarPlayer();

        vkify.musicPopup.tryWrapUpdateFaceSidebar = tryWrapUpdateFace;
    }

    function bindSidebarPlayerDOM() {
        const sidebarPlayer = document.querySelector('#sidebar_audio_player');
        if (!sidebarPlayer) return;

        const sidebarPlayBtn = sidebarPlayer.querySelector('#sidebar_ap_play_btn');
        const sidebarRightBtn = sidebarPlayer.querySelector('#sidebar_ap_right_btn');
        const sidebarTrackInfo = sidebarPlayer.querySelector('.sidebar_ap_track_info');

        if (sidebarPlayBtn) {
            sidebarPlayBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!window.player?.audioPlayer) return;
                if (window.player.audioPlayer.paused) {
                    window.player.play();
                } else {
                    window.player.pause();
                }
                if (typeof vkify.musicPopup.updateSidebarPlayer === 'function') {
                    vkify.musicPopup.updateSidebarPlayer();
                }
            });
        }

        if (sidebarRightBtn) {
            sidebarRightBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!window.player?.currentTrack) return;
                if (window.player.audioPlayer && !window.player.audioPlayer.paused) {
                    window.player.playNextTrack();
                } else {
                    if (typeof window.player.__resetContext === 'function') {
                        window.player.__resetContext();
                    }
                    window.player.current_track_id = null;
                    window.player.pause();
                    if (typeof vkify.musicPopup.updateSidebarPlayer === 'function') {
                        vkify.musicPopup.updateSidebarPlayer();
                    }
                    if (typeof vkify.musicPopup.updateTopPlayer === 'function') {
                        vkify.musicPopup.updateTopPlayer();
                    }
                    if (typeof window.player.__updateFace === 'function') {
                        window.player.__updateFace();
                    }
                }
            });
        }

        if (sidebarTrackInfo) {
            sidebarTrackInfo.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const uid = window.openvk?.current_id;
                if (!uid) return;
                const url = `/audios${uid}`;
                document.body.classList.remove('menu-expanded', 'dimmed');
                if (window.router?.checkUrl(url)) {
                    window.router.route({ url });
                } else {
                    location.assign(url);
                }
            });
        }

        if (typeof vkify.musicPopup.updateSidebarPlayer === 'function') {
            vkify.musicPopup.updateSidebarPlayer();
        }
        if (typeof vkify.musicPopup.tryWrapUpdateFaceSidebar === 'function') {
            vkify.musicPopup.tryWrapUpdateFaceSidebar();
        }
    }

    // Material Design 2 touch ripples, mobile layout only. A single delegated
    // pointerdown listener covers SPA-swapped content with no rescan: the
    // positioning/clipping classes live only for the duration of the press,
    // so static layout is never affected.
    const RIPPLE_BOUNDED_SELECTOR = '.button, .profile_link'
        + ', .ui_actions_menu a, .ui_actions_menu button, .ui_actions_menu input'
        + ', .ui_actions_menu label, .ui_actions_menu .ui_actions_menu_item'
        + ', .ui_tab, .ui_tab_plain, .sidebar_inner .link, .mobile-info-row'
        + ', .mobile-scroll-card, .action_button, .msg-dropdown-menu .msg-dropdown-item'
        + ', .messenger-app--header--back a, .messenger-app--header--name a';
    const RIPPLE_UNBOUNDED_SELECTOR = '.appbar .hamburger, .appbar-extra-btn'
        + ', .ovk-msg-fullscreen .ovk-diag-head-close, .ovk-msg-fullscreen .ovk-diag-head-apply'
        + ', .ovk-msg-sheet .ovk-diag-head-close, .ovk-msg-sheet .ovk-diag-head-apply'
        + ', .messenger-app--header--ava, .messenger-app-header--more-actions--trigger';

    function rippleEnabled() {
        return window.matchMedia('(max-width: 768px)').matches
            && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function releaseRipple(ink, host) {
        if (!host || !ink || host.__rippleInk !== ink || ink.__rippleReleased) return;
        ink.__rippleReleased = true;
        if (!ink.isConnected) {
            cleanupRipple(host, ink);
            return;
        }
        // Fade from the live rendered state: transitions pick up mid-flight,
        // so an early release never jumps. The end state is plain inline
        // style, which paints even where animation clocks stall.
        ink.style.transition = 'opacity 150ms linear';
        ink.style.opacity = '0';
        const onEnd = (ev) => {
            if (ev.propertyName !== 'opacity') return;
            ink.removeEventListener('transitionend', onEnd);
            cleanupRipple(host, ink);
        };
        ink.addEventListener('transitionend', onEnd);
        // Fallback for frozen frames (background tab): guarded by token.
        setTimeout(() => cleanupRipple(host, ink), 400);
    }

    function clearRippleClip(host) {
        const clip = host.__rippleClip;
        if (!clip) return;
        if (clip.__rippleParent && clip.__rippleMadeRelative) {
            clip.__rippleParent.style.position = '';
        }
        clip.remove();
        host.__rippleClip = null;
    }

    function cleanupRipple(host, onlyToken) {
        if (!host) return;
        if (onlyToken && host.__rippleInk !== onlyToken) return;
        host.querySelectorAll(':scope > .md-ripple-ink').forEach((node) => node.remove());
        clearRippleClip(host);
        host.classList.remove('md-ripple', 'md-ripple--unbounded');
        if (host.__rippleRelease) {
            host.removeEventListener('contextmenu', host.__rippleRelease);
            host.__rippleRelease = null;
        }
        if (!onlyToken || host.__rippleInk === onlyToken) host.__rippleInk = null;
    }

    document.addEventListener('pointerdown', (e) => {
        if (!rippleEnabled()) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        // When bounded and unbounded hosts nest (e.g. a .ui_actions_menu
        // rendered inside a button.appbar-extra-btn wrap), the deepest match
        // wins so the ripple lands on the pressed item, not its container.
        const boundedHost = e.target?.closest?.(RIPPLE_BOUNDED_SELECTOR);
        const unboundedHost = e.target?.closest?.(RIPPLE_UNBOUNDED_SELECTOR);
        let host = boundedHost || unboundedHost;
        let unbounded = !boundedHost && !!unboundedHost;
        if (boundedHost && unboundedHost) {
            if (unboundedHost.contains(boundedHost)) {
                host = boundedHost;
                unbounded = false;
            } else {
                host = unboundedHost;
                unbounded = true;
            }
        }
        if (!host) return;
        if (host.hasAttribute('disabled') || host.classList.contains('disabled')) return;

        const rect = host.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        // Replaced elements (<input>) render no children, so the ripple is
        // painted in an overlay clip box aligned over the element. The clip
        // is positioned against the parent, scrolled and stacked with it.
        let rippleBox = host;
        clearRippleClip(host);
        if (host.tagName === 'INPUT' || host.tagName === 'IMG') {
            const parent = host.parentElement;
            if (!parent) return;
            const clip = document.createElement('div');
            clip.className = 'md-ripple-ink-clip';
            let madeRelative = false;
            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
                madeRelative = true;
            }
            const parentRect = parent.getBoundingClientRect();
            clip.style.left = (rect.left - parentRect.left) + 'px';
            clip.style.top = (rect.top - parentRect.top) + 'px';
            clip.style.width = rect.width + 'px';
            clip.style.height = rect.height + 'px';
            clip.style.borderRadius = window.getComputedStyle(host).borderRadius;
            // The ink paints with currentColor: inherit the host's text color
            // explicitly, since the overlay lives under the form, not the
            // control (e.g. light label on an accent button).
            clip.style.color = window.getComputedStyle(host).color;
            clip.__rippleParent = parent;
            clip.__rippleMadeRelative = madeRelative;
            host.__rippleClip = clip;
            parent.appendChild(clip);
            rippleBox = clip;
        } else {
            host.classList.add('md-ripple');
            if (unbounded) host.classList.add('md-ripple--unbounded');
        }
        host.querySelectorAll(':scope > .md-ripple-ink').forEach((node) => node.remove());

        const ink = document.createElement('span');
        ink.className = 'md-ripple-ink';
        ink.setAttribute('aria-hidden', 'true');

        let size, originX, originY, driftX, driftY;
        if (unbounded) {
            size = Math.ceil(Math.max(rect.width, rect.height));
            originX = rect.width / 2;
            originY = rect.height / 2;
            driftX = 0;
            driftY = 0;
        } else {
            size = Math.ceil(Math.hypot(rect.width, rect.height));
            originX = (typeof e.clientX === 'number' ? e.clientX - rect.left : rect.width / 2);
            originY = (typeof e.clientY === 'number' ? e.clientY - rect.top : rect.height / 2);
            // Drift toward the element center while expanding, like MDC Web's
            // fg-translate. Transform order keeps the drift in host pixels.
            driftX = rect.width / 2 - originX;
            driftY = rect.height / 2 - originY;
        }
        ink.style.width = size + 'px';
        ink.style.height = size + 'px';
        ink.style.left = (originX - size / 2) + 'px';
        ink.style.top = (originY - size / 2) + 'px';
        ink.style.opacity = '0';
        ink.style.transform = 'translate(0px, 0px) scale(0.3)';
        rippleBox.appendChild(ink);
        host.__rippleInk = ink;

        // Activation splits like MDC Web's: opacity snaps in fast while the
        // radius expands slower and drifts toward the center. Forcing style
        // resolution first makes the end state transition instead of jump,
        // and the resting state is plain inline style so it always paints.
        void ink.offsetWidth;
        ink.style.opacity = '0.12';
        ink.style.transform = 'translate(' + driftX + 'px, ' + driftY + 'px) scale(1)';

        const release = (ev) => {
            // Long-press on a ripple host must not summon the context menu.
            if (ev && ev.type === 'contextmenu') ev.preventDefault();
            releaseRipple(ink, host);
        };
        if (host.__rippleRelease) host.removeEventListener('contextmenu', host.__rippleRelease);
        host.__rippleRelease = release;
        window.addEventListener('pointerup', release, { once: true });
        window.addEventListener('pointercancel', release, { once: true });
        window.addEventListener('blur', release, { once: true });
        host.addEventListener('contextmenu', release, { once: true });
        setTimeout(release, 1200);
    });
})();
