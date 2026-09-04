(() => {

const tr = window.tr;
const LoaderUtils = window.LoaderUtils;
const CF = window.ContentFetcher;
const MAX_ATTACHMENTS = window.openvk?.max_attachments || 10;
const DEFAULT_PER_PAGE = window.openvk?.default_per_page || 10;

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Math.floor(Date.now() / 1000), diff = now - timestamp;
    if (diff < 60) return tr('time_just_now');
    if (diff < 3600) return tr('time_minutes_ago', Math.floor(diff / 60));
    const d = new Date(timestamp * 1000), today = new Date(), yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return tr('time_today');
    if (d.toDateString() === yesterday.toDateString()) return tr('time_yesterday');
    try { return d.toLocaleDateString(document.documentElement.lang, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d.toLocaleDateString(); }
};

const ajloader = {
    _count: 0,
    show() { this._count++; u('#ajloader').addClass('shown'); },
    hide() { this._count = Math.max(0, this._count - 1); if (!this._count) u('#ajloader').removeClass('shown'); },
    async wrap(fn) { this.show(); try { return await fn(); } finally { this.hide(); } }
};

vkify.bindOnce('composerAttachmentHandlers', () => {
    document.addEventListener('click', (e) => {
        const del = e.target.closest('.upload-delete');
        if (del && e.target.closest('#videoOpen')) {
            e.preventDefault();
            e.stopPropagation();
            u(del).closest('a.upload-item').remove();
        }
    }, true);

    u(document).on('click', '.vertical-attachment #small_remove_button', (e) => {
        e.preventDefault();
        u(e.target).closest('.vertical-attachment').remove();
    });
    u(document).on('click', '.post-horizontal .upload-delete', (e) => {
        e.preventDefault(); e.stopPropagation();
        u(e.target).closest('a.upload-item').remove();
    });
    u(document).on('click', '.post-buttons .upload-item', (e) => { e.preventDefault(); e.stopPropagation(); });
});

const getAttachedCount = (form, playlistMode = false) => {
    if (playlistMode) return form?.find('.PE_audios .vertical-attachment').length || 0;
    return form?.find('.post-horizontal > a, .post-vertical > .vertical-attachment').length || 0;
};

const isAttached = (form, type, id, playlistMode = false) => {
    if (playlistMode) {
        return form?.find(`.PE_audios .vertical-attachment[data-id='${id}']`).length > 0;
    }
    const checkType = type === 'document' ? 'doc' : type;
    if (checkType === 'photo' || checkType === 'video') return form?.find(`.upload-item[data-type='${checkType}'][data-id='${id}']`).length > 0;
    return form?.find(`.vertical-attachment[data-type='${checkType}'][data-id='${id}']`).length > 0;
};

const canAttach = (form, count = 1, playlistMode = false) => {
    if (playlistMode) return true;
    if (getAttachedCount(form) + count > MAX_ATTACHMENTS) {
        NewNotification(tr('error'), tr('too_many_attachments'), null, () => {}, 5000, false);
        return false;
    }
    return true;
};

const appendHorizontal = (form, { type, id, viewerId, preview, page_url, key, fullsize_url }) => {
    if (!form?.length || !type || !id) return;
    const isVideo = type === 'video';
    const openId = viewerId || id;
    const href = page_url || id;
    const dataKey = key ? ` data-key="${key}"` : '';
    form.find('.post-horizontal').append(`
        <a ${isVideo ? 'id="videoOpen"' : ''} ${type === 'photo' ? `onclick="if(!event.target.closest('.upload-delete'))PhotoViewer.openById('${openId}', event)"` : ''} 
           draggable="true" href="/${type}${href}" class="upload-item" data-type='${type}' data-id="${id}"${dataKey}>
            <span class="upload-delete">×</span>
            ${isVideo ? `<div class='play-button'><div class='play-button-ico'></div></div>` : ''}
            <img draggable="false" src="${preview}" alt='...'>
        </a>
    `);
};

const appendVertical = (form, { type, id, html, undeletable }, playlistMode = false) => {
    if (!form?.length || !type || !id) return;
    const target = playlistMode ? '.PE_audios' : '.post-vertical';
    const dataTypeAttr = playlistMode ? '' : ` data-type='${type}'`;
    form.find(target).append(`
        <div class="vertical-attachment upload-item" draggable="true"${dataTypeAttr} data-id="${id}">
            <div class='vertical-attachment-content' draggable="false">${html || ''}</div>
            <div class='${undeletable ? 'lagged' : ''} vertical-attachment-remove'>
                <div id='small_remove_button'></div>
            </div>
        </div>
    `);
};

// biome-ignore lint/correctness/noUnusedVariables: helper
const removeAttachment = (form, type, id, playlistMode = false) => {
    if (playlistMode) {
        form?.find(`.PE_audios .vertical-attachment[data-id='${id}']`).remove();
        return;
    }
    const checkType = type === 'document' ? 'doc' : type;
    if (checkType === 'photo' || checkType === 'video') {
        form?.find(`.upload-item[data-type='${checkType}'][data-id='${id}']`).remove();
    } else {
        form?.find(`.vertical-attachment[data-type='${checkType}'][data-id='${id}']`).remove();
    }
};

const CACHE_TTL_MS = 60000;

const getPreRenderedHTML = (preRendered, emptyMessage, rowsClass = '') => {
    const itemsHTML = preRendered?.renderedHTML || '';
    const itemsWithWrapper = itemsHTML && rowsClass ? `<div class="${rowsClass}">${itemsHTML}</div>` : itemsHTML;
    const emptyHTML = !itemsHTML && preRendered ? `<div class="information">${emptyMessage}</div>` : '';
    return { itemsHTML: itemsWithWrapper, emptyHTML };
};

const buildUploadButton = (labelKey = 'upload_button') => `
    <div class="choose_upload_area picker-upload-btn" role="button" tabindex="0">
        <span class="choose_upload_area_label">${tr(labelKey)}</span>
    </div>`;

const buildSearchUI = (placeholderKey, inputType = 'search') => `
    <div class="ui_search_new ui_search ui_search_field_empty picker-search">
        <div class="ui_search_input_block">
            <button class="ui_search_button_search">&nbsp;</button>
            <div class="ui_search_input_inner">
                <div class="ui_search_reset" style="visibility: hidden; opacity: 0;"></div>
                <input type="${inputType}" maxlength="100" class="ui_search_field" placeholder="${tr(placeholderKey)}">
            </div>
        </div>
    </div>`;

const buildDualContainers = (activeKey, hasClub, itemsHTML, emptyHTML, containerClass = 'picker-items') => {
    const userContent = activeKey === 'user' ? (itemsHTML || emptyHTML) : '';
    const groupContent = activeKey === 'group' ? (itemsHTML || emptyHTML) : '';
    return `
        <div class="${containerClass} ${containerClass}--user ${activeKey === 'user' ? `${containerClass}--active` : ''}">${userContent}</div>
        ${hasClub ? `<div class="${containerClass} ${containerClass}--group ${activeKey === 'group' ? `${containerClass}--active` : ''}">${groupContent}</div>` : ''}`;
};

const renderAlbumHTML = (album) => `
    <div class="clear_fix clear page_album_row">
        <a href="javascript:void(0)" class="page_album_link picker-album photos_choose_album_row ${!album.thumb_src ? 'page_album_nocover' : ''}" data-album-id="${album.id}">
            <div class="page_album_thumb_wrap">${album.thumb_src ? `<img loading="lazy" src="${album.thumb_src}" class="page_album_thumb" />` : ''}</div>
            <div class="page_album_title">
                <div class="page_album_size">${album.size}</div>
                <div class="page_album_title_text">${escapeHtml(album.title)}</div>
                <div class="page_album_description">${album.description ? escapeHtml(album.description).substring(0, 100) : ''}</div>
            </div>
        </a>
    </div>`;

class AttachmentPickerBase {
    constructor(options) {
        this.form = options.form;
        this.club = Number(options.club) || 0;
        this.type = options.type || 'photo';
        this.playlistMode = !!options.playlistMode;
        this.selected = new Set();
        this.viewingUser = this.club === 0;
        this.msgbox = null;
    }

    getOwnerId() {
        return (this.club !== 0 && !this.viewingUser) ? -Math.abs(this.club) : window.openvk.current_id;
    }

    isSelected(id) {
        return this.selected.has(id) || isAttached(this.form, this.type, id, this.playlistMode);
    }

    close() {
        this.msgbox?.close();
        this.msgbox = null;
    }

    addClubToggleLink() {
        const header = this.msgbox.getNode().find('.ovk-diag-head');
        if (!header.length) return;
        const existingTitle = header.nodes[0]?.firstChild;
        if (existingTitle?.nodeType === Node.TEXT_NODE) {
            const titleSpan = document.createElement('span');
            titleSpan.className = 'picker-title-text';
            titleSpan.textContent = existingTitle.textContent;
            header.nodes[0].replaceChild(titleSpan, existingTitle);
        }
        const linkId = `${this.type}_picker_toggle`;
        const labelKey = this.viewingUser ? `back_to_club_${this.type}s` : `choose_from_my_${this.type}s`;
        header.append(`<span class="toggle_link" id="${linkId}"><span class="divider">|</span><a href="#" class="tab_link picker-toggle-link">
            <vkifyloc name="${labelKey}"></vkifyloc></a></span>`);
        window.processVkifyLocTags?.();
    }

    updateAttachButton() {
        const bar = this.msgbox.getNode().find('.ovk-diag-action');
        const btn = bar.find('.picker-attach-selected');
        const count = this.selected.size;
        if (count > 0) {
            if (!btn.length) bar.prepend(`<input type="button" class="button picker-attach-selected" value="${tr('attach')} (${count})">`);
            else btn.attr('value', `${tr('attach')} (${count})`);
        } else {
            btn.remove();
        }
    }

    _getItemData(row, id) {
        return this.adapter?.getItemData?.(row, id) || { type: this.type, id };
    }

    handleItemSelect(row, id) {
        if (this.isSelected(id)) {
            this.selected.delete(id);
            row.removeClass('selected');
            row.find('.picker-item-select span, .attachAudio span, .attachDocument span').text(tr('attach'));
        } else {
            const currentAttached = getAttachedCount(this.form, this.playlistMode);
            const pendingNew = [...this.selected].filter(sid => !isAttached(this.form, this.type, sid, this.playlistMode)).length;
            if (!this.playlistMode && currentAttached + pendingNew + 1 > MAX_ATTACHMENTS) {
                NewNotification(tr('error'), tr('too_many_attachments'), null, () => {}, 5000, false);
                return;
            }
            this.selected.add(id);
            row.addClass('selected');
            row.find('.picker-item-select span, .attachAudio span, .attachDocument span').text(tr('detach'));
        }
        this.updateAttachButton();
    }

    handleItemAttach(row, id) {
        if (isAttached(this.form, this.type, id, this.playlistMode)) return;
        if (!canAttach(this.form, 1, this.playlistMode)) return;
        this.attachItem(this._getItemData(row, id));
        this.close();
    }

    attachItem(data) {
        if (data.alignment === 'vertical' || data.html) appendVertical(this.form, data, this.playlistMode);
        else appendHorizontal(this.form, data);
    }

    attachSelected() {
        const toAttach = [...this.selected].filter(id => !isAttached(this.form, this.type, id, this.playlistMode));
        if (!canAttach(this.form, toAttach.length, this.playlistMode)) return;
        toAttach.forEach(id => {
            const row = this.msgbox.getNode().find(`[data-picker-id="${id}"]`);
            this.attachItem(this._getItemData(row, id));
        });
    }
}

class AttachmentPicker extends AttachmentPickerBase {
    constructor(options) {
        super(options);
        this.adapter = options.adapter;
        this.loading = false;
        this.abortController = null;
        this._loadGeneration = 0;

        this._cache = {
            user: this._createCacheEntry(),
            group: this._createCacheEntry()
        };
    }

    get page() { return this._getCache().page; }
    set page(v) { this._getCache().page = v; }

    get query() { return this._getCache().query; }
    set query(v) { this._getCache().query = v; }

    _createCacheEntry() {
        return {
            loaded: false,
            staleAt: 0,
            page: 0,
            hasMore: false,
            query: ''
        };
    }

    _getCacheKey() {
        return this.viewingUser ? 'user' : 'group';
    }

    _getCache() {
        return this._cache[this._getCacheKey()];
    }

    _markCacheFresh() {
        this._getCache().staleAt = Date.now() + CACHE_TTL_MS;
    }

    _getContainer(forUser = this.viewingUser) {
        const key = forUser ? 'user' : 'group';
        return this.msgbox?.getNode().find(`.picker-items--${key}`);
    }

    _switchContainer(toUser) {
        const node = this.msgbox.getNode();
        node.find('.picker-items--user, .picker-items--group').removeClass('picker-items--active');
        const key = toUser ? 'user' : 'group';
        node.find(`.picker-items--${key}`).addClass('picker-items--active');
    }

    async _loadContainerIfNeeded(forUser) {
        const cache = this._cache[forUser ? 'user' : 'group'];
        if (cache.loaded && !this._isCacheStaleFor(forUser)) return;

        const prevViewingUser = this.viewingUser;
        this.viewingUser = forUser;
        await this.load();
        this.viewingUser = prevViewingUser;
    }

    _isCacheStaleFor(forUser) {
        const cache = this._cache[forUser ? 'user' : 'group'];
        return cache.loaded && Date.now() > cache.staleAt;
    }

    _preloadAlternateContainer() {
        const forUser = !this.viewingUser;
        const cache = this._cache[forUser ? 'user' : 'group'];
        if (cache.loaded && !this._isCacheStaleFor(forUser)) return;

        const doPreload = () => this._loadContainerIfNeeded(forUser);
        if ('requestIdleCallback' in window) {
            requestIdleCallback(doPreload, { timeout: 3000 });
        } else {
            setTimeout(doPreload, 500);
        }
    }

    ensureSelected(id) {
        const selected = this.isSelected(id);
        if (selected) this.selected.add(id);
        return selected;
    }

    async prefetch() {
        this._initialData = await this.adapter.fetch(this, null);
        this._preRendered = this._preRenderInitialData();
    }

    show() {
        const preRendered = this._preRendered;

        this.msgbox = new CMessageBox({
            title: this.adapter.title,
            body: this.adapter.buildBody(this, preRendered),
            close_on_buttons: false,
            warn_on_exit: true,
            buttons: this.adapter.buttons || [],
            callbacks: this.adapter.callbacks?.(this) || []
        });

        this.applyWidth();
        this.setupCommonHandlers();
        this.adapter.setupHandlers?.(this);

        if (this.club !== 0 && this.adapter.supportsClubToggle) {
            this.addClubToggleLink();
        }

        if (preRendered) {
            const cache = this._getCache();
            cache.loaded = true;
            cache.hasMore = preRendered.hasMore || false;
            this._markCacheFresh();

            if (preRendered.hasMore) {
                const container = this._getContainer();
                container.append(`<div class="show_more button button_gray picker-show-more" data-page="${this.page + 1}">${tr('show_more')}</div>`);
            }
        }
        this._initialData = null;
        this._preRendered = null;
        this.updateAttachButton();
        this.adapter.afterLoad?.(this, preRendered);
        this._setupInfiniteScroll();
    }

    _preRenderInitialData() {
        const result = this._initialData;
        if (!result?.items?.length) return result;
        result.renderedHTML = result.items.map(item => this.adapter.renderItem(this, item)).join('');
        return result;
    }

    applyWidth() {
        if (!this.adapter.width) return;
        const node = this.msgbox.getNode()?.nodes?.[0];
        if (node?.style) node.style.width = this.adapter.width;
    }

    updateToggleLink() {
        const linkEl = this.msgbox.getNode().find('.picker-toggle-link');
        if (!linkEl.length) return;
        const key = this.viewingUser ? `back_to_club_${this.type}s` : `choose_from_my_${this.type}s`;
        linkEl.html(`<vkifyloc name="${key}"></vkifyloc>`);
        window.processVkifyLocTags?.();
    }

    setupCommonHandlers() {
        const node = this.msgbox.getNode();

        node.on('click', '.picker-toggle-link', async (e) => {
            e.preventDefault();
            if (this.loading) return;

            this.viewingUser = !this.viewingUser;
            this.updateToggleLink();
            this.selected.clear();
            this._switchContainer(this.viewingUser);

            const cache = this._getCache();
            if (!cache.loaded) {
                await this.load();
            } else if (this._isCacheStaleFor(this.viewingUser)) {
                await this.load();
            }
            this._infiniteScroll?.reset();
            this.updateAttachButton();
        });

        node.on('mouseenter', '.picker-toggle-link', () => {
            this._preloadAlternateContainer();
        });

        node.on('click', '.picker-item-select', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            this.handleItemSelect(row, id);
        });

        node.on('click', '.picker-item-attach', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                this.handleItemSelect(row, id);
            } else {
                this.handleItemAttach(row, id);
            }
        });

        node.on('click', '.picker-attach-selected', () => {
            this.attachSelected();
            this.close();
        });

        const searchEl = node.find('.picker-search').nodes[0];
        if (searchEl && window.uiSearch) {
            window.uiSearch.init(searchEl, {
                onInput: async (q) => { this.query = q; this.page = 0; await this.load(); this._infiniteScroll?.reset(); },
                onReset: async () => { this.query = ''; this.page = 0; await this.load(); this._infiniteScroll?.reset(); },
                timeout: 400
            });
        }
    }

    _combinedAbortSignal(controller, signal) {
        if (!signal) return controller.signal;
        if (controller.signal.aborted || signal.aborted) {
            const ac = new AbortController();
            ac.abort();
            return ac.signal;
        }
        const ac = new AbortController();
        const abort = () => ac.abort();
        controller.signal.addEventListener('abort', abort, { once: true });
        signal.addEventListener('abort', abort, { once: true });
        return ac.signal;
    }

    async load(append = false, useInitial = false, signal = null) {
        const generation = ++this._loadGeneration;
        this.loading = true;
        this.abortController?.abort();
        this.abortController = new AbortController();

        const cache = this._getCache();
        const container = this._getContainer();
        const rowsClass = this.adapter.rowsClass;

        let rowsContainer = rowsClass ? container.find(`.${rowsClass}`) : container;
        if (rowsClass && !rowsContainer.length) {
            container.html(`<div class="${rowsClass}"></div>`);
            rowsContainer = container.find(`.${rowsClass}`);
        }

        const targetContainer = rowsClass ? rowsContainer : container;

        if (!append && !useInitial) {
            targetContainer.html('<div class="picker-loading"></div>');
            container.find('.picker-show-more').remove();
        }

        const isStale = () => generation !== this._loadGeneration;

        try {
            const fetchSignal = this._combinedAbortSignal(this.abortController, signal);
            const result = useInitial && this._initialData
                ? this._initialData
                : await this.adapter.fetch(this, fetchSignal);
            this._initialData = null;
            if (isStale() || !result) return;

            if (!append) targetContainer.html('');

            if (!result.items?.length && !append) {
                container.html(`<div class="information">${this.adapter.emptyMessage || tr('no_results')}</div>`);
                cache.loaded = true;
                cache.hasMore = false;
                this._markCacheFresh();
                this.adapter.afterLoad?.(this, result);
                return result;
            }

            if (rowsClass) targetContainer.addClass(rowsClass);
            const html = result.items.map(item => this.adapter.renderItem(this, item)).join('');
            targetContainer.append(html);

            cache.loaded = true;
            cache.page = append ? cache.page : 0;
            cache.hasMore = result.hasMore;
            this._markCacheFresh();

            container.find('.picker-show-more').remove();
            if (result.hasMore) {
                container.append(`<div class="show_more button button_gray picker-show-more" data-page="${cache.page + 1}">${tr('show_more')}</div>`);
            }

            this.updateAttachButton();
            this.adapter.afterLoad?.(this, result);
            return result;
        } catch (err) {
            if (isStale() || err.name === 'AbortError') return;
            console.error(`[AttachmentPicker] Load error:`, err);
            if (!append) {
                if (rowsClass) targetContainer.removeClass(rowsClass);
                targetContainer.html(`<div class="information">${tr('error')}</div>`);
            }
            if (append) throw err;
        } finally {
            if (!isStale()) this.loading = false;
        }
    }

    _setupInfiniteScroll() {
        if (!this.msgbox) return;

        if (this._infiniteScroll) {
            this._infiniteScroll.disconnect();
        }

        this._infiniteScroll = CF.infiniteScroll('.picker-show-more', {
            container: () => this._getContainer(),
            load: async (page, signal) => {
                const container = this._getContainer();
                const btn = container.find('.picker-show-more');
                this.page = Number(btn.attr('data-page')) || this.page + 1;
                return await this.load(true, false, signal);
            },
            render: () => {},
            hasMore: (result) => !!result && result.hasMore,
            onError: () => {}
        });
    }

    close() {
        this._infiniteScroll?.disconnect();
        this.abortController?.abort();
        super.close();
    }
}

