(() => {


const tr = window.tr;
const u = window.u;
const LoaderUtils = window.LoaderUtils;

u(document).off('input');

const WALL_CHECKBOX_NAMES = ['as_group', 'force_sign', 'anon', 'nsfw'];

function resolveWallFormContext(el) {
    if (el?.form) return el.form;
    return el?.closest?.('form') || document.querySelector('#write form') || null;
}

function findWallFormControl(form, name) {
    if (!form) return null;
    const control = form.elements.namedItem(name);
    return control instanceof RadioNodeList ? control[0] : control;
}

function renderEditMenuLayout(apiPost, type, postId) {
    const clubId = apiPost.owner_id < 0 ? Math.abs(apiPost.owner_id) : 0;
    const editFormId = `write-edit-form-${postId}`;

    const nsfwOpt = type === 'post'
        ? `<label class="checkbox"><input type="checkbox" name="nsfw" form="${editFormId}" ${apiPost.is_explicit ? 'checked' : ''} /><span>${tr('contains_nsfw')}</span></label>`
        : '';

    const asGroupOpt = type === 'post' && apiPost.owner_id < 0 && apiPost.can_pin
        ? `<label class="checkbox"><input type="checkbox" name="as_group" form="${editFormId}" ${apiPost.from_id < 0 ? 'checked' : ''} /><span>${tr('post_as_group')}</span></label>`
        : '';

    const postOptsItems = `${nsfwOpt}${asGroupOpt}`;
    const postOptsTrigger = type === 'post' && postOptsItems
        ? `<div class="post-opts-trigger ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this, null, {align: 'left'});" onmouseout="uiActionsMenu.hide(this);">
            <div class="post_settings" id="postOptsTrigger${postId}" role="button">
                <div class="common_icon"></div>
            </div>
            <div class="post-opts ui_actions_menu" id="postOptsTooltip${postId}">${postOptsItems}</div>
       </div>`
        : '';
    const postOptsTooltip = '';

    const inlineAttachButtons = type === 'post'
        ? `
            <a class="attach_photo" id="__vkifyPhotoAttachment" data-club="${clubId}" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('photo')}">
                <div class="post-attach-menu__icon"></div>
            </a>
            <a class="attach_video" id="__vkifyVideoAttachment" data-club="${clubId}" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('video')}">
                <div class="post-attach-menu__icon"></div>
            </a>
            <a class="attach_audio" id="__vkifyAudioAttachment" data-club="${clubId}" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('audio')}">
                <div class="post-attach-menu__icon"></div>
            </a>
        `
        : '';

    const dropdownTrigger = type === 'post'
        ? `<a class="post-attach-menu__trigger" id="moreAttachTrigger${postId}">
                ${window.vkifylang?.more ?? tr('show_more')}
           </a>`
        : `<span class="post-attach-menu__trigger" id="moreAttachTrigger${postId}" tabindex="0" role="button"></span>`;

    const dropdownItems = type === 'post'
        ? `
            <a class="attach_document" id="__vkifyDocumentAttachment" data-club="${clubId}">
                <div class="post-attach-menu__icon"></div>
                ${tr('document')}
            </a>
            <a class="attach_note" id="__vkifyNotesAttachment">
                <div class="post-attach-menu__icon"></div>
                ${tr('note')}
            </a>
            <a class="attach_source" id="__sourceAttacher">
                <div class="post-attach-menu__icon"></div>
                ${tr('source')}
            </a>
        `
        : `
            <a class="attach_photo" id="__vkifyPhotoAttachment" data-club="${clubId}">
                <div class="post-attach-menu__icon"></div>
                ${tr('photo')}
            </a>
            <a class="attach_video" id="__vkifyVideoAttachment" data-club="${clubId}">
                <div class="post-attach-menu__icon"></div>
                ${tr('video')}
            </a>
            <a class="attach_audio" id="__vkifyAudioAttachment" data-club="${clubId}">
                <div class="post-attach-menu__icon"></div>
                ${tr('audio')}
            </a>
            <a class="attach_document" id="__vkifyDocumentAttachment" data-club="${clubId}">
                <div class="post-attach-menu__icon"></div>
                ${tr('document')}
            </a>
        `;

    const attachMenuHtml = `
        <div id="wallAttachmentMenu" class="page_add_media post-attach-menu ${type === 'post' ? 'post-attach-menu--inline' : ''}">
            ${inlineAttachButtons}
            <div class="ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this);" onmouseout="uiActionsMenu.hide(this);">
                ${dropdownTrigger}
                <div class="ui_actions_menu" id="moreAttachTooltip${postId}">
                    ${dropdownItems}
                </div>
            </div>
            ${postOptsTrigger}
        </div>
    `;

    return `
        <div class='edit_menu module_body'>
            <form id="${editFormId}">
                <textarea placeholder="${tr('edit')}" name="text" style="width: 100%;resize: none;" class="expanded-textarea small-textarea">${apiPost.text}</textarea>
                <div class='post-buttons'>
                    <div class="post-horizontal"></div>
                    <div class="post-vertical"></div>
                    <div class="post-repost"></div>
                    <div class="post-source"></div>
                    <input type="hidden" id="source" name="source" value="none" />
                    <div class="post-bottom-acts">
                        ${attachMenuHtml}
                        <div class='edit_menu_buttons post-bottom-buttons'>
                            <input class='button button_light' type='button' id='__edit_cancel' value='${tr('cancel')}'>
                            <input class='button' type='button' id='__edit_save' value='${tr('save')}'>
                        </div>
                    </div>
                </div>
            </form>
        </div>`;
}

function renderRepostBottomLayout() {
    return `
            <div class="post-bottom-acts">
                <div class="post-attach-menu">
                    <div id="wallAttachmentMenu">
                        <a id="__vkifyPhotoAttachment" class="attach_photo" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('photo')}" data-club="0">
                            <div class="post-attach-menu__icon"></div>
                        </a>
                        <a id="__vkifyVideoAttachment" class="attach_video" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('video')}" data-club="0">
                            <div class="post-attach-menu__icon"></div>
                        </a>
                        <a id="__vkifyAudioAttachment" class="attach_audio" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('audio')}" data-club="0">
                            <div class="post-attach-menu__icon"></div>
                        </a>
                        <a id="__vkifyDocumentAttachment" class="attach_document" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('document')}" data-club="0">
                            <div class="post-attach-menu__icon"></div>
                        </a>
                    </div>
                </div>
                <div class="post-bottom-buttons">
                    <div class="ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this, null, {autopos: true, align: 'right'});" onmouseout="uiActionsMenu.hide(this);">
                        <div class="post_settings" id="__vkifyRepostOptsTrigger" role="button" style="display:none;">
                            <div class="common_icon"></div>
                        </div>
                        <div class="post-opts ui_actions_menu" id="__vkifyRepostOptsTooltip">
                            <label class="checkbox">
                                <input type="checkbox" name="asGroup" /><span>${tr('post_as_group')}</span>
                            </label>
                            <label class="checkbox" id="__vkifyRepostSignedOpt" style="display:none">
                                <input type="checkbox" name="signed" /><span>${tr('add_signature')}</span>
                            </label>
                        </div>
                    </div>
                    <input type="button" value="${tr('send')}" class="button" id="__vkifyRepostSend" />
                </div>
            </div>
        `;
}

function resetWallComposer(form) {
    if (!form) return;

    form.reset();

    const textarea = form.querySelector('textarea.small-textarea');
    if (textarea) {
        textarea.classList.remove('expanded-textarea');
        textarea.blur();
    }

    const composer = form.closest('.model_content_textarea');
    if (composer) {
        composer.classList.remove('shown');
    }

    const horizontal = form.querySelector('.post-horizontal');
    const vertical = form.querySelector('.post-vertical');
    const source = form.querySelector('.post-source');
    const geo = form.querySelector('.post-has-geo');
    const replyto = form.querySelector('.post-replyto');
    const replyToInput = form.querySelector('input[name="reply_to_comment"]');

    if (horizontal) horizontal.innerHTML = '';
    if (vertical) vertical.innerHTML = '';
    if (source) source.innerHTML = '';
    if (geo) geo.innerHTML = '';
    if (replyto) replyto.innerHTML = '';
    if (replyToInput) replyToInput.value = '';

    syncWallCheckboxHiddenInputs(form);
}

function syncWallCheckboxHiddenInputs(form) {
    if (!form) return;

    WALL_CHECKBOX_NAMES.forEach(name => {
        const control = findWallFormControl(form, name);
        if (!control || !control.checked) return;

        let hiddenInput = form.querySelector(`input[name="${name}"][type="hidden"]`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = name;
            form.appendChild(hiddenInput);
        }

        hiddenInput.value = 'on';
    });
}

function setupWallCheckboxListeners() {
    if (!vkify.bindOnce('wallCheckboxListeners', setupWallCheckboxListeners)) return;

    ['force_sign', 'nsfw'].forEach(name => {
        u(document).on('change', `input[name="${name}"]`, (e) => {
            syncWallCheckboxHiddenInputs(resolveWallFormContext(e.target));
        });
    });
}

function switchAvatar(el, targetType) {
    const formContext = resolveWallFormContext(el);
    const userImg = formContext ? formContext.querySelector('.post_field_user_image') : document.querySelector('.post_field_user_image');
    const groupImg = formContext ? formContext.querySelector('.post_field_user_image_group') : document.querySelector('.post_field_user_image_group');
    const anonImg = formContext ? formContext.querySelector('.post_field_user_image_anon') : document.querySelector('.post_field_user_image_anon');
    const avatarLink = formContext ? formContext.querySelector('.post_field_user_link') : document.querySelector('.post_field_user_link');

    if (!userImg) return;

    const targetImg = targetType === 'group' ? groupImg : anonImg;
    if (!targetImg) return;

    if (formContext) {
        if (formContext._avatarTimeout) clearTimeout(formContext._avatarTimeout);
        if (formContext._avatarCleanupTimeout) clearTimeout(formContext._avatarCleanupTimeout);
    }

    if (el.checked) {
        if (targetType === 'group' && anonImg) anonImg.style.opacity = '0';
        if (targetType === 'anon' && groupImg) groupImg.style.opacity = '0';

        if (userImg.style.opacity !== '0' || userImg.classList.contains('avatar-showing')) {
            userImg.style.opacity = '';
            userImg.classList.remove('avatar-showing');
            userImg.classList.add('avatar-flipping');
        }

        const showTarget = () => {
            targetImg.style.opacity = '';
            targetImg.classList.remove('avatar-flipping');
            targetImg.classList.add('avatar-showing');

            const targetUrl = targetType === 'group' ? targetImg.dataset.groupUrl : targetImg.dataset.anonUrl;
            if (avatarLink && targetUrl) {
                avatarLink.href = targetUrl;
            }

            const cleanup = () => {
                userImg.style.opacity = '0';
                userImg.classList.remove('avatar-flipping');
                targetImg.style.opacity = '1';
                targetImg.classList.remove('avatar-showing');
            };
            if (formContext) formContext._avatarCleanupTimeout = setTimeout(cleanup, 150);
            else setTimeout(cleanup, 150);
        };

        if (formContext) formContext._avatarTimeout = setTimeout(showTarget, 150);
        else setTimeout(showTarget, 150);
    } else {
        if (targetImg.style.opacity !== '0' || targetImg.classList.contains('avatar-showing')) {
            targetImg.style.opacity = '';
            targetImg.classList.remove('avatar-showing');
            targetImg.classList.add('avatar-flipping');
        }

        const showUser = () => {
            userImg.style.opacity = '';
            userImg.classList.remove('avatar-flipping');
            userImg.classList.add('avatar-showing');

            if (avatarLink && userImg.dataset.userUrl) {
                avatarLink.href = userImg.dataset.userUrl;
            }

            const cleanup = () => {
                targetImg.style.opacity = '0';
                targetImg.classList.remove('avatar-flipping');
                userImg.style.opacity = '1';
                userImg.classList.remove('avatar-showing');
            };
            if (formContext) formContext._avatarCleanupTimeout = setTimeout(cleanup, 150);
            else setTimeout(cleanup, 150);
        };

        if (formContext) formContext._avatarTimeout = setTimeout(showUser, 150);
        else setTimeout(showUser, 150);
    }
}

window.handleWallAsGroupClick = window.handleWallAsGroupClick || ((el) => {
        const formContext = resolveWallFormContext(el);

        if (el.checked) {
            const anonCheckbox = findWallFormControl(formContext, 'anon');
            if (anonCheckbox) {
                anonCheckbox.checked = false;
            }
        } else {
            const forceSignCheckbox = findWallFormControl(formContext, 'force_sign');
            if (forceSignCheckbox) {
                forceSignCheckbox.checked = false;
            }
        }

        const wrap = el.closest('.ui_actions_menu_wrap');
        if (wrap) {
            const forceSignOpt = wrap.querySelector('#forceSignOpt');
            if (forceSignOpt) {
                forceSignOpt.style.setProperty('display', el.checked ? 'flex' : 'none', 'important');
            }
            const anonOpt = wrap.querySelector('#octoberAnonOpt');
            if (anonOpt) {
                anonOpt.style.setProperty('display', el.checked ? 'none' : 'flex', 'important');
            }
        }

        const form = resolveWallFormContext(el);
        if (form) {
            if (!form.dataset.originalAction) {
                form.dataset.originalAction = form.action;
            }

            const isCommentForm = form.dataset.originalAction?.includes('/al_comments/create/');

            if (!isCommentForm) {
                const currentUrl = window.location.pathname;
                const groupMatch = currentUrl.match(/^\/club(\d+)/);
                if (groupMatch && el.checked) {
                    form.action = `/wall-${groupMatch[1]}/makePost`;
                } else if (form.dataset.originalAction) {
                    form.action = form.dataset.originalAction;
                }
            }
        }

        switchAvatar(el, 'group');
        syncWallCheckboxHiddenInputs(form);
    });

window.handleWallAnonClick = window.handleWallAnonClick || ((el) => {
        const formContext = resolveWallFormContext(el);
        let asGroupInput = findWallFormControl(formContext, 'as_group');

        if (el.checked && asGroupInput) {
            asGroupInput.checked = false;
        }

        const wrap = el.closest('.ui_actions_menu_wrap');
        if (wrap) {
            asGroupInput = wrap.querySelector('input[name="as_group"]') || asGroupInput;
            if (asGroupInput) {
                asGroupInput.disabled = el.checked;
            }
            const forceSignOpt = wrap.querySelector('#forceSignOpt');
            if (forceSignOpt) {
                forceSignOpt.style.display = asGroupInput?.checked ? 'flex' : 'none';
            }
            const anonOpt = wrap.querySelector('#octoberAnonOpt');
            if (anonOpt) {
                anonOpt.style.display = 'flex';
            }
        } else if (asGroupInput) {
            asGroupInput.disabled = el.checked;
        }

        const form = resolveWallFormContext(el);
        if (form) {
            if (!form.dataset.originalAction) {
                form.dataset.originalAction = form.action;
            }

            if (form.dataset.originalAction) {
                form.action = form.dataset.originalAction;
            }
        }

        switchAvatar(el, 'anon');
        syncWallCheckboxHiddenInputs(form);
    });

function bindComposerSubmitOnce() {
    if (!vkify.bindOnce('composerSubmit', bindComposerSubmitOnce)) return;

    const bumpSelectedTabCountOnNewPost = () => {
        const countEl = document.querySelector('.ui_tab_sel .ui_tab_count');
        if (!countEl) return;

        const initial = parseInt((countEl.textContent || '').trim(), 10);
        if (Number.isNaN(initial)) return;

        const existingIds = new Set(
            Array.from(document.querySelectorAll('.post:not(.reply)[data-id]'))
                .map(n => n.getAttribute('data-id'))
                .filter(Boolean)
        );

        let done = false;
        const finalize = () => {
            if (done) return;
            done = true;
            try { observer.disconnect(); } catch (_e) { }
            try { clearTimeout(timer); } catch (_e) { }
        };

        const tryIncrement = () => {
            if (done) return;
            const nodes = document.querySelectorAll('.post:not(.reply)[data-id]');
            for (const n of nodes) {
                const id = n.getAttribute('data-id');
                if (id && !existingIds.has(id)) {
                    const current = parseInt((countEl.textContent || '').trim(), 10);
                    if (!Number.isNaN(current)) {
                        countEl.textContent = String(current + 1);
                    }
                    finalize();
                    return;
                }
            }
        };

        const observer = new MutationObserver(() => {
            tryIncrement();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const timer = setTimeout(() => {
            finalize();
        }, 5000);
    };

    u(document).on('submit', '#write form', (e) => {
        syncWallCheckboxHiddenInputs(e.target);
        bumpSelectedTabCountOnNewPost();
    });
}

function bindCommentCancelOnce() {
    if (!vkify.bindOnce('commentCancel', bindCommentCancelOnce)) return;

    u(document).on('click', '.wall-comment-cancel', (e) => {
        e.preventDefault();
        const button = e.target.closest('.wall-comment-cancel');
        const form = button?.closest('form');
        resetWallComposer(form);
    });
}

vkify.once('initTextareaInteraction', () => {
    window.initTextareaInteraction = () => {
        if (!vkify.bindOnce('textareaInteraction', window.initTextareaInteraction)) return;

        const showComposer = (target) => {
            if (target.tagName === 'TEXTAREA' || target.classList?.contains('submit_post_field')) {
                target.closest('.model_content_textarea')?.classList.add('shown');
                if (target.classList?.contains('small-textarea')) {
                    target.classList.add('expanded-textarea');
                }
            }
        };

        ['focus', 'input', 'click'].forEach(event => {
            document.addEventListener(event, e => showComposer(e.target), event === 'focus');
        });

        const checkAttachments = () => {
            document.querySelectorAll('.model_content_textarea').forEach(box => {
                const horizontal = box.querySelector('.post-horizontal');
                const vertical = box.querySelector('.post-vertical');
                if ((horizontal?.children.length || vertical?.children.length)) {
                    box.classList.add('shown');
                }
            });
        };

        checkAttachments();
        vkify.observeDOM(checkAttachments, {
            filter: m => m.type === 'childList'
        });
    };
});

function bindSourceButtonOrderFix() {
    if (!vkify.bindOnce('sourceButtonOrderFix', bindSourceButtonOrderFix)) return;
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#__sourceAttacher')) return;
        e.preventDefault();
        queueMicrotask(() => {
            const action = document.querySelector('.ovk-diag-action');
            const setBtn = action?.querySelector('#__setsrcbutton');
            const first = action?.firstElementChild;
            if (action && setBtn && first && first !== setBtn) {
                action.insertBefore(setBtn, first);
            }
        });
    });
}

setupWallCheckboxListeners();
bindComposerSubmitOnce();
bindCommentCancelOnce();
bindSourceButtonOrderFix();

let _groupInfoTabsInitialized = false;
function initGroupInfoTabs() {
    if (_groupInfoTabsInitialized) return;
    _groupInfoTabsInitialized = true;

    document.addEventListener('click', (e) => {
        const container = e.target.closest('#group_info_tabs');
        if (!container) return;

        const tabLink = e.target.closest('.ui_tab');
        if (!tabLink) return;
        
        e.preventDefault();
        
        const tabLi = tabLink.closest('li');
        if (!tabLi) return;
        const tabId = tabLi.id;
        
        container.querySelectorAll('li').forEach(li => {
            const tab = li.querySelector('.ui_tab');
            if (tab) tab.classList.toggle('ui_tab_sel', li.id === tabId);
        });
        vkify.moveTabSlider?.(container, tabLink, true);
        
        const infoContent = document.getElementById('group_tab_info_content');
        const pinnedContent = document.getElementById('group_tab_pinned_content');
        
        if (tabId === 'group_tab_info') {
            if (infoContent) infoContent.style.display = '';
            if (pinnedContent) pinnedContent.style.display = 'none';
        } else if (tabId === 'group_tab_pinned') {
            if (infoContent) infoContent.style.display = 'none';
            if (pinnedContent) pinnedContent.style.display = '';
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initTextareaInteraction();
        initGroupInfoTabs();
    });
} else {
    window.initTextareaInteraction();
    initGroupInfoTabs();
}

function getSuggestionPostNode(el) {
    return el?.closest('.post') || el?.closest('table') || null;
}

function getClubPageUrl() {
    const match = location.pathname.match(/^\/club(\d+)/);
    return match ? `/club${match[1]}` : location.pathname.replace(/\/suggested$/, '');
}

function setWallTabSelected(tabId, animate = true) {
    const container = document.getElementById('wall_top_tabs');
    const targetTab = document.getElementById(tabId)?.querySelector('.ui_tab');
    if (!container || !targetTab) return;

    document.querySelectorAll('#wall_top_tabs > li').forEach((li) => {
        const tab = li.querySelector('.ui_tab');
        if (!tab) return;
        tab.classList.toggle('ui_tab_sel', li.id === tabId);
    });

    vkify.moveTabSlider?.(container, targetTab, animate);
}

function isAjaxWallOpen() {
    const insertThere = document.querySelector('.wall_module .insertThere');
    return insertThere?.style.display === 'block';
}

function showAjaxWallContent(tabId, updateHistory = true) {
    const insertThere = document.querySelector('.wall_module .insertThere');
    const allPostsContainer = document.querySelector('.wall_module #underHeader > #all_posts') || document.getElementById('all_posts') || document.querySelector('.wall_module #underHeader') || document.getElementById('underHeader');
    const tabLink = document.querySelector(`#${tabId} a`);
    if (!insertThere || !allPostsContainer || !tabLink) return;

    allPostsContainer.style.display = 'none';
    insertThere.style.display = 'block';
    
    if (tabId === 'wall_tab_suggested') {
        insertThere.classList.add('infContainer');
    } else {
        insertThere.classList.remove('infContainer');
    }

    
    if (updateHistory) window.router?.updateHistory(tabLink.href, { kind: 'tab' });

    if (insertThere.dataset.loadedTab === tabId) return;
    
    insertThere.innerHTML = '';
    insertThere.dataset.loadedTab = tabId;

    if (typeof window.__resetPaginatorState === 'function') {
        const allPostsContainer = document.querySelector('.wall_module #underHeader > #all_posts') || document.getElementById('all_posts') || document.querySelector('.wall_module #underHeader') || document.getElementById('underHeader');
        window.__resetPaginatorState(allPostsContainer);
    }

    const fetchUrl = tabId === 'wall_tab_owners'
        ? tabLink.href + (tabLink.href.includes('?') ? '&' : '?') + '__vkify16_tab=1'
        : tabLink.href;

    ky.get(fetchUrl, {
        hooks: {
            beforeRequest: [() => {
                insertThere.insertAdjacentHTML('afterbegin', '<div class="page_block page_padding loader_wrapper" style="text-align: center;"></div>');
                if (window.LoaderUtils) {
                    window.LoaderUtils.show(insertThere.querySelector('.loader_wrapper'));
                } else {
                    insertThere.querySelector('.loader_wrapper').innerHTML = '<img src="/assets/packages/static/openvk/img/loading_mini.gif">';
                }
            }],
            afterResponse: [async (_request, _options, response) => {
                const text = await response.text();
                const doc = new DOMParser().parseFromString(text, 'text/html');
                
                let result;
                if (tabId === 'wall_tab_suggested') {
                    result = doc.querySelector('.infContainer');
                } else if (tabId === 'wall_tab_owners') {
                    result = doc.getElementById('owner_posts') || doc.querySelector('.wall_posts.content.scroll_container') || doc.querySelector('.content.scroll_container');
                } else if (tabId === 'wall_tab_archive') {
                    result = doc.getElementById('archive_posts_container');
                }

                if (!result) return;
                
                if (tabId === 'wall_tab_owners' || tabId === 'wall_tab_suggested' || tabId === 'wall_tab_archive') {
                    const loadedSearch = result.querySelector('#wall_search');
                    // The search bar is wrapped in a page_block, it's better to hide the whole block if it exists
                    if (loadedSearch) {
                        const searchBlock = loadedSearch.closest('.page_block');
                        if (searchBlock && searchBlock.style) {
                            searchBlock.style.display = 'none';
                        } else {
                            loadedSearch.style.display = 'none';
                        }
                    }
                }

                result.querySelectorAll('.bsdn').forEach(bsdnInitElement);
                // For owners and archive, we inject outerHTML so the wrapper is preserved
                if (tabId === 'wall_tab_owners' || tabId === 'wall_tab_archive') {
                    insertThere.innerHTML = result.outerHTML;
                } else {
                    insertThere.innerHTML = result.innerHTML;
                }

                if (tabId === 'wall_tab_archive') {
                    vkify.initTabSliderSafe?.();

                    const archiveBanner = insertThere.querySelector('.page_block.archive_banner');
                    if (archiveBanner && !archiveBanner.querySelector('.archive_banner_link')) {
                        const archiveUrl = tabLink.href.split('?')[0] + '?type=archive';
                        const label = window.vkifylang?.manage_archive ?? 'Manage archive';
                        archiveBanner.insertAdjacentHTML('beforeend', `<a class="button archive_banner_link" href="${archiveUrl}">${label}</a>`);
                    }
                }
            }],
        },
    });
}

function hideAjaxWallContent(updateHistory = true) {
    const insertThere = document.querySelector('.wall_module .insertThere');
    const allPostsContainer = document.getElementById('all_posts') || document.querySelector('.wall_module #underHeader') || document.getElementById('underHeader');
    if (!insertThere || !allPostsContainer) return;

    allPostsContainer.style.display = '';
    insertThere.style.display = 'none';
    insertThere.classList.remove('infContainer');
    insertThere.dataset.loadedTab = 'wall_tab_all';
    
    if (typeof window.__resetPaginatorState === 'function') {
        window.__resetPaginatorState(allPostsContainer);
    }
    
    const allTabLink = document.querySelector('#wall_tab_all a');
    const url = allTabLink ? allTabLink.href : getClubPageUrl();
    
    if (updateHistory) window.router?.updateHistory(url, { kind: 'tab' });
}

function updateSuggestionCounts(newCount) {
    const count = String(newCount);

    const tabCount = document.querySelector('#wall_tab_suggested .ui_tab_count');
    if (tabCount) tabCount.textContent = count;

    const cound = document.getElementById('cound');
    if (cound) {
        cound.textContent = tr('suggested_posts_in_group', newCount);
    }

    document.querySelectorAll('.page_block_header_inner .ui_crumb_count').forEach((el, idx, all) => {
        if (idx === all.length - 1) el.textContent = count;
    });

    if (newCount < 1) {
        const insertThere = document.querySelector('.wall_module .insertThere');
        if (isAjaxWallOpen() && insertThere?.dataset?.loadedTab === 'wall_tab_suggested') {
            hideAjaxWallContent();
        }
        document.getElementById('wall_tab_suggested')?.remove();
        if (insertThere?.dataset?.loadedTab === 'wall_tab_suggested') {
            setWallTabSelected('wall_tab_all', false);
        }
    }
}

function removeSuggestionPost(postNode) {
    if (!postNode) return;
    postNode.style.transition = 'opacity 300ms ease-in-out';
    postNode.style.opacity = '0';
    postNode.classList.remove('post');
    setTimeout(() => { postNode.outerHTML = ''; }, 300);
}

function loadMoreSuggestedPostsVkify() {
    let link = location.href;
    if (!link.includes('/suggested')) {
        link += '/suggested';
    }

    const container = document.getElementById('postz') || document.getElementById('wall_block_posts');
    if (!container) return;

    ky.get(link, {
        hooks: {
            beforeRequest: [() => {
                container.innerHTML = '<img src="/assets/packages/static/openvk/img/loading_mini.gif">';
            }],
            afterResponse: [async (_request, _options, response) => {
                const body = new DOMParser().parseFromString(await response.text(), 'text/html');
                const posts = body.querySelectorAll('.post');

                if (posts.length < 1) {
                    const url = new URL(location.href);
                    const page = Number(url.searchParams.get('p') || 1);
                    if (page < 2) return;
                    url.searchParams.set('p', String(page - 1));
                    window.router?.updateHistory(url, { kind: 'tab' });
                    loadMoreSuggestedPostsVkify();
                    return;
                }

                body.querySelectorAll('.bsdn').forEach(bsdnInitElement);
                const source = body.getElementById('postz') || body.getElementById('wall_block_posts');
                if (source) container.innerHTML = source.innerHTML;
            }],
        },
    });
}

function initSuggestionsAdapterOnce() {
    if (!vkify.bindOnce('suggestionsAdapter', initSuggestionsAdapterOnce)) return;
    if (typeof window.ky === 'undefined' || typeof window.MessageBox !== 'function') return;

    window.endSuggestAction = (newCount, postNode) => {
        updateSuggestionCounts(newCount);
        removeSuggestionPost(postNode);

        const postsRoot = document.getElementById('postz') || document.getElementById('wall_block_posts');
        if (
            postsRoot
            && postsRoot.querySelectorAll('.post').length < 1
            && newCount > 0
            && document.querySelector('.paginator')
        ) {
            loadMoreSuggestedPostsVkify();
        }
    };

    window.loadMoreSuggestedPosts = loadMoreSuggestedPostsVkify;

    vkify.onWallTabSwitch = (tab) => {
        const tabId = tab.closest('li')?.id;
        if (tabId === 'wall_tab_suggested' || tabId === 'wall_tab_owners' || tabId === 'wall_tab_archive') {
            showAjaxWallContent(tabId);
            return true;
        }
        if (tabId === 'wall_tab_all' && isAjaxWallOpen()) {
            hideAjaxWallContent();
            return true;
        }
        return false;
    };

    window.addEventListener('popstate', (event) => {
        if (event.state?.vkify?.kind !== 'tab') return;
        const activeTab = Array.from(document.querySelectorAll('#wall_top_tabs > li a')).find(link => link.href === location.href)?.closest('li');
        if (activeTab?.id && activeTab.id !== 'wall_tab_all') {
            showAjaxWallContent(activeTab.id, false);
        } else if (isAjaxWallOpen()) {
            hideAjaxWallContent(false);
        }
    });

    document.addEventListener('click', (e) => {
        const declineBtn = e.target.closest('#decline_post');
        if (declineBtn) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const post = getSuggestionPostNode(declineBtn);
            const formData = new FormData();
            formData.append('id', declineBtn.dataset.id);
            formData.append('hash', u('meta[name=csrf]').attr('value'));

            declineBtn.classList.add('lagged');
            declineBtn.removeAttribute('id');

            ky.post('/wall/decline', { body: formData }).then(async (response) => {
                const json = await response.json();
                if (json.success) {
                    window.endSuggestAction(json.new_count, post);
                } else {
                    MessageBox(tr('error'), json.flash.message, [tr('ok')], [Function.noop]);
                }
                declineBtn.textContent = tr('decline_suggested');
                declineBtn.id = 'decline_post';
                declineBtn.classList.remove('lagged');
            }).catch(console.error);

            return;
        }

        const publishBtn = e.target.closest('#publish_post');
        if (!publishBtn) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const post = getSuggestionPostNode(publishBtn);
        const sourceText = post?.querySelector('.really_text')?.dataset?.text || '';
        const body = `
            <textarea id="pooblish" style="max-height:500px;resize:vertical;min-height:54px;"></textarea>
            <label class="checkbox"><input type="checkbox" id="signatr" checked><span>${tr('add_signature')}</span></label>
        `;

        MessageBox(tr('publishing_suggested_post'), body, [tr('publish'), tr('cancel')], [
            async () => {
                const formData = new FormData();
                formData.append('id', publishBtn.dataset.id);
                formData.append('sign', document.getElementById('signatr')?.checked ? 1 : 0);
                formData.append('new_content', document.getElementById('pooblish')?.value || '');
                formData.append('hash', u('meta[name=csrf]').attr('value'));

                publishBtn.classList.add('lagged');
                publishBtn.removeAttribute('id');

                try {
                    const response = await ky.post('/wall/accept', { body: formData });
                    const json = await response.json();

                    if (json.success) {
                        NewNotification(
                            tr('suggestion_succefully_published'),
                            tr('suggestion_press_to_go'),
                            null,
                            () => { window.location.assign(`/wall${json.id}`); }
                        );
                        window.endSuggestAction(json.new_count, post);
                    } else {
                        MessageBox(tr('error'), json.flash.message, [tr('ok')], [Function.noop]);
                    }
                } catch (err) {
                    console.error(err);
                }

                publishBtn.textContent = tr('publish_suggested');
                publishBtn.id = 'publish_post';
                publishBtn.classList.remove('lagged');
            },
            Function.noop,
        ]);

        const pooblish = document.getElementById('pooblish');
        if (pooblish) pooblish.value = sourceText;
        const diagBody = document.querySelector('.ovk-diag-body');
        if (diagBody) diagBody.style.padding = '9px';
    }, true);
}

initSuggestionsAdapterOnce();

vkify.once('reportPost', () => {
    window.reportPost = (postId) => {
        const uReportMsgTxt = `${tr("going_to_report_post")}<br/>${tr("report_question_text")}<br/><br/><b>${tr("report_reason")}</b>: <input type='text' id='uReportMsgInput' placeholder='${tr("reason")}' />`;

        MessageBox(tr("report_question"), uReportMsgTxt, [tr("confirm_m"), tr("cancel")], [
            async () => {
                const reasonInput = document.querySelector('#uReportMsgInput');
                const reason = reasonInput?.value?.trim() ?? '';

                try {
                    const params = new URLSearchParams({ reason, type: 'post' });
                    const body = await ky.get(`/report/${postId}?${params.toString()}`).text();
                    if (body.indexOf('reason') === -1) {
                        MessageBox(tr('error'), tr('error_sending_report'), ['OK'], [Function.noop]);
                        return;
                    }

                    MessageBox(tr('action_successfully'), tr('will_be_watched'), ['OK'], [Function.noop]);
                } catch (_err) {
                    MessageBox(tr('error'), tr('error_sending_report'), ['OK'], [Function.noop]);
                }
            },
            Function.noop
        ]);
    };
});

vkify.onPageLifecycle('afterPageReady', () => {
    if (window.postPopupManager && !window.postPopupManager.currentModal) {
        window.postPopupManager.checkInitialUrl();
    }
}, 'after');

vkify.once('editMenuLayout', () => {
    vkify.editMenuLayout = (api_post, type, postId) => renderEditMenuLayout(api_post, type, postId);
});

function bindPostEditOnce() {
    if (!vkify.bindOnce('postEdit', bindPostEditOnce)) return;

    document.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('#editPost');
        if (!editBtn) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const post = u(editBtn).closest('.post');
        if (!post.length) return;

        if (post.hasClass('editing')) {
            post.removeClass('editing');
            return;
        }

        const edit_place_l = post.hasClass('reply') ? post.find('.reply_content > .post_edit') : post.children('.post_edit');
        const edit_place = u(edit_place_l.first());
        const rawId = post.attr('data-id') || '';
        const id = rawId.split('_');
        const type = post.hasClass('reply') ? 'comment' : 'post';

        if (edit_place.html() === '') {
            u(editBtn).addClass('lagged');
            try {
                const params = type === 'post' ? { posts: rawId } : { owner_id: 1, comment_id: id[1] };
                const api_req = await window.OVKAPI.call(`wall.${type === 'post' ? 'getById' : 'getComment'}`, params);
                const api_post = api_req.items[0];

                edit_place.html(vkify.editMenuLayout(api_post, type, rawId));

                if (api_post.copyright) {
                    edit_place.find('.post-source').html(`
                        <span>${tr('source')}: <a>${escapeHtml(api_post.copyright.link)}</a></span>
                        <div id='remove_source_button'></div>
                    `);
                    edit_place.find('.post-source #remove_source_button').on('click', () => {
                        edit_place.find('.post-source').html('');
                        edit_place.find(`input[name='source']`).attr('value', 'remove');
                    });
                }

                if (api_post.copy_history?.length > 0) {
                    edit_place.find('.post-repost').html(`<span>${tr('has_repost')}.</span>`);
                }

                api_post.attachments.forEach(att => {
                    const attType = att.type;
                    let aid = `${att[attType].owner_id}_${att[attType].id}`;
                    if (att[attType]?.access_key) aid += `_${att[attType].access_key}`;

                    if (attType === 'video' || attType === 'photo') {
                        const preview = attType === 'photo' ? att[attType].sizes[1].url : att[attType].image[0].url;
                        window.__appendToTextarea({ type: attType, preview, id: aid }, edit_place);
                    } else if (attType === 'poll') {
                        window.__appendToTextarea({ type: attType, alignment: 'vertical', html: tr('poll'), id: att[attType].id, undeletable: true }, edit_place);
                    } else {
                        const found_block = post.find(`div[data-att_type='${attType}'][data-att_id='${aid}']`);
                        window.__appendToTextarea({ type: attType, alignment: 'vertical', html: found_block.html(), id: aid }, edit_place);
                    }
                });

                edit_place.find('.edit_menu #__edit_save').on('click', async (ev) => {
                    const p = {
                        owner_id: id[0],
                        post_id: id[1],
                        message: edit_place.find('.edit_menu textarea').nodes[0].value
                    };
                    const editForm = edit_place.find('.edit_menu form').nodes[0];
                    const nsfw_mark = editForm?.elements.namedItem('nsfw') || null;
                    const as_group = editForm?.elements.namedItem('as_group') || null;
                    const copyright = edit_place.find(`.edit_menu input[name='source']`);
                    const collected_attachments = collect_attachments(edit_place.find('.post-buttons')).join(',');

                    if (nsfw_mark) p.explicit = Number(nsfw_mark.checked);
                    p.attachments = collected_attachments.length < 1 ? 'remove' : collected_attachments;
                    if (as_group?.checked) p.from_group = 1;
                    if (copyright.length && copyright.nodes[0].value !== 'none') p.copyright = copyright.nodes[0].value;

                    u(ev.target).addClass('lagged');
                    try {
                        if (type === 'post') {
                            await window.OVKAPI.call('wall.edit', p);
                        } else {
                            p.comment_id = id[1];
                            await window.OVKAPI.call('wall.editComment', p);
                        }
                    } catch (err) {
                        fastError(err.message);
                        u(ev.target).removeClass('lagged');
                        return;
                    }

                    const new_post_html = await ContentFetcher.request(`/iapi/getPostTemplate/${id[0]}_${id[1]}?type=${type}`, {
                        method: 'POST',
                        responseType: 'text',
                        ajaxQuery: false
                    });
                    u(ev.target).removeClass('lagged');
                    post.removeClass('editing');
                    post.nodes[0].outerHTML = u(new_post_html).last().outerHTML;
                    bsdnHydrate();
                });

                edit_place.find('.edit_menu #__edit_cancel').on('click', () => post.removeClass('editing'));
            } catch (err) {
                console.error('Failed to load post for editing:', err);
                NewNotification(tr('error'), tr('error_loading_post'), null, () => {}, 4000, false);
            }
            u(editBtn).removeClass('lagged');
        }

        post.addClass('editing');
        const ta = edit_place.find('textarea').first();
        if (ta) window.vkifyTextareaAutosize?.apply?.(ta);
    }, true);
}

