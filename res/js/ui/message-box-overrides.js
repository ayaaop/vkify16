(function () {
'use strict';

let enableSheetGestures = null;

vkify.bindOnce('messageBoxOverrides', () => {
    const applyOverrides = () => {
        const U = window.u;
        const CMB = window.CMessageBox || (typeof CMessageBox !== 'undefined' ? CMessageBox : null);

        if (!U || !CMB || !CMB.prototype) {
            return false;
        }

        const proto = CMB.prototype;
        if (!proto) {
            return false;
        }

        const closeMessageBox = async (msg) => {
            if (msg.close_on_buttons) {
                msg.close();
                return;
            }
            if (msg.warn_on_exit && typeof msg.__showCloseConfirmationDialog === 'function') {
                const res = await msg.__showCloseConfirmationDialog();
                if (res === true) {
                    msg.close();
                }
            } else {
                msg.close();
            }
        };

        // Fullscreen msgbox containers (.ovk-photo-view-dimmer, .ovk-modern-msg)
        // render above body > .dimmer, so stock's 'body.dimmed .dimmer' handler
        // never sees clicks on their backdrop.
        if (!window.__vkifyBackdropCloseBound) {
            window.__vkifyBackdropCloseBound = true;
            document.addEventListener('click', (e) => {
                const t = e.target;
                if (!(t instanceof Element)) return;
                if (t.classList.contains('ovk-msg-minimized')) return;
                if (!t.classList.contains('ovk-photo-view-dimmer') && !t.classList.contains('ovk-modern-msg')) return;

                const stack = window.messagebox_stack;
                const msg = stack && stack[stack.length - 1];
                if (!msg) return;
                if (msg._viewer && typeof msg._viewer.close === 'function') {
                    msg._viewer.close();
                } else {
                    closeMessageBox(msg);
                }
            });
        }

        // appbar elevation for fullscreen viewers: .ovk-appbar-scrolled stays
        // on while the viewer's scroll body is away from the top.
        if (!window.__vkifyViewerScrollBound) {
            window.__vkifyViewerScrollBound = true;
            document.addEventListener('scroll', (e) => {
                const scroller = e.target;
                if (!(scroller instanceof Element)) return;
                if (!scroller.matches('.post_viewer_page, .ovk-video-player-body, .ovk-doc-viewer-body')) return;
                scroller.closest('.ovk-modal-video-window')
                    ?.classList.toggle('ovk-appbar-scrolled', scroller.scrollTop > 0);
            }, true);
        }

        if (!proto.addClass) {
            proto.addClass = function (className) {
                this.getNode?.()?.addClass(className);
                return this;
            };
        }

        if (!proto.__vkifyStackingHooked) {
            proto.__vkifyStackingHooked = true;

            const origExitDialog = proto.__exitDialog;
            proto.__exitDialog = function () {
                const stack = window.messagebox_stack;
                const myIndex = stack?.findIndex(m => m.id === this.id) ?? -1;
                if (myIndex > 0) {
                    const prev = stack[myIndex - 1];
                    const prevNode = prev?.getNode?.();
                    if (prevNode?.length) {
                        prevNode.removeClass('msgbox-hidden');
                        if (prevNode.nodes[0]) {
                            prevNode.nodes[0].style.display = '';
                        }
                    }
                }
                origExitDialog.call(this);
                // Stock clears ?w only via viewer.close(); Escape, __closeMsgs
                // and direct msg.close() bypass it and leave the param behind.
                if (this._viewer && typeof this._viewer._removeW === 'function') {
                    this._viewer._removeW();
                }
            };

            const decorateDialog = (el) => {
                const head = el.querySelector('.ovk-diag-head');
                if (!head) return;
                head.querySelectorAll('#_close, .stickers_modal_close_cross, .ovk-diag-head-close').forEach((btn) => {
                    const parent = btn.parentElement;
                    btn.remove();
                    if (parent && parent !== head && !parent.childNodes.length) {
                        parent.remove();
                    }
                });
                if (head.querySelector('.ovk-diag-head-close')) return;
                const close = document.createElement('div');
                close.className = 'ovk-diag-head-close';
                close.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="ovk-diag-head-close-icon"><use href="#cancel-24"></use></svg>';
                close.addEventListener('click', () => {
                    const msgId = el.dataset?.id;
                    const msg = window.messagebox_stack?.find(m => String(m.id) === msgId);
                    if (msg) closeMessageBox(msg);
                });
                head.appendChild(close);
                if (!head.textContent.trim()) {
                    el.classList.add('ovk-diag-no-title');
                }
                // anonymous flex items can't be truncated — wrap the title text
                const titleText = [...head.childNodes].find(
                    n => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
                );
                if (titleText) {
                    const span = document.createElement('span');
                    span.className = 'ovk-diag-head-title';
                    head.insertBefore(span, titleText);
                    span.appendChild(titleText);
                }
            };

            // the hidden action bar still fires via .click()
            const installHeadApply = (el) => {
                const head = el.querySelector('.ovk-diag-head');
                const confirmBtn = el.querySelector('.ovk-diag-action > .button, .ovk-diag-action > button, .ovk-diag-action > input[type="button"], .ovk-diag-action > input[type="submit"]');
                if (!head || !confirmBtn || head.querySelector('.ovk-diag-head-apply')) return;

                const applyBtn = document.createElement('button');
                applyBtn.type = 'button';
                applyBtn.className = 'ovk-diag-head-apply';
                applyBtn.setAttribute('aria-label', confirmBtn.value || confirmBtn.textContent.trim() || tr('save'));
                applyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><use href="#done-outline-24"></use></svg>';
                applyBtn.addEventListener('click', () => confirmBtn.click());
                head.appendChild(applyBtn);
            };

            // themepack dialogs opt in directly via addClass at creation
            const SHEET_BODY_MARKERS = '.stickers_pack_modal, .audiosInsert, [id^="poll_editor"], #osm-map, #upload_container, #repostMsgInput, #_fast_video_upload, .message-viewers-modal-loader, .message-viewers-list-wrap, .pinned-message-modal-content';
            const FULLSCREEN_BODY_MARKERS = '#_fullyDeleteAudio, #_edit_post_modal, #_new_post_modal, .chat-permissions-desc, .stickers_gift_dialog_body';
            const classifyDialog = (el) => {
                el.querySelectorAll('.ovk-diag-action > .button, .ovk-diag-action > button, .ovk-diag-action > input[type="button"], .ovk-diag-action > input[type="submit"]')
                    .forEach(btn => btn.classList.add('ovk-msg-btn'));
                if (el.querySelector(SHEET_BODY_MARKERS)) {
                    el.classList.add('ovk-msg-sheet');
                }
                if (el.querySelector(FULLSCREEN_BODY_MARKERS)) {
                    el.classList.add('ovk-msg-fullscreen');
                    installHeadApply(el);
                }
                if (!el.classList.contains('ovk-msg-sheet') && !el.classList.contains('ovk-msg-fullscreen')) {
                    el.classList.add('ovk-msg-dialog');
                }
            };

            const watchDialogBodyScroll = (el) => {
                const body = el.querySelector('.ovk-diag-body');
                if (!body) return;
                const action = el.querySelector('.ovk-diag-action');
                let ro, mo, scrollEndTimer = null;
                const isScrollable = () => body.scrollHeight - body.clientHeight > 1;
                const clearScrolled = () => el.classList.remove('ovk-diag-scrolled');
                const update = () => {
                    if (!el.isConnected) {
                        ro?.disconnect();
                        mo?.disconnect();
                        return;
                    }
                    const remaining = body.scrollHeight - body.clientHeight - body.scrollTop;
                    el.classList.toggle('ovk-diag-can-scroll', remaining > 1);
                    if (!isScrollable() || body.scrollTop <= 1) {
                        clearScrolled();
                    }
                    if (action && !el.classList.contains('ovk-diag-stacked')) {
                        el.classList.toggle('ovk-diag-stacked', action.scrollWidth > action.clientWidth + 1);
                    }
                };
                // head divider shows only during an active scroll
                const onBodyScroll = () => {
                    update();
                    if (!isScrollable() || body.scrollTop <= 1) {
                        clearScrolled();
                        return;
                    }
                    el.classList.add('ovk-diag-scrolled');
                    clearTimeout(scrollEndTimer);
                    scrollEndTimer = setTimeout(clearScrolled, 250);
                };
                ro = new ResizeObserver(update);
                mo = new MutationObserver(update);
                ro.observe(body);
                if (action) ro.observe(action);
                mo.observe(body, { childList: true, subtree: true, characterData: true });
                body.addEventListener('scroll', onBodyScroll, { passive: true });
                update();
            };

            // Pins fullscreen dialogs to the visual viewport so bottom-anchored
            // UI isn't covered by the on-screen keyboard or dynamic browser
            // chrome on browsers that only shrink the visual viewport
            // (interactive-widget=resizes-content already covers Chromium).
            const syncFullscreenToVisualViewport = (el) => {
                const vv = window.visualViewport;
                if (!vv || el.__vkifyVvSynced) return;
                el.__vkifyVvSynced = true;
                const apply = () => {
                    if (!el.isConnected) {
                        vv.removeEventListener('resize', apply);
                        vv.removeEventListener('scroll', apply);
                        return;
                    }
                    const mobile = typeof window.isMobile === 'function'
                        ? window.isMobile()
                        : window.matchMedia('(max-width: 768px)').matches;
                    if (!mobile) {
                        el.style.removeProperty('--ovk-vv-height');
                        el.style.top = '';
                        return;
                    }
                    el.style.setProperty('--ovk-vv-height', vv.height + 'px');
                    el.style.top = vv.offsetTop + 'px';
                };
                vv.addEventListener('resize', apply);
                vv.addEventListener('scroll', apply);
                apply();
            };

            enableSheetGestures = (el) => {
                const diag = el.querySelector('.ovk-diag');
                const body = el.querySelector('.ovk-diag-body');
                if (!diag || el.__vkifyGestures) return;
                el.__vkifyGestures = true;
                let drag = null;
                let lastH = null;
                let sizeAnimating = false;

                const dimmer = () => document.querySelector('body.dimmed > .dimmer');
                const currentCap = () => {
                    const mh = parseFloat(getComputedStyle(diag).maxHeight);
                    return isFinite(mh) ? mh : window.innerHeight;
                };
                const naturalHeight = (expanded) => {
                    const h0 = diag.offsetHeight;
                    el.classList.toggle('ovk-msg-sheet--expanded', expanded);
                    diag.style.height = '';
                    const h = diag.offsetHeight;
                    diag.style.height = `${h0}px`;
                    return h;
                };

                diag.addEventListener('touchstart', (e) => {
                    if (e.touches.length > 1) { drag = null; return; }
                    if (e.target.closest('button, a, input, textarea, select, label, .ui_tab, #osm-map')) return;
                    const inBody = !!body?.contains(e.target);
                    if (inBody && body.scrollTop > 0) return;
                    drag = {
                        startY: e.touches[0].clientY,
                        lastY: e.touches[0].clientY,
                        lastT: e.timeStamp,
                        vel: 0,
                        inBody,
                        decided: false,
                        startH: 0, peekH: 0, peekCap: 0, capH: 0,
                    };
                }, { passive: true });

                diag.addEventListener('touchmove', (e) => {
                    if (!drag) return;
                    const y = e.touches[0].clientY;
                    const dy = y - drag.startY;
                    const dt = e.timeStamp - drag.lastT;
                    if (dt > 0) drag.vel = drag.vel * 0.7 + ((y - drag.lastY) / dt) * 0.3;
                    drag.lastY = y;
                    drag.lastT = e.timeStamp;

                    if (!drag.decided) {
                        if (Math.abs(dy) < 6) return;
                        if (drag.inBody && dy < 0
                            && el.classList.contains('ovk-msg-sheet--expanded')
                            && diag.offsetHeight >= currentCap() - 1) {
                            drag = null;
                            return;
                        }
                        drag.decided = true;
                        drag.startH = diag.offsetHeight;
                        drag.peekH = naturalHeight(false);
                        drag.peekCap = currentCap();
                        el.classList.add('ovk-msg-sheet--expanded');
                        drag.capH = currentCap();
                        el.classList.remove('ovk-msg-sheet--expanded');
                        el.classList.add('ovk-msg-sheet--dragging');
                        diag.style.height = `${drag.startH}px`;
                        diag.style.transition = 'none';
                    }
                    e.preventDefault();
                    const h = drag.startH - dy;
                    if (h >= drag.peekH) {
                        diag.style.transform = '';
                        diag.style.height = `${Math.min(h, drag.capH)}px`;
                    } else {
                        diag.style.height = `${drag.peekH}px`;
                        diag.style.transform = `translateY(${drag.peekH - h}px)`;
                    }
                    const d = dimmer();
                    if (d) d.style.opacity = Math.max(0, 0.2 * (1 - Math.max(0, drag.peekH - h) / drag.peekH));
                }, { passive: false });

                const settle = () => {
                    if (!diag.isConnected) {
                        document.removeEventListener('touchend', settle);
                        document.removeEventListener('touchcancel', settle);
                        return;
                    }
                    const d = dimmer();
                    if (d) d.style.opacity = '';
                    if (!drag) return;
                    const g = drag;
                    drag = null;
                    if (!g.decided) {
                        el.classList.remove('ovk-msg-sheet--dragging');
                        return;
                    }

                    const dy = g.lastY - g.startY;
                    const h = g.startH - dy;
                    const v = g.vel;

                    if (h <= g.peekH) {
                        const over = g.peekH - h;
                        if (over > Math.min(120, g.peekH / 3) || v > 0.8) {
                            el.classList.remove('ovk-msg-sheet--dragging');
                            const msgId = el.dataset?.id;
                            const msg = window.messagebox_stack?.find(m => String(m.id) === msgId);
                            diag.style.transition = 'transform .18s ease-in';
                            diag.style.transform = 'translateY(105%)';
                            setTimeout(async () => {
                                if (msg) await closeMessageBox(msg);
                                if (el.isConnected) {
                                    diag.style.transition = 'transform .2s';
                                    diag.style.height = '';
                                    diag.style.transform = '';
                                }
                            }, 160);
                            return;
                        }
                    }

                    const expand = v < -0.4 ? true
                        : v > 0.4 ? false
                        : h > (g.peekH + g.capH) / 2;

                    const visH = Math.min(Math.max(h, g.peekH), expand ? g.capH : g.peekCap);
                    diag.style.height = `${visH}px`;
                    el.classList.toggle('ovk-msg-sheet--expanded', expand);
                    el.classList.remove('ovk-msg-sheet--dragging');
                    diag.style.height = '';
                    const targetH = diag.offsetHeight;
                    diag.style.height = `${visH}px`;
                    void diag.offsetHeight;

                    const needsAnim = Math.abs(visH - targetH) >= 2
                        || (diag.style.transform && diag.style.transform !== 'none');
                    if (!needsAnim) {
                        diag.style.transition = '';
                        diag.style.height = '';
                        return;
                    }
                    sizeAnimating = true;
                    diag.style.transition = 'height .22s cubic-bezier(.4,0,.2,1), transform .22s cubic-bezier(.4,0,.2,1)';
                    diag.style.height = `${targetH}px`;
                    diag.style.transform = '';
                    const settleDone = (e) => {
                        if (e.propertyName !== 'height' && e.propertyName !== 'transform') return;
                        diag.removeEventListener('transitionend', settleDone);
                        diag.style.transition = '';
                        diag.style.height = '';
                        sizeAnimating = false;
                        lastH = diag.offsetHeight;
                    };
                    diag.addEventListener('transitionend', settleDone);
                };
                document.addEventListener('touchend', settle);
                document.addEventListener('touchcancel', settle);

                let endTimer = null;
                let pendingResize = false;
                const onContentResize = () => {
                    if (!diag.isConnected) {
                        sizeRO.disconnect();
                        clearTimeout(endTimer);
                        return;
                    }
                    if (!window.isMobile?.()) {
                        lastH = null;
                        return;
                    }
                    if (drag?.decided) return;
                    if (el.classList.contains('ovk-msg-sheet--resizing')) {
                        if (endTimer) { clearTimeout(endTimer); endTimer = null; }
                        diag.style.transition = '';
                        diag.style.height = '';
                        sizeAnimating = false;
                        pendingResize = false;
                        lastH = diag.offsetHeight;
                        return;
                    }
                    if (sizeAnimating) {
                        pendingResize = true;
                        return;
                    }
                    diag.style.transition = 'none';
                    diag.style.height = '';
                    const newH = diag.offsetHeight;
                    if (lastH === null || Math.abs(newH - lastH) < 2) {
                        diag.style.transition = '';
                        lastH = newH;
                        return;
                    }
                    diag.style.height = `${lastH}px`;
                    void diag.offsetHeight;
                    lastH = newH;
                    sizeAnimating = true;
                    diag.style.transition = 'height .2s ease';
                    diag.style.height = `${newH}px`;
                    const done = (e) => {
                        if (e?.propertyName && e.propertyName !== 'height') return;
                        diag.removeEventListener('transitionend', done);
                        diag.removeEventListener('transitioncancel', done);
                        if (endTimer) { clearTimeout(endTimer); endTimer = null; }
                        if (diag.style.transition !== 'height .2s ease') {
                            sizeAnimating = false;
                            return;
                        }
                        diag.style.transition = '';
                        sizeAnimating = false;
                        if (pendingResize) {
                            pendingResize = false;
                            onContentResize();
                            return;
                        }
                        diag.style.height = '';
                        lastH = diag.offsetHeight;
                    };
                    diag.addEventListener('transitionend', done);
                    diag.addEventListener('transitioncancel', done);
                    endTimer = setTimeout(() => { if (sizeAnimating) done(); }, 350);
                };
                const sizeRO = new ResizeObserver(onContentResize);
                sizeRO.observe(diag);
            };

            vkify.bindOnce('msgboxStackObserver', () => {
                const observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of m.removedNodes) {
                            if (node.nodeType === 1
                                && node.classList?.contains('ovk-msg-sheet')
                                && !document.querySelector('.ovk-msg-sheet')) {
                                document.body.classList.remove('ovk-sheet-dim');
                            }
                        }
                        for (const node of m.addedNodes) {
                            if (node.nodeType === 1 && node.classList?.contains('ovk-msg-all')) {
                                window.tippy?.hideAll?.();
                                decorateDialog(node);
                                classifyDialog(node);
                                watchDialogBodyScroll(node);
                                if (node.classList.contains('ovk-msg-fullscreen')) {
                                    syncFullscreenToVisualViewport(node);
                                }
                                if (node.classList.contains('ovk-msg-sheet')) {
                                    document.body.classList.add('ovk-sheet-dim');
                                    enableSheetGestures(node);
                                }
                                return;
                            }
                        }
                    }
                });
                observer.observe(document.body, { childList: true });
            });
        }

        return true;
    };

    applyOverrides();
    vkify.onPageLifecycle('afterPageReady', applyOverrides, 'after');
});

