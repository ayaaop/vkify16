(function () {
'use strict';

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

            // full-screen dialogs get a header tick wired to the first
            // action button (the hidden bar still fires via .click())
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

            // stock dialogs classified by body marker; themepack dialogs
            // opt in directly via addClass at creation
            const SHEET_BODY_MARKERS = '.stickers_pack_modal, .audiosInsert, [id^="poll_editor"], #osm-map';
            const FULLSCREEN_BODY_MARKERS = '#_fullyDeleteAudio, #_fast_video_upload';
            const classifyDialog = (el) => {
                if (el.querySelector(SHEET_BODY_MARKERS)) {
                    el.classList.add('ovk-msg-sheet');
                }
                if (el.querySelector(FULLSCREEN_BODY_MARKERS)) {
                    el.classList.add('ovk-msg-fullscreen');
                    installHeadApply(el);
                }
            };

            // footer divider only while the body can scroll further down;
            // also stacks the action buttons when labels overflow the row
            const watchDialogBodyScroll = (el) => {
                const body = el.querySelector('.ovk-diag-body');
                if (!body) return;
                const action = el.querySelector('.ovk-diag-action');
                let ro, mo;
                const update = () => {
                    if (!el.isConnected) {
                        ro?.disconnect();
                        mo?.disconnect();
                        return;
                    }
                    const remaining = body.scrollHeight - body.clientHeight - body.scrollTop;
                    el.classList.toggle('ovk-diag-can-scroll', remaining > 1);
                    if (action && !el.classList.contains('ovk-diag-stacked')) {
                        el.classList.toggle('ovk-diag-stacked', action.scrollWidth > action.clientWidth + 1);
                    }
                };
                ro = new ResizeObserver(update);
                mo = new MutationObserver(update);
                ro.observe(body);
                if (action) ro.observe(action);
                mo.observe(body, { childList: true, subtree: true, characterData: true });
                body.addEventListener('scroll', update, { passive: true });
                update();
            };

            // bottom-sheet gestures: drag drives the height between peek and
            // expanded detents; below peek it translates for dismissal
            const enableSheetGestures = (el) => {
                const diag = el.querySelector('.ovk-diag');
                const body = el.querySelector('.ovk-diag-body');
                if (!diag) return;
                let drag = null;
                let lastH = null;
                let sizeAnimating = false;

                const dimmer = () => document.querySelector('body.dimmed > .dimmer');
                // read the active cap from CSS so swipe and settle can't diverge
                const currentCap = () => {
                    const mh = parseFloat(getComputedStyle(diag).maxHeight);
                    return isFinite(mh) ? mh : window.innerHeight;
                };
                // natural content height for a detent, inline styles cleared
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
                        // fully expanded + upward pull inside the body → scroll
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
                    const v = g.vel; // px/ms, positive = moving down

                    // below peek: translate distance or a downward fling dismisses
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
                                    // warn_on_exit declined — slide back up
                                    diag.style.transition = 'transform .2s';
                                    diag.style.height = '';
                                    diag.style.transform = '';
                                }
                            }, 160);
                            return;
                        }
                    }

                    // snap to a detent: fling direction wins over position
                    const expand = v < -0.4 ? true
                        : v > 0.4 ? false
                        : h > (g.peekH + g.capH) / 2;

                    // clamp to the target cap before removing --dragging so
                    // max-height doesn't snap the dragged height instantly
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
                    diag.addEventListener('transitionend', () => {
                        diag.style.transition = '';
                        diag.style.height = '';
                        sizeAnimating = false;
                        lastH = diag.offsetHeight;
                    }, { once: true });
                };
                diag.addEventListener('touchend', settle);
                diag.addEventListener('touchcancel', settle);

                // animate content-driven resizes (tab switches, async loads)
                const sizeRO = new ResizeObserver(() => {
                    if (!diag.isConnected) {
                        sizeRO.disconnect();
                        return;
                    }
                    const newH = diag.offsetHeight;
                    if (lastH === null || drag?.decided || sizeAnimating || Math.abs(newH - lastH) < 2) {
                        lastH = newH;
                        return;
                    }
                    sizeAnimating = true;
                    diag.style.transition = 'none';
                    diag.style.height = `${lastH}px`;
                    void diag.offsetHeight;
                    diag.style.transition = 'height .2s ease';
                    diag.style.height = `${newH}px`;
                    diag.addEventListener('transitionend', () => {
                        diag.style.transition = '';
                        diag.style.height = '';
                        sizeAnimating = false;
                        lastH = diag.offsetHeight;
                    }, { once: true });
                });
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

    const tabs = [...mbTabs.querySelectorAll('.mb_tab')].map(t => ({
        name: t.dataset.name,
        label: t.textContent.trim(),
        active: t.id === 'active',
    }));

    const header = u(`
        <h2 class="page_block_h2 tabs_header">
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
        positionSlider(active);
        updateExtrasVisibility();
    }

    positionSlider(ul.querySelector('.ui_tab_sel'));

    u(ul).on('click', '.ui_tab', (e) => {
        e.preventDefault();
        const name = u(e.target).closest('.ui_tab').attr('data-name');
        activate(name);
        mbTabs.querySelector(`.mb_tab[data-name='${name}'] a`)?.click();
    });

    // mirror buttons injected into .mb_tabs as links in the visible ul,
    // tagged so they only show on their owning tab
    new MutationObserver(() => {
        mbTabs.querySelectorAll('input[type=button]').forEach((btn) => {
            ul.querySelectorAll(`.ui_tab_extra[data-owner-tab='${currentTab}']`).forEach(el => el.remove());
            const classes = [...btn.classList].filter(c => c !== 'button').join(' ');
            const a = u(`<a class="ui_tab_extra ${classes}" href="#" id="${btn.id}" data-owner-tab="${currentTab}">${btn.value}</a>`).first();
            btn.remove();
            ul.appendChild(a);
        });
    }).observe(mbTabs, { childList: true });
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

            // the tick shows only once the form diverges from its baseline
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
                    if (btn.disabled) return;
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

            // invoke the stock handler with a normalized target so
            // dataset.pagescount resolves regardless of the clicked child
            if (typeof window.onFeedSettingsClick === 'function') {
                window.onFeedSettingsClick({ preventDefault() {}, target: link });
            }
            styleFeedSettingsDialog();
        });
    });
});

})();