bindPostEditOnce();

vkify.once('shareAudioPlaylist', () => {
    window.shareAudioPlaylist = async (event, owner_id, playlist_id) => {
        event.preventDefault();
        event.stopPropagation();

        const msg = new CMessageBox({
            title: tr('share'),
            unique_name: 'repost_playlist_modal',
            body: `
                <form id="write">
                    <div class="messagebox-content-header">
                        <vkifyloc name="playlist_share_explain"></vkifyloc>
                    </div>
                    <div class='display_flex_column' style='margin-top: 10px;'>
                        <b>${tr('auditory')}</b>

                        <div class='display_flex_column' style="gap: 4px;padding-left: 1px;">
                            <label class="radio">
                                <input type="radio" name="repost_type" value="wall" checked>
                                <span>${tr("in_wall")}</span>
                            </label>

                            <label class="radio">
                                <input type="radio" name="repost_type" value="group">
                                <span>${tr("in_group")}</span>
                            </label>

                            <select class="dark" name="selected_repost_club" style='display:none; margin-top: 5px; width: 100%;'></select>
                        </div>

                        <b style="margin-top: 12px; margin-bottom: 6px;">${tr('your_comment')}</b>

                        <div style="padding-left: 1px;">
                            <textarea id='repostMsgInput' class="dark" placeholder='...' style="width: 100%; box-sizing: border-box; height: 60px; resize: none;"></textarea>
                        </div>
                    </div>
                    <div class="post-buttons" style="display: block;">
                        <div class="post-horizontal"></div>
                        <div class="post-vertical"></div>
                        ${renderRepostBottomLayout()}
                    </div>
                </form>
            `,
            buttons: [],
            callbacks: []
        });

        const node = msg.getNode();
        u('.ovk-diag-body').attr('style', 'padding: 20px 25px;');

        const updateAttachClub = () => {
            const type = node.find("input[name='repost_type']:checked").nodes[0]?.value;
            let clubId = 0;
            if (type === 'group') {
                try {
                    clubId = parseInt(node.find("select[name='selected_repost_club']").nodes[0]?.value, 10) || 0;
                } catch(_e) {}
            }
            node.find('#wallAttachmentMenu a').attr('data-club', clubId);
        };

        // Bind repost type changes
        u('.ovk-diag-body').on('change', "input[name='repost_type']", (e) => {
            const value = e.target.value;
            const hasClubs = window.openvk.writeableClubs && window.openvk.writeableClubs.items.length > 0;
            switch(value) {
                case 'wall':
                    u('#__vkifyRepostOptsTrigger').attr('style', 'display:none');
                    u("select[name='selected_repost_club']").attr('style', 'display:none');
                    break;
                case 'group':
                    if (hasClubs) {
                        u('#__vkifyRepostOptsTrigger').attr('style', 'display:block');
                        u("select[name='selected_repost_club']").attr('style', 'display:block');
                    }
                    break;
            }
            updateAttachClub();
        });

        u('.ovk-diag-body').on('change', "select[name='selected_repost_club']", () => {
            updateAttachClub();
        });

        // Bind option changes inside the tooltip
        node.find('#__vkifyRepostOptsTooltip input[name="asGroup"]').on('change', (e) => {
            node.find('#__vkifyRepostSignedOpt').attr('style', e.target.checked ? '' : 'display:none');
        });

        // Bind send button click
        node.find('#__vkifyRepostSend').on('click', async () => {
            const message = node.find('#repostMsgInput').nodes[0].value;
            const type = node.find("input[name='repost_type']:checked").nodes[0].value;
            let club_id = 0;
            try {
                club_id = parseInt(node.find("select[name='selected_repost_club']").nodes[0].selectedOptions[0].value, 10);
            } catch(_e) {}

            const as_group = node.find('#__vkifyRepostOptsTooltip input[name="asGroup"]').nodes[0]?.checked;
            const signed = node.find('#__vkifyRepostOptsTooltip input[name="signed"]').nodes[0]?.checked;
            const attachments = collect_attachments(node.find('.post-buttons')).join(',');

            const playlistUrl = `${window.location.origin}/playlist${owner_id}_${playlist_id}`;
            const postText = message ? `${message}\n\n${playlistUrl}` : playlistUrl;

            const params = {
                message: postText,
                owner_id: type === 'group' && club_id !== 0 ? -club_id : window.openvk.current_id
            };

            if (as_group) params.from_group = 1;
            if (signed) params.signed = 1;
            if (attachments) params.attachments = attachments;

            const sendBtn = node.find('#__vkifyRepostSend').nodes[0];
            LoaderUtils.showInButton(sendBtn);

            try {
                const res = await window.OVKAPI.call('wall.post', params);
                msg.close();
                NewNotification(tr('information_-1'), tr('shared_succ'), null, () => {
                    window.router.route(`/wall${params.owner_id}_${res.post_id}`);
                });
            } catch (e) {
                console.error(e);
                fastError(e.message);
            } finally {
                LoaderUtils.restoreButton(sendBtn);
            }
        });

        // Initialize clubs list
        if(!window.openvk.writeableClubs) {
            window.openvk.writeableClubs = await window.OVKAPI.call('groups.get', {'filter': 'admin', 'count': 100});
        }

        window.openvk.writeableClubs.items.forEach(club => {
            u("select[name='selected_repost_club']").append(`<option value='${club.id}'>${ovk_proc_strtr(escapeHtml(club.name), 100)}</option>`);
        });

        if(window.openvk.writeableClubs.items.length < 1) {
            u("input[name='repost_type'][value='group']").attr('disabled', 'disabled');
            u("input[name='repost_type'][value='group']").closest("label").addClass("lagged");
        }

    };
});

