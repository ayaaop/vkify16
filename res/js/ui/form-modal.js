(() => {

// Parses the flash message OpenVK renders into the returned page (see the
// script[data-flash-type] block in @layout.latte). OpenVK form endpoints
// follow post/redirect/get: success redirects to the entity page (sometimes
// with a "succ" flash), failure redirects back to the referer with an "err"
// flash — so the flash is the only reliable success/failure signal,
// especially when the success URL equals the referer.
const extractFlash = (docOrHtml) => {
    const doc = typeof docOrHtml === 'string'
        ? new DOMParser().parseFromString(docOrHtml, 'text/html')
        : docOrHtml;
    const script = doc.querySelector?.('.page_body > script[data-flash-type]');
    if (!script) return null;

    const text = script.textContent;
    const match = text.match(/NewNotification\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*\)/s)
               || text.match(/MessageBox\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*,/s);
    if (!match) return null;

    return { type: script.dataset.flashType || 'err', title: match[2], message: match[4] };
};

const wireFormModal = (modal, onSubmit, onReady) => {
    setTimeout(() => {
        const node = modal.getNode().nodes[0];
        const form = node?.querySelector('form');
        if (!form) return;

        form.querySelector('input[type=text], input:not([type]), textarea')?.focus();

        node.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 && !e.shiftKey && e.target.tagName === 'INPUT'
                && (e.target.type === 'text' || !e.target.type)) {
                e.preventDefault();
                onSubmit();
            }
        });

        onReady?.(modal, form);
    }, 100);
};

// Fetches a server-rendered form page, injects its .form_group into a modal
// and POSTs to the form's own action on submit.
window.showFormModal = vkify.once('showFormModal', () => async (url, opts = {}) => {
    const {
        title: titleOverride,
        submitText = tr('save') || tr('create') || 'Save',
        cancelText = tr('cancel') || 'Cancel',
        requiredField,
        requiredError = tr('error') || 'Required',
        errorMsg = 'Failed to save',
        fallbackUrl,
        noNavigate,
        onSuccess,
        onReady
    } = opts;

    const onModalSuccess = window._currentMediaModalRefresh || onSuccess;
    const noNav = noNavigate != null ? noNavigate : !!window._currentMediaModalRefresh;

    let doc, formGroup, loadError;
    try {
        vkify.ensureStyle?.('settings');
        const res = await window.ContentFetcher.request(url, {
            responseType: 'response',
            showLoader: true,
            skipRedirectError: true
        });
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');

        // a redirected GET means the server bounced us (e.g. flashFail to the
        // referer on missing permissions) — surface its flash instead of a form
        if (res.redirected) {
            loadError = extractFlash(doc)?.message || 'Failed to load form';
        } else {
            for (const g of doc.querySelectorAll('.form_group')) {
                if (g.querySelector('form')) { formGroup = g; break; }
            }
            if (!formGroup) loadError = 'Failed to load form';
        }
    } catch (e) {
        console.error('Failed to load form', url, e);
        loadError = 'Failed to load form';
    }
    if (loadError) {
        NewNotification(tr('error'), loadError, null);
        return;
    }

    // Add 'vertical' class for narrow modal layout
    formGroup.classList.add('vertical');
    formGroup.classList.remove('settings_padding');
    formGroup.classList.remove('label_end');

    // Hide the form's own submit footer / submit buttons — modal provides them
    formGroup.querySelectorAll('.settings_save_footer').forEach(el => { el.style.display = 'none'; });
    formGroup.querySelectorAll('input[type=submit], button[type=submit]').forEach(el => { el.style.display = 'none'; });

    // Title: option > last breadcrumb without href > <title>
    let modalTitle = titleOverride;
    if (!modalTitle) {
        const crumbs = doc.querySelectorAll('.ui_crumb');
        const last = crumbs[crumbs.length - 1];
        if (last && last.tagName.toLowerCase() === 'div') {
            modalTitle = last.textContent.trim();
        } else {
            // Strip the " - InstanceName" suffix that OpenVK appends to <title>
            modalTitle = (doc.title || '').trim().replace(/\s+[-–—|]\s+[^-–—|]+$/, '')
                || tr('edit') || 'Edit';
        }
    }

    const body = formGroup.outerHTML;

    let modal;
    const onSubmit = async () => {
        const node = modal.getNode().nodes[0];
        const form = node.querySelector('form');
        if (!form) return;

        if (requiredField) {
            const reqEl = form.querySelector(`[name="${requiredField}"]`);
            if (reqEl && !String(reqEl.value || '').trim()) {
                NewNotification(tr('error'), requiredError, null);
                reqEl.focus();
                return;
            }
        }

        const fd = new FormData(form);
        const csrf = vkify.getCsrf();
        if (csrf) fd.set('hash', csrf);

        const interactive = form.querySelectorAll('input, textarea, select, button');
        interactive.forEach(el => { el.disabled = true; });

        try {
            const postUrl = new URL(form.getAttribute('action') || url, new URL(url, location.href)).href;
            const res = await ContentFetcher.request(postUrl, {
                method: 'POST',
                body: fd,
                responseType: 'response',
                showLoader: true,
                errorMessage: errorMsg,
                ajaxQuery: false,
                skipRedirectError: true
            });

            const flash = extractFlash(await res.text());
            if (flash?.type === 'err') {
                NewNotification(flash.title || tr('error'), flash.message, null);
                interactive.forEach(el => { el.disabled = false; });
                return;
            }

            modal.close();
            if (flash?.message) NewNotification(flash.title, flash.message, null);

            if (noNav) {
                // stay on the current page: run the caller's refresh hook if
                // any, otherwise reload the page so changes show in place
                if (onModalSuccess) onModalSuccess();
                else vkify.navigate(location.pathname + location.search);
            } else {
                let target = res.url || fallbackUrl || location.pathname + location.search;
                try {
                    const u = new URL(target, location.href);
                    if (u.origin === location.origin) target = u.pathname + u.search + u.hash;
                } catch (_) { /* ignore */ }
                vkify.navigate(target);
            }
        } catch (err) {
            interactive.forEach(el => { el.disabled = false; });
        }
    };

    modal = new CMessageBox({
        title: modalTitle,
        body,
        buttons: [submitText, cancelText],
        callbacks: [onSubmit, () => modal.close()],
        close_on_buttons: false,
        warn_on_exit: false
    });

    wireFormModal(modal, onSubmit, onReady);
    return modal;
});