const PHOTO_PER_PAGE = 16;
const ALBUMS_PER_PAGE = 2;

const renderPhotoItem = (photo, isSelected) => {
    const baseId = `${photo.owner_id}_${photo.id}`;
    const key = photo.access_key || '';
    const fullId = baseId + (key ? `_${key}` : '');
    const pageUrl = baseId + (key ? `?key=${key}` : '');
    const thumb = photo.sizes[4]?.url || photo.sizes[1]?.url || photo.sizes[0]?.url;
    const preview = photo.sizes[4]?.url || photo.sizes[1]?.url || photo.sizes[0]?.url;
    const fullsize = photo.sizes[9]?.url || photo.sizes[photo.sizes.length - 1]?.url;
    return `<a class="photos_choose_row picker-item-attach ${isSelected ? 'selected' : ''}" href="javascript:void(0)" 
               data-picker-id="${fullId}" data-key="${key}" data-page-url="${pageUrl}" data-preview="${preview}" data-fullsize="${fullsize}">
        <div class="photo_row_img" style="background-image: url('${thumb}')"></div>
        <div class="photos_choose_row_bg"></div>
        <div class="media_check_btn_wrap picker-item-select"><div class="media_check_btn"></div></div>
    </a>`;
};

const renderPhotosGrid = (photos, picker, hasMore, page) => {
    if (!photos?.length) return `<div class="information">${tr('is_x_photos_zero')}</div>`;
    const itemsHtml = photos.map(p => {
        const fullId = `${p.owner_id}_${p.id}` + (p.access_key ? `_${p.access_key}` : '');
        return renderPhotoItem(p, picker.isSelected(fullId));
    }).join('');
    const showMoreHtml = hasMore ? `<div class="show_more button button_gray picker-show-more" data-page="${page + 1}">${tr('show_more')}</div>` : '';
    return `<div class="photos_choose_rows">${itemsHtml}</div>${showMoreHtml}`;
};