function bindWallSearchOnce() {
    if (!vkify.bindOnce('wallSearch', bindWallSearchOnce)) return;

    const toggleSearchFieldEmptyState = (input) => {
        if (!input) return;
        input.closest('.ui_search')?.classList.toggle('ui_search_field_empty', input.value.length === 0);
    };

    const resetTabsScrollPosition = (tabs) => {
        if (!tabs) return;
        tabs.scrollLeft = 0;
    };

    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('.ui_tab_search');
        if (!toggle) return;

        const header = toggle.closest('.tabs_header');
        if (!header) return;

        if (header.classList.contains('ui_tabs_search_opened')) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        header.classList.add('ui_tabs_search_opened');
        const input = header.querySelector('.ui_search_field');
        if (input) input.focus();
    }, true);

    document.addEventListener('click', (e) => {
        const reset = e.target.closest('.ui_tab_search_wrap .ui_search_reset');
        if (!reset) return;

        const header = reset.closest('.tabs_header');
        if (!header) return;

        header.classList.remove('ui_tabs_search_opened');
        const input = header.querySelector('.ui_search_field');
        if (input) {
            input.value = '';
            toggleSearchFieldEmptyState(input);
        }
    }, true);

    u(document).on('input', '.ui_tab_search_wrap .ui_search_field', (e) => {
        toggleSearchFieldEmptyState(e.target);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'search') {
        const header = document.querySelector('#wall_top_tabs')?.closest('.tabs_header');
        if (header) {
            header.classList.add('ui_tabs_search_opened');
        }
    }
}