window.showEditPhotoModal = (photoId) => window.showFormModal(`/photo${photoId}/edit`, {
    errorMsg: 'Failed to update photo',
    noNavigate: true
});

window.showEditVideoModal = (videoId) => window.showFormModal(`/video${videoId}/edit`, {
    requiredField: 'name',
    requiredError: tr('error_no_video_name') || tr('error_no_group_name') || 'Name is required',
    errorMsg: 'Failed to update video',
    noNavigate: true,
    // a full page reload would reset the player — swap the info block only,
    // leaving .video_block_layout (video element/iframe) untouched
    onSuccess: async () => {
        try {
            const doc = await ContentFetcher.fetchPageContent(location.pathname + location.search, null, {});
            const fresh = doc.querySelector('.ovk-vid-details');
            const current = document.querySelector('.ovk-vid-details');
            if (!fresh || !current) throw new Error('Video info block not found');
            current.innerHTML = fresh.innerHTML;

            // keep the player element's metadata in sync (read by the viewer)
            const bsdn = doc.querySelector('.bsdn[data-name]');
            const currentBsdn = document.querySelector('.bsdn[data-name]');
            if (bsdn && currentBsdn) currentBsdn.dataset.name = bsdn.dataset.name;
        } catch (e) {
            vkify.navigate(location.pathname + location.search);
        }
    }
});

window.showEditTopicModal = (topicId) => window.showFormModal(`/topic${topicId}/edit`, {
    requiredField: 'title',
    requiredError: tr('error_segmentation') || 'Title is required',
    fallbackUrl: `/topic${topicId}`,
    errorMsg: 'Failed to update topic',
    skipRedirectError: true,
    validateResponse: (res) => res.ok && /\/topic-?\d+_\d+/.test(res.url || '')
});

