(() => {

const SimpleFormModal = vkify.once('SimpleFormModal', () => {
    const Hb = window.Handlebars;

    // Per-type templates. Handlebars auto-escapes `{{ }}` so manual escapeHtml
    // calls disappear; `{{{ }}}` preserves raw HTML where the caller intends it
    // (e.g. f.label, f.after, f.html).
    const fieldInputTpl = {
        hidden: Hb.compile(
            '<input type="hidden" name="{{name}}" id="{{id}}" value="{{value}}" />'
        ),
        text: Hb.compile(
            '<input type="text" name="{{name}}" id="{{id}}" value="{{value}}" placeholder="{{placeholder}}" style="width:100%" />'
        ),
        textarea: Hb.compile(
            '<textarea name="{{name}}" id="{{id}}" placeholder="{{placeholder}}" style="width:100%;resize:vertical;min-height:80px">{{value}}</textarea>'
        ),
        checkbox: Hb.compile(
            '<label class="checkbox"><input type="checkbox" name="{{name}}" id="{{id}}" {{#if checked}}checked{{/if}} {{#if onChange}}onchange="{{onChange}}"{{/if}} /><span>{{{text}}}</span></label>'
        ),
        file: Hb.compile(
            '<input type="file" name="{{name}}" id="{{id}}" {{#if accept}}accept="{{accept}}"{{/if}} {{#if multiple}}multiple{{/if}} style="{{#if hidden}}display:none{{/if}}" />'
        )
    };

    const fieldWrapperTpl = Hb.compile(
        '<div class="form_field">' +
            '{{#unless noLabel}}<div class="form_label">{{{label}}}</div>{{/unless}}' +
            '<div class="form_data">{{{input}}}{{{after}}}</div>' +
        '</div>'
    );

    const wrapperTpl = Hb.compile(
        '<div id="{{id}}" class="{{className}}" style="{{style}}">{{{children}}}</div>'
    );

    const bodyTpl = Hb.compile(
        '<div class="form_group" style="{{style}}">{{{fields}}}</div>'
    );

    const renderField = (f) => {
        if (f.type === 'html') return f.html || '';
        if (f.type === 'wrapper') {
            const children = (f.children || []).map(renderField).join('');
            return wrapperTpl({ id: f.id || '', className: f.className || '', style: f.style || '', children });
        }

        const type = f.type || 'text';
        const inputRenderer = fieldInputTpl[type] || fieldInputTpl.text;
        const input = inputRenderer({
            name: f.name || '',
            id: f.id || '',
            value: f.value == null ? '' : f.value,
            placeholder: f.placeholder || '',
            checked: !!f.checked,
            onChange: f.onChange || '',
            text: f.text || '',
            accept: f.accept || '',
            multiple: !!f.multiple,
            hidden: !!f.hidden
        });

        if (type === 'hidden') return input;

        return fieldWrapperTpl({
            noLabel: !!f.noLabel,
            label: f.label || '',
            after: f.after || '',
            input
        });
    };

    const show = ({ title, fields, submitText = tr('create'), cancelText = tr('cancel'), onSubmit, onReady, focusFieldId, enableEnterHandler = true, width }) => {
        const style = width ? `width:${width};margin:0` : 'width:100%;margin:0';
        const body = bodyTpl({ style, fields: fields.map(renderField).join('') });
        const modal = new CMessageBox({
            title, body,
            buttons: [submitText, cancelText],
            callbacks: [() => onSubmit?.(modal), () => modal.close()],
            close_on_buttons: false,
            warn_on_exit: false
        });

        setTimeout(() => {
            const firstEl = ge(focusFieldId || fields.find(f => f.id && f.type !== 'hidden' && f.type !== 'html')?.id);
            if (firstEl) firstEl.focus();

            if (enableEnterHandler && modal.getNode) {
                const textIds = fields.filter(f => f.id && (f.type === 'text' || !f.type)).map(f => f.id);
                textIds.forEach((id, i) => {
                    modal.getNode().on('keydown', `#${id}`, e => {
                        if (e.keyCode === 13 && !e.shiftKey) {
                            e.preventDefault();
                            i === textIds.length - 1 ? onSubmit?.(modal) : ge(textIds[i + 1])?.focus();
                        }
                    });
                });
            }

            onReady?.(modal);
        }, 100);
        return modal;
    };

    const submitForm = async ({ inputs, requiredId, requiredError, url, formFields, fileInputs, checkboxInputs, fallbackUrl, errorMsg, noNavigate, onSuccess }) => {
        const els = inputs.map(id => ge(id));
        if (els.some(el => !el)) return console.error('Form inputs not found');

        const values = els.map(el => el.value.trim());
        const reqIdx = inputs.indexOf(requiredId);
        if (reqIdx >= 0 && !values[reqIdx]) {
            NewNotification(tr('error'), requiredError, null);
            return els[reqIdx].focus();
        }

        const csrf = vkify.getCsrf();
        if (!csrf) {
            NewNotification(tr('error'), 'CSRF token not found. Please refresh the page and try again.', null);
            return els[0].focus();
        }

        const fd = new FormData();
        formFields.forEach((name, i) => { fd.append(name, values[i]); });
        fd.append('hash', csrf);

        if (fileInputs) {
            fileInputs.forEach(({ id, name }) => {
                const el = ge(id);
                if (el?.files?.[0]) fd.append(name, el.files[0]);
            });
        }

        if (checkboxInputs) {
            checkboxInputs.forEach(({ id, name }) => {
                const el = ge(id);
                if (el?.checked) fd.append(name, 'on');
            });
        }

        els.forEach(el => { el.disabled = true; });

        try {
            const res = await ContentFetcher.request(url, {
                method: 'POST',
                body: fd,
                responseType: 'response',
                showLoader: true,
                errorMessage: errorMsg,
                ajaxQuery: false
            });
            window.messagebox_stack?.at(-1)?.close();
            if (noNavigate) {
                if (onSuccess) onSuccess();
            } else {
                vkify.navigate(res.url || fallbackUrl || location.pathname + location.search);
            }
        } catch (err) {
            els.forEach(el => { el.disabled = false; });
            els[0].focus();
        }
    };

    return { show, submitForm, renderField };
});

window.showSimpleFormModal = SimpleFormModal.show;

// Generic form modal: fetches a server-rendered page (edit/create), extracts
// its `.form_group` element and injects the original HTML directly into the
// modal. POSTs the form on submit using its own action attribute (or the
// fetched URL). Preserves the template's exact layout and behaviour.
window.showFormModal = vkify.once('showFormModal', () => async (url, opts = {}) => {
    const {
        title: titleOverride,
        submitText = tr('save') || tr('create') || 'Save',
        cancelText = tr('cancel') || 'Cancel',
        formGroupSelector = '.form_group',
        requiredField,
        requiredError = tr('error') || 'Required',
        errorMsg = 'Failed to save',
        fallbackUrl,
        noNavigate,
        onSuccess,
        runScripts = false,
        onReady,
        validateResponse,
        skipRedirectError = false
    } = opts;

    const onModalSuccess = onSuccess || window._currentMediaModalRefresh;
    const noNav = noNavigate != null ? noNavigate : !!window._currentMediaModalRefresh;

    let doc, formGroup;
    try {
        doc = await window.ContentFetcher.fetchPageContent(url, null, { showLoader: true });
        const groups = doc.querySelectorAll(formGroupSelector);
        for (const g of groups) {
            if (g.querySelector('form')) { formGroup = g; break; }
        }
        if (!formGroup) throw new Error('Form not found on page');
    } catch (e) {
        console.error('Failed to load form', url, e);
        NewNotification(tr('error'), 'Failed to load form', null);
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

    // Capture inline scripts for optional execution after mount
    const scripts = runScripts
        ? Array.from(doc.querySelectorAll('script:not([src])')).map(s => s.textContent)
        : [];

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
            const postUrl = form.getAttribute('action') || url;
            const res = await ContentFetcher.request(postUrl, {
                method: 'POST',
                body: fd,
                responseType: 'response',
                showLoader: true,
                errorMessage: errorMsg,
                ajaxQuery: false,
                skipRedirectError
            });

            if (typeof validateResponse === 'function' && !validateResponse(res)) {
                try {
                    const html = await res.text();
                    const flash = extractFlashMessage(html);
                    NewNotification(window.tr('error'), flash?.message || errorMsg, null);
                } catch (e) {
                    NewNotification(window.tr('error'), errorMsg, null);
                }
                interactive.forEach(el => { el.disabled = false; });
                return;
            }

            window.messagebox_stack?.at(-1)?.close();

            if (noNav) {
                if (onModalSuccess) onModalSuccess();
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

    setTimeout(() => {
        const node = modal.getNode().nodes[0];
        const form = node.querySelector('form');
        if (!form) return;

        // Run inline scripts from the fetched page (e.g. file-upload wiring)
        scripts.forEach(src => {
            try { (new Function(src))(); } catch (e) { console.warn('Inline script error', e); }
        });

        const firstInput = form.querySelector('input[type=text], input:not([type]), textarea');
        firstInput?.focus();

        // Submit on Enter in single-line text inputs
        node.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 && !e.shiftKey && e.target.tagName === 'INPUT'
                && (e.target.type === 'text' || !e.target.type)) {
                e.preventDefault();
                onSubmit();
            }
        });

        onReady?.(modal, form);
    }, 100);

    return modal;
});

// Backwards-compatible alias
window.showEditFormModal = window.showFormModal;

// === Per-type wrappers ===
window.showEditPhotoModal = (photoId) => window.showFormModal(`/photo${photoId}/edit`, {
    fallbackUrl: `/photo${photoId}`,
    errorMsg: 'Failed to update photo'
});

window.showEditVideoModal = (videoId) => window.showFormModal(`/video${videoId}/edit`, {
    requiredField: 'name',
    requiredError: tr('error_no_video_name') || tr('error_no_group_name') || 'Name is required',
    fallbackUrl: `/video${videoId}`,
    errorMsg: 'Failed to update video'
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
    fallbackUrl: `/app${appId}`,
    errorMsg: 'Failed to update app'
});

const extractFlashMessage = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const pageBody = doc.querySelector('.page_body');
    if (!pageBody) return null;

    const scripts = pageBody.querySelectorAll(':scope > script');
    for (const script of scripts) {
        const text = script.textContent;
        const match = text.match(/NewNotification\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*\)/s)
                   || text.match(/MessageBox\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*,/s);
        if (match) {
            return { title: match[2], message: match[4] };
        }
    }
    return null;
};