const renderAlbumsGrid = (albums, hasMore) => {
    if (!albums?.items?.length) return `<div class="information">${tr('albums_zero')}</div>`;
    const itemsHtml = albums.items.map(renderAlbumHTML).join('');
    const showMoreHtml = hasMore ? `<div class="show_more button button_gray picker-albums-more">${tr('show_more')}</div>` : '';
    return `<div class="photos_choose_album_rows">${itemsHtml}</div>${showMoreHtml}`;
};

const fetchAlbums = async (ownerId, page = 0) => {
    return await window.OVKAPI.call('photos.getAlbums', {
        owner_id: ownerId,
        need_covers: 1,
        photo_sizes: 1,
        need_system: 1,
        count: ALBUMS_PER_PAGE,
        offset: page * ALBUMS_PER_PAGE
    });
};

const fetchPhotos = async (ownerId, albumId, page = 0) => {
    const params = { owner_id: ownerId, photo_sizes: 1, count: PHOTO_PER_PAGE, offset: page * PHOTO_PER_PAGE };
    if (albumId) params.album_id = albumId;
    const method = albumId ? 'photos.get' : 'photos.getAll';
    const result = await window.OVKAPI.call(method, params);
    if (!result) return { items: [], hasMore: false, count: 0 };
    return { items: result.items || [], hasMore: (page + 1) * PHOTO_PER_PAGE < result.count, count: result.count };
};