function replaceMbTabs(mbTabs) {
    if (mbTabs.__vkifyReplaced) return;
    mbTabs.__vkifyReplaced = true;

    // a wholesale re-render can replace .mb_tabs and orphan the previous header
    const stale = mbTabs.previousElementSibling;
    if (stale?.classList.contains('vkify-mb-tabs')) {
        stale.remove();
    }

    // the IM materials page renders .mb_tab without data-name — fall back to the index
    const readTabs = () => [...mbTabs.querySelectorAll('.mb_tab')].map((t, i) => ({
        el: t,
        name: t.dataset.name ?? `tab-${i}`,
        label: t.textContent.trim(),
        active: t.id === 'active',
    }));
    const tabs = readTabs();

    const header = u(`
        <h2 class="page_block_h2 tabs_header vkify-mb-tabs">
            <ul class="ui_tabs clear_fix ui_tabs_plain ui_tabs_sliding">
                ${tabs.map(t => `
                    <li><a class="ui_tab${t.active ? ' ui_tab_sel' : ''}" href="#" data-name="${t.name}">${t.label}</a></li>
                `).join('')}
                <div class="ui_tabs_slider"></div>
            </ul>
        </h2>
    `).first();
    const ul = header.querySelector('ul');
    const slider = ul.querySelector('.ui_tabs_slider');

    mbTabs.style.display = 'none';
    mbTabs.parentNode.insertBefore(header, mbTabs);

    let currentTab = tabs.find(t => t.active)?.name ?? tabs[0]?.name;

    function positionSlider(tabEl) {
        if (!tabEl) return;
        slider.style.transform = `translateX(${tabEl.offsetLeft}px)`;
        slider.style.width = `${tabEl.offsetWidth}px`;
    }

    function updateExtrasVisibility() {
        ul.querySelectorAll('.ui_tab_extra').forEach(el => {
            el.style.display = el.dataset.ownerTab === currentTab ? '' : 'none';
        });
    }

    function activate(name) {
        currentTab = name;
        const active = ul.querySelector(`.ui_tab[data-name='${name}']`);
        ul.querySelectorAll('.ui_tab').forEach(a => a.classList.toggle('ui_tab_sel', a === active));
        updateExtrasVisibility();
        positionSlider(active);
    }

    const repositionSlider = () => positionSlider(ul.querySelector('.ui_tab_sel'));

    positionSlider(ul.querySelector('.ui_tab_sel'));
    requestAnimationFrame(repositionSlider);
    document.fonts?.ready?.then(repositionSlider);
    new ResizeObserver(repositionSlider).observe(ul);

    u(ul).on('click', '.ui_tab', (e) => {
        e.preventDefault();
        const name = u(e.target).closest('.ui_tab').attr('data-name');
        activate(name);
        const tab = readTabs().find(t => t.name === name)?.el;
        (tab?.querySelector('a') ?? tab)?.click();
    });

    new MutationObserver(() => {
        // Preact re-renders move id="active" between tabs without touching our header
        const active = readTabs().find(t => t.active);
        if (active && active.name !== currentTab) {
            activate(active.name);
        }
        mbTabs.querySelectorAll('input[type=button]').forEach((btn) => {
            ul.querySelectorAll(`.ui_tab_extra[data-owner-tab='${currentTab}']`).forEach(el => el.remove());
            const classes = [...btn.classList].filter(c => c !== 'button').join(' ');
            const a = u(`<a class="ui_tab_extra ${classes}" href="#" id="${btn.id}" data-owner-tab="${currentTab}">${btn.value}</a>`).first();
            btn.remove();
            ul.appendChild(a);
        });
        updateExtrasVisibility();
        repositionSlider();
    }).observe(mbTabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });
}