bindWallSearchOnce();

vkify.once('repostModalLayout', () => {
    vkify.hook(window, 'repost', (_id, _repost_type) => {
        const dialogBody = u('.ovk-diag-body');
        if (!dialogBody.length) return;

        const dialog = dialogBody.closest('.ovk-diag-cont');
        const footer = dialog.find('.ovk-diag-action');
        const originalSendBtn = footer.find('button').first();

        footer.attr('style', 'display:none');

        const editMenuButtons = dialogBody.find('.edit_menu_buttons');
        if (!editMenuButtons.length) return;

        const repostSignsEl = dialogBody.find('#repost_signs');
        const hasGroupOpts = repostSignsEl.length > 0;

        const newLayoutHtml = renderRepostBottomLayout();

        editMenuButtons.replace(newLayoutHtml);
        dialogBody.find('.post-buttons').attr('style', 'display:block');

        if (hasGroupOpts) {
            repostSignsEl.attr('style', 'display:none !important');
            const optsTrigger = dialogBody.find('#__vkifyRepostOptsTrigger');

            const origAsGroup = repostSignsEl.find('input[name="asGroup"]');
            const origSigned = repostSignsEl.find('input[name="signed"]');

            const signedOpt = dialogBody.find('#__vkifyRepostSignedOpt');
            dialogBody.find('#__vkifyRepostOptsTooltip input[name="asGroup"]').on('change', (e) => {
                if (origAsGroup.nodes[0]) origAsGroup.nodes[0].checked = e.target.checked;
                signedOpt.attr('style', e.target.checked ? '' : 'display:none');
            });
            dialogBody.find('#__vkifyRepostOptsTooltip input[name="signed"]').on('change', (e) => {
                if (origSigned.nodes[0]) origSigned.nodes[0].checked = e.target.checked;
            });

            dialogBody.on('change', `input[name='repost_type']`, (e) => {
                optsTrigger.attr('style', e.target.value === 'group' ? '' : 'display:none');
                repostSignsEl.attr('style', 'display:none !important');
            });
        }

        dialogBody.find('#__vkifyRepostSend').on('click', () => {
            if (originalSendBtn) originalSendBtn.click();
        });

    }, 'then');
});