window.showCreateGroupModal = (e) => {
    e?.preventDefault();
    window.showFormModal('/groups_create', {
        requiredField: 'name',
        requiredError: tr('error_no_group_name'),
        submitText: tr('create'),
        errorMsg: 'Failed to create group',
        skipRedirectError: true,
        validateResponse: (res) => /\/club\d+/.test(res.url || '')
    });
    return false;
};

window.showCreateEventModal = (e) => {
    e?.preventDefault();
    window.showFormModal('/events_create', {
        requiredField: 'name',
        requiredError: tr('error_no_event_name'),
        submitText: tr('create'),
        errorMsg: 'Failed to create event',
        skipRedirectError: true,
        validateResponse: (res) => /\/event\d+/.test(res.url || '')
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
            // The original /board{id}/create page wires file inputs via
            // setupWallPostInputHandlers / handleUpload, which live in
            // OpenVK's wall bundle and aren't loaded outside that page.
            // Wire just the attachment name display here instead.
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

window.showEditPlaylistModal = async (playlistId, e) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const url = `/playlist${playlistId}/edit`;

    try {
        const doc = await window.ContentFetcher.fetchPageContent(url, null, { showLoader: true });
        const editBox = doc.querySelector('.audio_pl_edit_box');
        if (!editBox) throw new Error('Edit box not found');

        // Dynamically load the edit_playlist.css styles
        vkify.loadStyle(null, 'vkify_style_edit_playlist', vkify.resourceUrl('/css/edit_playlist.css'));

        const modalTitle = tr('edit_playlist') || 'Edit playlist';
        const body = `<div class="PE_wrapper">${editBox.outerHTML}</div>`;

        const modal = new CMessageBox({
            title: modalTitle,
            body: body,
            buttons: [],
            close_on_buttons: false,
            warn_on_exit: true
        });

        setTimeout(() => {
            const node = modal.getNode().nodes[0];
            const form = node.querySelector('.PE_playlistEditPage');
            if (!form) return;

            modal.getNode().attr('style', 'width: 560px;');
            modal.getNode().find('.ovk-diag-body').attr('style', 'padding: 0 !important;');

            // Sync play/pause state for audios inside the modal
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

            // Listen to player's audio element events
            if (window.player?.audioPlayer) {
                window.player.audioPlayer.addEventListener('play', updateModalPlayerStates);
                window.player.audioPlayer.addEventListener('pause', updateModalPlayerStates);
                window.player.audioPlayer.addEventListener('timeupdate', updateModalPlayerStates);
            }

            // Also run initially
            updateModalPlayerStates();

            const saveBtn = node.querySelector('#playlist_edit');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    LoaderUtils.showInButton(saveBtn);

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
                            makeError(req_json?.flash?.message || 'Failed to save playlist');
                        }
                    } catch (err) {
                        console.error('Failed to save playlist from modal:', err);
                        NewNotification(tr('error'), 'Failed to save playlist', null);
                    } finally {
                        LoaderUtils.restoreButton(saveBtn);
                    }
                }, true); // capturing phase to preempt general bubbling click listener
            }

            // Hook close behavior to unload styles when closed
            const originalClose = modal.close;
            modal.close = function(...args) {
                if (window.player?.audioPlayer) {
                    window.player.audioPlayer.removeEventListener('play', updateModalPlayerStates);
                    window.player.audioPlayer.removeEventListener('pause', updateModalPlayerStates);
                    window.player.audioPlayer.removeEventListener('timeupdate', updateModalPlayerStates);
                }
                vkify.unloadStyle('vkify_style_edit_playlist');
                originalClose.apply(this, args);
            };

            // Focus the title input
            const firstInput = node.querySelector('#ape_pl_name');
            firstInput?.focus();
        }, 50);

        return modal;
    } catch (err) {
        console.error('Failed to load edit playlist modal:', err);
        NewNotification(tr('error'), 'Failed to load edit playlist form', null);
    }

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