vkify.onPage(() => {
    vkify.bindOnce('mbTabsObserver', () => {
        vkify.observeDOM((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList.contains('mb_tabs')) {
                        replaceMbTabs(node);
                    } else {
                        node.querySelectorAll?.('.mb_tabs').forEach(replaceMbTabs);
                    }
                }
            }
        });
    });

    vkify.bindOnce('hookShowAudioAddDialog', () => {
        vkify.hook(window, '__showAudioAddDialog', function () {
            u('.ovk-diag-cont').last().setAttribute('style', 'width:500px');
            u('.ovk-diag-body').attr('style', 'padding:0px !important;');
            const action = document.querySelector('.ovk-diag-action');
            if (action && action.children.length >= 2) {
                action.insertBefore(action.children[1], action.children[0]);
            }
            document.getElementById('_content')?.classList.add('page_padding');
        }, 'then');
    });

    vkify.bindOnce('hookFeedSettingsLink', () => {
        const styleFeedSettingsDialog = () => {
            const container = document.getElementById('_feed_settings_container');
            if (!container) return;

            const diag = container.closest('.ovk-diag-cont');
            let applyBtn = null;
            if (diag) {
                diag.setAttribute('style', 'width:500px');
                diag.classList.add('ovk-msg-sheet');
                document.body.classList.add('ovk-sheet-dim');
                enableSheetGestures?.(diag);

                const head = diag.querySelector('.ovk-diag-head');
                if (head && !head.querySelector('.ovk-diag-head-apply')) {
                    applyBtn = document.createElement('button');
                    applyBtn.type = 'button';
                    applyBtn.className = 'ovk-diag-head-apply';
                    applyBtn.setAttribute('aria-label', tr('apply'));
                    applyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><use href="#done-outline-24"></use></svg>';
                    applyBtn.addEventListener('click', () => {
                        document.getElementById('__content')?.querySelector("input[type='button'].button")?.click();
                    });
                    head.appendChild(applyBtn);
                }
            }

            const body = container.closest('.ovk-diag')?.querySelector('.ovk-diag-body');
            if (body) {
                body.setAttribute('style', 'padding:0px !important; min-height: 290px; overflow: hidden;');
            }

            const content = document.getElementById('__content');
            if (!content) return;

            const readSettingsState = () => JSON.stringify({
                posts: content.querySelector('#pageSelect')?.value ?? '',
                page: content.querySelector('#pageNumber')?.value ?? '',
                ignored: !!content.querySelector('#showIgnored')?.checked,
                alien: !!content.querySelector('#alienPosts')?.checked,
            });
            let settingsTable = null;
            let settingsBaseline = null;
            const updateApplyVisibility = () => {
                if (!applyBtn) return;
                const dirty = settingsTable !== null && settingsBaseline !== readSettingsState();
                applyBtn.style.display = dirty ? '' : 'none';
            };
            content.addEventListener('input', updateApplyVisibility);
            content.addEventListener('change', updateApplyVisibility);

            const rebuildIgnoredItem = (item) => {
                if (item.__vkifyRebuilt) return;
                item.__vkifyRebuilt = true;

                const id = item.dataset.id;
                item.querySelector('.third_column')?.remove();

                const slot = u(`
                    <div class="third_column" style="display: grid; align-items: center;">
                        <button type="button" class="button">${tr('stop_ignore')}</button>
                    </div>
                `).first();
                item.appendChild(slot);

                const btn = slot.querySelector('button');
                btn.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    if (!vkify.requireAuth() || btn.disabled) return;
                    btn.disabled = true;
                    btn.classList.add('lagged');

                    const params = Number(id) > 0
                        ? `user_ids=${encodeURIComponent(id)}`
                        : `group_ids=${encodeURIComponent(Math.abs(id))}`;
                    const resp = await ky.get(`/method/newsfeed.deleteBan?auth_mechanism=roaming&${params}`).json().catch(() => null);
                    if (!resp || resp.error_code) {
                        console.error(resp?.error_msg);
                        btn.disabled = false;
                        btn.classList.remove('lagged');
                        return;
                    }

                    const cached = window.openvk?.ignored_list?.response?.items;
                    if (Array.isArray(cached)) {
                        window.openvk.ignored_list.response.items =
                            cached.filter(i => String(i.real_id) !== String(id));
                    }

                    const list = item.parentNode;
                    item.remove();
                    if (list && !list.querySelector('.entity_vertical_list_item')) {
                        content.innerHTML = `<div class="information">${tr('no_ignores_count')}</div>`;
                    }
                });
            };

            const stripRemoveIgnoresButton = () => {
                document.querySelectorAll(
                    '#_feed_settings_container #_remove_ignores, #_feed_settings_container .ui_tab_extra#_remove_ignores'
                ).forEach(el => el.remove());
            };

            const onContentChange = () => {
                const table = content.querySelector('table');
                if (table) {
                    if (table !== settingsTable) {
                        settingsTable = table;
                        settingsBaseline = readSettingsState();
                    }
                } else {
                    settingsTable = null;
                    settingsBaseline = null;
                }
                updateApplyVisibility();
                if (table) {
                    content.classList.remove('page_padding');
                    return;
                }

                content.classList.add('page_padding');
                content.querySelectorAll('.entity_vertical_list_item').forEach(rebuildIgnoredItem);
                stripRemoveIgnoresButton();
            };

            onContentChange();
            new MutationObserver(onContentChange).observe(content, { childList: true, subtree: true });
        };

        document.addEventListener('click', (e) => {
            const link = e.target.closest('#__feed_settings_link');
            if (!link) return;
            e.preventDefault();

            if (typeof window.onFeedSettingsClick === 'function') {
                window.onFeedSettingsClick({ preventDefault() {}, target: link });
            }
            styleFeedSettingsDialog();
        });
    });
});