// Post template from post-template.js
const Hb = window.Handlebars;

const tplMapIcon = `<svg class="map_svg_icon" width="13" height="12" viewBox="0 0 3.4395833 3.175"><g><path d="M 1.7197917 0.0025838216 C 1.1850116 0.0049444593 0.72280427 0.4971031 0.71520182 1.0190592 C 0.70756921 1.5430869 1.7223755 3.1739665 1.7223755 3.1739665 C 1.7223755 3.1739665 2.7249195 1.5439189 2.7243815 0.99632161 C 2.7238745 0.48024825 2.2492929 0.00024648357 1.7197917 0.0025838216 z M 1.7197917 0.52606608 A 0.48526123 0.48526123 0 0 1 2.2050334 1.0113078 A 0.48526123 0.48526123 0 0 1 1.7197917 1.4965495 A 0.48526123 0.48526123 0 0 1 1.23455 1.0113078 A 0.48526123 0.48526123 0 0 1 1.7197917 0.52606608 z " /></g></svg>`;

const postTpl = Hb.compile(
`<div class="post page_block scroll_node" data-id="{{pretty_id}}" data-uniqueid="{{pretty_id}}">
    <div class="post_header">
        <a class="post_image" href="{{owner.domain}}">
            <img src="{{owner.photo_50}}" width="50" class="post-avatar">
        </a>
        <div class="post_header_info">
            <div class="post_author">
                <a class="author" href="{{owner.domain}}">{{owner.name}}</a>
                {{#if owner.verified}}<span class="page_verified"></span>{{/if}}
            </div>
            <div class="post_date">
                <a href="{{url}}" class="post_link">{{{created}}}</a>
            </div>
        </div>
    </div>
    <div class="post-content">
        <div class="text wall_text">
            <div class="really_text wall_post_text">{{message}}</div>
        </div>
        {{#if geo.name}}
        <div class="post-geo">
            <span class="post-geo-link">
                {{{map_icon}}}
                {{geo.name}}
            </span>
        </div>
        {{/if}}
    </div>
</div>`
);