class PhotoMainView {
    constructor(picker) {
        this.picker = picker;
        this.albums = null;
        this.photos = null;
        this.albumsPage = 0;
        this.photosPage = 0;
    }

    get showRecentPhotos() { return this.picker.viewingUser; }
    get ownerId() { return this.picker.getOwnerId(); }

    async prefetch() {
        const albumsPromise = fetchAlbums(this.ownerId, 0);
        if (this.showRecentPhotos) {
            const [albums, photos] = await Promise.all([albumsPromise, fetchPhotos(this.ownerId, null, 0)]);
            this.albums = albums;
            this.photos = photos;
        } else {
            this.albums = await albumsPromise;
            this.photos = { items: [], hasMore: false };
        }
    }

    buildBody() {
        const albumsHtml = renderAlbumsGrid(this.albums, this.albums && (this.albumsPage + 1) * ALBUMS_PER_PAGE < this.albums.count);
        const photosHtml = this.showRecentPhotos ? renderPhotosGrid(this.photos?.items, this.picker, this.photos?.hasMore, this.photosPage) : '';
        return `<div class='attachment_selector'>
            <input type="file" multiple accept="image/*" class="picker-upload-input" style="display:none">
            ${this.showRecentPhotos ? buildUploadButton() : ''}
            <div id='attachment_insert' style='height: unset; padding: 0'>
                <div id='albums_content' class="photos_container_albums">${albumsHtml}</div>
                ${this.showRecentPhotos ? `<div id='photos_content'>${photosHtml}</div>` : ''}
            </div>
        </div>`;
    }

    setupHandlers(node) {
        if (this.showRecentPhotos) {
            node.on('click', '.picker-upload-btn', () => node.find('.picker-upload-input').nodes[0]?.click());
            node.on('change', '.picker-upload-input', (e) => {
                if (e.target.files?.length) {
                    Array.from(e.target.files).forEach(f => { window.__uploadToTextarea?.(f, this.picker.form); });
                    this.picker.close();
                }
            });
            this._setupDragDrop(node);
        }

        node.on('click', '.picker-album', async (e) => {
            e.preventDefault();
            const albumEl = u(e.currentTarget);
            const albumId = Number(albumEl.attr('data-album-id'));
            const title = albumEl.find('.page_album_title_text').nodes[0]?.textContent?.trim() || tr('select_photo');
            await this.picker.switchToAlbumView(albumId, title);
        });

        node.on('click', '.picker-albums-more', async (e) => {
            e.preventDefault();
            const target = u(e.currentTarget);
            target.addClass('lagged');
            this.albumsPage++;
            try {
                const moreAlbums = await fetchAlbums(this.ownerId, this.albumsPage);
                const container = node.find('#albums_content');
                const rows = container.find('.photos_choose_album_rows');
                rows.append(moreAlbums.items.map(renderAlbumHTML).join(''));
                container.find('.picker-albums-more').remove();
                if ((this.albumsPage + 1) * ALBUMS_PER_PAGE < moreAlbums.count) {
                    container.append(`<div class="show_more button button_gray picker-albums-more">${tr('show_more')}</div>`);
                }
            } catch (err) {
                console.error('[PhotoMainView] Failed to load albums:', err);
            } finally {
                target.removeClass('lagged');
            }
        });

        if (this.showRecentPhotos) {
            this._photosScroller = CF.infiniteScroll('.picker-show-more', {
                container: () => node.find('#photos_content'),
                load: async (page, signal) => {
                    this.photosPage++;
                    return await fetchPhotos(this.ownerId, null, this.photosPage);
                },
                render: (result, container) => {
                    const rows = container.find('.photos_choose_rows');
                    rows.append(result.items.map(p => {
                        const fullId = `${p.owner_id}_${p.id}` + (p.access_key ? `_${p.access_key}` : '');
                        return renderPhotoItem(p, this.picker.isSelected(fullId));
                    }).join(''));
                    container.find('.picker-show-more').remove();
                    if (result.hasMore) {
                        container.append(`<div class="show_more button button_gray picker-show-more" data-page="${this.photosPage + 1}">${tr('show_more')}</div>`);
                    }
                },
                hasMore: (result) => result.hasMore,
                onError: (err) => console.error('[PhotoMainView] Failed to load photos:', err)
            });
        }
    }

    disconnectScrollers() {
        this._albumsScroller?.disconnect();
        this._photosScroller?.disconnect();
        this._albumsScroller = null;
        this._photosScroller = null;
    }

    _setupDragDrop(node) {
        const dropTarget = node.find('.attachment_selector').nodes[0];
        if (!dropTarget) return;
        let dragDepth = 0;
        const isFileDrag = (e) => e?.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
        const getImageFiles = (e) => Array.from(e?.dataTransfer?.files || []).filter(f => f && (f.type?.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(f.name)));
        const setDragState = (on) => node[on ? 'addClass' : 'removeClass']('ovk-photo-dragover');

        dropTarget.addEventListener('dragenter', (e) => { if (isFileDrag(e)) { e.preventDefault(); e.stopPropagation(); dragDepth++; setDragState(true); } });
        dropTarget.addEventListener('dragover', (e) => { if (isFileDrag(e)) { e.preventDefault(); e.stopPropagation(); try { e.dataTransfer.dropEffect = 'copy'; } catch {} setDragState(true); } });
        dropTarget.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) setDragState(false); });
        dropTarget.addEventListener('drop', (e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault(); e.stopPropagation(); dragDepth = 0; setDragState(false);
            const files = getImageFiles(e);
            if (!files.length) return;
            const current = getAttachedCount(this.picker.form);
            const allowed = Math.max(0, MAX_ATTACHMENTS - current);
            if (!allowed) { canAttach(this.picker.form, 1); return; }
            files.slice(0, allowed).forEach(f => { window.__uploadToTextarea?.(f, this.picker.form); });
            this.picker.close();
        });
    }

    getState() {
        return { albums: this.albums, photos: this.photos, albumsPage: this.albumsPage, photosPage: this.photosPage };
    }

    restoreState(state) {
        if (state) { this.albums = state.albums; this.photos = state.photos; this.albumsPage = 0; this.photosPage = 0; }
    }
}