window.showEditAppModal = (appId) => window.showFormModal(`/editapp?app=${encodeURIComponent(appId)}`, {
    requiredField: 'name',
    requiredError: tr('error_no_app_name') || tr('error_no_group_name') || 'Name is required',
    errorMsg: 'Failed to update app',
    noNavigate: true
});

window.showCreateGroupModal = (e) => {
    e?.preventDefault();
    window.showFormModal('/groups_create', {
        requiredField: 'name',
        requiredError: tr('error_no_group_name'),
        submitText: tr('create'),
        errorMsg: 'Failed to create group'
    });
    return false;
};

window.showCreateEventModal = (e) => {
    e?.preventDefault();
    window.showFormModal('/events_create', {
        requiredField: 'name',
        requiredError: tr('error_no_event_name'),
        submitText: tr('create'),
        errorMsg: 'Failed to create event'
    });
    return false;
};

window.showCreateAlbumModal = (createUrl) => window.showFormModal(createUrl || '/albums/create', {
    requiredField: 'name',
    requiredError: tr('error_no_album_name') || tr('error_no_group_name') || 'Album name is required',
    submitText: tr('create'),
    errorMsg: 'Failed to create album'
});

window.showCreateTopicModal = (e, clubId) => {
    e?.preventDefault();
    window.showFormModal(`/board${clubId}/create`, {
        requiredField: 'title',
        requiredError: tr('error_segmentation'),
        submitText: tr('create_topic'),
        errorMsg: 'Failed to create topic',
        // The server redirects on both success (to /topic{clubId}_{topicId})
        // and failure (flashFail to HTTP_REFERER), so don't treat the
        // redirect itself as an access error.
        skipRedirectError: true,
        validateResponse: (res) => res.ok && /\/topic-?\d+_\d+/.test(res.url || ''),
        // biome-ignore lint/correctness/noUnusedFunctionParameters: event handler
        onReady: (modal, form) => {
            // stock page wires file inputs via OpenVK's wall bundle, which isn't loaded here
            const picInput = form.querySelector('input[name="_pic_attachment"]');
            const vidInput = form.querySelector('input[name="_vid_attachment"]');
            const statusSpan = form.querySelector('.post-upload span');
            if (!statusSpan) return;

            const updateStatus = () => {
                const files = [];
                if (picInput?.files?.[0]) files.push(picInput.files[0].name);
                if (vidInput?.files?.[0]) files.push(vidInput.files[0].name);
                statusSpan.textContent = files.length ? files.join(', ') : tr('none') || '(unknown)';
            };
            picInput?.addEventListener('change', updateStatus);
            vidInput?.addEventListener('change', updateStatus);
        }
    });
    return false;
};

// Playlist forms use a different contract (ajax=1 -> JSON {success, redirect, flash})
// and ship their own markup (.audio_pl_edit_box) instead of .form_group.
const openPlaylistFormModal = async ({ url, title, errorMsg, saveButtonSelector, successUrl, extraSetup }) => {
    try {
        const doc = await window.ContentFetcher.fetchPageContent(url, null, { showLoader: true });
        const editBox = doc.querySelector('.audio_pl_edit_box');
        if (!editBox) throw new Error('Edit box not found');

        vkify.loadStyle(null, 'vkify_style_edit_playlist', vkify.resourceUrl('/css/edit_playlist.css'));

        const modal = new CMessageBox({
            title,
            body: `<div class="PE_wrapper">${editBox.outerHTML}</div>`,
            buttons: [], // the template provides its own controls
            close_on_buttons: false,
            warn_on_exit: true
        });
        modal.getNode().addClass('ovk-msg-sheet');

        setTimeout(() => {
            const node = modal.getNode().nodes[0];
            const form = node.querySelector('.PE_playlistEditPage');
            if (!form) return;

            modal.getNode().attr('style', 'width: 560px;');
            modal.getNode().find('.ovk-diag-body').attr('style', 'padding: 0 !important;');

            const teardown = extraSetup?.(modal, node, form);

            const saveBtn = node.querySelector(saveButtonSelector);
            saveBtn?.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                LoaderUtils.showInButton(saveBtn);

                const ids = [];
                node.querySelectorAll('.PE_audios .vertical-attachment').forEach(vatch => {
                    ids.push(vatch.dataset.id);
                });

                const fd = serializeForm(form);
                fd.append('hash', vkify.getCsrf());
                fd.append('ajax', 1);
                fd.append('audios', ids);

                try {
                    const req_json = await ContentFetcher.postForm(url, fd, {
                        responseType: 'json',
                        csrf: false,
                        throwOnError: false
                    });
                    if (req_json?.success) {
                        modal.close();
                        window.router.route(successUrl ?? req_json.redirect);
                    } else {
                        makeError(req_json?.flash?.message || errorMsg);
                    }
                } catch (err) {
                    console.error(errorMsg, err);
                    NewNotification(tr('error'), errorMsg, null);
                } finally {
                    LoaderUtils.restoreButton(saveBtn);
                }
            }, true); // capturing phase to preempt general bubbling click listener

            const originalClose = modal.close;
            modal.close = function(...args) {
                teardown?.();
                vkify.unloadStyle('vkify_style_edit_playlist');
                originalClose.apply(this, args);
            };

            node.querySelector('#ape_pl_name')?.focus();
        }, 50);

        return modal;
    } catch (err) {
        console.error('Failed to load playlist modal:', err);
        NewNotification(tr('error'), 'Failed to load playlist form', null);
    }

    return false;
};

