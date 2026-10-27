vkify.once('photoEditor', function () {
    const tr = (key) => (typeof window.tr === 'function' ? window.tr(key) : key);
    const vtr = (key, fallback) => (window.vkifylang && window.vkifylang[key]) || fallback || key;

    const FILTER_PRESETS = [
        { id: 'original', name: 'Original', params: { exposure: 0.5, contrast: 0.5, saturation: 0.5, vignette: 0, sharpness: 0, sepia: 0, tint: [0, 0, 0] } },
        { id: 'sky', name: 'Sky', params: { exposure: 0.56, contrast: 0.58, saturation: 0.65, vignette: 0.2, sharpness: 0.15, sepia: 0, tint: [-0.04, 0.02, 0.09] } },
        { id: 'stone', name: 'Stone', params: { exposure: 0.48, contrast: 0.64, saturation: 0.25, vignette: 0.35, sharpness: 0.25, sepia: 0.15, tint: [0.02, 0.01, -0.02] } },
        { id: 'flower', name: 'Flower', params: { exposure: 0.55, contrast: 0.55, saturation: 0.72, vignette: 0.25, sharpness: 0.1, sepia: 0.12, tint: [0.07, -0.01, 0.03] } },
        { id: 'retro', name: 'Retro', params: { exposure: 0.52, contrast: 0.44, saturation: 0.36, vignette: 0.45, sharpness: 0, sepia: 0.55, tint: [0.08, 0.04, -0.07] } },
        { id: 'bw', name: 'B&W', params: { exposure: 0.52, contrast: 0.66, saturation: 0.0, vignette: 0.3, sharpness: 0.2, sepia: 0, tint: [0, 0, 0] } },
        { id: 'summer', name: 'Summer', params: { exposure: 0.58, contrast: 0.54, saturation: 0.68, vignette: 0.2, sharpness: 0.1, sepia: 0.22, tint: [0.09, 0.05, -0.05] } },
    ];

    const AVAILABLE_COLORS = ['#E64646', '#FF9300', '#FFCB00', '#62DA37', '#00AEF9', '#CC74E1', '#000000', '#FFFFFF'];
    const MIN_FONT_SIZE = 14;

    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf"]');
        return meta ? (meta.getAttribute('value') || meta.getAttribute('content') || '') : '';
    }

    function isMobileEditorView() {
        if (typeof window.isMobile === 'function') {
            try { return Boolean(window.isMobile()); } catch (_) {}
        }
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function getEventPoint(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    function createPeSlider(container, opts) {
        if (!container) return null;
        const width = opts.width || 200;
        const widthCss = typeof width === 'string' ? width : `${width}px`;
        const fallbackW = typeof width === 'number' ? width : 100;
        let value = opts.value !== undefined ? Number(opts.value) : 0.5;
        value = Math.max(0, Math.min(1, isNaN(value) ? 0.5 : value));

        container.innerHTML = `
            <div class="pe_params_back" style="width: ${widthCss}; max-width: 100%;">
                <div class="pe_params_amount" style="width: ${Math.round(value * 100)}%;"></div>
                <div class="pe_params_amount_handle" style="left: ${Math.round(value * 100)}%;"></div>
            </div>
        `;
        const backEl = container.querySelector('.pe_params_back');
        const amountEl = container.querySelector('.pe_params_amount');
        const handleEl = container.querySelector('.pe_params_amount_handle');

        let helperEl = null;
        if (opts.formatHint) {
            helperEl = document.createElement('div');
            helperEl.className = 'pe_handler_helper';
            document.body.appendChild(helperEl);
        }

        function updateUI(val, showHint) {
            const pct = Math.max(0, Math.min(1, val));
            amountEl.style.width = `${pct * 100}%`;
            handleEl.style.left = `${pct * 100}%`;
            if (helperEl && showHint) {
                helperEl.textContent = opts.formatHint(pct);
                helperEl.style.display = 'block';
                const rect = handleEl.getBoundingClientRect();
                helperEl.style.left = `${Math.round(rect.left + rect.width / 2 - helperEl.offsetWidth / 2)}px`;
                helperEl.style.top = `${Math.round(rect.top - helperEl.offsetHeight - 8)}px`;
            }
        }

        function setFromEvent(e, fireChange = true, showHint = true) {
            const pt = getEventPoint(e);
            const rect = backEl.getBoundingClientRect();
            const relX = (pt.clientX - rect.left) / (rect.width || fallbackW);
            value = Math.max(0, Math.min(1, relX));
            updateUI(value, showHint);
            if (fireChange && typeof opts.onChange === 'function') {
                opts.onChange(value);
            }
        }

        const onStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            handleEl.classList.add('active');
            container.classList.add('active');
            setFromEvent(e, true, true);

            const onMove = (me) => {
                if (me.cancelable) me.preventDefault();
                setFromEvent(me, true, true);
            };
            const onUp = () => {
                handleEl.classList.remove('active');
                container.classList.remove('active');
                if (helperEl) helperEl.style.display = 'none';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onUp);
                window.removeEventListener('touchcancel', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
            window.addEventListener('touchcancel', onUp);
        };

        container.addEventListener('mousedown', onStart);
        container.addEventListener('touchstart', onStart, { passive: false });
        if (opts.fireChangeEventOnInit && typeof opts.onChange === 'function') {
            opts.onChange(value);
        }

        return {
            getValue: () => value,
            setValue: (v, fire = false) => {
                value = Math.max(0, Math.min(1, Number(v) || 0));
                updateUI(value, false);
                if (fire && typeof opts.onChange === 'function') {
                    opts.onChange(value);
                }
            },
            destroy: () => {
                container.removeEventListener('mousedown', onStart);
                container.removeEventListener('touchstart', onStart);
                if (helperEl && helperEl.parentNode) {
                    helperEl.parentNode.removeChild(helperEl);
                }
            },
        };
    }

    let peFontsPromise = null;
    function ensurePeFonts() {
        if (peFontsPromise) return peFontsPromise;
        if (!document.fonts || typeof document.fonts.load !== 'function') {
            peFontsPromise = Promise.resolve();
            return peFontsPromise;
        }
        const loads = ['500 32px Roboto', '32px Lobster', '32px Impact'].map((spec) =>
            document.fonts.load(spec).catch(() => {})
        );
        peFontsPromise = Promise.all(loads).then(() => document.fonts.ready).catch(() => {});
        return peFontsPromise;
    }

    function peTextFontWeight(fam) {
        return String(fam || '').toLowerCase().includes('roboto') ? '500' : '';
    }

    async function resolvePhotoContext(photoPrettyId, opts = {}) {
        const cleanId = String(photoPrettyId || '').replace(/^["']+|["']+$/g, '').split('_').slice(0, 2).join('_');
        const linkEl = document.querySelector(`[data-photo-id="${cleanId}"]`);
        let albumPrettyId = linkEl ? (linkEl.getAttribute('data-album') || '') : '';
        let attachedPostsRaw = linkEl ? (linkEl.getAttribute('data-attached-posts') || '') : '';
        let fullSrc = opts.src || (linkEl ? (linkEl.getAttribute('data-src') || '') : '');
        let largeSrc = opts.largeSrc || (linkEl ? (linkEl.getAttribute('data-large-src') || '') : '');
        let description = '';
        const avatarBlock = linkEl?.closest?.('.avatar_block') || (opts.isAvatar ? document.querySelector('.avatar_block') : null);
        const isAvatar = Boolean(opts.isAvatar || avatarBlock);
        const clubId = opts.clubId || (avatarBlock?.dataset?.club ? Number(avatarBlock.dataset.club) : null);

        let activeViewer = (window.messagebox_stack || []).slice().reverse().find((m) => m && m._viewer && typeof PhotoViewer === 'function' && m._viewer instanceof PhotoViewer)?.['_viewer'] || null;
        if (activeViewer && (!activeViewer.modal || !document.body.contains(activeViewer.modal.getNode().nodes[0]))) {
            activeViewer = null;
        }
        let containerRoot = document;
        if (activeViewer && activeViewer.modal) {
            containerRoot = activeViewer.modal.getNode().nodes[0] || document;
            const modalImg = containerRoot.querySelector('#ovk-photo-img');
            if (modalImg && modalImg.getAttribute('src') && !largeSrc) {
                largeSrc = modalImg.src;
            }
        } else {
            const pageImg = document.querySelector('.pv_photo img') || (isAvatar ? document.querySelector('#bigAvatar') : null);
            if (pageImg && pageImg.getAttribute('src') && !largeSrc) {
                largeSrc = pageImg.src;
            }
        }

        const origLink = containerRoot.querySelector('#pv_more_act_download, #pv_actions_more_menu a[target="_blank"], #pv_actions_more_menu_mobile a[target="_blank"]');
        if (origLink && origLink.getAttribute('href') && !fullSrc) {
            fullSrc = origLink.href;
        }
        if (!attachedPostsRaw) {
            const peActEl = containerRoot.querySelector(`[data-photo-id="${cleanId}"][data-attached-posts]`);
            if (peActEl) attachedPostsRaw = peActEl.getAttribute('data-attached-posts') || '';
        }

        const albumLink = containerRoot.querySelector('.pv_album_name[href^="/album"], .pv_bottom_info_left a[href^="/album"]');
        if (albumLink && !albumPrettyId) {
            const m = albumLink.getAttribute('href').match(/\/album(-?\d+_\d+)/);
            if (m) albumPrettyId = m[1];
        }

        try {
            const editRes = await fetch(`/photo${cleanId}/edit`, { credentials: 'same-origin' });
            if (editRes.ok) {
                const editHtml = await editRes.text();
                const doc = new DOMParser().parseFromString(editHtml, 'text/html');
                const ta = doc.querySelector('textarea[name="desc"]');
                if (ta) description = ta.value || '';
                if (!albumPrettyId) {
                    const crumbAlbum = doc.querySelector('a[href^="/album"]');
                    if (crumbAlbum) {
                        const m = crumbAlbum.getAttribute('href').match(/\/album(-?\d+_\d+)/);
                        if (m) albumPrettyId = m[1];
                    }
                }
            }
        } catch (_) {}

        if (!fullSrc && cleanId) {
            try {
                const photoPageRes = await fetch(`/photo${cleanId}`, { credentials: 'same-origin' });
                if (photoPageRes.ok) {
                    const doc = new DOMParser().parseFromString(await photoPageRes.text(), 'text/html');
                    const origA = doc.querySelector('#pv_more_act_download, #pv_actions_more_menu a[target="_blank"]');
                    const peAct = doc.querySelector('#pv_more_act_pe[data-attached-posts], #pv_more_act_spe[data-attached-posts]');
                    const pvImg = doc.querySelector('.pv_photo img');
                    if (origA?.href) fullSrc = origA.href;
                    if (peAct && !attachedPostsRaw) attachedPostsRaw = peAct.getAttribute('data-attached-posts') || '';
                    if (pvImg?.src && !largeSrc) largeSrc = pvImg.src;
                }
            } catch (_) {}
        }

        if (!fullSrc) fullSrc = largeSrc;
        if (!largeSrc) largeSrc = fullSrc;

        return {
            photoId: cleanId,
            ownerId: Number(cleanId.split('_')[0]) || (window.openvk ? window.openvk.current_id : 0),
            vid: cleanId.split('_')[1] || '',
            albumPrettyId,
            attachedPosts: attachedPostsRaw ? attachedPostsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
            fullSrc,
            largeSrc,
            description,
            activeViewer,
            containerRoot,
            isAvatar,
            clubId,
            fromComposer: Boolean(opts.fromComposer),
        };
    }

    async function saveEditedPhotoAndReplace(ctx, blob) {
        const hash = getCsrfToken();
        const file = new File([blob], 'Edited.jpg', { type: 'image/jpeg', lastModified: Date.now() });

        let targetAlbum = ctx.albumPrettyId;
        let isSpecialAlbum = Boolean(ctx.isAvatar);

        if (!isSpecialAlbum && targetAlbum) {
            try {
                const probe = await fetch(`/photos/upload?album=${encodeURIComponent(targetAlbum)}`, {
                    method: 'GET',
                    headers: { 'X-OpenVK-Ajax-Query': '1' },
                    credentials: 'same-origin',
                });
                if (probe.redirected || !probe.ok) {
                    isSpecialAlbum = true;
                } else {
                    const txt = await probe.text();
                    if (txt.includes('flash-type="err"')) {
                        isSpecialAlbum = true;
                    }
                }
            } catch (_) {
                isSpecialAlbum = true;
            }
        }

        let newPrettyId = null;
        let newPhotoUrl = null;

        if (ctx.isAvatar) {
            const fd = new FormData();
            fd.append('blob', file, 'Edited.jpg');
            fd.append('ajax', '1');
            fd.append('on_wall', '0');
            fd.append('hash', hash);

            const avaEndpoint = ctx.clubId ? `/club${ctx.clubId}/al_avatar` : '/al_avatars';
            const avaRes = await fetch(avaEndpoint, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const avaJson = await avaRes.json();
            if (avaJson && avaJson.success && avaJson.new_photo) {
                newPrettyId = avaJson.new_photo;
                newPhotoUrl = avaJson.url;
                if (ctx.description) {
                    const descFd = new FormData();
                    descFd.append('desc', ctx.description);
                    descFd.append('hash', hash);
                    await fetch(`/photo${newPrettyId}/edit`, {
                        method: 'POST',
                        body: descFd,
                        credentials: 'same-origin',
                    });
                }
            }
            if (!newPrettyId) {
                throw new Error(avaJson?.flash?.message || tr('error_uploading_photo') || 'Avatar upload failed');
            }
        }

        if (!newPrettyId) {
            const uploadUrl = (!targetAlbum || isSpecialAlbum)
                ? `/photos/upload?upload_context=${encodeURIComponent(ctx.ownerId)}`
                : `/photos/upload?album=${encodeURIComponent(targetAlbum)}`;

            const fd = new FormData();
            fd.append('photo_0', file, 'Edited.jpg');
            fd.append('count', '1');
            fd.append('hash', hash);

            const upRes = await fetch(uploadUrl, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const upJson = await upRes.json();
            if (!upJson || !upJson.success || !Array.isArray(upJson.photos) || !upJson.photos[0]) {
                throw new Error(upJson?.flash?.message || tr('error_uploading_photo') || 'Upload failed');
            }

            const uploaded = upJson.photos[0];
            newPrettyId = uploaded.pretty_id || `${uploaded.owner}_${uploaded.vid}`;
            newPhotoUrl = uploaded.link || uploaded.url;

            if (ctx.description) {
                if (targetAlbum && !isSpecialAlbum) {
                    const finFd = new FormData();
                    finFd.append('photos', JSON.stringify({ [uploaded.id]: ctx.description }));
                    finFd.append('hash', hash);
                    await fetch(`/photos/upload?act=finish&album=${encodeURIComponent(targetAlbum)}`, {
                        method: 'POST',
                        body: finFd,
                        credentials: 'same-origin',
                    });
                } else {
                    const descFd = new FormData();
                    descFd.append('desc', ctx.description);
                    descFd.append('hash', hash);
                    await fetch(`/photo${newPrettyId}/edit`, {
                        method: 'POST',
                        body: descFd,
                        credentials: 'same-origin',
                    });
                }
            }
        }

        // If the photo is attached to any post (from server data-attached-posts,
        // viewer context, or page DOM), update those posts to reference the new photo.
        const postIds = new Set(ctx.attachedPosts || []);
        if (ctx.activeViewer?.context?.type === 'post' && ctx.activeViewer.context.id) {
            postIds.add(String(ctx.activeViewer.context.id));
        }
        document.querySelectorAll(`a[href*="/photo${ctx.photoId}"], a[onclick*="${ctx.photoId}"]`).forEach((a) => {
            const postEl = a.closest('.post[data-id]');
            if (postEl?.dataset?.id) postIds.add(String(postEl.dataset.id));
        });

        const isEditingExistingPost = Boolean(
            ctx.fromComposer && document.querySelector(`.post.editing .upload-item[data-id^="${ctx.photoId}"], #_edit_post_modal .upload-item[data-id^="${ctx.photoId}"]`)
        );
        let canDeleteOriginal = !ctx.fromComposer;
        if (!isEditingExistingPost && postIds.size > 0 && window.OVKAPI && typeof window.OVKAPI.call === 'function') {
            for (const postId of postIds) {
                try {
                    const parts = postId.split('_');
                    if (parts.length < 2) {
                        canDeleteOriginal = false;
                        continue;
                    }
                    const res = await window.OVKAPI.call('wall.getById', { posts: `${parts[0]}_${parts[1]}` });
                    const items = res?.items || res?.response?.items || res;
                    const apiPost = Array.isArray(items) ? items[0] : items;
                    if (!apiPost) {
                        canDeleteOriginal = false;
                        continue;
                    }
                    const attList = (apiPost.attachments || []).map((att) => {
                        const t = att.type;
                        const obj = att[t];
                        if (!obj) return null;
                        const aid = `${obj.owner_id}_${obj.id}`;
                        if (t === 'photo' && aid === ctx.photoId) {
                            return `photo${newPrettyId}`;
                        }
                        return `${t}${aid}`;
                    }).filter(Boolean);
                    if (!(apiPost.attachments || []).some((att) =>
                        att.type === 'photo' && `${att.photo?.owner_id}_${att.photo?.id}` === ctx.photoId)) {
                        canDeleteOriginal = false;
                        continue;
                    }
                    const editParams = {
                        owner_id: parts[0],
                        post_id: parts[1],
                        message: apiPost.text || '',
                        attachments: attList.join(','),
                    };
                    if (apiPost.is_explicit) editParams.explicit = 1;
                    if (apiPost.copyright?.link) editParams.copyright = apiPost.copyright.link;
                    await window.OVKAPI.call('wall.edit', editParams);
                } catch (_) {
                    canDeleteOriginal = false;
                }
            }
        } else if (postIds.size > 0) {
            canDeleteOriginal = false;
        }

        if (postIds.size > 0 && !canDeleteOriginal && !ctx.fromComposer) {
            throw new Error(`Edited photo saved at /photo${newPrettyId}, but a post could not be updated. The original was kept.`);
        }

        // Delete the original photo to complete replacement (unless a non-editable post still depends on it)
        if (canDeleteOriginal && Number(ctx.ownerId) === Number(window.openvk?.current_id)) {
            try {
                const delFd = new FormData();
                delFd.append('hash', hash);
                await fetch(`/photo${ctx.photoId}/delete`, {
                    method: 'POST',
                    body: delFd,
                    credentials: 'same-origin',
                });
            } catch (delErr) {
                console.warn('PhotoEditor | Failed to delete old photo after replacement:', delErr);
            }
        }

        // Update thumbnails and composer upload-items in the current DOM if present
        document.querySelectorAll(`.upload-item[data-type="photo"][data-id^="${ctx.photoId}"]`).forEach((item) => {
            item.dataset.id = newPrettyId;
            item.dataset.pageUrl = newPrettyId;
            if (newPhotoUrl) {
                item.dataset.preview = newPhotoUrl;
                item.dataset.fullsize = newPhotoUrl;
                const img = item.querySelector('img');
                if (img) img.src = newPhotoUrl;
            }
            item.setAttribute('href', `/photo${newPrettyId}`);
            item.setAttribute('onclick', `if(!event.target.closest('.upload-delete, .ui_thumb_x_button, .ui_extra_btn_pe, .photo_thumb_btn_editor'))PhotoViewer.openById('${newPrettyId}', event)`);
            const form = item.closest('form, #write');
            if (form && typeof window.vkifyUpdateComposerMediaGrid === 'function') {
                window.vkifyUpdateComposerMediaGrid(form);
            }
        });

        if (postIds.size === 0 || canDeleteOriginal) {
            document.querySelectorAll(`a[href*="/photo${ctx.photoId}"], a[onclick*="${ctx.photoId}"]`).forEach((a) => {
                if (a.classList.contains('upload-item')) return;
                if (a.getAttribute('href')) {
                    a.href = a.href.replace(`/photo${ctx.photoId}`, `/photo${newPrettyId}`);
                }
                const oncl = a.getAttribute('onclick');
                if (oncl) {
                    a.setAttribute('onclick', oncl.replace(ctx.photoId, newPrettyId));
                }
                const img = a.querySelector('img');
                if (img && newPhotoUrl) {
                    img.src = newPhotoUrl;
                }
            });
        }

        document.querySelectorAll(`[data-photo-id="${ctx.photoId}"]`).forEach((el) => {
            el.setAttribute('data-photo-id', newPrettyId);
            if (newPhotoUrl) {
                el.setAttribute('data-src', newPhotoUrl);
                el.setAttribute('data-large-src', newPhotoUrl);
            }
        });

        if (ctx.isAvatar && newPhotoUrl) {
            if (typeof window.vkifyApplyAvatarUploadPatches === 'function') {
                window.vkifyApplyAvatarUploadPatches(
                    { success: true, new_photo: newPrettyId, url: newPhotoUrl },
                    { isGroup: Boolean(ctx.clubId), clubId: ctx.clubId, skipSavedLabel: true }
                );
            } else {
                const bigAvatar = document.querySelector('#bigAvatar');
                if (bigAvatar) {
                    bigAvatar.src = newPhotoUrl;
                    bigAvatar.setAttribute('onclick', `PhotoViewer.openById('${newPrettyId}', event);`);
                    if (bigAvatar.parentNode && bigAvatar.parentNode.tagName === 'A') {
                        bigAvatar.parentNode.href = `/photo${newPrettyId}`;
                    }
                }
            }
        }

        return { newPrettyId, newPhotoUrl };
    }

    function navigateAfterSave(ctx, result) {
        if (!result || !result.newPrettyId) return;
        if ((ctx.fromComposer || ctx.isAvatar) && ctx.activeViewer && ctx.activeViewer.modal) {
            try {
                ctx.activeViewer.close();
            } catch (_) {}
            return;
        }
        if (ctx.activeViewer && ctx.activeViewer.modal) {
            const viewer = ctx.activeViewer;
            const oldKey = viewer.currentId;
            if (oldKey && viewer.items[oldKey]) {
                viewer.items[result.newPrettyId] = {
                    ...viewer.items[oldKey],
                    id: result.newPrettyId,
                    url: result.newPhotoUrl || viewer.items[oldKey].url,
                    cached: null,
                    cachedBottom: null,
                };
                const idx = viewer.itemsOrder.indexOf(oldKey);
                if (idx !== -1) viewer.itemsOrder[idx] = result.newPrettyId;
                delete viewer.items[oldKey];
                viewer.selectItem(result.newPrettyId, viewer.items[result.newPrettyId]);
                return;
            }
        }
        if (ctx.fromComposer || ctx.isAvatar) return;
        if (window.vkify && typeof window.vkify.navigate === 'function') {
            window.vkify.navigate(`/photo${result.newPrettyId}`);
        } else {
            window.location.href = `/photo${result.newPrettyId}`;
        }
    }

    /* ==========================================================================
       1. Classic Photo Editor (pe.js + filters_pe.js port)
       ========================================================================== */

    class VkPhotoEditEngine {
        constructor(parentEl, photoSrc, bigPhotoSrc, options, initCallback, sizeUpdateCallback) {
            this.parentEl = parentEl;
            this.photoSrc = photoSrc;
            this.bigPhotoSrc = bigPhotoSrc || photoSrc;
            this.options = Object.assign({ maxEditorSizeWidth: 660 }, options || {});
            this.initCallback = initCallback;
            this.sizeUpdateCallback = sizeUpdateCallback;
            this.pixelRatio = window.devicePixelRatio || 1;

            this._mode = 'filter';
            this._currentFilter = 'original';
            this._currentFilterAmount = 0.75;
            this.exposure = 0.5;
            this.contrast = 0.5;
            this.saturation = 0.5;
            this.vignetteAmount = 0;
            this.unsharpAmount = 0;
            this.sepiaAmount = 0;
            this.autoEnabled = false;
            this._rotation = 0;
            this.lastCrop = { t: 0, l: 0, r: 0, b: 0 };
            this._text = '';
            this._fontType = 1;

            this.canvasEl = document.createElement('canvas');
            this.canvasEl.id = 'pe_main';
            this.ctx = this.canvasEl.getContext('2d');

            this._loadImages();
        }

        _loadImages() {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                this.originalImageCanvas = document.createElement('canvas');
                this.originalImageCanvas.width = img.naturalWidth || img.width;
                this.originalImageCanvas.height = img.naturalHeight || img.height;
                this.originalImageCanvas.getContext('2d').drawImage(img, 0, 0);

                this.bigImageCanvas = document.createElement('canvas');
                this.bigImageCanvas.width = this.originalImageCanvas.width;
                this.bigImageCanvas.height = this.originalImageCanvas.height;
                this.bigImageCanvas.getContext('2d').drawImage(img, 0, 0);

                this._rebuildWorkingCanvas();
                this._imageLoaded = true;
                this.render();
                if (typeof this.initCallback === 'function') {
                    this.initCallback();
                }
            };
            img.onerror = () => {
                if (this.photoSrc !== this.bigPhotoSrc) {
                    this.photoSrc = this.bigPhotoSrc;
                    this._loadImages();
                }
            };
            img.src = this.bigPhotoSrc || this.photoSrc;
        }

        _rebuildWorkingCanvas() {
            if (!this.originalImageCanvas) return;
            const crop = this.getLastCrop();
            const srcW = this.originalImageCanvas.width;
            const srcH = this.originalImageCanvas.height;

            const l = Math.round(srcW * crop.l);
            const t = Math.round(srcH * crop.t);
            const w = Math.max(16, Math.round(srcW * (1 - crop.l - crop.r)));
            const h = Math.max(16, Math.round(srcH * (1 - crop.t - crop.b)));

            const maxW = this.options.maxEditorSizeWidth || 650;
            const maxH = this.options.maxEditorSizeHeight || maxW;
            const scale = Math.min(maxW / w, maxH / h, 1);
            const dispW = Math.max(16, Math.round(w * scale));
            const dispH = Math.max(16, Math.round(h * scale));
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const bufW = Math.max(16, Math.round(dispW * dpr));
            const bufH = Math.max(16, Math.round(dispH * dpr));

            this.options.width = dispW;
            this.options.height = dispH;

            this.workingCanvas = document.createElement('canvas');
            this.workingCanvas.width = bufW;
            this.workingCanvas.height = bufH;
            const wCtx = this.workingCanvas.getContext('2d');
            wCtx.imageSmoothingEnabled = true;
            wCtx.imageSmoothingQuality = 'high';
            wCtx.drawImage(this.originalImageCanvas, l, t, w, h, 0, 0, bufW, bufH);

            if (this.autoEnabled) {
                this._applyAutoToCanvas(this.workingCanvas);
            }

            this.canvasEl.width = bufW;
            this.canvasEl.height = bufH;
            this.canvasEl.style.width = `${dispW}px`;
            this.canvasEl.style.height = `${dispH}px`;

            if (typeof this.sizeUpdateCallback === 'function') {
                this.sizeUpdateCallback();
            }
        }

        _applyAutoToCanvas(cnv) {
            const ctx = cnv.getContext('2d');
            const w = cnv.width;
            const h = cnv.height;
            const size = w * h;
            if (!size) return;
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            const nbMin = size * 0.01;
            const nbMax = size * 0.01;

            for (let chan = 0; chan < 3; chan++) {
                const histo = new Int32Array(256);
                for (let i = 0; i < size; i++) {
                    histo[data[i * 4 + chan]]++;
                }
                for (let i = 1; i < 256; i++) {
                    histo[i] += histo[i - 1];
                }
                let min = 0;
                while (min < 255 && histo[min] <= nbMin) min++;
                let max = 255;
                while (max > 0 && histo[max] > size - nbMax) max--;
                if (max < 255) max++;

                if (max > min) {
                    const norm = new Uint8ClampedArray(256);
                    for (let i = 0; i < min; i++) norm[i] = 0;
                    for (let i = min; i < max; i++) norm[i] = Math.round(((i - min) * 255) / (max - min));
                    for (let i = max; i < 256; i++) norm[i] = 255;
                    for (let i = 0; i < size; i++) {
                        data[i * 4 + chan] = norm[data[i * 4 + chan]];
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }

        show() {
            if (this.parentEl && !this.canvasEl.parentNode) {
                this.parentEl.appendChild(this.canvasEl);
            }
            if (typeof this.sizeUpdateCallback === 'function') {
                this.sizeUpdateCallback();
            }
        }

        getSize() {
            return [this.options.width || 600, this.options.height || 400];
        }

        getLastCrop() {
            if (!this.lastCrop) {
                this.lastCrop = { t: 0, l: 0, r: 0, b: 0 };
            }
            return { ...this.lastCrop };
        }

        resetCrop() {
            this.crop(0, 0, 0, 0, true);
        }

        crop(left, right, top, bottom, isReset) {
            if (!isReset) {
                this.lastCrop = { t: top, l: left, r: right, b: bottom };
            } else {
                this.lastCrop = { t: 0, l: 0, r: 0, b: 0 };
            }
            this._rebuildWorkingCanvas();
            this.render();
        }

        getRotation() {
            return this._rotation || 0;
        }

        rotate() {
            if (!this.originalImageCanvas) return;
            this._rotation = ((this._rotation || 0) + 1) % 4;
            const rot = document.createElement('canvas');
            rot.width = this.originalImageCanvas.height;
            rot.height = this.originalImageCanvas.width;
            const rCtx = rot.getContext('2d');
            rCtx.translate(rot.width, 0);
            rCtx.rotate(Math.PI / 2);
            rCtx.drawImage(this.originalImageCanvas, 0, 0);
            this.originalImageCanvas = rot;

            const crop = this.getLastCrop();
            this.lastCrop = {
                t: crop.l,
                l: crop.b,
                b: crop.r,
                r: crop.t,
            };
            this._rebuildWorkingCanvas();
            this.render();
        }

        applyAuto(enabled) {
            this.autoEnabled = enabled === undefined ? !this.autoEnabled : Boolean(enabled);
            this._rebuildWorkingCanvas();
            this.render();
        }

        isAuto() {
            return Boolean(this.autoEnabled);
        }

        setBlur(size, position, type) {
            this.blurSize = size;
            this.blurPosition = position || [0.5, 0.5];
            this.blurType = type || 1;
            this.render();
        }

        getBlur() {
            if (this.blurSize === undefined) return undefined;
            return {
                size: this.blurSize,
                position: this.blurPosition || [0.5, 0.5],
                type: this.blurType || 1,
            };
        }

        setText(text, fontType) {
            if (text === undefined && this._text === undefined) return '';
            if (text !== undefined) {
                this._text = String(text).slice(0, 200);
            }
            if (fontType !== undefined) {
                this._fontType = Number(fontType);
            }
            this.render();
            return this._text;
        }

        getText() {
            return { text: this._text || '', font: this._fontType ?? 1 };
        }

        getCurrentFilter() {
            return { name: this._currentFilter || 'original', amount: this._currentFilterAmount ?? 0.75 };
        }

        applyFilter(name, amount) {
            this._mode = 'filter';
            if (name !== undefined) this._currentFilter = name;
            if (amount !== undefined) this._currentFilterAmount = amount;
            this.render();
        }

        applyParameters() {
            this._mode = 'params';
            this.render();
        }

        getMode() {
            return this._mode || 'filter';
        }

        getExposure() { return this.exposure ?? 0.5; }
        getContrast() { return this.contrast ?? 0.5; }
        getSaturation() { return this.saturation ?? 0.5; }
        getVignette() { return this.vignetteAmount || 0; }
        getSharpness() { return this.unsharpAmount || 0; }
        getSepia() { return this.sepiaAmount || 0; }

        setExposure(v) { this._mode = 'params'; this.exposure = v; this.render(); }
        setContrast(v) { this._mode = 'params'; this.contrast = v; this.render(); }
        setSaturation(v) { this._mode = 'params'; this.saturation = Math.min(0.85, v); this.render(); }
        setVignette(v) { this._mode = 'params'; this.vignetteAmount = v; this.render(); }
        setSharpness(v) { this._mode = 'params'; this.unsharpAmount = v; this.render(); }
        setSepia(v) { this._mode = 'params'; this.sepiaAmount = v; this.render(); }

        restoreAll() {
            this._mode = 'filter';
            this._currentFilter = 'original';
            this._currentFilterAmount = 0.75;
            this.exposure = 0.5;
            this.contrast = 0.5;
            this.saturation = 0.5;
            this.vignetteAmount = 0;
            this.unsharpAmount = 0;
            this.sepiaAmount = 0;
            this.blurSize = 0;
            this.blurPosition = [0.5, 0.5];
            this.blurType = 1;
            this._text = '';
            this._fontType = 1;
            this.autoEnabled = false;
            this.lastCrop = { t: 0, l: 0, r: 0, b: 0 };
            if (this._rotation) {
                let r = (4 - this._rotation) % 4;
                while (r--) {
                    this.rotate();
                }
                this._rotation = 0;
            }
            this._rebuildWorkingCanvas();
            this.render();
        }

        _getEffectiveParams() {
            if (this._mode === 'params') {
                return {
                    exposure: (this.getExposure() - 0.5) * 1.4,
                    contrast: (this.getContrast() - 0.5) * 1.4,
                    saturation: (this.getSaturation() - 0.5) * 2.0,
                    vignette: this.getVignette(),
                    sharpness: this.getSharpness(),
                    sepia: this.getSepia(),
                    tint: [0, 0, 0],
                };
            }
            const preset = FILTER_PRESETS.find((f) => f.id === this._currentFilter) || FILTER_PRESETS[0];
            const amt = this._currentFilter === 'original' ? 0 : (this._currentFilterAmount ?? 0.75);
            const p = preset.params;
            return {
                exposure: (p.exposure - 0.5) * 1.4 * amt,
                contrast: (p.contrast - 0.5) * 1.4 * amt,
                saturation: (p.saturation - 0.5) * 2.0 * amt,
                vignette: p.vignette * amt,
                sharpness: p.sharpness * amt,
                sepia: p.sepia * amt,
                tint: [p.tint[0] * amt, p.tint[1] * amt, p.tint[2] * amt],
            };
        }

        _renderPipelineToCanvas(sourceCanvas, targetCanvas) {
            const w = sourceCanvas.width;
            const h = sourceCanvas.height;
            targetCanvas.width = w;
            targetCanvas.height = h;
            const ctx = targetCanvas.getContext('2d');
            ctx.drawImage(sourceCanvas, 0, 0);

            const eff = this._getEffectiveParams();
            const hasPixelOps = Math.abs(eff.exposure) > 0.005
                || Math.abs(eff.contrast) > 0.005
                || Math.abs(eff.saturation) > 0.005
                || eff.sepia > 0.005
                || eff.sharpness > 0.005
                || Math.abs(eff.tint[0]) > 0.001
                || Math.abs(eff.tint[1]) > 0.001
                || Math.abs(eff.tint[2]) > 0.001;

            if (hasPixelOps) {
                const imgData = ctx.getImageData(0, 0, w, h);
                const d = imgData.data;

                if (eff.sharpness > 0.01) {
                    const copy = new Uint8ClampedArray(d);
                    const sAmt = eff.sharpness * 0.8;
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const idx = (y * w + x) * 4;
                            for (let c = 0; c < 3; c++) {
                                const center = copy[idx + c] * 5;
                                const neighbors = copy[idx - 4 + c] + copy[idx + 4 + c] + copy[idx - w * 4 + c] + copy[idx + w * 4 + c];
                                d[idx + c] = Math.min(255, Math.max(0, copy[idx + c] + (center - neighbors) * sAmt * 0.25));
                            }
                        }
                    }
                }

                const expMul = Math.pow(2, eff.exposure);
                const contrast = Math.max(-0.85, Math.min(0.85, eff.contrast));
                const sat = eff.saturation;
                const sep = eff.sepia;
                const tR = eff.tint[0] * 255;
                const tG = eff.tint[1] * 255;
                const tB = eff.tint[2] * 255;

                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i] / 255;
                    let g = d[i + 1] / 255;
                    let b = d[i + 2] / 255;

                    if (contrast > 0) {
                        r = (r - 0.5) / (1 - contrast) + 0.5;
                        g = (g - 0.5) / (1 - contrast) + 0.5;
                        b = (b - 0.5) / (1 - contrast) + 0.5;
                    } else if (contrast < 0) {
                        r = (r - 0.5) * (1 + contrast) + 0.5;
                        g = (g - 0.5) * (1 + contrast) + 0.5;
                        b = (b - 0.5) * (1 + contrast) + 0.5;
                    }

                    r *= expMul;
                    g *= expMul;
                    b *= expMul;

                    const avg = (r + g + b) / 3;
                    if (sat > 0) {
                        const f = 1 - 1 / (1.001 - Math.min(0.9, sat));
                        r += (avg - r) * f;
                        g += (avg - g) * f;
                        b += (avg - b) * f;
                    } else if (sat < 0) {
                        r += (avg - r) * (-sat);
                        g += (avg - g) * (-sat);
                        b += (avg - b) * (-sat);
                    }

                    if (sep > 0) {
                        const sr = r * (1 - 0.607 * sep) + g * (0.769 * sep) + b * (0.189 * sep);
                        const sg = r * (0.349 * sep) + g * (1 - 0.314 * sep) + b * (0.168 * sep);
                        const sb = r * (0.272 * sep) + g * (0.534 * sep) + b * (1 - 0.869 * sep);
                        r = sr;
                        g = sg;
                        b = sb;
                    }

                    d[i] = Math.min(255, Math.max(0, r * 255 + tR));
                    d[i + 1] = Math.min(255, Math.max(0, g * 255 + tG));
                    d[i + 2] = Math.min(255, Math.max(0, b * 255 + tB));
                }

                ctx.putImageData(imgData, 0, 0);
            }

            if (eff.vignette > 0.01) {
                const maxR = Math.hypot(w / 2, h / 2);
                const innerR = maxR * Math.max(0.15, 0.7 - eff.vignette * 0.45);
                const grad = ctx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, maxR);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, eff.vignette * 0.85)})`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            }

            if (this.blurSize && this.blurSize > 0.01) {
                const blurCnv = document.createElement('canvas');
                blurCnv.width = w;
                blurCnv.height = h;
                const bCtx = blurCnv.getContext('2d');
                const radius = Math.max(1, Math.round(this.blurSize * 12 * (w / 600)));
                bCtx.filter = `blur(${radius}px)`;
                bCtx.drawImage(targetCanvas, 0, 0);
                bCtx.filter = 'none';

                const pos = this.blurPosition || [0.5, 0.5];
                const cx = pos[0] * w;
                const cy = pos[1] * h;

                const maskCnv = document.createElement('canvas');
                maskCnv.width = w;
                maskCnv.height = h;
                const mCtx = maskCnv.getContext('2d');
                mCtx.drawImage(blurCnv, 0, 0);
                mCtx.globalCompositeOperation = 'destination-out';

                if (this.blurType === 2) {
                    const band = h * 0.22;
                    const grad = mCtx.createLinearGradient(0, cy - band, 0, cy + band);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(0.35, 'rgba(0,0,0,1)');
                    grad.addColorStop(0.65, 'rgba(0,0,0,1)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    mCtx.fillStyle = grad;
                    mCtx.fillRect(0, 0, w, h);
                } else {
                    const rOuter = Math.max(w, h) * 0.32;
                    const rInner = rOuter * 0.35;
                    const grad = mCtx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
                    grad.addColorStop(0, 'rgba(0,0,0,1)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    mCtx.fillStyle = grad;
                    mCtx.fillRect(0, 0, w, h);
                }

                ctx.drawImage(maskCnv, 0, 0);
            }

            if (this._text) {
                this._drawTextOnContext(ctx, w, h);
            }
        }

        _drawTextOnContext(ctx, w, h) {
            const text = this._text;
            const fontType = Number(this._fontType || 0);
            ctx.save();

            if (fontType === 1) {
                const grad = ctx.createLinearGradient(0, h - w * 0.08, 0, h);
                grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
                ctx.shadowBlur = Math.max(2, w * 0.006);
            }

            const coeff = 0.3 * Math.max(w, h);
            const nominalSize = fontType === 0 ? coeff * 0.14 : coeff * 0.17;
            const fontFam = fontType === 0 ? "Impact, 'Arial Black', sans-serif" : "'Lobster', cursive, sans-serif";
            ctx.font = `normal ${nominalSize}px ${fontFam}`;

            const maxWidth = w * 0.85;
            const rawLines = (fontType === 0 ? text.toUpperCase() : text).split(/\r?\n/);
            const lines = [];
            for (const rawLine of rawLines) {
                if (ctx.measureText(rawLine).width <= maxWidth) {
                    lines.push(rawLine);
                } else {
                    const words = rawLine.split(' ');
                    let curLine = '';
                    for (const word of words) {
                        const test = curLine ? `${curLine} ${word}` : word;
                        if (ctx.measureText(test).width > maxWidth && curLine) {
                            lines.push(curLine);
                            curLine = word;
                        } else {
                            curLine = test;
                        }
                    }
                    if (curLine) lines.push(curLine);
                }
            }

            ctx.strokeStyle = '#000';
            ctx.fillStyle = '#fff';
            ctx.lineJoin = 'round';
            ctx.textAlign = 'center';

            if (fontType === 0) {
                const sz = Math.max(16, Math.min(nominalSize * 1.2, (w * 0.88) / Math.max(6, ...lines.map((l) => l.length * 0.55))));
                ctx.font = `normal ${sz}px ${fontFam}`;
                ctx.lineWidth = Math.max(2, sz * 0.08);
                const lineHeight = sz * 1.12;
                let bottomY = h - sz * 0.25 - h * 0.03;

                for (let i = lines.length - 1; i >= 0; i--) {
                    let y = bottomY;
                    if (i === 0 && lines.length > 1) {
                        y = sz * 1.1 + h * 0.03;
                    } else {
                        bottomY -= lineHeight;
                    }
                    ctx.strokeText(lines[i], w / 2, y);
                    ctx.fillText(lines[i], w / 2, y);
                }
            } else {
                const sz = coeff * 0.18;
                ctx.font = `normal ${sz}px ${fontFam}`;
                const lineHeight = sz * 1.15;
                let y = h - nominalSize * 0.65;
                for (let i = lines.length - 1; i >= 0; i--) {
                    ctx.fillText(lines[i], w / 2, y);
                    y -= lineHeight;
                }
            }

            ctx.restore();
        }

        render() {
            if (!this.workingCanvas) return;
            this._renderPipelineToCanvas(this.workingCanvas, this.canvasEl);
        }

        exportBlob(callback) {
            if (!this.originalImageCanvas) return;
            const crop = this.getLastCrop();
            const srcW = this.originalImageCanvas.width;
            const srcH = this.originalImageCanvas.height;
            const l = Math.round(srcW * crop.l);
            const t = Math.round(srcH * crop.t);
            const w = Math.max(16, Math.round(srcW * (1 - crop.l - crop.r)));
            const h = Math.max(16, Math.round(srcH * (1 - crop.t - crop.b)));

            const fullCropped = document.createElement('canvas');
            fullCropped.width = w;
            fullCropped.height = h;
            fullCropped.getContext('2d').drawImage(this.originalImageCanvas, l, t, w, h, 0, 0, w, h);

            if (this.autoEnabled) {
                this._applyAutoToCanvas(fullCropped);
            }

            const outCanvas = document.createElement('canvas');
            this._renderPipelineToCanvas(fullCropped, outCanvas);
            outCanvas.toBlob(callback, 'image/jpeg', 0.92);
        }

        clean() {
            if (this.canvasEl && this.canvasEl.parentNode) {
                this.canvasEl.parentNode.removeChild(this.canvasEl);
            }
        }
    }

    async function openVkPhotoEditor(photoPrettyId, opts = {}) {
        ensurePeFonts();
        const ctx = await resolvePhotoContext(photoPrettyId, opts);
        if (!ctx || !ctx.fullSrc) return;

        const filterThumbsHtml = FILTER_PRESETS.map((f, idx) => `
            <div class="pe_filter_thumb ${idx === 0 ? 'pe_filter_selected' : ''}" id="pe_filter_${f.id}" data-filter="${f.id}" data-name="${f.name}">
                <canvas class="pe_filter_thumb_canvas" width="88" height="88"></canvas>
                <div class="pe_thumb_filter_name">${f.name}</div>
            </div>
        `).join('');

        const paramSliders = [
            ['exposure', vtr('pe_exposure', 'Exposure'), 0.5],
            ['contrast', vtr('pe_contrast', 'Contrast'), 0.5],
            ['saturation', vtr('pe_saturation', 'Saturation'), 0.5],
            ['vignette', vtr('pe_vignette', 'Vignette'), 0],
            ['sharpness', vtr('pe_sharpness', 'Sharpness'), 0],
            ['sepia', vtr('pe_sepia', 'Sepia'), 0],
        ].map(([id, label, defVal]) => `
            <div class="pe_params_slider_wrap">
                <div class="pe_params_slider_label">${label}</div>
                <div class="pe_params_slider" id="pe_param_${id}" data-param="${id}" data-default="${defVal}"></div>
            </div>
        `).join('');

        const bodyHtml = `
            <div class="pe_modal_root">
                <div class="pe_wrap">
                    <div id="pe_loader" class="pe_loader">
                        <div class="pr pr_medium" style="opacity:1;"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>
                    </div>
                    <div class="pe_canvas_wrap"></div>
                    <div class="pe_actions">
                        <div class="pe_action" id="pe_crop" onmouseover="showTitle(this)" data-title="${vtr('pe_crop', 'Crop')}"><div></div></div>
                        <div class="pe_action" id="pe_blur" onmouseover="showTitle(this)" data-title="${vtr('pe_blur', 'Blur')}"><div></div></div>
                        <div class="pe_action" id="pe_rotate" onmouseover="showTitle(this)" data-title="${vtr('pe_rotate', 'Rotate')}"><div></div></div>
                        <div class="pe_action" id="pe_auto" onmouseover="showTitle(this)" data-title="${vtr('pe_auto', 'Auto-correction')}"><div></div></div>
                        <div class="pe_action" id="pe_text" onmouseover="showTitle(this)" data-title="${vtr('pe_text', 'Add text')}"><div></div></div>
                    </div>
                </div>
                <div class="pe_tabs_panel" id="pe_tabs_panel" style="display:block; opacity:1;">
                    <div class="pe_undo_wrap">
                        <a id="pe_undo">${vtr('pe_undo', 'Reset')}</a>
                    </div>
                    <div class="pe_type_chooser">
                        <div class="pe_type_chooser_item selected" id="pe_type_filters">${vtr('pe_filters', 'Filters')}</div>
                        <div class="pe_type_chooser_item" id="pe_type_parameters">${vtr('pe_parameters', 'Parameters')}</div>
                    </div>
                    <div class="pe_filter_type_tabs">
                        <div id="pe_type_filters_tab" class="clear_fix" style="display:block;">
                            <div class="pe_filters_array clear_fix">${filterThumbsHtml}</div>
                        </div>
                        <div id="pe_type_parameters_tab" style="display:none;">
                            ${paramSliders}
                        </div>
                    </div>
                </div>
            </div>
        `;

        let peEngine = null;
        let isSaving = false;
        const paramSliderInstances = {};
        let activeFilterAmountSlider = null;
        let activePopover = null;

        const modal = new CMessageBox({
            title: vtr('pe_act_photoeditor', 'Photo editor'),
            body: bodyHtml,
            close_on_buttons: false,
            warn_on_exit: false,
            buttons: [tr('save'), tr('cancel')],
            callbacks: [
                function onSave() {
                    if (isSaving || !peEngine) return;
                    isSaving = true;
                    const saveBtn = modal.getNode().find('.ovk-diag-head-apply').nodes[0]
                        || modal.getNode().find('.ovk-diag-action .button, .ovk-diag-action button').nodes[0];
                    if (saveBtn && window.LoaderUtils) {
                        window.LoaderUtils.showInButton(saveBtn, { theme: 'baw' });
                    }

                    peEngine.exportBlob(async (blob) => {
                        try {
                            const res = await saveEditedPhotoAndReplace(ctx, blob);
                            window.removeEventListener('resize', onMobileResize);
                            peEngine.clean();
                            modal.close();
                            navigateAfterSave(ctx, res);
                        } catch (err) {
                            console.error('PhotoEditor save error:', err);
                            if (typeof window.NewNotification === 'function') {
                                window.NewNotification(tr('error'), String(err.message || err), null);
                            }
                            isSaving = false;
                            if (saveBtn && window.LoaderUtils) {
                                window.LoaderUtils.restoreButton(saveBtn);
                            }
                        }
                    });
                },
                function onCancel() {
                    window.removeEventListener('resize', onMobileResize);
                    if (peEngine) peEngine.clean();
                    modal.close();
                },
            ],
        });

        const rootNode = modal.getNode().nodes[0];
        if (!rootNode) return;
        const isMobile = isMobileEditorView();
        if (isMobile) {
            rootNode.classList.add('vkify-pe-dialog', 'ovk-msg-fullscreen');
            const head = rootNode.querySelector('.ovk-diag-head');
            const confirmBtn = rootNode.querySelector('.ovk-diag-action .button, .ovk-diag-action button');
            if (head && confirmBtn && !head.querySelector('.ovk-diag-head-apply')) {
                const applyBtn = document.createElement('button');
                applyBtn.type = 'button';
                applyBtn.className = 'ovk-diag-head-apply';
                applyBtn.setAttribute('aria-label', tr('save'));
                applyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><use href="#done-outline-24"></use></svg>';
                applyBtn.addEventListener('click', () => confirmBtn.click());
                head.appendChild(applyBtn);
            }
        } else {
            rootNode.style.width = '706px';
            rootNode.classList.add('vkify-pe-dialog', 'ovk-msg-sheet');
        }
        const diagBody = rootNode.querySelector('.ovk-diag-body');
        if (diagBody) {
            diagBody.style.padding = '0';
        }

        const canvasWrap = rootNode.querySelector('.pe_canvas_wrap');
        const loaderEl = rootNode.querySelector('#pe_loader');
        const undoLink = rootNode.querySelector('#pe_undo');
        const actionsEl = rootNode.querySelector('.pe_actions');
        const tabsPanel = rootNode.querySelector('#pe_tabs_panel');
        const closeSheet = () => rootNode.classList.remove('pe_mobile_sheet_open');
        if (isMobile && actionsEl && tabsPanel) {
            const tools = document.createElement('div');
            tools.className = 'pe_mobile_tools';
            tools.innerHTML = `
                <button type="button" data-panel="filters">${vtr('pe_filters', 'Filters')}</button>
                <button type="button" data-panel="parameters">${vtr('pe_parameters', 'Parameters')}</button>
            `;
            actionsEl.prepend(tools);
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'pe_mobile_sheet_close';
            dismiss.setAttribute('aria-label', tr('close'));
            dismiss.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><use href="#cancel-24"></use></svg>';
            tabsPanel.appendChild(dismiss);
            dismiss.addEventListener('click', closeSheet);
            tools.addEventListener('click', (e) => {
                const button = e.target.closest('[data-panel]');
                if (!button) return;
                const panel = button.dataset.panel;
                if (rootNode.classList.contains('pe_mobile_sheet_open')
                    && rootNode.dataset.pePanel === panel) {
                    closeSheet();
                    return;
                }
                rootNode.dataset.pePanel = panel;
                rootNode.querySelector(panel === 'filters' ? '#pe_type_filters' : '#pe_type_parameters')?.click();
                rootNode.classList.add('pe_mobile_sheet_open');
            });
            rootNode.querySelector('.pe_wrap')?.addEventListener('click', (e) => {
                if (e.target.closest('.pe_actions, .pe_action_bar, .pe_crop_area')) return;
                closeSheet();
            });
        }

        const peUndoStack = [];
        const peRedoStack = [];
        function capturePeSnapshot() {
            if (!peEngine) return null;
            return {
                mode: peEngine._mode,
                currentFilter: peEngine._currentFilter,
                currentFilterAmount: peEngine._currentFilterAmount,
                exposure: peEngine.getExposure(),
                contrast: peEngine.getContrast(),
                saturation: peEngine.getSaturation(),
                vignette: peEngine.getVignette(),
                sharpness: peEngine.getSharpness(),
                sepia: peEngine.getSepia(),
                autoEnabled: peEngine.isAuto(),
                rotation: peEngine.getRotation(),
                lastCrop: peEngine.getLastCrop(),
                blurSize: peEngine.blurSize || 0,
                blurPosition: (peEngine.blurPosition || [0.5, 0.5]).slice(),
                blurType: peEngine.blurType || 1,
                text: peEngine._text || '',
                fontType: peEngine._fontType ?? 1,
            };
        }
        function pushPeUndo(snap = capturePeSnapshot()) {
            if (!snap) return;
            const prev = peUndoStack[peUndoStack.length - 1];
            if (prev && JSON.stringify(prev) === JSON.stringify(snap)) return;
            peUndoStack.push(snap);
            if (peUndoStack.length > 40) peUndoStack.shift();
            peRedoStack.length = 0;
        }
        function applyPeSnapshot(snap) {
            if (!peEngine || !snap) return;
            hideCropOverlay();
            closePopover();
            while (peEngine.getRotation() !== snap.rotation) {
                peEngine.rotate();
            }
            peEngine.lastCrop = { ...snap.lastCrop };
            peEngine.autoEnabled = Boolean(snap.autoEnabled);
            peEngine._mode = snap.mode;
            peEngine._currentFilter = snap.currentFilter;
            peEngine._currentFilterAmount = snap.currentFilterAmount;
            peEngine.exposure = snap.exposure;
            peEngine.contrast = snap.contrast;
            peEngine.saturation = snap.saturation;
            peEngine.vignetteAmount = snap.vignette;
            peEngine.unsharpAmount = snap.sharpness;
            peEngine.sepiaAmount = snap.sepia;
            peEngine.blurSize = snap.blurSize;
            peEngine.blurPosition = snap.blurPosition.slice();
            peEngine.blurType = snap.blurType;
            peEngine._text = snap.text;
            peEngine._fontType = snap.fontType;
            peEngine._rebuildWorkingCanvas();
            peEngine.render();
            Object.entries(paramSliderInstances).forEach(([k, inst]) => {
                if (snap[k] !== undefined) inst.setValue(snap[k], false);
            });
            rootNode.querySelectorAll('.pe_filter_thumb').forEach((t) => {
                t.classList.toggle('pe_filter_selected', t.dataset.filter === snap.currentFilter);
                const oldSlider = t.querySelector('.pe_filter_amount_slider');
                if (oldSlider && t.dataset.filter !== snap.currentFilter) oldSlider.remove();
            });
            const isParamsMode = snap.mode === 'params';
            tabFiltersBtn?.classList.toggle('selected', !isParamsMode);
            tabParamsBtn?.classList.toggle('selected', isParamsMode);
            if (tabFiltersContent) tabFiltersContent.style.display = isParamsMode ? 'none' : 'block';
            if (tabParamsContent) tabParamsContent.style.display = isParamsMode ? 'block' : 'none';
            renderFilterThumbnails();
            updateStateIndicators();
        }

        function updateStateIndicators() {
            if (!peEngine) return;
            const crop = peEngine.getLastCrop();
            const hasCrop = crop.l + crop.r + crop.t + crop.b > 0.001;
            const blur = peEngine.getBlur();
            const hasBlur = Boolean(blur && blur.size > 0.001);
            const hasRot = peEngine.getRotation() > 0;
            const hasAuto = peEngine.isAuto();
            const txt = peEngine.getText();
            const hasText = Boolean(txt && txt.text);

            rootNode.querySelector('#pe_crop')?.classList.toggle('enabled', hasCrop);
            rootNode.querySelector('#pe_blur')?.classList.toggle('enabled', hasBlur);
            rootNode.querySelector('#pe_rotate')?.classList.toggle('enabled', hasRot);
            rootNode.querySelector('#pe_auto')?.classList.toggle('enabled', hasAuto);
            rootNode.querySelector('#pe_text')?.classList.toggle('enabled', hasText);

            const hasFilter = peEngine.getMode() === 'filter' && peEngine.getCurrentFilter().name !== 'original';
            const hasParams = peEngine.getMode() === 'params' && (
                Math.abs(peEngine.getExposure() - 0.5) > 0.01
                || Math.abs(peEngine.getContrast() - 0.5) > 0.01
                || Math.abs(peEngine.getSaturation() - 0.5) > 0.01
                || peEngine.getVignette() > 0.01
                || peEngine.getSharpness() > 0.01
                || peEngine.getSepia() > 0.01
            );
            const modified = hasCrop || hasBlur || hasRot || hasAuto || hasText || hasFilter || hasParams;
            if (undoLink) {
                undoLink.classList.toggle('enabled', modified);
            }
        }

        function renderFilterThumbnails() {
            if (!peEngine || !peEngine.workingCanvas) return;
            const thumbBoxes = rootNode.querySelectorAll('.pe_filter_thumb');
            const thumbDpr = Math.min(2, window.devicePixelRatio || 1);
            const thumbPx = Math.round(82 * thumbDpr);
            const smallSrc = document.createElement('canvas');
            smallSrc.width = thumbPx;
            smallSrc.height = thumbPx;
            const sCtx = smallSrc.getContext('2d');
            sCtx.imageSmoothingEnabled = true;
            sCtx.imageSmoothingQuality = 'high';
            const sw = peEngine.workingCanvas.width;
            const sh = peEngine.workingCanvas.height;
            const side = Math.min(sw, sh);
            sCtx.drawImage(peEngine.workingCanvas, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, thumbPx, thumbPx);

            const savedMode = peEngine._mode;
            const savedFilter = peEngine._currentFilter;
            const savedAmt = peEngine._currentFilterAmount;
            const savedText = peEngine._text;
            const savedBlur = peEngine.blurSize;
            peEngine._text = '';
            peEngine.blurSize = 0;

            thumbBoxes.forEach((box) => {
                const fId = box.dataset.filter;
                const cnv = box.querySelector('canvas');
                if (!cnv) return;
                cnv.width = thumbPx;
                cnv.height = thumbPx;
                peEngine._mode = 'filter';
                peEngine._currentFilter = fId;
                peEngine._currentFilterAmount = 0.85;
                peEngine._renderPipelineToCanvas(smallSrc, cnv);
            });

            peEngine._mode = savedMode;
            peEngine._currentFilter = savedFilter;
            peEngine._currentFilterAmount = savedAmt;
            peEngine._text = savedText;
            peEngine.blurSize = savedBlur;
        }

        const maxEditorW = isMobile ? Math.max(160, (window.innerWidth || 360) - 24) : 650;
        const maxEditorH = isMobile ? Math.max(96, (window.innerHeight || 640) - 150) : 520;
        const onMobileResize = () => {
            if (!peEngine?._imageLoaded || !rootNode.isConnected) return;
            const width = Math.max(160, (window.innerWidth || 360) - 24);
            const height = Math.max(96, (window.innerHeight || 640) - 150);
            if (peEngine.options.maxEditorSizeWidth === width && peEngine.options.maxEditorSizeHeight === height) return;
            hideCropOverlay();
            peEngine.options.maxEditorSizeWidth = width;
            peEngine.options.maxEditorSizeHeight = height;
            peEngine._rebuildWorkingCanvas();
            peEngine.render();
            renderFilterThumbnails();
        };
        const onPeKeyDown = (ke) => {
            if (!rootNode.isConnected) return;
            const activeTag = document.activeElement?.tagName;
            const inInput = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
            if (inInput) {
                if (ke.key === 'Escape') {
                    ke.preventDefault();
                    ke.stopPropagation();
                    document.activeElement?.blur?.();
                    closePopover();
                }
                return;
            }
            const mod = ke.ctrlKey || ke.metaKey;
            if (mod && ke.key.toLowerCase() === 'z' && !ke.shiftKey) {
                ke.preventDefault();
                ke.stopPropagation();
                if (peUndoStack.length > 0) {
                    const cur = capturePeSnapshot();
                    if (cur) peRedoStack.push(cur);
                    applyPeSnapshot(peUndoStack.pop());
                }
                return;
            }
            if ((mod && ke.key.toLowerCase() === 'y') || (mod && ke.shiftKey && ke.key.toLowerCase() === 'z')) {
                ke.preventDefault();
                ke.stopPropagation();
                if (peRedoStack.length > 0) {
                    const cur = capturePeSnapshot();
                    if (cur) peUndoStack.push(cur);
                    applyPeSnapshot(peRedoStack.pop());
                }
                return;
            }
            if (ke.key === 'Escape') {
                ke.preventDefault();
                ke.stopPropagation();
                if (cropEl) {
                    hideCropOverlay();
                } else if (activePopover) {
                    closePopover();
                } else if (rootNode.classList.contains('pe_mobile_sheet_open')) {
                    closeSheet();
                } else {
                    modal.close();
                }
                return;
            }
            if (ke.key === 'Enter') {
                if (cropEl) {
                    ke.preventDefault();
                    ke.stopPropagation();
                    cropEl.querySelector('#crop_apply')?.click();
                } else if (mod) {
                    ke.preventDefault();
                    ke.stopPropagation();
                    rootNode.querySelector('.ovk-diag-action .button, .ovk-diag-action button')?.click();
                }
                return;
            }
            if (!mod && !ke.altKey && ke.key.toLowerCase() === 'r') {
                ke.preventDefault();
                rootNode.querySelector('#pe_rotate')?.click();
            }
        };
        window.addEventListener('keydown', onPeKeyDown, true);
        if (isMobile) window.addEventListener('resize', onMobileResize);
        const originalClose = modal.close.bind(modal);
        modal.close = (...args) => {
            window.removeEventListener('resize', onMobileResize);
            window.removeEventListener('keydown', onPeKeyDown, true);
            peEngine?.clean();
            return originalClose(...args);
        };

        peEngine = new VkPhotoEditEngine(
            canvasWrap,
            ctx.largeSrc,
            ctx.fullSrc,
            { maxEditorSizeWidth: maxEditorW, maxEditorSizeHeight: maxEditorH },
            function onInit() {
                if (loaderEl) loaderEl.style.display = 'none';
                peEngine.show();
                if (actionsEl) actionsEl.style.opacity = '1';
                renderFilterThumbnails();
                updateStateIndicators();
            },
            function onSizeUpdate() {}
        );
        ensurePeFonts().then(() => peEngine && peEngine.render());

        // Filter thumb selection & amount slider
        rootNode.querySelectorAll('.pe_filter_thumb').forEach((thumb) => {
            thumb.addEventListener('click', () => {
                const filterId = thumb.dataset.filter;
                if (peEngine?.getCurrentFilter().name !== filterId) {
                    pushPeUndo();
                }
                rootNode.querySelectorAll('.pe_filter_thumb').forEach((t) => {
                    t.classList.remove('pe_filter_selected');
                    const oldSlider = t.querySelector('.pe_filter_amount_slider');
                    if (oldSlider) oldSlider.remove();
                });
                if (activeFilterAmountSlider) {
                    activeFilterAmountSlider.destroy();
                    activeFilterAmountSlider = null;
                }
                thumb.classList.add('pe_filter_selected');

                if (filterId !== 'original') {
                    const sliderWrap = document.createElement('div');
                    sliderWrap.className = 'pe_filter_amount_slider';
                    const innerSlider = document.createElement('div');
                    innerSlider.className = 'slider';
                    sliderWrap.appendChild(innerSlider);
                    thumb.appendChild(sliderWrap);

                    activeFilterAmountSlider = createPeSlider(innerSlider, {
                        width: 68,
                        value: peEngine.getCurrentFilter().amount || 0.75,
                        fireChangeEventOnInit: true,
                        onChange: (val) => {
                            peEngine.applyFilter(filterId, val);
                            updateStateIndicators();
                        },
                    });
                } else {
                    peEngine.applyFilter('original', 0.75);
                    updateStateIndicators();
                }
            });
        });

        // Init parameter sliders
        rootNode.querySelectorAll('.pe_params_slider').forEach((sliderEl) => {
            const param = sliderEl.dataset.param;
            const defVal = Number(sliderEl.dataset.default || 0);
            const method = 'set' + param.charAt(0).toUpperCase() + param.slice(1);
            const startSnap = () => pushPeUndo();
            sliderEl.addEventListener('mousedown', startSnap, true);
            sliderEl.addEventListener('touchstart', startSnap, { capture: true, passive: true });
            paramSliderInstances[param] = createPeSlider(sliderEl, {
                width: 185,
                value: defVal,
                formatHint: (v) => `${Math.round(v * 100)}%`,
                onChange: (val) => {
                    if (peEngine && typeof peEngine[method] === 'function') {
                        peEngine[method](val);
                        updateStateIndicators();
                    }
                },
            });
        });

        // Tab switcher (Filters / Parameters)
        const tabFiltersBtn = rootNode.querySelector('#pe_type_filters');
        const tabParamsBtn = rootNode.querySelector('#pe_type_parameters');
        const tabFiltersContent = rootNode.querySelector('#pe_type_filters_tab');
        const tabParamsContent = rootNode.querySelector('#pe_type_parameters_tab');

        tabFiltersBtn?.addEventListener('click', () => {
            tabFiltersBtn.classList.add('selected');
            tabParamsBtn?.classList.remove('selected');
            if (tabFiltersContent) tabFiltersContent.style.display = 'block';
            if (tabParamsContent) tabParamsContent.style.display = 'none';
            peEngine.applyFilter();
            updateStateIndicators();
        });

        tabParamsBtn?.addEventListener('click', () => {
            tabParamsBtn.classList.add('selected');
            tabFiltersBtn?.classList.remove('selected');
            if (tabParamsContent) tabParamsContent.style.display = 'block';
            if (tabFiltersContent) tabFiltersContent.style.display = 'none';
            peEngine.applyParameters();
            updateStateIndicators();
        });

        // Undo / Reset all
        undoLink?.addEventListener('click', (e) => {
            e.preventDefault();
            const wasParamsTab = tabParamsBtn?.classList.contains('selected');
            pushPeUndo();
            hideCropOverlay();
            closePopover();
            peEngine.restoreAll();
            Object.entries(paramSliderInstances).forEach(([k, inst]) => {
                const def = k === 'exposure' || k === 'contrast' || k === 'saturation' ? 0.5 : 0;
                inst.setValue(def, false);
            });
            rootNode.querySelector('#pe_filter_original')?.click();
            if (wasParamsTab) {
                peEngine.applyParameters();
            }
            renderFilterThumbnails();
            updateStateIndicators();
        });

        // Crop overlay
        let cropEl = null;
        function hideCropOverlay() {
            if (cropEl && cropEl.parentNode) {
                cropEl.parentNode.removeChild(cropEl);
            }
            cropEl = null;
        }

        function toggleCropOverlay() {
            if (cropEl) {
                hideCropOverlay();
                return;
            }
            closePopover();
            peEngine.resetCrop();
            renderFilterThumbnails();

            const [cw, ch] = peEngine.getSize();
            cropEl = document.createElement('div');
            cropEl.className = 'pe_crop_area visible';
            cropEl.style.width = `${cw}px`;
            cropEl.style.height = `${ch}px`;

            const sides = ['top', 'left', 'bottom', 'right', 'top_left', 'top_right', 'bottom_left', 'bottom_right'];
            cropEl.innerHTML = sides.map((s) => `<div class="pe_side_handle" data-side="${s}" id="pe_crop_side_handle_${s}"></div>`).join('') + `
                <div class="pe_crop_apply_wrap">
                    <div class="pe_crop_apply_button" id="crop_apply"></div>
                    <div class="pe_crop_apply_button" id="crop_reset"></div>
                </div>
            `;
            canvasWrap.appendChild(cropEl);

            const curCrop = {
                l: Math.round(cw * 0.06),
                r: Math.round(cw * 0.06),
                t: Math.round(ch * 0.06),
                b: Math.round(ch * 0.06),
            };

            function syncCropBorders() {
                cropEl.style.borderLeftWidth = `${curCrop.l}px`;
                cropEl.style.borderRightWidth = `${curCrop.r}px`;
                cropEl.style.borderTopWidth = `${curCrop.t}px`;
                cropEl.style.borderBottomWidth = `${curCrop.b}px`;
            }
            syncCropBorders();

            cropEl.querySelector('#crop_apply')?.addEventListener('mousedown', (e) => e.stopPropagation());
            cropEl.querySelector('#crop_reset')?.addEventListener('mousedown', (e) => e.stopPropagation());
            cropEl.querySelector('#crop_apply')?.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
            cropEl.querySelector('#crop_reset')?.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

            cropEl.querySelector('#crop_apply')?.addEventListener('click', (e) => {
                e.stopPropagation();
                pushPeUndo();
                peEngine.crop(curCrop.l / cw, curCrop.r / cw, curCrop.t / ch, curCrop.b / ch, false);
                hideCropOverlay();
                renderFilterThumbnails();
                updateStateIndicators();
            });

            cropEl.querySelector('#crop_reset')?.addEventListener('click', (e) => {
                e.stopPropagation();
                pushPeUndo();
                peEngine.resetCrop();
                hideCropOverlay();
                renderFilterThumbnails();
                updateStateIndicators();
            });

            cropEl.querySelectorAll('.pe_side_handle').forEach((handle) => {
                const onHandleStart = (e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    const side = handle.dataset.side;
                    cropEl.classList.add('no_actions');

                    const onMove = (me) => {
                        if (me.cancelable) me.preventDefault();
                        const pt = getEventPoint(me);
                        const rect = canvasWrap.getBoundingClientRect();
                        const x = Math.max(0, Math.min(cw, pt.clientX - rect.left));
                        const y = Math.max(0, Math.min(ch, pt.clientY - rect.top));
                        const minBox = 48;
                        if (side.includes('left')) curCrop.l = Math.min(x, cw - curCrop.r - minBox);
                        if (side.includes('right')) curCrop.r = Math.min(cw - x, cw - curCrop.l - minBox);
                        if (side.includes('top')) curCrop.t = Math.min(y, ch - curCrop.b - minBox);
                        if (side.includes('bottom')) curCrop.b = Math.min(ch - y, ch - curCrop.t - minBox);
                        syncCropBorders();
                    };
                    const onUp = () => {
                        cropEl?.classList.remove('no_actions');
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        window.removeEventListener('touchmove', onMove);
                        window.removeEventListener('touchend', onUp);
                        window.removeEventListener('touchcancel', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                    window.addEventListener('touchmove', onMove, { passive: false });
                    window.addEventListener('touchend', onUp);
                    window.addEventListener('touchcancel', onUp);
                };
                handle.addEventListener('mousedown', onHandleStart);
                handle.addEventListener('touchstart', onHandleStart, { passive: false });
            });

            const onCropBoxStart = (e) => {
                if (e.target !== cropEl) return;
                if (e.cancelable) e.preventDefault();
                const startPt = getEventPoint(e);
                const orig = { ...curCrop };
                cropEl.classList.add('active', 'no_actions');

                const onMove = (me) => {
                    if (me.cancelable) me.preventDefault();
                    const pt = getEventPoint(me);
                    const dx = pt.clientX - startPt.clientX;
                    const dy = pt.clientY - startPt.clientY;
                    const boxW = cw - orig.l - orig.r;
                    const boxH = ch - orig.t - orig.b;
                    curCrop.l = Math.max(0, Math.min(cw - boxW, orig.l + dx));
                    curCrop.r = cw - boxW - curCrop.l;
                    curCrop.t = Math.max(0, Math.min(ch - boxH, orig.t + dy));
                    curCrop.b = ch - boxH - curCrop.t;
                    syncCropBorders();
                };
                const onUp = () => {
                    cropEl?.classList.remove('active', 'no_actions');
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('touchmove', onMove);
                    window.removeEventListener('touchend', onUp);
                    window.removeEventListener('touchcancel', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onUp);
                window.addEventListener('touchcancel', onUp);
            };
            cropEl.addEventListener('mousedown', onCropBoxStart);
            cropEl.addEventListener('touchstart', onCropBoxStart, { passive: false });
        }

        function closePopover() {
            if (activePopover) {
                if (activePopover.cleanup) activePopover.cleanup();
                if (activePopover.el && activePopover.el.parentNode) {
                    activePopover.el.parentNode.removeChild(activePopover.el);
                }
                activePopover = null;
            }
            actionsEl?.classList.remove('active');
            canvasWrap?.classList.remove('blur_pos');
        }

        // Action buttons
        rootNode.querySelector('#pe_crop')?.addEventListener('click', () => toggleCropOverlay());

        rootNode.querySelector('#pe_rotate')?.addEventListener('click', () => {
            pushPeUndo();
            hideCropOverlay();
            peEngine.rotate();
            renderFilterThumbnails();
            updateStateIndicators();
        });

        rootNode.querySelector('#pe_auto')?.addEventListener('click', () => {
            pushPeUndo();
            peEngine.applyAuto();
            renderFilterThumbnails();
            updateStateIndicators();
        });

        rootNode.querySelector('#pe_blur')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activePopover && activePopover.type === 'blur') {
                closePopover();
                return;
            }
            hideCropOverlay();
            closePopover();

            const btn = e.currentTarget;
            let blur = peEngine.getBlur();
            if (!blur || !blur.size) {
                pushPeUndo();
                peEngine.setBlur(0.5, [0.5, 0.5], 1);
                blur = peEngine.getBlur();
                updateStateIndicators();
            }

            const pop = document.createElement('div');
            pop.className = 'pe_blur_input pe_action_bar';
            pop.style.opacity = '0.95';
            pop.style.left = `${actionsEl.offsetLeft + actionsEl.offsetWidth + 8}px`;
            pop.style.bottom = `${Math.round(actionsEl.offsetHeight + 24 - btn.offsetTop - btn.offsetHeight / 2 - 14)}px`;
            pop.innerHTML = `
                <div class="pe_blur_slider"></div>
                <div class="pe_blurtype_changer ${blur.type === 2 ? 'linear' : ''}" title="${vtr('pe_change_blur_type', 'Change blur mode')}"></div>
            `;
            rootNode.querySelector('.pe_wrap').appendChild(pop);
            actionsEl.classList.add('active');
            canvasWrap.classList.add('blur_pos');

            const sliderInst = createPeSlider(pop.querySelector('.pe_blur_slider'), {
                width: '100%',
                value: blur.size || 0.5,
                onChange: (val) => {
                    const curB = peEngine.getBlur() || { position: [0.5, 0.5], type: 1 };
                    peEngine.setBlur(val, curB.position, curB.type);
                    updateStateIndicators();
                },
            });

            const typeBtn = pop.querySelector('.pe_blurtype_changer');
            typeBtn.addEventListener('click', () => {
                pushPeUndo();
                const isLinear = typeBtn.classList.toggle('linear');
                const curB = peEngine.getBlur() || { size: 0.5, position: [0.5, 0.5] };
                peEngine.setBlur(curB.size, curB.position, isLinear ? 2 : 1);
            });

            const onCanvasDown = (ce) => {
                pushPeUndo();
                const setPos = (ev) => {
                    const pt = getEventPoint(ev);
                    const rect = canvasWrap.getBoundingClientRect();
                    let px = Math.max(0, Math.min(1, (pt.clientX - rect.left) / (rect.width || 1)));
                    let py = Math.max(0, Math.min(1, (pt.clientY - rect.top) / (rect.height || 1)));
                    if (Math.abs(px - 0.5) < 0.03) px = 0.5;
                    if (Math.abs(py - 0.5) < 0.03) py = 0.5;
                    const curB = peEngine.getBlur() || { size: 0.5, type: 1 };
                    peEngine.setBlur(curB.size, [px, py], curB.type);
                };
                setPos(ce);
                const onMove = (me) => {
                    if (me.cancelable) me.preventDefault();
                    setPos(me);
                };
                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('touchmove', onMove);
                    window.removeEventListener('touchend', onUp);
                    window.removeEventListener('touchcancel', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onUp);
                window.addEventListener('touchcancel', onUp);
            };
            canvasWrap.addEventListener('mousedown', onCanvasDown);
            canvasWrap.addEventListener('touchstart', onCanvasDown, { passive: false });

            activePopover = {
                type: 'blur',
                el: pop,
                cleanup: () => {
                    sliderInst?.destroy();
                    canvasWrap.removeEventListener('mousedown', onCanvasDown);
                    canvasWrap.removeEventListener('touchstart', onCanvasDown);
                },
            };
        });

        rootNode.querySelector('#pe_text')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activePopover && activePopover.type === 'text') {
                closePopover();
                return;
            }
            hideCropOverlay();
            closePopover();

            const btn = e.currentTarget;
            const curText = peEngine.getText();
            const pop = document.createElement('div');
            pop.className = 'pe_text_input pe_action_bar';
            pop.style.opacity = '0.95';
            pop.style.left = `${actionsEl.offsetLeft + actionsEl.offsetWidth + 8}px`;
            pop.style.bottom = `${24}px`;
            pop.innerHTML = `
                <textarea placeholder="${vtr('pe_text_placeholder', 'Enter text...')}"></textarea>
                <div class="pe_text_font_changer ${curText.font === 0 ? 'impact' : ''}" title="${vtr('pe_change_font', 'Change font')}"></div>
            `;
            rootNode.querySelector('.pe_wrap').appendChild(pop);
            actionsEl.classList.add('active');

            const ta = pop.querySelector('textarea');
            const fontBtn = pop.querySelector('.pe_text_font_changer');
            ta.setAttribute('data-no-autosize', '');
            ta.value = curText.text || '';
            pushPeUndo();

            ta.addEventListener('input', () => {
                peEngine.setText(ta.value, fontBtn.classList.contains('impact') ? 0 : 1);
                updateStateIndicators();
            });
            fontBtn.addEventListener('click', () => {
                const isImpact = fontBtn.classList.toggle('impact');
                peEngine.setText(ta.value, isImpact ? 0 : 1);
                updateStateIndicators();
            });
            ta.focus();

            activePopover = { type: 'text', el: pop, cleanup: null };
        });
    }

    /* ==========================================================================
       2. Stickers, Text & Drawing Editor (spe.js port)
       ========================================================================== */

    async function loadUserStickerPacks() {
        let packs = [];
        try {
            if (window.OVKAPI && typeof window.OVKAPI.call === 'function') {
                const res = await window.OVKAPI.call('stickers.get', {});
                if (res && Array.isArray(res.items)) {
                    packs = res.items;
                }
            }
        } catch (_) {}

        if (packs.length === 0 && Array.isArray(window.myStickerPacks)) {
            packs = window.myStickerPacks;
        }
        return packs;
    }

    async function openVkStickersEditor(photoPrettyId, opts = {}) {
        ensurePeFonts();
        let ctx = await resolvePhotoContext(photoPrettyId, opts);
        if (!ctx) return;

        let pvWrapper = (!opts.isAvatar && (ctx.containerRoot.querySelector('.pv_wrapper') || document.querySelector('.pv_wrapper'))) || null;
        if (!pvWrapper && typeof PhotoViewer === 'function' && typeof PhotoViewer.openById === 'function') {
            await PhotoViewer.openById(photoPrettyId);
            await new Promise((r) => setTimeout(r, 120));
            ctx = await resolvePhotoContext(photoPrettyId, opts);
            if (!ctx) return;
            pvWrapper = ctx.containerRoot.querySelector('.pv_wrapper') || document.querySelector('.pv_wrapper');
            const waitImg = pvWrapper ? pvWrapper.querySelector('#ovk-photo-img, .pv_photo img') : null;
            if (waitImg && (!waitImg.complete || !waitImg.naturalWidth)) {
                await new Promise((resolve) => {
                    const done = () => resolve();
                    waitImg.addEventListener('load', done, { once: true });
                    waitImg.addEventListener('error', done, { once: true });
                    setTimeout(done, 1500);
                });
            }
        }
        if (!pvWrapper) {
            return openVkPhotoEditor(photoPrettyId, opts);
        }

        const pvPhoto = pvWrapper.querySelector('.pv_photo');
        const pvRight = pvWrapper.querySelector('.pv_right');
        const pvBottomInfo = pvWrapper.querySelector('.pv_bottom_info');
        const imgEl = pvPhoto ? pvPhoto.querySelector('img') : null;
        if (!pvPhoto || !pvRight || !imgEl) return;
        const mobileEditing = isMobileEditorView();

        // Avoid double opening
        if (pvWrapper.classList.contains('pv_pe')) return;
        pvWrapper.classList.add('pv_pe');
        const previousImageTransform = imgEl.style.transform;
        if (mobileEditing) imgEl.style.transform = 'none';

        const packs = await loadUserStickerPacks();
        const stickersMap = {};
        const stickerPacksData = {};

        packs.forEach((p) => {
            const pId = String(p.id);
            stickerPacksData[pId] = (p.stickers || []).map((stk) => {
                const rawId = stk.id || stk.sticker_id;
                const sId = `${pId}_${rawId}`;
                const u128 = stk.photo_128 || `/sticker/${pId}/${rawId}_128.webp`;
                const u256 = stk.photo_256 || u128;
                const u512 = stk.photo_512 || `/sticker/${pId}/${rawId}_512.webp`;
                let animUrl = stk.animation_url
                    || (stk.animations && stk.animations[0]?.url)
                    || (u128.endsWith('.json') ? u128 : '')
                    || ((stk.is_animated || p.is_animated) ? `/sticker/${pId}/${rawId}_512.json` : '');
                const isLottie = Boolean(animUrl || stk.is_animated || p.is_animated || u128.endsWith('.json'));
                if (isLottie && !animUrl && pId && rawId) {
                    animUrl = `/sticker/${pId}/${rawId}_512.json`;
                }
                const item = {
                    id: sId,
                    rawId,
                    packId: pId,
                    isLottie,
                    animationUrl: animUrl,
                    sizes: { 128: u128, 256: u256, 512: u512 },
                };
                stickersMap[sId] = item;
                return item;
            });
        });

        const packTabsHtml = packs.map((p, idx) => {
            const firstStk = (p.stickers && p.stickers[0]) || null;
            const firstRawId = firstStk ? (firstStk.id || firstStk.sticker_id) : p.id;
            const animUrl = p.animation_url
                || (firstStk && (firstStk.animation_url || (firstStk.animations && firstStk.animations[0]?.url) || (firstStk.is_animated ? `/sticker/${p.id}/${firstRawId}_512.json` : '')))
                || (p.is_animated ? `/sticker/${p.id}/${firstRawId}_512.json` : '');
            const isLottie = Boolean(animUrl || p.is_animated || (firstStk && firstStk.is_animated) || (p.photo_128 && p.photo_128.endsWith('.json')) || (firstStk && firstStk.photo_128 && firstStk.photo_128.endsWith('.json')));
            const finalAnimUrl = animUrl
                || (p.photo_128 && p.photo_128.endsWith('.json') ? p.photo_128 : '')
                || (firstStk && firstStk.photo_128 && firstStk.photo_128.endsWith('.json') ? firstStk.photo_128 : '');
            const iconUrl = p.icon || p.photo_128 || (firstStk ? (firstStk.photo_128 || `/sticker/${p.id}/${firstRawId}_128.webp`) : '');
            return `
                <div class="pe_sticker_pack_tab ${idx === 0 ? 'pe_selected' : ''}" id="pe_stickers_pack_tab_${p.id}" data-pack-id="${p.id}" title="${p.title || p.name || ''}">
                    ${isLottie && finalAnimUrl
                        ? `<div class="sticker-lottie-thumb pe_lottie_thumb" data-anim-url="${finalAnimUrl}"></div>`
                        : (iconUrl ? `<img src="${iconUrl}" alt="" />` : '')}
                </div>
            `;
        }).join('');

        const pePanel = document.createElement('div');
        pePanel.className = 'pe_editor';
        pePanel.innerHTML = `
            <div class="pe_tabs clear_fix">
                <div class="pe_tab pe_selected" id="pe_tab_stickers" data-tab="stickers">
                    <div class="pe_tab_icon"></div>
                    <div class="pe_tab_text">${vtr('pe_tab_stickers', 'Stickers')}</div>
                </div>
                <div class="pe_tab" id="pe_tab_text" data-tab="text">
                    <div class="pe_tab_icon"></div>
                    <div class="pe_tab_text">${vtr('pe_tab_text', 'Text')}</div>
                </div>
                <div class="pe_tab" id="pe_tab_draw" data-tab="draw">
                    <div class="pe_tab_icon"></div>
                    <div class="pe_tab_text">${vtr('pe_tab_draw', 'Draw')}</div>
                </div>
            </div>

            <div class="pe_tab_content" id="pe_tab_content_stickers">
                <div class="pe_sticker_packs_tabs">
                    <div class="pe_sticker_packs_slider_cont">${packTabsHtml}</div>
                </div>
                <div class="pe_sticker_pack_list_wrap">
                    <div class="pe_sticker_pack_list clear_fix"></div>
                </div>
            </div>

            <div class="pe_tab_content" id="pe_tab_content_text" style="display:none;">
                <div class="pe_new_text_wrap">
                    <button type="button" class="button button_gray button_wide" id="pe_add_text_btn">
                        <span class="pe_new_text_icon"></span>${vtr('pe_new_text', 'Add text')}
                    </button>
                </div>
                <div class="pe_text_fonts">
                    <div class="pe_label">${vtr('pe_font', 'Font')}</div>
                    <div class="radiobtn on _pe_text_font_rdbtn" id="pe_font_roboto" data-font="Roboto, sans-serif">Roboto</div>
                    <div class="radiobtn _pe_text_font_rdbtn" id="pe_font_lobster" data-font="'Lobster', cursive">Lobster</div>
                    <div class="radiobtn _pe_text_font_rdbtn" id="pe_font_impact" data-font="Impact, 'Arial Black', sans-serif">Impact</div>
                </div>
                <div class="pe_text_slider_wrap">
                    <div class="pe_label">${vtr('pe_size', 'Size')}</div>
                    <div class="pe_text_size_slider"></div>
                </div>
                <div class="pe_label">${vtr('pe_color', 'Color')}</div>
                <div id="pe_text_color_picker" class="pe_drawing_colors_wrap clear_fix"></div>
            </div>

            <div class="pe_tab_content" id="pe_tab_content_draw" style="display:none;">
                <canvas class="pe_drawing_preview" width="220" height="70"></canvas>
                <div class="pe_drawing_sliders clear_fix">
                    <div class="pe_drawing_slider_wrap">
                        <div class="pe_label">${vtr('pe_size', 'Size')}</div>
                        <div class="pe_drawing_width_slider"></div>
                    </div>
                    <div class="pe_drawing_slider_wrap">
                        <div class="pe_label">${vtr('pe_intensity', 'Intensity')}</div>
                        <div class="pe_drawing_intensity_slider"></div>
                    </div>
                </div>
                <div class="pe_label">${vtr('pe_color', 'Color')}</div>
                <div id="pe_drawing_color_picker" class="pe_drawing_colors_wrap clear_fix"></div>
                <div class="pe_drawing_undo _pe_drawing_undo" style="display:none;">${vtr('pe_drawing_undo', 'Undo last action')}</div>
            </div>

            <div class="pe_bottom_actions">
                <button type="button" class="button button_light button_disabled pe_spe_undo_btn" id="pe_spe_undo_btn" title="${vtr('pe_drawing_undo', 'Undo last action')}" aria-label="${vtr('pe_drawing_undo', 'Undo last action')}">
                    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h8a4 4 0 1 1 0 8H8"/><polyline points="7 5 4 8 7 11"/></svg>
                </button>
                <button type="button" class="button button_light" id="pe_spe_cancel_btn">${tr('cancel')}</button>
                <button type="button" class="button _pe_save_btn button_disabled" id="pe_spe_save_btn">${tr('save')}</button>
            </div>
        `;
        if (mobileEditing) {
            pePanel.querySelectorAll('.pe_tab_content').forEach((content) => {
                const dismiss = document.createElement('button');
                dismiss.type = 'button';
                dismiss.className = 'pe_mobile_sheet_close';
                dismiss.setAttribute('aria-label', tr('close'));
                dismiss.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><use href="#cancel-24"></use></svg>';
                dismiss.addEventListener('click', () => pvWrapper.classList.remove('pv_pe_sheet_open'));
                content.prepend(dismiss);
            });
            const cancelBtnEl = pePanel.querySelector('#pe_spe_cancel_btn');
            const undoBtnEl = pePanel.querySelector('#pe_spe_undo_btn');
            const saveBtnEl = pePanel.querySelector('#pe_spe_save_btn');
            if (cancelBtnEl) {
                cancelBtnEl.classList.remove('button', 'button_light');
                cancelBtnEl.classList.add('pe_spe_cancel_icon_btn');
                cancelBtnEl.setAttribute('aria-label', tr('cancel'));
                cancelBtnEl.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor"><use href="#arrow-left-outline-28"></use></svg>';
            }
            undoBtnEl?.classList.replace('button_light', 'button_baw');
            saveBtnEl?.classList.add('button_baw', 'button_baw_inverted');
        }

        const prevPvRightDisplay = pvRight.style.display;
        if (mobileEditing) {
            pvRight.style.display = 'flex';
        }
        // Hide existing right panel children and insert pe_editor
        const hiddenRightNodes = Array.from(pvRight.children);
        hiddenRightNodes.forEach((n) => { n.style.display = 'none'; });
        pvRight.appendChild(pePanel);

        // Compute exact rendered image box inside .pv_photo (accounting for object-fit: contain)
        function computeDisplayedImageBox() {
            const photoRect = pvPhoto.getBoundingClientRect();
            const imgRect = imgEl.getBoundingClientRect();
            const natW = imgEl.naturalWidth || imgRect.width || photoRect.width || 1;
            const natH = imgEl.naturalHeight || imgRect.height || photoRect.height || 1;
            const imgStyle = window.getComputedStyle(imgEl);
            const objFit = imgStyle.objectFit || 'fill';

            let boxW = imgRect.width;
            let boxH = imgRect.height;
            let boxLeft = imgRect.left - photoRect.left;
            let boxTop = imgRect.top - photoRect.top;

            if (objFit === 'contain' || objFit === 'scale-down') {
                const ratio = natW / natH;
                const elemRatio = boxW / (boxH || 1);
                let renderW = boxW;
                let renderH = boxH;
                if (elemRatio > ratio) {
                    renderH = boxH;
                    renderW = boxH * ratio;
                } else {
                    renderW = boxW;
                    renderH = boxW / ratio;
                }
                if (objFit === 'scale-down' && renderW > natW) {
                    renderW = natW;
                    renderH = natH;
                }
                boxLeft += (boxW - renderW) / 2;
                boxTop += (boxH - renderH) / 2;
                boxW = renderW;
                boxH = renderH;
            }

            return {
                dispW: Math.max(1, Math.round(boxW)),
                dispH: Math.max(1, Math.round(boxH)),
                offsetX: Math.round(boxLeft),
                offsetY: Math.round(boxTop),
            };
        }

        let { dispW, dispH, offsetX, offsetY } = computeDisplayedImageBox();

        const canvasOverlay = document.createElement('div');
        canvasOverlay.className = 'pe_canvas';
        canvasOverlay.style.width = `${dispW}px`;
        canvasOverlay.style.height = `${dispH}px`;
        canvasOverlay.style.left = `${offsetX}px`;
        canvasOverlay.style.top = `${offsetY}px`;
        canvasOverlay.innerHTML = `
            <div class="pe_canvas_sticker_layers"></div>
            <canvas class="pe_drawing_canvas" width="${dispW}" height="${dispH}"></canvas>
            <div class="pe_canvas_text_layers"></div>
            <div class="pe_snap_guide pe_snap_guide_v"></div>
            <div class="pe_snap_guide pe_snap_guide_h"></div>
            <div class="pe_layer_delete_zone"><div class="pe_layer_delete_icon"></div></div>
        `;
        pvPhoto.appendChild(canvasOverlay);

        const stickerLayersEl = canvasOverlay.querySelector('.pe_canvas_sticker_layers');
        const textLayersEl = canvasOverlay.querySelector('.pe_canvas_text_layers');
        const drawingCanvasEl = canvasOverlay.querySelector('.pe_drawing_canvas');
        const snapGuideV = canvasOverlay.querySelector('.pe_snap_guide_v');
        const snapGuideH = canvasOverlay.querySelector('.pe_snap_guide_h');
        const deleteZoneEl = canvasOverlay.querySelector('.pe_layer_delete_zone');
        const drawingCtx = drawingCanvasEl.getContext('2d');

        // Bottom info bar delete button (icon button on mobile, text link on desktop)
        const deleteSelectedBtn = document.createElement(mobileEditing ? 'button' : 'a');
        if (mobileEditing) {
            deleteSelectedBtn.type = 'button';
            deleteSelectedBtn.className = 'button button_baw pe_delete_selected_btn';
            deleteSelectedBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
            pePanel.querySelector('.pe_bottom_actions')?.insertBefore(
                deleteSelectedBtn,
                pePanel.querySelector('#pe_spe_undo_btn')
            );
        } else {
            deleteSelectedBtn.className = 'pe_delete_selected_btn';
            pvBottomInfo?.appendChild(deleteSelectedBtn);
        }
        deleteSelectedBtn.style.display = 'none';

        let currentTab = 'stickers';
        let selectedLayerEl = null;
        let selectionBoxEl = null;
        let activeTextareaEl = null;
        const drawings = [];
        const speUndoStack = [];
        const speRedoStack = [];

        let currentTextFont = 'Roboto, sans-serif';
        let currentTextSize = 36;
        let currentTextColorIdx = 7;

        let drawingLineWidth = 8;
        let drawingLineOpacity = 1;
        let drawingLineColor = AVAILABLE_COLORS[0];

        const saveBtn = pePanel.querySelector('#pe_spe_save_btn');
        const globalUndoBtn = pePanel.querySelector('#pe_spe_undo_btn');
        const undoDrawBtn = pePanel.querySelector('._pe_drawing_undo');

        function applyTextFontStyleClasses(el, fontStr) {
            if (!el) return;
            const low = String(fontStr || '').toLowerCase();
            const isImpact = low.includes('impact');
            const isLobster = low.includes('lobster');
            el.classList.toggle('pe_text_impact_style', isImpact);
            el.classList.toggle('pe_text_lobster_style', isLobster);
            el.classList.toggle('pe_text_roboto_style', !isImpact && !isLobster);
        }

        function mountStickerLayerContent(layer, { stickerUrl = '', animationUrl = '' }) {
            layer.dataset.stickerUrl = stickerUrl || '';
            if (animationUrl) {
                layer.dataset.animationUrl = animationUrl;
            } else {
                delete layer.dataset.animationUrl;
            }
            if (animationUrl && window.lottie) {
                layer.style.backgroundImage = '';
                const lottieHost = document.createElement('div');
                lottieHost.className = 'pe_layer_lottie_host';
                layer.appendChild(lottieHost);
                try {
                    const anim = window.lottie.loadAnimation({
                        container: lottieHost,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: animationUrl,
                    });
                    layer._lottieAnim = anim;
                    return;
                } catch (_) {
                    lottieHost.remove();
                }
            }
            if (stickerUrl) {
                layer.style.backgroundImage = `url('${stickerUrl}')`;
            }
        }

        function captureSpeState() {
            const stickers = Array.from(stickerLayersEl.children).map((el) => ({
                stickerUrl: el.dataset.stickerUrl || '',
                animationUrl: el.dataset.animationUrl || '',
                left: el.offsetLeft,
                top: el.offsetTop,
                width: el.offsetWidth,
                height: el.offsetHeight,
                rotation: el.dataset.rotation || '0',
            }));
            const texts = Array.from(textLayersEl.children)
                .filter((el) => el.dataset.isPlaceholder !== '1')
                .map((el) => {
                    const inner = el.querySelector('.pe_layer_text_inner');
                    return {
                        text: inner?.textContent || '',
                        fontFamily: inner?.style.fontFamily || 'Roboto, sans-serif',
                        fontWeight: inner?.style.fontWeight || '',
                        fontSize: inner?.style.fontSize || '36px',
                        color: inner?.style.color || '#FFFFFF',
                        colorIndex: inner?.dataset.colorIndex || '7',
                        left: el.offsetLeft,
                        top: el.offsetTop,
                        rotation: el.dataset.rotation || '0',
                    };
                });
            const drawCopy = drawings.map((d) => ({
                color: d.color,
                width: d.width,
                opacity: d.opacity,
                path: d.path.map((pt) => [pt[0], pt[1]]),
            }));
            return { stickers, texts, drawings: drawCopy };
        }

        function updateSaveButtonState() {
            const hasRealTexts = Array.from(textLayersEl.children).some((el) => el.dataset.isPlaceholder !== '1')
                || Boolean(activeTextareaEl && activeTextareaEl.value.trim());
            const changed = stickerLayersEl.children.length > 0 || hasRealTexts || drawings.length > 0;
            saveBtn.classList.toggle('button_disabled', !changed);
            globalUndoBtn?.classList.toggle('button_disabled', speUndoStack.length === 0);
            if (undoDrawBtn) {
                undoDrawBtn.style.display = (drawings.length > 0 || speUndoStack.length > 0) ? 'block' : 'none';
            }
        }

        function pushSpeUndo(snap = captureSpeState()) {
            if (!snap) return;
            const prev = speUndoStack[speUndoStack.length - 1];
            if (prev && JSON.stringify(prev) === JSON.stringify(snap)) return;
            speUndoStack.push(snap);
            if (speUndoStack.length > 40) speUndoStack.shift();
            speRedoStack.length = 0;
            updateSaveButtonState();
        }

        function restoreSpeState(snap) {
            if (!snap) return;
            if (activeTextareaEl && activeTextareaEl.parentNode) {
                activeTextareaEl.parentNode.removeChild(activeTextareaEl);
            }
            activeTextareaEl = null;
            selectedLayerEl = null;
            selectionBoxEl = null;
            deleteSelectedBtn.style.display = 'none';

            Array.from(stickerLayersEl.children).forEach((el) => {
                try { el._lottieAnim?.destroy?.(); } catch (_) {}
            });
            stickerLayersEl.innerHTML = '';
            (snap.stickers || []).forEach((s) => {
                const layer = document.createElement('div');
                layer.className = 'pe_canvas_layer pe_canvas_sticker_layer';
                layer.style.width = `${s.width}px`;
                layer.style.height = `${s.height}px`;
                layer.style.left = `${s.left}px`;
                layer.style.top = `${s.top}px`;
                layer.dataset.rotation = String(s.rotation || '0');
                if (Number(s.rotation)) layer.style.transform = `rotateZ(${s.rotation}deg)`;
                mountStickerLayerContent(layer, { stickerUrl: s.stickerUrl, animationUrl: s.animationUrl });
                stickerLayersEl.appendChild(layer);
            });

            textLayersEl.innerHTML = '';
            (snap.texts || []).forEach((t) => {
                const layer = document.createElement('div');
                layer.className = 'pe_canvas_layer pe_canvas_text_layer';
                layer.dataset.rotation = String(t.rotation || '0');
                if (Number(t.rotation)) layer.style.transform = `rotateZ(${t.rotation}deg)`;
                const inner = document.createElement('span');
                inner.className = 'pe_layer_text_inner';
                inner.textContent = t.text;
                inner.style.fontFamily = t.fontFamily;
                inner.style.fontWeight = t.fontWeight;
                inner.style.fontSize = t.fontSize;
                inner.style.color = t.color;
                inner.dataset.colorIndex = String(t.colorIndex);
                applyTextFontStyleClasses(inner, t.fontFamily);
                layer.appendChild(inner);
                layer.style.left = `${t.left}px`;
                layer.style.top = `${t.top}px`;
                textLayersEl.appendChild(layer);
            });

            drawings.length = 0;
            (snap.drawings || []).forEach((d) => {
                drawings.push({
                    color: d.color,
                    width: d.width,
                    opacity: d.opacity,
                    path: d.path.map((pt) => [pt[0], pt[1]]),
                });
            });
            renderDrawingsOn(drawingCtx, 1);
            updateSaveButtonState();
        }

        function performSpeUndo() {
            if (activeTextareaEl) {
                finishEditingTextLayer();
            }
            if (speUndoStack.length === 0) return;
            speRedoStack.push(captureSpeState());
            restoreSpeState(speUndoStack.pop());
        }

        function performSpeRedo() {
            if (speRedoStack.length === 0) return;
            speUndoStack.push(captureSpeState());
            restoreSpeState(speRedoStack.pop());
        }

        let isFinishingText = false;
        function finishEditingTextLayer() {
            if (isFinishingText || !activeTextareaEl || !selectedLayerEl) return;
            isFinishingText = true;
            try {
                const ta = activeTextareaEl;
                const layer = selectedLayerEl;
                const inner = layer.querySelector('.pe_layer_text_inner');
                const val = ta.value.trim();
                activeTextareaEl = null;
                if (ta.parentNode) {
                    ta.parentNode.removeChild(ta);
                }
                if (!val) {
                    selectedLayerEl = null;
                    layer.remove();
                    deleteSelectedBtn.style.display = 'none';
                } else if (inner) {
                    if (layer._preEditSnapshot) {
                        pushSpeUndo(layer._preEditSnapshot);
                        delete layer._preEditSnapshot;
                    }
                    delete layer.dataset.isPlaceholder;
                    inner.textContent = val;
                    layer.style.visibility = '';
                }
                updateSaveButtonState();
            } finally {
                isFinishingText = false;
            }
        }

        function deselectLayer() {
            finishEditingTextLayer();
            if (selectionBoxEl && selectionBoxEl.parentNode) {
                selectionBoxEl.parentNode.removeChild(selectionBoxEl);
            }
            selectionBoxEl = null;
            selectedLayerEl = null;
            deleteSelectedBtn.style.display = 'none';
        }

        function selectLayer(layerEl) {
            deselectLayer();
            if (!layerEl) return;
            selectedLayerEl = layerEl;
            selectionBoxEl = document.createElement('div');
            selectionBoxEl.className = 'pe_layer_selection';
            selectionBoxEl.innerHTML = `
                <div class="pe_layer_selection_handler" data-handle="nw" id="pe_nw"></div>
                <div class="pe_layer_selection_handler" data-handle="ne" id="pe_ne"></div>
                <div class="pe_layer_selection_handler" data-handle="se" id="pe_se"></div>
                <div class="pe_layer_selection_handler" data-handle="sw" id="pe_sw"></div>
            `;
            layerEl.appendChild(selectionBoxEl);

            const isText = layerEl.classList.contains('pe_canvas_text_layer');
            const delLabel = isText ? vtr('pe_delete_text', 'Delete text') : vtr('pe_delete_sticker', 'Delete sticker');
            if (mobileEditing) {
                deleteSelectedBtn.title = delLabel;
                deleteSelectedBtn.setAttribute('aria-label', delLabel);
                deleteSelectedBtn.style.display = 'inline-flex';
            } else {
                deleteSelectedBtn.textContent = delLabel;
                deleteSelectedBtn.style.display = 'inline';
            }
        }

        deleteSelectedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedLayerEl) {
                pushSpeUndo();
                const el = selectedLayerEl;
                deselectLayer();
                el.remove();
                updateSaveButtonState();
            }
        });

        function addStickerLayer(sticker, x, y) {
            pushSpeUndo();
            const layer = document.createElement('div');
            layer.className = 'pe_canvas_layer pe_canvas_sticker_layer';
            const size = 110;
            layer.style.width = `${size}px`;
            layer.style.height = `${size}px`;
            layer.style.left = `${Math.round(x - size / 2)}px`;
            layer.style.top = `${Math.round(y - size / 2)}px`;
            layer.dataset.rotation = '0';
            mountStickerLayerContent(layer, {
                stickerUrl: sticker.sizes[512] || sticker.sizes[256] || sticker.sizes[128],
                animationUrl: sticker.isLottie ? sticker.animationUrl : '',
            });
            stickerLayersEl.appendChild(layer);
            selectLayer(layer);
            updateSaveButtonState();
        }

        function resizeActiveTextarea() {
            if (!activeTextareaEl || !selectedLayerEl) return;
            const inner = selectedLayerEl.querySelector('.pe_layer_text_inner');
            if (!inner) return;
            const centerX = typeof selectedLayerEl._anchorCenterX === 'number'
                ? selectedLayerEl._anchorCenterX
                : (selectedLayerEl.offsetLeft + selectedLayerEl.offsetWidth / 2);
            selectedLayerEl._anchorCenterX = centerX;
            const placeholderText = vtr('pe_text_placeholder', 'Enter text...');
            inner.textContent = activeTextareaEl.value || placeholderText;
            const w = Math.min(Math.max(120, dispW - 8), Math.max(160, selectedLayerEl.offsetWidth + 28));
            const h = Math.max(46, selectedLayerEl.offsetHeight + 16);
            const left = Math.max(4, Math.min(dispW - w - 4, Math.round(centerX - w / 2)));
            const top = Math.max(4, Math.min(dispH - h - 4, selectedLayerEl.offsetTop));
            selectedLayerEl.style.left = `${Math.max(4, Math.round(centerX - selectedLayerEl.offsetWidth / 2))}px`;
            activeTextareaEl.style.setProperty('width', `${w}px`, 'important');
            activeTextareaEl.style.setProperty('height', `${h}px`, 'important');
            activeTextareaEl.style.left = `${left}px`;
            activeTextareaEl.style.top = `${top}px`;
        }

        function startInlineTextEdit(layerEl) {
            const inner = layerEl.querySelector('.pe_layer_text_inner');
            if (!inner) return;
            if (mobileEditing) {
                pvWrapper.classList.remove('pv_pe_sheet_open');
            }
            if (!layerEl._preEditSnapshot) {
                layerEl._preEditSnapshot = captureSpeState();
            }
            if (typeof layerEl._anchorCenterX !== 'number') {
                layerEl._anchorCenterX = layerEl.offsetLeft + layerEl.offsetWidth / 2;
            }
            const isPlaceholder = layerEl.dataset.isPlaceholder === '1';
            const placeholderText = vtr('pe_text_placeholder', 'Enter text...');
            const ta = document.createElement('textarea');
            ta.className = 'pe_textarea';
            ta.setAttribute('data-no-autosize', '');
            ta.placeholder = placeholderText;
            ta.value = isPlaceholder ? '' : (inner.textContent || '');
            ta.style.fontFamily = inner.style.fontFamily;
            ta.style.fontWeight = inner.style.fontWeight;
            ta.style.fontSize = inner.style.fontSize;
            ta.style.color = inner.style.color;
            applyTextFontStyleClasses(ta, inner.style.fontFamily);

            layerEl.style.visibility = 'hidden';
            selectedLayerEl = layerEl;
            activeTextareaEl = ta;
            canvasOverlay.appendChild(ta);
            resizeActiveTextarea();
            ta.focus();
            if (!isPlaceholder) ta.select();

            ta.addEventListener('input', () => {
                resizeActiveTextarea();
                updateSaveButtonState();
            });

            ta.addEventListener('keydown', (ke) => {
                if (ke.key === 'Escape' || (ke.key === 'Enter' && !ke.shiftKey)) {
                    ke.preventDefault();
                    ke.stopPropagation();
                    finishEditingTextLayer();
                    if (selectedLayerEl) selectLayer(selectedLayerEl);
                }
            });

            ta.addEventListener('blur', (be) => {
                const rel = be.relatedTarget;
                if (rel && pePanel.contains(rel) && rel.closest('#pe_tab_content_text')) {
                    return;
                }
                const editingLayer = selectedLayerEl;
                finishEditingTextLayer();
                if (editingLayer && editingLayer.isConnected) {
                    selectLayer(editingLayer);
                }
            });
        }

        function addNewTextLayer() {
            const preSnap = captureSpeState();
            deselectLayer();
            const layer = document.createElement('div');
            layer.className = 'pe_canvas_layer pe_canvas_text_layer';
            layer.dataset.rotation = '0';
            layer.dataset.isPlaceholder = '1';
            layer._preEditSnapshot = preSnap;
            const inner = document.createElement('span');
            inner.className = 'pe_layer_text_inner';
            inner.textContent = vtr('pe_text_placeholder', 'Enter text...');
            inner.style.fontFamily = currentTextFont;
            inner.style.fontWeight = peTextFontWeight(currentTextFont);
            inner.style.fontSize = `${currentTextSize}px`;
            inner.style.color = AVAILABLE_COLORS[currentTextColorIdx];
            inner.dataset.colorIndex = String(currentTextColorIdx);
            applyTextFontStyleClasses(inner, currentTextFont);

            layer.appendChild(inner);
            textLayersEl.appendChild(layer);
            layer._anchorCenterX = dispW / 2;
            layer.style.left = `${Math.round(dispW / 2 - layer.offsetWidth / 2)}px`;
            layer.style.top = `${Math.round(dispH * (mobileEditing ? 0.38 : 0.5) - layer.offsetHeight / 2)}px`;
            selectLayer(layer);
            startInlineTextEdit(layer);
            updateSaveButtonState();
        }

        // Render sticker pack grid
        const stickersListEl = pePanel.querySelector('.pe_sticker_pack_list');
        function initPeLottieThumbs(root) {
            if (!window.lottie || !root) return;
            root.querySelectorAll('.pe_lottie_thumb[data-anim-url]').forEach((thumb) => {
                const url = thumb.dataset.animUrl;
                if (!url || thumb._lottieInitialized) return;
                thumb._lottieInitialized = true;
                try {
                    thumb._lottieAnim = window.lottie.loadAnimation({
                        container: thumb,
                        renderer: 'svg',
                        loop: false,
                        autoplay: false,
                        path: url,
                    });
                } catch (_) {}
            });
        }
        function renderStickerPack(packId) {
            pePanel.querySelectorAll('.pe_sticker_pack_tab').forEach((t) => {
                t.classList.toggle('pe_selected', String(t.dataset.packId) === String(packId));
            });
            const list = stickerPacksData[String(packId)] || [];
            if (list.length === 0) {
                stickersListEl.innerHTML = `<div class="pe_empty_stickers">${tr('stickers_empty_prompt') || 'No stickers'}</div>`;
                return;
            }
            stickersListEl.innerHTML = list.map((stk) => `
                <div class="pe_sticker_preview ${stk.isLottie ? 'is-lottie-item' : ''}" data-sticker-id="${stk.id}">
                    ${stk.isLottie && stk.animationUrl
                        ? `<div class="sticker-lottie-thumb pe_lottie_thumb" data-anim-url="${stk.animationUrl}"></div>`
                        : `<img src="${stk.sizes[128]}" loading="lazy" alt="" />`}
                </div>
            `).join('');
            initPeLottieThumbs(stickersListEl);
        }

        initPeLottieThumbs(pePanel.querySelector('.pe_sticker_packs_tabs'));
        if (packs.length > 0) {
            renderStickerPack(packs[0].id);
        } else {
            renderStickerPack('');
        }

        pePanel.querySelectorAll('.pe_sticker_pack_tab').forEach((tab) => {
            tab.addEventListener('click', () => renderStickerPack(tab.dataset.packId));
        });

        stickersListEl.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.pe_sticker_preview.is-lottie-item');
            if (!item) return;
            const thumb = item.querySelector('.pe_lottie_thumb');
            if (thumb?._lottieAnim) {
                thumb._lottieAnim.setLoop(true);
                thumb._lottieAnim.play();
            }
        });
        stickersListEl.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.pe_sticker_preview.is-lottie-item');
            if (!item || item.contains(e.relatedTarget)) return;
            const thumb = item.querySelector('.pe_lottie_thumb');
            if (thumb?._lottieAnim) {
                thumb._lottieAnim.goToAndStop(0, true);
            }
        });

        stickersListEl.addEventListener('click', (e) => {
            const item = e.target.closest('.pe_sticker_preview');
            if (!item) return;
            const stk = stickersMap[item.dataset.stickerId];
            if (stk) {
                addStickerLayer(stk, dispW / 2, dispH / 2);
                if (mobileEditing) pvWrapper.classList.remove('pv_pe_sheet_open');
            }
        });

        // Color pickers
        function initColorPicker(el, initialIdx, onSelect) {
            if (!el) return;
            el.innerHTML = AVAILABLE_COLORS.map((c, idx) => `
                <div class="pe_drawing_color ${c === '#FFFFFF' ? 'pe_drawing_color_white' : ''} ${idx === initialIdx ? 'pe_selected' : ''}" data-color-index="${idx}" style="background-color:${c};"></div>
            `).join('');
            el.addEventListener('click', (e) => {
                const sw = e.target.closest('.pe_drawing_color');
                if (!sw) return;
                const idx = Number(sw.dataset.colorIndex);
                el.querySelectorAll('.pe_drawing_color').forEach((d) => d.classList.remove('pe_selected'));
                sw.classList.add('pe_selected');
                onSelect(AVAILABLE_COLORS[idx], idx);
            });
        }

        function syncSelectedTextStyle() {
            if (!selectedLayerEl || !selectedLayerEl.classList.contains('pe_canvas_text_layer')) return;
            const inner = selectedLayerEl.querySelector('.pe_layer_text_inner');
            if (!inner) return;
            inner.style.fontFamily = currentTextFont;
            inner.style.fontWeight = peTextFontWeight(currentTextFont);
            inner.style.fontSize = `${currentTextSize}px`;
            inner.style.color = AVAILABLE_COLORS[currentTextColorIdx];
            inner.dataset.colorIndex = String(currentTextColorIdx);
            applyTextFontStyleClasses(inner, currentTextFont);
            if (activeTextareaEl) {
                activeTextareaEl.style.fontFamily = currentTextFont;
                activeTextareaEl.style.fontWeight = inner.style.fontWeight;
                activeTextareaEl.style.fontSize = `${currentTextSize}px`;
                activeTextareaEl.style.color = AVAILABLE_COLORS[currentTextColorIdx];
                applyTextFontStyleClasses(activeTextareaEl, currentTextFont);
                resizeActiveTextarea();
            }
        }

        initColorPicker(pePanel.querySelector('#pe_text_color_picker'), 7, (color, idx) => {
            if (selectedLayerEl && !activeTextareaEl) pushSpeUndo();
            currentTextColorIdx = idx;
            syncSelectedTextStyle();
        });

        const textSizeSliderEl = pePanel.querySelector('.pe_text_size_slider');
        const onTextSizeStart = () => { if (selectedLayerEl && !activeTextareaEl) pushSpeUndo(); };
        textSizeSliderEl?.addEventListener('mousedown', onTextSizeStart, true);
        textSizeSliderEl?.addEventListener('touchstart', onTextSizeStart, { capture: true, passive: true });
        const textSizeSlider = createPeSlider(textSizeSliderEl, {
            width: 240,
            value: 0.35,
            onChange: (val) => {
                currentTextSize = Math.round(MIN_FONT_SIZE + val * 72);
                syncSelectedTextStyle();
            },
        });

        pePanel.querySelectorAll('._pe_text_font_rdbtn').forEach((rb) => {
            rb.addEventListener('click', () => {
                if (selectedLayerEl && !activeTextareaEl) pushSpeUndo();
                pePanel.querySelectorAll('._pe_text_font_rdbtn').forEach((r) => r.classList.remove('on'));
                rb.classList.add('on');
                currentTextFont = rb.dataset.font || 'Roboto, sans-serif';
                syncSelectedTextStyle();
            });
        });

        pePanel.querySelector('#pe_add_text_btn')?.addEventListener('click', () => addNewTextLayer());

        // Drawing controls & preview
        const drawPreviewCanvas = pePanel.querySelector('.pe_drawing_preview');
        function hexToRgba(hex, alpha) {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (!m) return hex;
            return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
        }

        function updateDrawPreview() {
            if (!drawPreviewCanvas) return;
            const pCtx = drawPreviewCanvas.getContext('2d');
            pCtx.clearRect(0, 0, drawPreviewCanvas.width, drawPreviewCanvas.height);
            pCtx.beginPath();
            pCtx.moveTo(20, 35);
            pCtx.bezierCurveTo(70, 65, 150, 10, 200, 35);
            pCtx.lineWidth = drawingLineWidth;
            pCtx.strokeStyle = hexToRgba(drawingLineColor, drawingLineOpacity);
            pCtx.lineCap = 'round';
            pCtx.lineJoin = 'round';
            pCtx.stroke();
        }

        const drawWidthSlider = createPeSlider(pePanel.querySelector('.pe_drawing_width_slider'), {
            width: 115,
            value: 0.3,
            onChange: (val) => {
                drawingLineWidth = Math.max(2, Math.round((val + 0.1) * 24));
                updateDrawPreview();
            },
        });

        const drawIntensitySlider = createPeSlider(pePanel.querySelector('.pe_drawing_intensity_slider'), {
            width: 115,
            value: 1,
            onChange: (val) => {
                drawingLineOpacity = Math.max(0.05, val);
                updateDrawPreview();
            },
        });

        initColorPicker(pePanel.querySelector('#pe_drawing_color_picker'), 0, (color) => {
            drawingLineColor = color;
            updateDrawPreview();
        });
        updateDrawPreview();

        function renderDrawingsOn(ctx2d, scaleFactor = 1) {
            if (ctx2d === drawingCtx) {
                ctx2d.clearRect(0, 0, drawingCanvasEl.width, drawingCanvasEl.height);
            }
            ctx2d.lineCap = 'round';
            ctx2d.lineJoin = 'round';
            for (const d of drawings) {
                if (!d.path || d.path.length === 0) continue;
                ctx2d.lineWidth = d.width * scaleFactor;
                ctx2d.strokeStyle = hexToRgba(d.color, d.opacity);
                ctx2d.beginPath();
                ctx2d.moveTo(d.path[0][0] * scaleFactor, d.path[0][1] * scaleFactor);
                for (let i = 1; i < d.path.length; i++) {
                    ctx2d.lineTo(d.path[i][0] * scaleFactor, d.path[i][1] * scaleFactor);
                }
                ctx2d.stroke();
            }
        }

        globalUndoBtn?.addEventListener('click', () => performSpeUndo());
        undoDrawBtn?.addEventListener('click', () => performSpeUndo());

        const hideSnapGuides = () => {
            snapGuideV?.classList.remove('shown');
            snapGuideH?.classList.remove('shown');
        };

        // Canvas interactions (drag, resize/rotate layer, or draw stroke) — mouse + touch
        const onCanvasPointerDown = (e) => {
            if (e.target === activeTextareaEl) return;
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();

            const rect = canvasOverlay.getBoundingClientRect();
            const getLocalXY = (ev) => {
                const pt = getEventPoint(ev);
                return [pt.clientX - rect.left, pt.clientY - rect.top];
            };

            if (currentTab === 'draw') {
                deselectLayer();
                pushSpeUndo();
                const pt = getLocalXY(e);
                const stroke = {
                    color: drawingLineColor,
                    width: drawingLineWidth,
                    opacity: drawingLineOpacity,
                    path: [pt, [pt[0], pt[1] + 0.1]],
                };
                drawings.push(stroke);
                renderDrawingsOn(drawingCtx, 1);

                const onMove = (me) => {
                    if (me.cancelable) me.preventDefault();
                    stroke.path.push(getLocalXY(me));
                    renderDrawingsOn(drawingCtx, 1);
                };
                const onUp = () => {
                    updateSaveButtonState();
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('touchmove', onMove);
                    window.removeEventListener('touchend', onUp);
                    window.removeEventListener('touchcancel', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onUp);
                window.addEventListener('touchcancel', onUp);
                return;
            }

            const handleEl = e.target.closest('.pe_layer_selection_handler');
            if (handleEl && selectedLayerEl) {
                const preRotSnap = captureSpeState();
                let changedTransform = false;
                const layer = selectedLayerEl;
                const isText = layer.classList.contains('pe_canvas_text_layer');
                const startW = layer.offsetWidth;
                const startH = layer.offsetHeight;
                const cx = layer.offsetLeft + startW / 2;
                const cy = layer.offsetTop + startH / 2;
                const startPt = getLocalXY(e);
                const startVec = [startPt[0] - cx, startPt[1] - cy];
                const startDist = Math.max(10, Math.hypot(startVec[0], startVec[1]));
                const startAngle = Math.atan2(startVec[1], startVec[0]);
                const baseRot = Number(layer.dataset.rotation || 0);

                const onMove = (me) => {
                    if (me.cancelable) me.preventDefault();
                    changedTransform = true;
                    const pt = getLocalXY(me);
                    const vec = [pt[0] - cx, pt[1] - cy];
                    let deg = baseRot + ((Math.atan2(vec[1], vec[0]) - startAngle) * 180) / Math.PI;
                    const nearest45 = Math.round(deg / 45) * 45;
                    const nearest15 = Math.round(deg / 15) * 15;
                    if (Math.abs(deg - nearest45) <= 4) {
                        deg = nearest45;
                        layer.classList.add('pe_rotation_snapped');
                    } else if (me.shiftKey || Math.abs(deg - nearest15) <= 1.8) {
                        deg = nearest15;
                        layer.classList.add('pe_rotation_snapped');
                    } else {
                        layer.classList.remove('pe_rotation_snapped');
                    }
                    layer.dataset.rotation = String(deg);
                    layer.style.transform = `rotateZ(${deg}deg)`;

                    if (!isText) {
                        const dist = Math.max(30, Math.hypot(vec[0], vec[1]));
                        const ratio = dist / startDist;
                        const nw = Math.round(startW * ratio);
                        const nh = Math.round(startH * ratio);
                        layer.style.width = `${nw}px`;
                        layer.style.height = `${nh}px`;
                        layer.style.left = `${Math.round(cx - nw / 2)}px`;
                        layer.style.top = `${Math.round(cy - nh / 2)}px`;
                    }
                };
                const onUp = () => {
                    layer.classList.remove('pe_rotation_snapped');
                    if (changedTransform) pushSpeUndo(preRotSnap);
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('touchmove', onMove);
                    window.removeEventListener('touchend', onUp);
                    window.removeEventListener('touchcancel', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onUp);
                window.addEventListener('touchcancel', onUp);
                return;
            }

            const layerEl = e.target.closest('.pe_canvas_layer');
            if (!layerEl) {
                deselectLayer();
                return;
            }

            const wasAlreadySelected = layerEl === selectedLayerEl;
            selectLayer(layerEl);

            const preDragSnap = captureSpeState();
            const startPt = getLocalXY(e);
            const startLeft = layerEl.offsetLeft;
            const startTop = layerEl.offsetTop;
            let movedDist = 0;
            let overDeleteZone = false;
            const SNAP_PX = 7;

            const isPointInDeleteZone = (clientX, clientY) => {
                if (!deleteZoneEl) return false;
                const zRect = deleteZoneEl.getBoundingClientRect();
                const zCx = zRect.left + zRect.width / 2;
                const zCy = zRect.top + zRect.height / 2;
                return Math.hypot(clientX - zCx, clientY - zCy) <= Math.max(32, zRect.width * 0.65);
            };

            const onMove = (me) => {
                if (me.cancelable) me.preventDefault();
                const pt = getLocalXY(me);
                const clientPt = getEventPoint(me);
                const dx = pt[0] - startPt[0];
                const dy = pt[1] - startPt[1];
                movedDist = Math.hypot(dx, dy);
                let nextLeft = startLeft + dx;
                let nextTop = startTop + dy;
                if (movedDist > 4 && deleteZoneEl) {
                    pvWrapper.classList.add('pv_pe_dragging_layer');
                    deleteZoneEl.classList.add('shown');
                    overDeleteZone = isPointInDeleteZone(clientPt.clientX, clientPt.clientY);
                    deleteZoneEl.classList.toggle('over', overDeleteZone);
                    layerEl.classList.toggle('pe_layer_over_trash', overDeleteZone);
                }
                if (movedDist > 2 && !overDeleteZone) {
                    const lw = layerEl.offsetWidth;
                    const lh = layerEl.offsetHeight;
                    const cx = nextLeft + lw / 2;
                    const cy = nextTop + lh / 2;
                    const snapX = Math.abs(cx - dispW / 2) <= SNAP_PX;
                    const snapY = Math.abs(cy - dispH / 2) <= SNAP_PX;
                    if (snapX) nextLeft = dispW / 2 - lw / 2;
                    if (snapY) nextTop = dispH / 2 - lh / 2;
                    snapGuideV?.classList.toggle('shown', snapX);
                    snapGuideH?.classList.toggle('shown', snapY);
                } else {
                    hideSnapGuides();
                }
                layerEl.style.left = `${Math.round(nextLeft)}px`;
                layerEl.style.top = `${Math.round(nextTop)}px`;
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onUp);
                window.removeEventListener('touchcancel', onUp);
                pvWrapper.classList.remove('pv_pe_dragging_layer');
                hideSnapGuides();
                if (deleteZoneEl) {
                    deleteZoneEl.classList.remove('shown', 'over');
                }
                layerEl.classList.remove('pe_layer_over_trash');
                if (overDeleteZone) {
                    pushSpeUndo(preDragSnap);
                    deselectLayer();
                    layerEl.remove();
                    updateSaveButtonState();
                    return;
                }
                if (movedDist >= 3) {
                    layerEl._anchorCenterX = layerEl.offsetLeft + layerEl.offsetWidth / 2;
                    pushSpeUndo(preDragSnap);
                }
                if (wasAlreadySelected && movedDist < 3 && layerEl.classList.contains('pe_canvas_text_layer')) {
                    startInlineTextEdit(layerEl);
                }
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
            window.addEventListener('touchcancel', onUp);
        };
        canvasOverlay.addEventListener('mousedown', onCanvasPointerDown);
        canvasOverlay.addEventListener('touchstart', onCanvasPointerDown, { passive: false });

        // Top tabs switching
        pePanel.querySelectorAll('.pe_tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                if (activeTextareaEl) {
                    const editingLayer = selectedLayerEl;
                    finishEditingTextLayer();
                    if (editingLayer && editingLayer.isConnected) selectLayer(editingLayer);
                }
                const noRealTexts = !Array.from(textLayersEl.children).some((el) => el.dataset.isPlaceholder !== '1');
                if (mobileEditing) {
                    const wasOpen = pvWrapper.classList.contains('pv_pe_sheet_open');
                    if (wasOpen && currentTab === tabId) {
                        pvWrapper.classList.remove('pv_pe_sheet_open');
                        return;
                    }
                    if (!(tabId === 'text' && noRealTexts)) {
                        pvWrapper.classList.add('pv_pe_sheet_open');
                    }
                }
                currentTab = tabId;
                pePanel.querySelectorAll('.pe_tab').forEach((t) => t.classList.toggle('pe_selected', t === tab));
                pePanel.querySelectorAll('.pe_tab_content').forEach((c) => {
                    c.style.display = c.id === `pe_tab_content_${tabId}` ? 'block' : 'none';
                });
                if (tabId === 'text' && noRealTexts) {
                    addNewTextLayer();
                } else if (tabId === 'text' && !selectedLayerEl?.classList.contains('pe_canvas_text_layer')) {
                    const lastText = textLayersEl.lastElementChild;
                    if (lastText) selectLayer(lastText);
                } else if (tabId === 'draw') {
                    deselectLayer();
                }
            });
        });

        function syncSpeCanvasBounds() {
            const next = computeDisplayedImageBox();
            if (next.dispW === dispW && next.dispH === dispH && next.offsetX === offsetX && next.offsetY === offsetY) {
                return;
            }
            const ratioX = next.dispW / (dispW || 1);
            const ratioY = next.dispH / (dispH || 1);
            const ratioAvg = (ratioX + ratioY) / 2;

            dispW = next.dispW;
            dispH = next.dispH;
            offsetX = next.offsetX;
            offsetY = next.offsetY;

            canvasOverlay.style.width = `${dispW}px`;
            canvasOverlay.style.height = `${dispH}px`;
            canvasOverlay.style.left = `${offsetX}px`;
            canvasOverlay.style.top = `${offsetY}px`;

            drawingCanvasEl.width = dispW;
            drawingCanvasEl.height = dispH;

            Array.from(stickerLayersEl.children).forEach((sLayer) => {
                const nw = Math.round(sLayer.offsetWidth * ratioX);
                const nh = Math.round(sLayer.offsetHeight * ratioY);
                const nl = Math.round(sLayer.offsetLeft * ratioX);
                const nt = Math.round(sLayer.offsetTop * ratioY);
                sLayer.style.width = `${nw}px`;
                sLayer.style.height = `${nh}px`;
                sLayer.style.left = `${nl}px`;
                sLayer.style.top = `${nt}px`;
            });

            Array.from(textLayersEl.children).forEach((tLayer) => {
                const nl = Math.round(tLayer.offsetLeft * ratioX);
                const nt = Math.round(tLayer.offsetTop * ratioY);
                tLayer.style.left = `${nl}px`;
                tLayer.style.top = `${nt}px`;
                const inner = tLayer.querySelector('.pe_layer_text_inner');
                if (inner && inner.style.fontSize) {
                    const fSz = Math.max(MIN_FONT_SIZE, Math.round(parseFloat(inner.style.fontSize) * ratioAvg));
                    inner.style.fontSize = `${fSz}px`;
                }
            });

            drawings.forEach((d) => {
                d.width = d.width * ratioAvg;
                d.path = d.path.map((pt) => [pt[0] * ratioX, pt[1] * ratioY]);
            });
            renderDrawingsOn(drawingCtx, 1);
        }

        const onSpeKeyDown = (ke) => {
            if (!pePanel.isConnected) return;
            if (activeTextareaEl && document.activeElement === activeTextareaEl) return;
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') return;

            const mod = ke.ctrlKey || ke.metaKey;
            if (mod && ke.key.toLowerCase() === 'z' && !ke.shiftKey) {
                ke.preventDefault();
                ke.stopPropagation();
                performSpeUndo();
                return;
            }
            if ((mod && ke.key.toLowerCase() === 'y') || (mod && ke.shiftKey && ke.key.toLowerCase() === 'z')) {
                ke.preventDefault();
                ke.stopPropagation();
                performSpeRedo();
                return;
            }
            if ((ke.key === 'Delete' || ke.key === 'Backspace') && selectedLayerEl) {
                ke.preventDefault();
                ke.stopPropagation();
                pushSpeUndo();
                const el = selectedLayerEl;
                deselectLayer();
                el.remove();
                updateSaveButtonState();
                return;
            }
            if (selectedLayerEl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ke.key)) {
                ke.preventDefault();
                ke.stopPropagation();
                pushSpeUndo();
                const step = ke.shiftKey ? 10 : 1;
                if (ke.key === 'ArrowLeft') selectedLayerEl.style.left = `${selectedLayerEl.offsetLeft - step}px`;
                if (ke.key === 'ArrowRight') selectedLayerEl.style.left = `${selectedLayerEl.offsetLeft + step}px`;
                if (ke.key === 'ArrowUp') selectedLayerEl.style.top = `${selectedLayerEl.offsetTop - step}px`;
                if (ke.key === 'ArrowDown') selectedLayerEl.style.top = `${selectedLayerEl.offsetTop + step}px`;
                return;
            }
            if (ke.key === 'Escape') {
                ke.preventDefault();
                ke.stopPropagation();
                if (activeTextareaEl) {
                    const editingLayer = selectedLayerEl;
                    finishEditingTextLayer();
                    if (editingLayer && editingLayer.isConnected) selectLayer(editingLayer);
                } else if (mobileEditing && pvWrapper.classList.contains('pv_pe_sheet_open')) {
                    pvWrapper.classList.remove('pv_pe_sheet_open');
                } else if (selectedLayerEl) {
                    deselectLayer();
                } else {
                    closeSpeEditor();
                }
                return;
            }
            if (ke.key === 'Enter' && mod) {
                ke.preventDefault();
                ke.stopPropagation();
                saveBtn.click();
            }
        };
        window.addEventListener('keydown', onSpeKeyDown, true);

        const onWindowResize = () => syncSpeCanvasBounds();
        window.addEventListener('resize', onWindowResize);
        let resizeObserver = null;
        if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(() => syncSpeCanvasBounds());
            resizeObserver.observe(pvPhoto);
            resizeObserver.observe(imgEl);
        }

        requestAnimationFrame(() => syncSpeCanvasBounds());

        function closeSpeEditor() {
            window.removeEventListener('keydown', onSpeKeyDown, true);
            window.removeEventListener('resize', onWindowResize);
            resizeObserver?.disconnect();
            deselectLayer();
            textSizeSlider?.destroy();
            drawWidthSlider?.destroy();
            drawIntensitySlider?.destroy();
            if (canvasOverlay.parentNode) canvasOverlay.parentNode.removeChild(canvasOverlay);
            if (pePanel.parentNode) pePanel.parentNode.removeChild(pePanel);
            if (deleteSelectedBtn.parentNode) deleteSelectedBtn.parentNode.removeChild(deleteSelectedBtn);
            hiddenRightNodes.forEach((n) => { n.style.display = ''; });
            if (mobileEditing) {
                pvRight.style.display = prevPvRightDisplay || 'none';
                imgEl.style.transform = previousImageTransform;
            }
            pvWrapper.classList.remove('pv_pe', 'pv_pe_sheet_open', 'pv_pe_dragging_layer');
        }

        pePanel.querySelector('#pe_spe_cancel_btn')?.addEventListener('click', () => closeSpeEditor());

        let isSpeSaving = false;
        saveBtn.addEventListener('click', async () => {
            if (activeTextareaEl) {
                finishEditingTextLayer();
            }
            if (isSpeSaving || saveBtn.classList.contains('button_disabled') || saveBtn.classList.contains('lagged')) return;
            isSpeSaving = true;
            if (window.LoaderUtils) {
                window.LoaderUtils.showInButton(saveBtn, { theme: 'baw' });
            }
            deselectLayer();

            try {
                await ensurePeFonts();
                const maxImg = await new Promise((resolve, reject) => {
                    const im = new Image();
                    im.crossOrigin = 'Anonymous';
                    im.onload = () => resolve(im);
                    im.onerror = reject;
                    im.src = ctx.fullSrc || ctx.largeSrc;
                });

                const outW = maxImg.naturalWidth || maxImg.width;
                const outH = maxImg.naturalHeight || maxImg.height;
                const sizeCoeff = outW / dispW;

                const outCnv = document.createElement('canvas');
                outCnv.width = outW;
                outCnv.height = outH;
                const oCtx = outCnv.getContext('2d');
                oCtx.drawImage(maxImg, 0, 0, outW, outH);

                // Draw sticker layers
                const loadStickerDrawable = async (sLayer) => {
                    const url = sLayer.dataset.stickerUrl;
                    if (url && !url.endsWith('.json')) {
                        try {
                            return await new Promise((res, rej) => {
                                const im = new Image();
                                im.crossOrigin = 'Anonymous';
                                im.onload = () => res(im);
                                im.onerror = rej;
                                im.src = url;
                            });
                        } catch (_) {}
                    }
                    const svgEl = sLayer.querySelector('.pe_layer_lottie_host svg');
                    if (svgEl) {
                        const clone = svgEl.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        clone.setAttribute('width', '512');
                        clone.setAttribute('height', '512');
                        const svgXml = new XMLSerializer().serializeToString(clone);
                        const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
                        const blobUrl = URL.createObjectURL(svgBlob);
                        try {
                            return await new Promise((res, rej) => {
                                const im = new Image();
                                im.onload = () => res(im);
                                im.onerror = rej;
                                im.src = blobUrl;
                            });
                        } finally {
                            URL.revokeObjectURL(blobUrl);
                        }
                    }
                    return null;
                };
                const stickerNodes = Array.from(stickerLayersEl.children);
                for (const sLayer of stickerNodes) {
                    try {
                        const sImg = await loadStickerDrawable(sLayer);
                        if (!sImg) continue;
                        const w = sLayer.offsetWidth * sizeCoeff;
                        const h = sLayer.offsetHeight * sizeCoeff;
                        const x = sLayer.offsetLeft * sizeCoeff;
                        const y = sLayer.offsetTop * sizeCoeff;
                        const rot = (Number(sLayer.dataset.rotation || 0) * Math.PI) / 180;
                        oCtx.save();
                        oCtx.translate(x + w / 2, y + h / 2);
                        oCtx.rotate(rot);
                        oCtx.drawImage(sImg, -w / 2, -h / 2, w, h);
                        oCtx.restore();
                    } catch (_) {}
                }

                // Draw brush paths
                renderDrawingsOn(oCtx, sizeCoeff);

                // Draw text layers
                Array.from(textLayersEl.children).forEach((tLayer) => {
                    const inner = tLayer.querySelector('.pe_layer_text_inner');
                    if (!inner || !inner.textContent) return;
                    const w = tLayer.offsetWidth * sizeCoeff;
                    const h = tLayer.offsetHeight * sizeCoeff;
                    const x = tLayer.offsetLeft * sizeCoeff;
                    const y = tLayer.offsetTop * sizeCoeff;
                    const rot = (Number(tLayer.dataset.rotation || 0) * Math.PI) / 180;
                    const fSize = parseInt(inner.style.fontSize || '36', 10) * sizeCoeff;
                    const fFam = inner.style.fontFamily || 'Roboto, sans-serif';
                    const fWeight = inner.style.fontWeight || peTextFontWeight(fFam);
                    const isImpact = fFam.toLowerCase().includes('impact');
                    const isLobster = fFam.toLowerCase().includes('lobster');

                    oCtx.save();
                    oCtx.translate(x + w / 2, y + h / 2);
                    oCtx.rotate(rot);
                    oCtx.translate(0, -h / 2);
                    oCtx.font = `${fWeight ? `${fWeight} ` : ''}${fSize}px ${fFam}`;
                    oCtx.fillStyle = inner.style.color || '#FFFFFF';
                    oCtx.textAlign = 'center';
                    oCtx.textBaseline = 'top';

                    if (isImpact) {
                        oCtx.strokeStyle = '#000';
                        oCtx.lineWidth = Math.max(3, fSize * 0.1);
                        oCtx.lineJoin = 'round';
                    } else if (isLobster) {
                        oCtx.shadowColor = 'rgba(0,0,0,0.6)';
                        oCtx.shadowBlur = 3 * sizeCoeff;
                        oCtx.shadowOffsetX = 1 * sizeCoeff;
                        oCtx.shadowOffsetY = 1 * sizeCoeff;
                    } else {
                        oCtx.shadowColor = 'rgba(0, 0, 0, 0.55)';
                        oCtx.shadowBlur = 2.5 * sizeCoeff;
                        oCtx.shadowOffsetX = 0;
                        oCtx.shadowOffsetY = 1 * sizeCoeff;
                    }

                    const lines = inner.textContent.split(/\r?\n/);
                    lines.forEach((line, idx) => {
                        if (isImpact) oCtx.strokeText(line, 0, idx * fSize);
                        oCtx.fillText(line, 0, idx * fSize);
                    });
                    oCtx.restore();
                });

                const blob = await new Promise((res) => outCnv.toBlob(res, 'image/jpeg', 0.92));
                const saved = await saveEditedPhotoAndReplace(ctx, blob);
                closeSpeEditor();
                navigateAfterSave(ctx, saved);
            } catch (err) {
                console.error('SPE save error:', err);
                isSpeSaving = false;
                if (window.LoaderUtils) {
                    window.LoaderUtils.restoreButton(saveBtn);
                }
                if (typeof window.NewNotification === 'function') {
                    window.NewNotification(tr('error'), String(err.message || err), null);
                }
            }
        });
    }

    window.__vkifyPhotoEditorImpl = {
        openVkPhotoEditor,
        openVkStickersEditor,
    };
    window.openVkPhotoEditor = openVkPhotoEditor;
    window.openVkStickersEditor = openVkStickersEditor;
});