class PhotoAlbumView {
    constructor(picker, albumId, title) {
        this.picker = picker;
        this.albumId = albumId;
        this.title = title;
        this.photos = null;
        this.page = 0;
    }

    get ownerId() { return this.picker.getOwnerId(); }

    async prefetch() {
        this.photos = await fetchPhotos(this.ownerId, this.albumId, 0);
    }

    buildBody() {
        const photosHtml = renderPhotosGrid(this.photos?.items, this.picker, this.photos?.hasMore, this.page);
        return `<div class='attachment_selector'>
            <div id='attachment_insert' style='height: unset; padding: 0'>
                <div id='photos_content'>${photosHtml}</div>
            </div>
        </div>`;
    }

    setupHandlers(node) {
        this._photosScroller = CF.infiniteScroll('.picker-show-more', {
            container: () => node.find('#photos_content'),
            load: async (page, signal) => {
                this.page++;
                return await fetchPhotos(this.ownerId, this.albumId, this.page);
            },
            render: (result, container) => {
                const rows = container.find('.photos_choose_rows');
                rows.append(result.items.map(p => {
                    const fullId = `${p.owner_id}_${p.id}` + (p.access_key ? `_${p.access_key}` : '');
                    return renderPhotoItem(p, this.picker.isSelected(fullId));
                }).join(''));
                container.find('.picker-show-more').remove();
                if (result.hasMore) {
                    container.append(`<div class="show_more button button_gray picker-show-more" data-page="${this.page + 1}">${tr('show_more')}</div>`);
                }
            },
            hasMore: (result) => result.hasMore,
            onError: (err) => console.error('[PhotoAlbumView] Failed to load photos:', err)
        });
    }

    disconnectScrollers() {
        this._photosScroller?.disconnect();
        this._photosScroller = null;
    }

    getButtons() {
        return [tr('paginator_back')];
    }

    getCallbacks() {
        return [() => this.picker.switchToMainView()];
    }
}

class PhotoPicker extends AttachmentPickerBase {
    constructor(options) {
        super({ ...options, type: 'photo' });
        this._mainViewState = { user: null, group: null };
        this._currentView = null;
    }

    _getItemData(row, id) {
        const key = row.attr('data-key') || '';
        return {
            type: 'photo',
            id,
            page_url: row.attr('data-page-url') || id,
            key,
            preview: row.attr('data-preview'),
            fullsize_url: row.attr('data-fullsize')
        };
    }

    async open() {
        await this._showMainView();
    }

    async _showMainView() {
        const view = new PhotoMainView(this);
        const stateKey = this.viewingUser ? 'user' : 'group';
        if (this._mainViewState[stateKey]) {
            view.restoreState(this._mainViewState[stateKey]);
        } else {
            await ajloader.wrap(() => view.prefetch());
        }
        this._mainViewState[stateKey] = view.getState();
        this._currentView = view;
        this._showMessageBox(view, tr('select_photo'), [], []);
    }

    async switchToAlbumView(albumId, title) {
        if (this._currentView instanceof PhotoMainView) {
            const stateKey = this.viewingUser ? 'user' : 'group';
            this._mainViewState[stateKey] = this._currentView.getState();
        }
        this.close();
        const view = new PhotoAlbumView(this, albumId, title);
        await ajloader.wrap(() => view.prefetch());
        this._currentView = view;
        this._showMessageBox(view, title, view.getButtons(), view.getCallbacks());
    }

    async switchToMainView() {
        this.close();
        await this._showMainView();
    }

    async toggleContext() {
        if (this._currentView instanceof PhotoMainView) {
            const stateKey = this.viewingUser ? 'user' : 'group';
            this._mainViewState[stateKey] = this._currentView.getState();
        }
        this.close();
        this.viewingUser = !this.viewingUser;
        this.selected.clear();
        await this._showMainView();
    }

    close() {
        this._currentView?.disconnectScrollers?.();
        this._currentView = null;
        super.close();
    }

    _showMessageBox(view, title, buttons, callbacks) {
        this.msgbox = new CMessageBox({
            title,
            body: view.buildBody(),
            close_on_buttons: false,
            warn_on_exit: true,
            buttons,
            callbacks
        });
        const node = this.msgbox.getNode();
        node.nodes[0].style.width = '640px';

        if (this.club !== 0 && view instanceof PhotoMainView) this.addClubToggleLink();
        view.setupHandlers(node);
        this._setupViewHandlers(node);
        this.updateAttachButton();
    }

    _setupViewHandlers(node) {
        node.on('click', '.picker-toggle-link', async (e) => {
            e.preventDefault();
            await this.toggleContext();
        });

        node.on('click', '.picker-item-select', (e) => {
            e.preventDefault(); e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            this.handleItemSelect(row, row.attr('data-picker-id'));
        });

        node.on('click', '.picker-item-attach', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault(); e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                this.handleItemSelect(row, id);
            } else {
                this.handleItemAttach(row, id);
            }
        });

        node.on('click', '.picker-attach-selected', () => {
            this.attachSelected();
            this.close();
        });
    }
}