window.showEditPlaylistModal = (playlistId, e) => {
    e?.preventDefault();
    e?.stopPropagation();

    openPlaylistFormModal({
        url: `/playlist${playlistId}/edit`,
        title: tr('edit_playlist') || 'Edit playlist',
        saveButtonSelector: '#playlist_edit',
        errorMsg: 'Failed to save playlist',
        successUrl: location.pathname + location.search,
        extraSetup: (modal, node) => {
            const updateModalPlayerStates = () => {
                if (!window.player) return;
                const isPlaying = !window.player.audioPlayer.paused;
                const currentId = window.player.current_track_id;

                node.querySelectorAll('.PE_audios .audioEmbed').forEach(embed => {
                    const embedId = Number(embed.getAttribute('data-realid'));
                    const playIcon = embed.querySelector('.playerButton .playIcon');
                    if (!playIcon) return;

                    if (embedId === currentId && isPlaying) {
                        playIcon.classList.add('paused');
                    } else {
                        playIcon.classList.remove('paused');
                    }
                });
            };

            const player = window.player?.audioPlayer;
            if (player) {
                player.addEventListener('play', updateModalPlayerStates);
                player.addEventListener('pause', updateModalPlayerStates);
                player.addEventListener('timeupdate', updateModalPlayerStates);
            }

            updateModalPlayerStates();

            return () => {
                player?.removeEventListener('play', updateModalPlayerStates);
                player?.removeEventListener('pause', updateModalPlayerStates);
                player?.removeEventListener('timeupdate', updateModalPlayerStates);
            };
        }
    });
    return false;
};