function vkifyTplPost(post) {
    return postTpl({
        pretty_id: post.pretty_id || '',
        owner: {
            name: post.owner?.name || '',
            domain: post.owner?.domain || '',
            photo_50: post.owner?.photo_50 || '',
            verified: !!post.owner?.verified
        },
        url: post.url || '',
        created: post.created || '',
        message: post.message || '',
        geo: post.geo ? { name: post.geo.name || '' } : null,
        map_icon: tplMapIcon
    });
}

vkify.hook(window, 'tplPost', vkifyTplPost, 'replace');

// Stock #__ignoreSomeoneFeed handler assumes .scroll_node wraps .post as
// separate elements. In our template both classes sit on the same <div>, so
// find('.post') inside scroll_node returns nothing on unignore. We intercept
// in the capture phase (runs before stock's bubbling handler), take over, and
// animate the transition the same way post deletion does.
vkify.bindOnce('ignoreFeedFix', () => {
    // Replace the post's contents in-place with new HTML, mirroring the
    // post-delete animation: fade-out current content, swap innerHTML,
    // fade-in new content, animate height to its new natural size.
    async function morphPostContents(post, newInnerHTML, finalClasses) {
        post.style.position = 'relative';

        const wrapper = document.createElement('div');
        wrapper.style.opacity = '1';
        wrapper.style.transition = 'opacity 300ms ease';
        while (post.firstChild) wrapper.appendChild(post.firstChild);
        post.appendChild(wrapper);

        const originalHeight = post.offsetHeight;
        post.style.height   = `${originalHeight}px`;
        post.style.overflow = 'hidden';

        void wrapper.offsetHeight;
        wrapper.style.opacity = '0';

        await Promise.race([
            new Promise(resolve => {
                const handler = evt => {
                    if (evt.propertyName === 'opacity') {
                        wrapper.removeEventListener('transitionend', handler);
                        resolve();
                    }
                };
                wrapper.addEventListener('transitionend', handler);
            }),
            new Promise(resolve => setTimeout(resolve, 350))
        ]);

        post.innerHTML = newInnerHTML;
        if (finalClasses) {
            post.className = finalClasses;
        }

        const newChild = post.firstElementChild;
        if (!newChild) return;

        newChild.style.opacity = '0';
        newChild.style.transition = 'opacity 300ms ease';
        void newChild.offsetHeight;
        newChild.style.opacity = '1';

        await Promise.race([
            new Promise(resolve => {
                const handler = evt => {
                    if (evt.propertyName === 'opacity') {
                        newChild.removeEventListener('transitionend', handler);
                        resolve();
                    }
                };
                newChild.addEventListener('transitionend', handler);
            }),
            new Promise(resolve => setTimeout(resolve, 350))
        ]);

        const newHeight = newChild.offsetHeight;
        // Transition height itself so the box animates in either direction
        // (grow for undo, shrink for ignore). max-height alone can't grow
        // past style.height, and clearing height breaks shrink animations.
        post.style.transition = 'height 300ms ease';
        post.style.height     = `${newHeight}px`;

        await Promise.race([
            new Promise(resolve => {
                const handler = evt => {
                    if (evt.propertyName === 'height') {
                        post.removeEventListener('transitionend', handler);
                        resolve();
                    }
                };
                post.addEventListener('transitionend', handler);
            }),
            new Promise(resolve => setTimeout(resolve, 350))
        ]);

        post.style.position   = '';
        post.style.height     = '';
        post.style.overflow   = '';
        post.style.transition = '';
        newChild.style.transition = '';
        newChild.style.opacity    = '';
    }

    document.addEventListener('click', async (e) => {
        const target = e.target.closest('#__ignoreSomeoneFeed');
        if (!target) return;

        e.stopImmediatePropagation();
        e.preventDefault();

        const ENTITY_ID = Number(target.dataset.id);
        const VAL       = Number(target.dataset.val);
        const ACT       = VAL === 1 ? 'ignore' : 'unignore';
        const METHOD    = ACT === 'ignore' ? 'addBan' : 'deleteBan';
        const PARAM     = ENTITY_ID < 0 ? 'group_ids' : 'user_ids';
        const ENTITY    = ENTITY_ID < 0 ? 'club' : 'user';
        const URL       = `/method/newsfeed.${METHOD}?auth_mechanism=roaming&${PARAM}=${Math.abs(ENTITY_ID)}`;

        // The post element is what we morph. On ignore, target is inside
        // .post. On unignore, target is inside .ignore-message — but in our
        // setup we morph the post in-place, so unignore's target IS inside
        // the same .post element (the post was replaced in-place, not
        // moved to a sibling).
        const post = target.closest('.post');
        if (!post) return;

        post.classList.add('lagged');
        target.style.pointerEvents = 'none';

        const res  = await fetch(URL);
        const json = await res.json();

        target.style.pointerEvents = '';

        if (json.error_code) {
            post.classList.remove('lagged');
            switch (json.error_code) {
                case -10: fastError(';/'); break;
                case -50: fastError(tr('ignored_sources_limit')); break;
                default:  fastError(json.error_msg); break;
            }
            return;
        }

        if (json.response !== 1) {
            post.classList.remove('lagged');
            return;
        }

        post.classList.remove('lagged');

        if (ACT === 'ignore') {
            const ignoredText  = window.vkifylang[`feed_${ENTITY}_ignored`];
            const unignoreText = window.vkifylang.feed_unignore;
            const newHTML = `<div class="ignore-message">${ignoredText} <a id="__ignoreSomeoneFeed" data-val="0" data-id="${ENTITY_ID}" href="#">${unignoreText}</a></div>`;
            const originalHTML = post.innerHTML;
            const originalCls  = post.className;
            post.dataset.preIgnoreHtml      = encodeURIComponent(originalHTML);
            post.dataset.preIgnoreClassName = originalCls;
            await morphPostContents(post, newHTML, `${originalCls} post-hidden`);
        } else {
            const originalHTML = post.dataset.preIgnoreHtml ? decodeURIComponent(post.dataset.preIgnoreHtml) : '';
            const originalCls  = post.dataset.preIgnoreClassName ?? post.className.replace(/\bpost-hidden\b/g, '').trim();
            delete post.dataset.preIgnoreHtml;
            delete post.dataset.preIgnoreClassName;
            if (!originalHTML) {
                post.classList.remove('post-hidden');
                return;
            }
            await morphPostContents(post, `<div class="vkify-post-restore-wrap">${originalHTML}</div>`, originalCls);

            const wrap = post.querySelector(':scope > .vkify-post-restore-wrap');
            if (wrap) {
                while (wrap.firstChild) post.appendChild(wrap.firstChild);
                wrap.remove();
            }
        }
    }, true);
});