const VideoAdapter = {
    title: tr('selecting_video'),
    width: '640px',
    supportsClubToggle: false,
    perPage: DEFAULT_PER_PAGE,
    emptyMessage: tr('no_videos'),
    rowsClass: 'video_block_layout',

    // biome-ignore lint/correctness/noUnusedFunctionParameters: interface
    buildBody(picker, preRendered) {
        const { itemsHTML, emptyHTML } = getPreRenderedHTML(preRendered, VideoAdapter.emptyMessage, 'video_block_layout');
        return `<div class='attachment_selector'>
            ${buildUploadButton()}
            <div class="videos_choose_search">
                ${buildSearchUI('search_for_videos')}
            </div>
            <div class="picker-content" style="height: unset; padding: 0">
                <div class="picker-items">${itemsHTML || emptyHTML}</div>
            </div>
        </div>`;
    },

    setupHandlers(picker) {
        const node = picker.msgbox.getNode();

        node.on('click', '.picker-upload-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            picker.close();
            window.showFastVideoUpload?.(picker.form, e);
        });

        node.on('click', '.video_item__thumb_link', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                picker.handleItemSelect(row, id);
            } else {
                picker.handleItemAttach(row, id);
            }
        });

        node.on('click', '.video_item_title', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                picker.handleItemSelect(row, id);
            } else {
                picker.handleItemAttach(row, id);
            }
        });
    },

    // biome-ignore lint/correctness/noUnusedFunctionParameters: interface
    async fetch(picker, signal) {
        const params = {
            extended: 1,
            count: VideoAdapter.perPage,
            offset: picker.page * VideoAdapter.perPage
        };

        const videos = picker.query
            ? await window.OVKAPI.call('video.search', { ...params, q: picker.query })
            : await window.OVKAPI.call('video.get', { ...params, owner_id: window.openvk.current_id });

        if (!videos) return null;

        return {
            items: (videos.items || []).map(v => ({ ...v, _profiles: videos.profiles, _groups: videos.groups })),
            hasMore: (picker.page + 1) * VideoAdapter.perPage < videos.count
        };
    },

    renderItem(picker, video) {
        const baseId = `${video.owner_id}_${video.id}`;
        const key = video.access_key || '';
        const fullId = baseId + (key ? `_${key}` : '');
        const pageUrl = baseId + (key ? `?key=${key}` : '');
        const selected = picker.ensureSelected(fullId);
        const thumb = video.image?.[0]?.url || '';
        const author = window.find_author?.(video.owner_id, video._profiles, video._groups);
        const authorName = author ? (author.first_name ? `${author.first_name} ${author.last_name}` : author.name) : 'Unknown';
        const authorUrl = author ? (video.owner_id > 0 ? `/${author.id}` : `/club${Math.abs(video.owner_id)}`) : '#';
        const platform = video.platform || (video.type && video.type !== 0 && video.type !== 'video' ? 'External' : '');

        return `<div class="video_item ${selected ? 'selected' : ''}" data-picker-id="${fullId}" data-key="${key}" data-page-url="${pageUrl}" data-preview="${thumb}" data-url="${video.player || `/video${baseId}`}">
            <a class="video_item__thumb_link picker-item-attach" href="javascript:void(0)">
                <div class="video_item_thumb_wrap">
                    <div class="video_item_thumb" style="background-image: url('${thumb}')"></div>
                    <div class="video_item_controls">
                        <div class="video_thumb_label">
                            ${platform ? `<span class="video_thumb_label_item video_thumb_label_platform">${platform}</span>` : ''}
                            ${!platform && video.duration ? `<span class="video_thumb_label_item video_thumb_label_duration">${fmtTime(video.duration)}</span>` : ''}
                        </div>
                        <div class="media_check_btn_wrap picker-item-select"><div class="media_check_btn"></div></div>
                    </div>
                </div>
            </a>
            <div class="video_item_info">
                <a class="video_item_title picker-item-attach" href="javascript:void(0)" title="${escapeHtml(video.title || '')}">${escapeHtml(video.title || '')}</a>
                <div class="video_item_author"><a class="mem_link" href="${authorUrl}" target="_blank">${authorName}</a></div>
                ${video.date ? `<div class="video_item_add_info"><span class="video_item_date_info"><span class="video_item_updated">${formatRelativeTime(video.date)}</span></span></div>` : ''}
            </div>
        </div>`;
    },

    getItemData(row, id) {
        const key = row.attr('data-key') || '';
        return {
            type: 'video',
            id,
            page_url: row.attr('data-page-url') || id,
            key,
            preview: row.attr('data-preview'),
            fullsize_url: row.attr('data-url')
        };
    }
};

const AudioAdapter = {
    title: tr('select_audio'),
    width: '560px',
    supportsClubToggle: true,
    perPage: DEFAULT_PER_PAGE,
    emptyMessage: tr('no_audios_thisuser'),
    buttons: [tr('close')],
    callbacks: (picker) => [() => picker.close()],
    rowsClass: '',

    buildBody(picker, preRendered) {
        const { itemsHTML, emptyHTML } = getPreRenderedHTML(preRendered, AudioAdapter.emptyMessage);
        const activeKey = picker.viewingUser ? 'user' : 'group';
        const hasClub = picker.club !== 0;
        return `<div class='attachment_selector'>
            ${buildUploadButton()}
            <div class='audios_tab_content'>
                <div class='audios_search_container clear_fix'>
                    ${buildSearchUI('header_search', 'text')}
                    <select class="audio_search_type picker-search-type">
                        <option value="by_name">${tr("by_name")}</option>
                        <option value="by_performer">${tr("by_performer")}</option>
                    </select>
                </div>
                <div class="picker-content audiosInsert">
                    ${buildDualContainers(activeKey, hasClub, itemsHTML, emptyHTML)}
                </div>
            </div>
        </div>`;
    },

    setupHandlers(picker) {
        const node = picker.msgbox.getNode();
        picker._searchType = 'by_name';

        node.on('click', '.picker-upload-btn', () => {
            picker.close();
            window.showAudioUploadPopup?.({ ownerId: picker.getOwnerId() });
        });

        node.on('change', '.picker-search-type', (e) => {
            picker._searchType = e.target.value;
            picker.page = 0;
            picker.load();
        });
    },

    // biome-ignore lint/correctness/noUnusedFunctionParameters: interface
    async fetch(picker, signal) {
        const PlayersSearcher = window.playersSearcher || (typeof playersSearcher !== 'undefined' ? playersSearcher : null);
        if (!PlayersSearcher) throw new Error('playersSearcher not available');

        return new Promise((resolve, reject) => {
            const searcher = new PlayersSearcher("entity_audios", picker.getOwnerId());
            if (picker.query) {
                searcher.context_type = "search_context";
                searcher.query = picker.query;
                searcher.searchType = picker._searchType || 'by_name';
            }

            searcher.successCallback = (response, ctx) => {
                const doc = new DOMParser().parseFromString(response, "text/html");
                const pagesCount = Number(doc.querySelector("input[name='pagesCount']")?.value || 0);
                const count = Number(doc.querySelector("input[name='count']")?.value || 0);

                resolve({
                    items: Array.from(doc.querySelectorAll(".audioEmbed")),
                    hasMore: ctx.page < pagesCount,
                    count
                });
            };
            searcher.errorCallback = () => reject(new Error('Audio load failed'));
            searcher.movePage(picker.page + 1);
        });
    },

    renderItem(picker, audioEl) {
        const id = picker.playlistMode ? audioEl.dataset.realid : audioEl.dataset.prettyid;
        const selected = picker.ensureSelected(id);

        return `<div class='audio_attachment_header ${selected ? 'selected' : ''}' style="display:flex;width:100%;" data-picker-id="${id}">
            <div class='player_part'>${audioEl.outerHTML}</div>
            <div class="attachAudio picker-item-attach"><span>${selected ? tr("detach") : tr("attach")}</span></div>
        </div>`;
    },

    getItemData(row, id) {
        return {
            type: 'audio',
            id,
            html: row.find('.player_part').html(),
            alignment: 'vertical'
        };
    }
};

