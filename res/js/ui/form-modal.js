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
    errorMsg: 'Failed to update topic',
    noNavigate: true
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

window.showNewPlaylistModal = (e, gid = null) => {
    e?.preventDefault();
    e?.stopPropagation();

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

})();