window.vkifyFeedLists = (function () {
    const lang = (key, fallback = key) => window.vkifylang?.[key] || window.tr?.(key) || fallback;

    function getLists() {
        return Array.isArray(window.__vkifyFeedLists) ? window.__vkifyFeedLists : [];
    }

    function getSources() {
        return Array.isArray(window.__vkifyFeedSources) ? window.__vkifyFeedSources : [];
    }

    function navigateToFeed(url) {
        if (window.router && typeof window.router.route === 'function') {
            window.router.route({ url });
        } else {
            window.location.href = url;
        }
    }

    async function toggleSubscription(listId, add = 0, ev = null) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (!vkify.requireAuth()) return false;
        window.uiActionsMenu?.hideAll?.();
        try {
            await window.OVKAPI.call('newsfeed.toggleListSubscription', {
                list_id: Number(listId),
                add: Number(add) ? 1 : 0
            });
            const currentList = new URLSearchParams(window.location.search).get('list');
            if (!Number(add) && String(currentList) === String(listId)) {
                navigateToFeed('/feed');
            } else {
                navigateToFeed(window.location.pathname + window.location.search);
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    }

    async function toggleEntityInList(el, ev = null) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (!el || !vkify.requireAuth()) return false;
        const listId = Number(el.dataset.listId);
        const listTitle = el.dataset.listTitle || '';
        const entityId = Number(el.dataset.entityId);
        if (!listId || !entityId) return false;

        const rawIds = (el.dataset.sourceIds || '').split(',').filter(Boolean).map(Number);
        const set = new Set(rawIds);
        const willBeChecked = !el.classList.contains('checked');
        if (willBeChecked) set.add(entityId);
        else set.delete(entityId);

        const nextCsv = [...set].join(',');
        document.querySelectorAll(`[data-list-id="${listId}"][data-entity-id="${entityId}"]`).forEach(node => {
            node.classList.toggle('checked', willBeChecked);
            node.dataset.sourceIds = nextCsv;
        });

        try {
            await window.OVKAPI.call('newsfeed.saveList', {
                list_id: listId,
                title: listTitle,
                source_ids: nextCsv
            });
        } catch (e) {
            console.error(e);
        }
        return false;
    }

    function confirmDeleteList(listId, listTitle, parentBox = null) {
        const title = lang('feed_list_delete_confirm_title', 'Delete list');
        const body = `<div style="line-height: 160%;">${lang('feed_list_delete_confirm', 'Are you sure you want to delete the list <b>$1</b>?').replace('$1', escapeHtml(listTitle))}</div>`;
        let confirmBox = null;
        confirmBox = new CMessageBox({
            title,
            body,
            buttons: [window.tr?.('delete') || 'Delete', window.tr?.('cancel') || 'Cancel'],
            callbacks: [
                async () => {
                    try {
                        await window.OVKAPI.call('newsfeed.deleteList', { list_id: listId });
                        window.__vkifyFeedLists = getLists().filter(l => Number(l.id) !== Number(listId));
                        confirmBox?.close();
                        parentBox?.close();
                        const currentList = new URLSearchParams(window.location.search).get('list');
                        if (String(currentList) === String(listId)) {
                            navigateToFeed('/feed');
                        } else {
                            navigateToFeed(window.location.pathname + window.location.search);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                },
                () => {
                    confirmBox?.close();
                }
            ]
        });
    }

    function openEditor(listId = -1) {
        if (!vkify.requireAuth()) return false;
        window.uiActionsMenu?.hideAll?.();

        const isEdit = Number(listId) > 0;
        const existing = isEdit ? getLists().find(l => Number(l.id) === Number(listId)) : null;
        const initialTitle = existing?.title || '';
        const selectedIds = new Set((existing?.source_ids || []).map(Number));
        const sources = getSources();
        let activeTab = 'all';
        let filterQuery = '';

        const headerHtml = `
            <ul class="ui_tabs clear_fix ui_tabs_header ui_tabs_sliding">
                <li class="olist_tab_all"><a class="ui_tab ui_tab_sel" href="#" data-name="all">${escapeHtml(lang('feed_list_tab_all', 'Friends and communities'))}<span class="ui_tab_count">${sources.length || ''}</span></a></li>
                <li class="olist_tab_sel"><a class="ui_tab" href="#" data-name="selected">${escapeHtml(lang('feed_list_tab_selected', 'Selected'))}<span class="ui_tab_count" id="olist_selected_count">${selectedIds.size || ''}</span></a></li>
                <div class="ui_tabs_slider"></div>
            </ul>
        `;

        const bodyHtml = `
            <div class="vkify_olist_box">
                <div class="feed_list_name_wrap">
                    <div class="feed_list_name_row">
                        <div class="feed_list_name_label">${escapeHtml(lang('feed_list_name_label', 'List name:'))}</div>
                        <div class="feed_list_name_input">
                            <input type="text" id="feed_list_name" class="dark" maxlength="48" value="${escapeHtml(initialTitle)}" placeholder="${escapeHtml(lang('feed_list_name_placeholder', 'Enter list name'))}">
                        </div>
                    </div>
                </div>
                <div class="olist_filter_wrap">
                    <div class="ui_search ui_search_old ui_search_field_empty" id="olist_search_wrap">
                        <div class="ui_search_input_block">
                            <input type="text" class="ui_search_field" id="olist_filter" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${escapeHtml(lang('feed_list_filter_placeholder', 'Start typing a friend\'s or community\'s name'))}">
                            <div class="ui_search_reset" id="olist_filter_reset"></div>
                        </div>
                    </div>
                    <div id="olist_filter_actions" class="olist_filter_actions ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this, null, {align: 'right'});" onmouseout="uiActionsMenu.hide(this);" onclick="uiActionsMenu.toggle(this, null, {align: 'right'});">
                        <div class="olist_filter_label">${escapeHtml(lang('feed_list_select', 'Select'))}</div>
                        <div class="ui_actions_menu">
                            <a class="ui_actions_menu_item" data-olist-select="all">${escapeHtml(lang('feed_list_select_all', 'Select all'))}</a>
                            <a class="ui_actions_menu_item" data-olist-select="none">${escapeHtml(lang('feed_list_select_none', 'Deselect all'))}</a>
                            <div class="ui_actions_menu_sep"></div>
                            <a class="ui_actions_menu_item" data-olist-select="people">${escapeHtml(lang('feed_list_select_people', 'Friends and subscriptions'))}</a>
                            <a class="ui_actions_menu_item" data-olist-select="groups">${escapeHtml(lang('feed_list_select_groups', 'Communities'))}</a>
                        </div>
                    </div>
                </div>
                <div class="privacy_olist">
                    <div class="olist" id="olist_rows"></div>
                </div>
            </div>
        `;

        let box = null;
        const onSave = async () => {
            const root = box?.getNode?.()?.nodes?.[0];
            if (!root) return;
            const nameInput = root.querySelector('#feed_list_name');
            const title = (nameInput?.value || '').trim();
            if (!title) {
                nameInput?.focus();
                return;
            }

            const saveBtn = root.querySelector('.ovk-diag-action .button:not(.button_gray), .ovk-diag-action button:first-of-type');
            if (saveBtn) {
                saveBtn.disabled = true;
                window.LoaderUtils?.showInButton?.(u(saveBtn), { baw: true });
            }

            try {
                const params = {
                    title,
                    source_ids: [...selectedIds].join(',')
                };
                if (isEdit) params.list_id = Number(listId);

                const savedId = await window.OVKAPI.call('newsfeed.saveList', params);
                const targetListId = Number(savedId) || (isEdit ? Number(listId) : 0);
                box.close();
                if (targetListId > 0) {
                    navigateToFeed(`/feed?list=${targetListId}`);
                } else {
                    navigateToFeed('/feed');
                }
            } catch (e) {
                console.error(e);
                if (saveBtn) {
                    saveBtn.disabled = false;
                    window.LoaderUtils?.restoreButton?.(u(saveBtn));
                }
            }
        };

        box = new CMessageBox({
            title: headerHtml,
            body: bodyHtml,
            close_on_buttons: false,
            buttons: [window.tr?.('save') || 'Save', window.tr?.('cancel') || 'Cancel'],
            callbacks: [onSave, () => box.close()]
        });

        const node = box.getNode().nodes[0];
        if (!node) return false;
        node.classList.add('vkify-olist-dialog', 'ovk-msg-sheet');

        const headUl = node.querySelector('.ovk-diag-head .ui_tabs');
        const headSlider = headUl?.querySelector('.ui_tabs_slider');
        const positionHeadSlider = () => {
            const sel = headUl?.querySelector('.ui_tab_sel');
            if (!sel || !headSlider) return;
            headSlider.style.transform = `translateX(${sel.offsetLeft}px)`;
            headSlider.style.width = `${sel.offsetWidth}px`;
        };
        if (headUl) {
            positionHeadSlider();
            requestAnimationFrame(positionHeadSlider);
            new ResizeObserver(positionHeadSlider).observe(headUl);
        }

        if (isEdit) {
            const actionBar = node.querySelector('.ovk-diag-action');
            if (actionBar) {
                const delLink = document.createElement('a');
                delLink.className = 'olist_delete_link';
                delLink.textContent = lang('feed_delete_list', 'Delete list');
                delLink.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    confirmDeleteList(Number(listId), initialTitle || `#${listId}`, box);
                });
                actionBar.prepend(delLink);
            }
        }

        const rowsEl = node.querySelector('#olist_rows');
        const filterInput = node.querySelector('#olist_filter');
        const searchWrap = node.querySelector('#olist_search_wrap');
        const resetBtn = node.querySelector('#olist_filter_reset');

        const updateSelectedCounter = () => {
            const cntEl = node.querySelector('#olist_selected_count');
            if (cntEl) cntEl.textContent = selectedIds.size ? String(selectedIds.size) : '';
            requestAnimationFrame(positionHeadSlider);
        };

        const renderRows = () => {
            if (!rowsEl) return;
            const q = filterQuery.trim().toLowerCase();
            const filtered = sources.filter(item => {
                if (activeTab === 'selected' && !selectedIds.has(Number(item.id))) return false;
                if (q && !item.name.toLowerCase().includes(q)) return false;
                return true;
            });

            if (!filtered.length) {
                const emptyText = sources.length === 0
                    ? lang('feed_list_no_sources', 'You have no friends or communities yet')
                    : (activeTab === 'selected' && !q
                        ? lang('feed_list_no_selected', 'No friends or communities selected yet')
                        : (window.tr?.('no_results') || 'No results found'));
                rowsEl.innerHTML = `<div class="olist_empty">${escapeHtml(emptyText)}</div>`;
                return;
            }

            rowsEl.innerHTML = filtered.map(item => {
                const isChecked = selectedIds.has(Number(item.id));
                return `
                    <a href="${escapeHtml(item.url)}" class="olist_item_wrap${isChecked ? ' olist_item_wrap_on' : ''}" data-source-id="${item.id}">
                        <div class="olist_item">
                            <img class="olist_item_photo" src="${escapeHtml(item.avatar)}" alt="" loading="lazy">
                            <div class="olist_item_name">${escapeHtml(item.name)}</div>
                            <div class="olist_checkbox"></div>
                        </div>
                    </a>
                `;
            }).join('');
        };

        rowsEl?.addEventListener('click', (ev) => {
            const row = ev.target.closest('.olist_item_wrap');
            if (!row) return;
            ev.preventDefault();
            ev.stopPropagation();
            const id = Number(row.dataset.sourceId);
            if (!id) return;
            if (selectedIds.has(id)) {
                selectedIds.delete(id);
                row.classList.remove('olist_item_wrap_on');
            } else {
                selectedIds.add(id);
                row.classList.add('olist_item_wrap_on');
            }
            updateSelectedCounter();
            if (activeTab === 'selected') renderRows();
        });

        headUl?.querySelectorAll('.ui_tab').forEach(tabEl => {
            tabEl.addEventListener('click', (ev) => {
                ev.preventDefault();
                activeTab = tabEl.dataset.name || 'all';
                headUl.querySelectorAll('.ui_tab').forEach(t => {
                    t.classList.toggle('ui_tab_sel', t === tabEl);
                });
                positionHeadSlider();
                renderRows();
            });
        });

        filterInput?.addEventListener('input', () => {
            filterQuery = filterInput.value || '';
            searchWrap?.classList.toggle('ui_search_field_empty', !filterQuery);
            renderRows();
        });

        resetBtn?.addEventListener('click', () => {
            if (!filterInput) return;
            filterInput.value = '';
            filterQuery = '';
            searchWrap?.classList.add('ui_search_field_empty');
            renderRows();
            filterInput.focus();
        });

        node.querySelectorAll('[data-olist-select]').forEach(actionEl => {
            actionEl.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const mode = actionEl.dataset.olistSelect;
                if (mode === 'all') {
                    sources.forEach(s => selectedIds.add(Number(s.id)));
                } else if (mode === 'none') {
                    selectedIds.clear();
                } else if (mode === 'people') {
                    selectedIds.clear();
                    sources.filter(s => Number(s.id) > 0).forEach(s => selectedIds.add(Number(s.id)));
                } else if (mode === 'groups') {
                    selectedIds.clear();
                    sources.filter(s => Number(s.id) < 0).forEach(s => selectedIds.add(Number(s.id)));
                }
                updateSelectedCounter();
                renderRows();
                window.uiActionsMenu?.hideAll?.();
            });
        });

        renderRows();
        setTimeout(() => {
            const nameField = node.querySelector('#feed_list_name');
            if (nameField && !isEdit) nameField.focus();
            else filterInput?.focus();
        }, 50);

        return false;
    }

    return { openEditor, confirmDeleteList, toggleSubscription, toggleEntityInList };
})();

})();