const replyTooltipCache = new Map();
const replyTooltipPending = new Map();

async function buildReplyTooltipContent(replyId, ownerId) {
    const cached = replyTooltipCache.get(replyId);
    if (cached) {
        return cached;
    }

    const pending = replyTooltipPending.get(replyId);
    if (pending) {
        return await pending;
    }

    const promise = (async () => {
        try {
            const { items: [comment] = [], profiles = [] } = await window.OVKAPI.call('wall.getComment', {
                owner_id: parseInt(ownerId, 10) || 1,
                comment_id: replyId,
                extended: 1,
                fields: 'sex,screen_name,photo_50,photo_100,online_info,online,verified'
            });

            if (!comment) {
                throw new Error('No comment');
            }

            const profile = profiles.find(p => p.id === comment.from_id) || {};
            const name = escapeHtml(((profile.first_name || '') + ' ' + (profile.last_name || '')).trim()) || '...';
            const domain = escapeHtml(profile.screen_name || ('id' + comment.from_id));
            const photo = escapeHtml(profile.photo_50 || '/assets/packages/static/openvk/img/avatar.png');
            const verified = profile.verified ? '<a class="page_verified" href="/verify"></a>' : '';
            const date = new Date((comment.date || 0) * 1000).toLocaleString();
            const text = comment.text ? `<div class="text reply_text" id="text${comment.id}" style="white-space:pre-wrap;word-break:break-word;">${comment.text}</div>` : '';

            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="content">
                    <div class="post reply" data-id="1_${comment.id}" data-uniqueid="reply_${comment.id}" data-comment-id="${comment.id}" data-owner-id="${comment.from_id}">
                        <div class="reply_wrap">
                            <a class="reply_image" href="/${domain}">
                                <img src="${photo}" width="30" class="avatar reply_img" alt="">
                            </a>
                            <div class="reply_content">
                                <div class="reply_author post-author">
                                    <a class="author" href="/${domain}"><b class="post-author-name">${name}</b></a>
                                    ${verified}
                                </div>
                                <div class="post-content" id="${comment.id}">${text}</div>
                                <div class="reply_footer clear_fix">
                                    <div class="reply_date"><a href="#" class="reply_link" onclick="return false;">${escapeHtml(date)}</a></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const content = wrapper.firstElementChild;
            replyTooltipCache.set(replyId, content);
            return content;
        } catch (err) {
            const errorEl = document.createElement('div');
            errorEl.style.padding = '8px';
            errorEl.textContent = window.tr?.('error') || 'Error';
            return errorEl;
        } finally {
            replyTooltipPending.delete(replyId);
        }
    })();

    replyTooltipPending.set(replyId, promise);
    return await promise;
}