const DocumentAdapter = {
    title: tr('select_doc'),
    width: '636px',
    supportsClubToggle: true,
    perPage: DEFAULT_PER_PAGE,
    emptyMessage: tr('no_documents'),
    buttons: [tr('close')],
    callbacks: (picker) => [() => picker.close()],
    rowsClass: '',

    buildBody(picker, preRendered) {
        const { itemsHTML, emptyHTML } = getPreRenderedHTML(preRendered, DocumentAdapter.emptyMessage);
        const activeKey = picker.viewingUser ? 'user' : 'group';
        const hasClub = picker.club !== 0;
        return `<div class="docs_choose_wrap">
            ${buildUploadButton()}
            <div class="docs_choose_search">
                ${buildSearchUI('search_by_documents')}
            </div>
            <div class="picker-content clear_fix">
                ${buildDualContainers(activeKey, hasClub, itemsHTML, emptyHTML)}
            </div>
        </div>`;
    },

    setupHandlers(picker) {
        const node = picker.msgbox.getNode();

        node.on('click', '.picker-upload-btn', () => {
            picker.close();
            const clubId = picker.club !== 0 && !picker.viewingUser ? Math.abs(picker.club) : NaN;
            window.showDocumentUploadDialog?.("search", clubId, () => {}, picker.form);
        });
    },

    async fetch(picker, signal) {
        const fd = new FormData();
        fd.append("context", picker.query ? "search" : "list");
        fd.append("hash", window.router?.csrf || u("meta[name=csrf]").attr("value"));
        if (picker.query) fd.append("ctx_query", picker.query);

        const sourceArg = picker.viewingUser ? "" : (picker.club !== 0 ? picker.club : "");
        const response = await fetch(`/docs${sourceArg}?picker=1&p=${picker.page + 1}`, { method: "POST", body: fd, signal });
        const doc = new DOMParser().parseFromString(await response.text(), "text/html");

        const pagesCount = Number(doc.querySelector("input[name='pagesCount']")?.value || 0);
        const count = Number(doc.querySelector("input[name='count']")?.value || 0);

        return {
            items: Array.from(doc.querySelectorAll("._content")),
            hasMore: picker.page < pagesCount - 1,
            count
        };
    },

    renderItem(picker, docEl) {
        const id = docEl.dataset.attachmentdata;
        const selected = picker.ensureSelected(id);

        return `<div class='document_attachment_header ${selected ? 'selected' : ''}' data-picker-id="${id}" 
                    data-name="${escapeHtml(docEl.dataset.name || '')}">
            <div class="attachDocument picker-item-attach"><span>${selected ? tr("detach") : tr("attach")}</span></div>
            <div class='document_content'>${docEl.outerHTML}</div>
        </div>`;
    },

    getItemData(row, id) {
        const name = row.attr('data-name') || '';
        const urlParts = (id || '').split("_");
        return {
            type: 'doc',
            id,
            alignment: 'vertical',
            html: `<div class="docMainItem attachment_doc attachment_note">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><polygon points="0 0 0 10 8 10 8 4 4 4 4 0 0 0"/><polygon points="5 0 5 3 8 3 5 0"/></svg>
                <div class='attachment_note_content'>
                    <span class="attachment_note_text">${tr("document")}</span>
                    <span class="attachment_note_name"><a href="/doc${urlParts[0]}_${urlParts[1]}?key=${urlParts[2]}">${ovk_proc_strtr(escapeHtml(name), 50)}</a></span>
                </div>
            </div>`
        };
    }
};

const NoteAdapter = {
    title: tr('select_note'),
    width: '340px',
    supportsClubToggle: false,
    perPage: 10,
    emptyMessage: tr('no_notes'),
    buttons: [tr('close')],
    callbacks: (picker) => [() => picker.close()],
    rowsClass: '',

    // biome-ignore lint/correctness/noUnusedFunctionParameters: interface
    buildBody(picker, preRendered) {
        const { itemsHTML, emptyHTML } = getPreRenderedHTML(preRendered, NoteAdapter.emptyMessage);
        return `<div class='attachment_selector'>
            ${buildUploadButton('create_note')}
            <div class="picker-content" style="height: 270px; padding: 0">
                <div class="picker-items notesInsert">${itemsHTML || emptyHTML}</div>
            </div>
        </div>`;
    },

    setupHandlers(picker) {
        const node = picker.msgbox.getNode();
        node.find('.ovk-diag-body').attr('style', 'height:335px;padding:0px;');

        node.on('click', '.picker-upload-btn', () => {
            picker.close();
            window.router.route('/notes/create');
        });
    },

    // biome-ignore lint/correctness/noUnusedFunctionParameters: interface
    async fetch(picker, signal) {
        const notes = await window.OVKAPI.call('notes.get', {
            user_id: window.openvk.current_id,
            count: NoteAdapter.perPage,
            offset: picker.page * NoteAdapter.perPage
        });

        if (!notes) return null;

        return {
            items: notes.items || [],
            hasMore: (picker.page + 1) * NoteAdapter.perPage < notes.count
        };
    },

    renderItem(picker, note) {
        const id = `${note.owner_id}_${note.id}`;
        const selected = picker.ensureSelected(id);

        return `<div class='display_flex_row _content ${selected ? 'selected' : ''}' data-picker-id="${id}" data-name='${escapeHtml(note.title)}'>
            <div class="notes_titles" style='width: 73%;'>
                <div class="written">
                    <a href="${note.view_url}">${escapeHtml(note.title)}</a>
                    <small><span>${ovk_proc_strtr(escapeHtml(strip_tags(note.text)), 100)}</span></small>
                </div>
            </div>
            <div class="attachAudio picker-item-attach"><span>${selected ? tr('detach') : tr('attach')}</span></div>
        </div>`;
    },

    getItemData(row, id) {
        const name = row.attr('data-name') || '';
        return {
            type: 'note',
            id,
            alignment: 'vertical',
            html: `<div class="attachment_note">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><polygon points="0 0 0 10 8 10 8 4 4 4 4 0 0 0"/><polygon points="5 0 5 3 8 3 5 0"/></svg>
                <div class='attachment_note_content'>
                    <span class="attachment_note_text">${tr('note')}</span>
                    <span class="attachment_note_name">${ovk_proc_strtr(escapeHtml(name), 66)}</span>
                </div>
            </div>`
        };
    }
};

const adapters = {
    video: VideoAdapter,
    audio: AudioAdapter,
    document: DocumentAdapter,
    note: NoteAdapter
};

async function openPicker(type, form, club = 0, options = {}) {
    const adapter = adapters[type];
    if (!adapter) throw new Error(`Unknown attachment type: ${type}`);

    const picker = new AttachmentPicker({ type, form, club, adapter, playlistMode: !!options.playlistMode && type === 'audio' });
    try {
        await ajloader.wrap(() => picker.prefetch());
        picker.show();
    } catch (err) {
        console.error(`[AttachmentPicker] Error opening ${type} picker:`, err);
        ajloader.hide();
        NewNotification(tr('error'), err?.message || tr('error'), null, () => {}, 5000, false);
    }
    return picker;
}

function extractVideoTitleFromFilename(filename) {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

async function fetchYouTubeTitle(url) {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (!ytMatch) return null;
    try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.title || null;
    } catch { return null; }
}

function setupVideoTitleAutofill(container, fileSelector, linkSelector, nameSelector) {
    const $container = u(container);
    if (!$container.length) return;

    $container.on('change', fileSelector, (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const nameInput = $container.find(nameSelector).nodes[0];
        if (nameInput && !nameInput.value.trim()) {
            nameInput.value = extractVideoTitleFromFilename(file.name);
        }
    });

    let ytDebounce = null;
    $container.on('input', linkSelector, (e) => {
        clearTimeout(ytDebounce);
        const url = e.target.value.trim();
        if (!url) return;
        ytDebounce = setTimeout(async () => {
            const nameInput = $container.find(nameSelector).nodes[0];
            if (nameInput && !nameInput.value.trim()) {
                const title = await fetchYouTubeTitle(url);
                if (title && !nameInput.value.trim()) nameInput.value = title;
            }
        }, 500);
    });
}