window.showNewPlaylistModal = async (e, gid = null) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    let url = '/audios/newPlaylist';
    if (gid) {
        url += `?gid=${gid}`;
    }

    try {
        const doc = await window.ContentFetcher.fetchPageContent(url, null, { showLoader: true });
        const editBox = doc.querySelector('.audio_pl_edit_box');
        if (!editBox) throw new Error('Edit box not found');

        // Dynamically load the edit_playlist.css styles
        vkify.loadStyle(null, 'vkify_style_edit_playlist', vkify.resourceUrl('/css/edit_playlist.css'));

        const modalTitle = tr('new_playlist') || 'New playlist';
        const body = `<div class="PE_wrapper">${editBox.outerHTML}</div>`;

        const modal = new CMessageBox({
            title: modalTitle,
            body: body,
            buttons: [], // No standard buttons, the template has its own controls
            close_on_buttons: false,
            warn_on_exit: true
        });
        modal.getNode().addClass('ovk-msg-sheet');

        setTimeout(() => {
            const node = modal.getNode().nodes[0];
            const form = node.querySelector('.PE_playlistEditPage');
            if (!form) return;

            // Set size of the messagebox
            modal.getNode().attr('style', 'width: 560px;');
            modal.getNode().find('.ovk-diag-body').attr('style', 'padding: 0 !important;');

            // Intercept create button click to perform AJAX POST
            const createBtn = node.querySelector('#playlist_create');
            if (createBtn) {
                createBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    LoaderUtils.showInButton(createBtn);

                    const ids = [];
                    node.querySelectorAll('.PE_audios .vertical-attachment').forEach(vatch => {
                        ids.push(vatch.dataset.id);
                    });

                    const fd = serializeForm(form);
                    fd.append('hash', window.router.csrf);
                    fd.append('ajax', 1);
                    fd.append('audios', ids);

                    try {
                        const req_json = await ContentFetcher.postForm(url, fd, {
                            responseType: 'json',
                            csrf: false,
                            throwOnError: false
                        });
                        if (req_json?.success) {
                            modal.close();
                            vkify.unloadStyle('vkify_style_edit_playlist');
                            window.router.route(req_json.redirect);
                        } else {
                            makeError(req_json?.flash?.message || 'Failed to create playlist');
                        }
                    } catch (err) {
                        console.error('Failed to create playlist from modal:', err);
                        NewNotification(tr('error'), 'Failed to create playlist', null);
                    } finally {
                        LoaderUtils.restoreButton(createBtn);
                    }
                }, true);
            }

            // Hook close behavior to unload styles when closed
            const originalClose = modal.close;
            modal.close = function(...args) {
                vkify.unloadStyle('vkify_style_edit_playlist');
                originalClose.apply(this, args);
            };

            // Focus the title input
            const firstInput = node.querySelector('#ape_pl_name');
            firstInput?.focus();
        }, 50);

        return modal;
    } catch (err) {
        console.error('Failed to load new playlist modal:', err);
        NewNotification(tr('error'), 'Failed to load new playlist form', null);
    }

    openPlaylistFormModal({
        url: `/audios/newPlaylist${gid ? `?gid=${gid}` : ''}`,
        title: tr('new_playlist') || 'New playlist',
        saveButtonSelector: '#playlist_create',
        errorMsg: 'Failed to create playlist'
    });
    return false;
};

const updatePlaylistEmptyState = () => {
    document.querySelectorAll('.PE_audios').forEach(container => {
        const emptyPlaceholder = container.nextElementSibling;
        if (!emptyPlaceholder?.classList?.contains('ape_audios_empty_list')) return;

        const hasTracks = container.querySelectorAll('.vertical-attachment').length > 0;
        if (hasTracks) {
            container.style.display = 'block';
            emptyPlaceholder.style.display = 'none';
        } else {
            container.style.display = 'none';
            emptyPlaceholder.style.display = 'flex';
        }
    });
};

vkify.ready(() => {
    updatePlaylistEmptyState();
    vkify.onPage(updatePlaylistEmptyState);
    vkify.observeDOM(updatePlaylistEmptyState);
});

