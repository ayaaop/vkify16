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
                close.addEventListener('click', () => {
                    const msgId = el.dataset?.id;
                    const msg = window.messagebox_stack?.find(m => String(m.id) === msgId);
                    if (msg) closeMessageBox(msg);
                });
                head.appendChild(close);
            };

            vkify.bindOnce('msgboxStackObserver', () => {
                const observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === 1 && node.classList?.contains('ovk-msg-all')) {
                                window.tippy?.hideAll?.();
                                decorateDialog(node);
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

    // Stock dialogs sometimes inject extra <input type=button> into .mb_tabs
    // after the fact (e.g. feed settings' #_remove_ignores). Mirror them as
    // links in the visible ul, tagged with the owning tab so they only show
    // while that tab is active, and de-duplicated on re-entry.
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
            if (diag) {
                diag.setAttribute('style', 'width:500px');
            }

            const body = container.closest('.ovk-diag')?.querySelector('.ovk-diag-body');
            if (body) {
                body.setAttribute('style', 'padding:0px !important; min-height: 290px; overflow: hidden;');
            }

            const content = document.getElementById('__content');
            if (!content) return;

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
            if (!e.target.closest('#__feed_settings_link')) return;
            e.preventDefault();

            styleFeedSettingsDialog();
        });
    });
});

})();