vkify.hook(window, 'showFastVideoUpload', (formNode, event) => {
    let current_tab = 'file';
    const is_from_messenger = formNode && formNode.closest('.messenger-layer').length > 0;
    const msg = new CMessageBox({
        title: tr('upload_video'),
        close_on_buttons: false,
        warn_on_exit: true,
        unique_name: 'video_uploader',
        body: `
        <div id='_fast_video_upload'>
            <div id='_tabs'>
                <ul class="ui_tabs clear_fix">
                    <li><a class="ui_tab ui_tab_sel" data-name="file">${tr('video_file_upload')}</a></li>
                    <li><a class="ui_tab" data-name="youtube">${tr('video_youtube_upload')}</a></li>
                    <div class="ui_tabs_slider"></div>
                </ul>
            </div>
            <div id='__content' class='page_padding'></div>
        </div>
        `,
        buttons: [tr('upload_button'), tr('close')],
        callbacks: [async () => {
            const video_name = u(`#_fast_video_upload input[name='name']`).nodes[0]?.value;
            const video_desc = u(`#_fast_video_upload textarea[name='desc']`).nodes[0]?.value || '';
            let append_result = null;

            if (!video_name?.length) {
                u(`#_fast_video_upload input[name='name']`).nodes[0]?.focus();
                return;
            }

            const form_data = new FormData();
            const thisMsg = window.messagebox_stack[window.messagebox_stack.length - 1];
            const uploadBtn = thisMsg?.getNode().find('.ovk-diag-action button').nodes[0];

            switch (current_tab) {
                case 'youtube': {
                    const video_link = u(`#_fast_video_upload input[name='link']`).nodes[0]?.value;
                    if (!video_link?.length) {
                        u(`#_fast_video_upload input[name='link']`).nodes[0]?.focus();
                        return;
                    }

                    form_data.append('ajax', '1');
                    form_data.append('name', video_name);
                    form_data.append('desc', video_desc);
                    form_data.append('link', video_link);
                    form_data.append('unlisted', formNode ? 1 : 0);
                    form_data.append('hash', vkify.getCsrf());

                    if (is_from_messenger) {
                        form_data.append('is_from_messenger', '1');
                        const im = window.im_variants?.getCompromise?.() || window.im;
                        if (im?.state?.getOperator?.()?.supposed_type === 'club') {
                            form_data.append('club', Math.abs(im.state.getOperator().id));
                        }
                    }

                    uploadBtn?.classList.add('lagged');
                    const ytRes = await fetch('/videos/upload', { method: 'POST', body: form_data });
                    append_result = await ytRes.json();
                    break;
                }

                default: {
                    const video_file = u(`#_fast_video_upload input[name='blob']`).nodes[0];
                    if (!video_file?.files.length) return;

                    form_data.append('ajax', '1');
                    form_data.append('name', video_name);
                    form_data.append('desc', video_desc);
                    form_data.append('blob', video_file.files[0]);
                    form_data.append('unlisted', formNode ? 1 : 0);
                    form_data.append('hash', vkify.getCsrf());

                    if (is_from_messenger) {
                        form_data.append('is_from_messenger', '1');
                        const im = window.im_variants?.getCompromise?.() || window.im;
                        if (im?.state?.getOperator?.()?.supposed_type === 'club') {
                            form_data.append('club', Math.abs(im.state.getOperator().id));
                        }
                    }

                    uploadBtn?.classList.add('lagged');
                    const res = await fetch('/videos/upload', { method: 'POST', body: form_data });
                    append_result = await res.json();
                    break;
                }
            }

            if (append_result?.payload) {
                const payload = append_result.payload;
                if (formNode) {
                    const videoKey = payload.access_key || '';
                    const videoBaseId = `${payload.owner_id}_${payload.id}`;
                    const videoFullId = videoBaseId + (videoKey ? `_${videoKey}` : '');
                    const videoPageUrl = videoBaseId + (videoKey ? `?key=${videoKey}` : '');
                    const videoPreview = payload.image[0]?.url;
                    appendHorizontal(formNode, {
                        type: 'video',
                        preview: videoPreview,
                        page_url: videoPageUrl,
                        id: videoFullId,
                        key: videoKey,
                        fullsize_preview: videoPreview,
                        fullsize_url: videoPreview,
                    });
                }
                window.messagebox_stack.forEach(m => { m.close(); });
                if (!formNode) vkify.navigate(location.href);
            } else {
                fastError(append_result?.flash?.message || tr('error'));
                msg.close();
            }
        }, () => msg.close()]
    });

    msg.getNode().find('.ovk-diag-body').attr('style', 'padding:0!important');

    function switchTab(name) {
        current_tab = name;
        u('#_fast_video_upload .ui_tab').removeClass('ui_tab_sel');
        u(`#_fast_video_upload .ui_tab[data-name="${name}"]`).addClass('ui_tab_sel');

        const content = name === 'file' ? `
            <div class="form_field"><div class="form_label">${tr('info_name')}:</div><div class="form_data"><input type="text" name="name" /></div></div>
            <div class="form_field"><div class="form_label">${tr('description')}:</div><div class="form_data"><textarea name="desc"></textarea></div></div>
            <div class="form_field"><div class="form_label">${tr('video')}:</div><div class="form_data">
                <label class="button">${tr('browse')}<input type="file" name="blob" style="display:none" accept="video/*" /></label>
                <span id="filename" style="margin-left:7px"></span>
            </div></div>
        ` : `
            <div class="form_field"><div class="form_label">${tr('info_name')}:</div><div class="form_data"><input type="text" name="name" /></div></div>
            <div class="form_field"><div class="form_label">${tr('description')}:</div><div class="form_data"><textarea name="desc"></textarea></div></div>
            <div class="form_field"><div class="form_label">${tr('video_link_to_yt')}:</div><div class="form_data">
                <input type="text" name="link" placeholder="https://www.youtube.com/watch?v=9FWSRQEqhKE" />
            </div></div>
        `;
        msg.getNode().find('#__content').html(content);
        vkify.initTabSliderSafe?.();
    }

    u('#_fast_video_upload').on('click', '.ui_tab', (e) => {
        const name = u(e.target).closest('.ui_tab').nodes[0]?.dataset?.name;
        if (name) switchTab(name);
    });

    switchTab('file');
    initVideoTitleAutofill('#_fast_video_upload');
    vkify.initTabSliderSafe?.();
}, 'replace');

function initVideoTitleAutofill(container) {
    setupVideoTitleAutofill(container, 'input[name="blob"]', 'input[name="link"]', 'input[name="name"]');
}

vkify.onPage(() => {
    const uploadForm = document.getElementById('_video_upload_form');
    if (uploadForm) initVideoTitleAutofill('#_video_upload_form');
});

window.AttachmentPicker = AttachmentPicker;
window.PhotoPicker = PhotoPicker;
window.attachmentAdapters = adapters;
window.openAttachmentPicker = openPicker;

vkify.bindOnce('pickerButtons', () => {
    const resolveForm = (el) => (el ? u(el).closest('#write') : u());

    document.addEventListener('click', async (e) => {
        const photo = e.target.closest('#__photoAttachment, .im-attach-photo');
        if (photo) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const club = Number(photo.dataset.club ?? 0);
            const picker = new PhotoPicker({ form: resolveForm(photo), club });
            await picker.open();
            return;
        }

        const video = e.target.closest('#__videoAttachment');
        if (video) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await openPicker('video', resolveForm(video));
            return;
        }

        const audio = e.target.closest('#__audioAttachment');
        if (audio) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const club = Number(audio.dataset.club ?? 0);
            await openPicker('audio', resolveForm(audio), club);
            return;
        }

        const docBtn = e.target.closest('#__documentAttachment, .attach_document');
        if (docBtn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const club = Number(docBtn.dataset.club ?? 0);
            await openPicker('document', resolveForm(docBtn), club);
            return;
        }

        const noteBtn = e.target.closest('#__notesAttachment, .attach_note');
        if (noteBtn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await openPicker('note', resolveForm(noteBtn));
            return;
        }
    }, true);

    u(document).on('click', '#_vkifyPlaylistAppendTracks', async (e) => {
        if (e.__vkifyHandled) return;
        e.__vkifyHandled = true;
        await openPicker('audio', u('.PE_wrapper'), 0, { playlistMode: true });
    });
});

})();