window.wall = window.wall || {};

window.wall.postTooltip = function(el, post, opts = {}, tooltipOpts = {}) {
    if (!opts.reply) return;

    const replyId = String(post).split('_')[1] || String(post);
    const ownerId = el.dataset.replyToOwnerId;
    if (!replyId) return;

    if (el._tippy) {
        el._tippy.show();
        return;
    }

    if (typeof tippy === 'undefined' || !window.OVKAPI) return;

    const loading = document.createElement('div');
    loading.style.cssText = 'min-width:180px;min-height:60px;padding:8px;display:flex;align-items:center;justify-content:center;';
    window.LoaderUtils?.show?.(loading, { size: 'small' });

    const instance = tippy(el, {
        theme: 'light vk',
        trigger: 'mouseenter',
        interactive: true,
        maxWidth: 380,
        allowHTML: true,
        appendTo: document.body,
        animation: 'up_down',
        duration: [100, 100],
        content: loading,
        onCreate(inst) {
            inst.popper?.querySelector('.tippy-box')?.classList.add('wall_tt');
        },
        async onShow(inst) {
            const content = await buildReplyTooltipContent(replyId, ownerId);
            inst.setContent(content.cloneNode(true));
        }
    });

    instance.show();
};

window.wall.showReply = () => true;

u(document).on('click', '.post.reply', function(e) {
    const target = u(e.target);
    if (target.closest('a[href], .reply_action, .post_like, .attachment a, input, textarea, button').length) {
        return;
    }

    let comment   = u(this);
    let authorId  = comment.data('owner-id');
    let commentId = comment.data('comment-id');
    let authorNm  = (comment.data('mention-name') || '').trim();
    let fromGroup = comment.attr('data-from-group') === 'true';
    let postId    = comment.data('post-id');
    let inputbox  = postId == null ? u('#standaloneCommentBox textarea') : u('#wall-post-input' + postId);
    if (!inputbox.nodes.length) return;

    let mention   = ('[' + (fromGroup ? 'club' : 'id') + authorId + '|' + authorNm + '], ');
    let attachments = inputbox.closest('.model_content_textarea').find('.post-buttons');

    inputbox.nodes.forEach(node => {
        node.value = node.value.replace(/(^\[([A-Za-z0-9]+)\|([\p{L} 0-9@]+)\], |^)/u, mention);
    });
    inputbox.trigger('focusin');
    inputbox.closest('.model_content_textarea').addClass('shown');

    let attachReply = attachments.find('[name="reply_to_comment"]');
    if (attachReply.nodes.length) attachReply.nodes[0].value = commentId;

    attachments.find('.post-replyto').html(`
        <span>${window.tr?.('in_reply')}</span>
        <div id='remove_reply_button'></div>
    `);

    attachments.find('.post-replyto #remove_reply_button').on('click', (e) => {
        attachments.find('.post-replyto').html('');
        attachments.find('input[name="reply_to_comment"]').attr('value', '');
        inputbox.nodes.forEach(node => {
            node.value = node.value.replace(/^\[[A-Za-z0-9]+\|[\p{L} 0-9@]+\], /u, '');
        });
    });
});

function bindArchivePostPageOnce() {
    if (!vkify.bindOnce('archivePostPage', bindArchivePostPageOnce)) return;

    document.addEventListener('click', (e) => {
        const clicked = e.target instanceof Element ? e.target : e.target.parentElement;
        const archiveLink = clicked?.closest('.archive_post');
        if (!archiveLink) return;

        if (!archiveLink.hasAttribute('data-post-page')) return;

        e.preventDefault();
        e.stopPropagation();

        MessageBox(tr('warning'), tr('question_confirm'), [tr('yes'), tr('no')], [
            async () => {
                const baseHref = archiveLink.getAttribute('href');
                const ajaxUrl = baseHref + (baseHref.includes('?') ? '&' : '?') + 'ajax=1';

                try {
                    const response = await ky.get(ajaxUrl);
                    const json = await response.json();

                    if (!json.success) {
                        if (json.flash && json.flash.message) {
                            fastError(json.flash.message);
                        }
                        return;
                    }

                    const wallMatch = baseHref.match(/^\/wall(-?\d+)_\d+\/archive/);
                    const wall = wallMatch ? wallMatch[1] : null;
                    if (!wall) {
                        location.assign(baseHref);
                        return;
                    }

                    const isArchived = Boolean(json.archived);
                    const redirectUrl = isArchived
                        ? `/wall${wall}?type=archive`
                        : (Number(wall) < 0 ? `/club${Math.abs(Number(wall))}` : `/id${wall}`);

                    window.router.route(redirectUrl);
                } catch (err) {
                    console.error('Archive request failed:', err);
                    fastError(err.message);
                }
            },
            Function.noop
        ]);
    }, true);
}

bindArchivePostPageOnce();

})();