function bindInlineFieldEditorOnce() {
    function autoSizeTextarea(ta) {
        if (!ta || ta.tagName !== 'TEXTAREA') return;
        ta.style.height = '0px';
        ta.style.height = `${Math.min(350, Math.max(36, ta.scrollHeight + 2))}px`;
    }

    function extractInitialPlainText(rowContainer) {
        if (!rowContainer) return '';
        if (rowContainer.querySelector('.pv_no_description')) return '';
        const fullTextEl = rowContainer.querySelector('.full_text');
        if (fullTextEl) {
            const clone = fullTextEl.cloneNode(true);
            clone.querySelectorAll('.collapse_button').forEach((b) => b.remove());
            return clone.textContent.trim();
        }
        const reallyTextEl = rowContainer.querySelector('.really_text');
        if (reallyTextEl) {
            const clone = reallyTextEl.cloneNode(true);
            clone.querySelectorAll('.collapse_button').forEach((b) => b.remove());
            return clone.textContent.trim();
        }
        const lineLink = rowContainer.querySelector('.line_value a');
        if (lineLink) return lineLink.textContent.trim();
        return rowContainer.textContent.trim();
    }

    function openInlineEditor({ rowContainer, editUrl, fieldName, multiline, resultSelector, refreshUrl, placeholder, fallbackEmptyHtml, mirrorSelectors = [] }) {
        if (!rowContainer || !editUrl || rowContainer.__vkifyInlineEditing) return;
        rowContainer.__vkifyInlineEditing = true;

        const metaContainer = rowContainer.closest('[data-inline-field]');
        const initialText = metaContainer?.dataset.inlineValue ?? extractInitialPlainText(rowContainer);
        const originalContent = document.createElement('div');
        originalContent.className = 'vkify_inline_original';
        while (rowContainer.firstChild) originalContent.appendChild(rowContainer.firstChild);
        originalContent.hidden = true;
        originalContent.style.display = 'none';
        rowContainer.appendChild(originalContent);

        const wrap = document.createElement('div');
        wrap.className = 'vkify_inline_edit_wrap';
        const field = document.createElement(multiline ? 'textarea' : 'input');
        if (!multiline) field.type = 'text';
        field.className = 'dark vkify_inline_edit_field';
        field.setAttribute('data-no-autosize', '');
        field.placeholder = placeholder || '';
        field.value = initialText;
        wrap.appendChild(field);
        rowContainer.appendChild(wrap);

        if (multiline) autoSizeTextarea(field);
        field.focus();
        try {
            const len = field.value.length;
            field.setSelectionRange(len, len);
        } catch (_) {}

        let userTyped = false;
        field.addEventListener('input', () => {
            userTyped = true;
            if (multiline) autoSizeTextarea(field);
        });

        const formPromise = (async () => {
            const res = await fetch(editUrl, { credentials: 'same-origin' });
            if (!res.ok || res.redirected) return null;
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            for (const g of doc.querySelectorAll('.form_group')) {
                const f = g.querySelector('form');
                if (f) return f;
            }
            return doc.querySelector('form');
        })().catch(() => null);

        formPromise.then((form) => {
            if (!form || !wrap.isConnected || userTyped) return;
            const srcField = form.querySelector(`[name="${fieldName}"]`);
            if (srcField && typeof srcField.value === 'string') {
                field.value = srcField.value;
                if (multiline) autoSizeTextarea(field);
                try {
                    const len = field.value.length;
                    field.setSelectionRange(len, len);
                } catch (_) {}
            }
        });

        let finished = false;
        let cancelled = false;
        const restoreOriginal = () => {
            if (finished) return;
            finished = true;
            cancelled = true;
            rowContainer.__vkifyInlineEditing = false;
            wrap.remove();
            while (originalContent.firstChild) rowContainer.insertBefore(originalContent.firstChild, originalContent);
            originalContent.remove();
        };

        const saveInline = async () => {
            if (finished || cancelled) return;
            finished = true;
            const newVal = field.value.trim();
            const form = await formPromise;
            if (cancelled) return;
            if (!form) {
                finished = false;
                restoreOriginal();
                return;
            }
            const origField = form.querySelector(`[name="${fieldName}"]`);
            const origVal = origField ? String(origField.value || '').trim() : initialText;
            if (newVal === origVal) {
                finished = false;
                restoreOriginal();
                return;
            }

            field.disabled = true;

            try {
                const fd = new FormData(form);
                fd.set(fieldName, newVal);
                const csrf = vkify.getCsrf();
                if (csrf) fd.set('hash', csrf);

                const postUrl = new URL(form.getAttribute('action') || editUrl, new URL(editUrl, location.href)).href;
                const res = await fetch(postUrl, {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin',
                });
                const resHtml = await res.text();
                const resDoc = new DOMParser().parseFromString(resHtml, 'text/html');
                const flash = extractFlash(resDoc);
                let freshEl = resDoc.querySelector(resultSelector);
                if (res.ok && flash?.type !== 'err' && !freshEl && refreshUrl) {
                    // Group/user edit forms render the edit page after POST, not the profile.
                    const freshRes = await fetch(refreshUrl, { credentials: 'same-origin', cache: 'no-store' });
                    if (freshRes.ok && !freshRes.redirected) {
                        freshEl = new DOMParser().parseFromString(await freshRes.text(), 'text/html')
                            .querySelector(resultSelector);
                    }
                }
                if (!res.ok || flash?.type === 'err' || !freshEl) {
                    NewNotification(flash?.title || tr('error'), flash?.message || tr('error'), null);
                    finished = false;
                    restoreOriginal();
                    return;
                }

                rowContainer.__vkifyInlineEditing = false;
                const applyFreshContent = (target, html, fresh = freshEl) => {
                    const freshMeta = fresh?.closest?.('[data-inline-field]');
                    const targetMeta = target?.closest?.('[data-inline-field]');
                    if (freshMeta && targetMeta) {
                        ['inlineField', 'inlineValue', 'inlineMultiline', 'editUrl', 'refreshUrl'].forEach((key) => {
                            if (Object.prototype.hasOwnProperty.call(freshMeta.dataset, key)) {
                                targetMeta.dataset[key] = freshMeta.dataset[key];
                            } else {
                                delete targetMeta.dataset[key];
                            }
                        });
                    }
                    target.innerHTML = html;
                };
                const replacementHtml = freshEl.innerHTML.trim() ? freshEl.innerHTML : fallbackEmptyHtml;
                if (replacementHtml) {
                    applyFreshContent(rowContainer, replacementHtml);
                    for (const selector of mirrorSelectors) {
                        document.querySelectorAll(selector).forEach((target) => {
                            if (target !== rowContainer) applyFreshContent(target, replacementHtml);
                        });
                    }
                } else {
                    wrap.remove();
                    while (originalContent.firstChild) rowContainer.insertBefore(originalContent.firstChild, originalContent);
                    originalContent.remove();
                }

                const stack = window.messagebox_stack || [];
                const viewer = stack.slice().reverse().find((m) =>
                    m?._viewer?.modal?.getNode?.()?.nodes?.[0]?.contains(rowContainer))?._viewer;
                const entry = viewer?.items?.[viewer.currentId];
                if (entry && entry.cached) {
                    const cached = document.createElement('div');
                    cached.innerHTML = entry.cached;
                    const oldDesc = cached.querySelector(resultSelector);
                    if (oldDesc) {
                        oldDesc.replaceWith(rowContainer.cloneNode(true));
                        entry.cached = cached.innerHTML;
                    }
                }
            } catch (err) {
                console.error('Inline edit save failed:', err);
                finished = false;
                restoreOriginal();
            }
        };

        field.addEventListener('keydown', (ke) => {
            if (ke.key === 'Escape') {
                ke.preventDefault();
                ke.stopPropagation();
                restoreOriginal();
                return;
            }
            if (ke.key === 'Enter' && (!multiline || ke.ctrlKey || ke.metaKey)) {
                ke.preventDefault();
                ke.stopPropagation();
                saveInline();
            }
        });

        field.addEventListener('blur', () => {
            saveInline();
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.collapse_button, .vkify_inline_edit_wrap')) return;

        // 1. Photo description (.pv_desc)
        const pvEditLink = e.target.closest('.pv_desc .pv_can_edit');
        if (pvEditLink) {
            const innerAnchor = e.target.closest('a');
            if (innerAnchor && innerAnchor !== pvEditLink) return;
            const actionRef = pvEditLink.dataset.editUrl || pvEditLink.getAttribute('href') || '';
            const m = actionRef.match(/showEditPhotoModal\(\s*['"]([^'"]+)['"]\s*\)/);
            if (m) {
                e.preventDefault();
                e.stopPropagation();
                const photoId = m[1];
                const pvDesc = pvEditLink.closest('.pv_desc');
                openInlineEditor({
                    rowContainer: pvDesc,
                    editUrl: `/photo${photoId}/edit`,
                    fieldName: 'desc',
                    multiline: true,
                    resultSelector: '.pv_desc',
                    placeholder: tr('no_description'),
                    fallbackEmptyHtml: `<div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditPhotoModal('${photoId}')" role="button" tabindex="0"><span class="pv_no_description">${tr('no_description')}</span></div>`,
                });
                return;
            }
        }

        // 2. Video description (.video_info_description)
        const mvEditLink = e.target.closest('.video_info_description .pv_can_edit');
        if (mvEditLink) {
            const innerAnchor = e.target.closest('a');
            if (innerAnchor && innerAnchor !== mvEditLink) return;
            const actionRef = mvEditLink.dataset.editUrl || mvEditLink.getAttribute('href') || '';
            const m = actionRef.match(/showEditVideoModal\(\s*['"]([^'"]+)['"]\s*\)/);
            if (m) {
                e.preventDefault();
                e.stopPropagation();
                const videoId = m[1];
                const mvDesc = mvEditLink.closest('.video_info_description');
                openInlineEditor({
                    rowContainer: mvDesc,
                    editUrl: `/video${videoId}/edit`,
                    fieldName: 'desc',
                    multiline: true,
                    resultSelector: '.video_info_description',
                    placeholder: tr('no_description'),
                    fallbackEmptyHtml: `<div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditVideoModal('${videoId}')" role="button" tabindex="0"><span class="pv_no_description">${tr('no_description')}</span></div>`,
                });
                return;
            }
        }

        // 3. Group info / website rows (.group_info_rows .group_info_row.info / .site)
        const groupRow = e.target.closest('.group_info_rows .group_info_row.info, .group_info_rows .group_info_row.site');
        if (groupRow) {
            const isSiteRow = groupRow.classList.contains('site');
            const clickedLink = e.target.closest('a');
            const isEditAnchor = clickedLink && /\/club\d+\/edit$/.test(clickedLink.getAttribute('href') || '');
            const isEditIcon = Boolean(e.target.closest('.line_div_icon.edit'));
            if (clickedLink && !isEditAnchor) return;
            if (!isEditAnchor && !isEditIcon && !groupRow.classList.contains('vkify_can_inline_edit')) return;

            const editUrl = groupRow.dataset.editUrl || (isEditAnchor ? clickedLink.getAttribute('href') : '');
            if (!editUrl) return;

            e.preventDefault();
            e.stopPropagation();

            const rowType = isSiteRow ? 'site' : 'info';
            const mobileSelector = `#mobile_group_more_info_content .group_info_row.${rowType}`;
            const desktopSelector = `#group_info_content .group_info_row.${rowType}`;
            const isMobileContext = groupRow.dataset.inlineContext === 'mobile' || Boolean(groupRow.closest('.ovk-msg-sheet'));
            openInlineEditor({
                rowContainer: groupRow,
                editUrl,
                fieldName: isSiteRow ? 'website' : 'about',
                multiline: !isSiteRow,
                resultSelector: isMobileContext ? mobileSelector : desktopSelector,
                refreshUrl: editUrl.replace(/\/edit$/, ''),
                placeholder: isSiteRow ? tr('admin_banned_link_not_specified') : tr('desc_none'),
                fallbackEmptyHtml: `<div class="pv_can_edit pv_desc_cont" data-edit-url="${editUrl}" role="button" tabindex="0"><span class="pv_no_description">${isSiteRow ? tr('admin_banned_link_not_specified') : tr('desc_none')}</span></div>`,
                mirrorSelectors: [desktopSelector, mobileSelector],
            });
            return;
        }

        const profileData = e.target.closest('.profile_info_block tr[data-inline-field] .data.vkify_can_inline_edit, .form_field[data-inline-field] .form_data.vkify_can_inline_edit');
        if (profileData && !e.target.closest('a')) {
            const row = profileData.closest('[data-inline-field]');
            const fieldName = row.dataset.inlineField;
            const editUrl = row.dataset.editUrl;
            const refreshUrl = row.dataset.refreshUrl;
            if (!fieldName || !editUrl || !refreshUrl) return;
            e.preventDefault();
            e.stopPropagation();
            const mobileSelector = `#mobile_more_info_content .form_field[data-inline-field="${fieldName}"] .form_data`;
            const desktopSelector = `.profile_info_block tr[data-inline-field="${fieldName}"] .data`;
            const isMobileContext = row.dataset.inlineContext === 'mobile' || Boolean(row.closest('.ovk-msg-sheet'));
            openInlineEditor({
                rowContainer: profileData,
                editUrl,
                fieldName,
                multiline: row.dataset.inlineMultiline !== 'false',
                resultSelector: isMobileContext ? mobileSelector : desktopSelector,
                refreshUrl,
                mirrorSelectors: [desktopSelector, mobileSelector],
            });
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        const editTarget = e.target.closest?.('.pv_can_edit[role="button"]');
        if (!editTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        e.stopPropagation();
        editTarget.click();
    }, true);
}

vkify.bindOnce('vkifyInlineFieldEditor', bindInlineFieldEditorOnce);

})();
