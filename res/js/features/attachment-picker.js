import { computeMakimaGrid } from '../utils/makima-grid.js';

(() => {

const tr = window.tr;
const vtr = (key, fallback) => (window.vkifylang && window.vkifylang[key]) || fallback || key;
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

const VIDEO_PLATFORM_LABELS = { youtube: 'YouTube', vimeo: 'Vimeo', rutube: 'Rutube' };
const videoPlatformLabel = (platform) => {
    if (!platform) return '';
    const known = VIDEO_PLATFORM_LABELS[String(platform).toLowerCase()];
    return known || String(platform).replace(/^./, (c) => c.toUpperCase());
};

const ajloader = {
    _count: 0,
    show() { this._count++; u('#ajloader').addClass('shown'); },
    hide() { this._count = Math.max(0, this._count - 1); if (!this._count) u('#ajloader').removeClass('shown'); },
    async wrap(fn) { this.show(); try { return await fn(); } finally { this.hide(); } }
};

const composerLayoutRaf = new WeakMap();
function scheduleComposerLayout(containerEl) {
    if (!containerEl) return;
    if (containerEl.nodeType !== 1 && containerEl.nodes?.[0]) {
        containerEl = containerEl.nodes[0];
    }
    if (!containerEl || containerEl.nodeType !== 1 || composerLayoutRaf.has(containerEl)) return;
    composerLayoutRaf.set(containerEl, requestAnimationFrame(() => {
        composerLayoutRaf.delete(containerEl);
        layoutComposerHorizontal(containerEl);
    }));
}

// Pure layout computation shared by layoutComposerHorizontal and the drag
// reorder preview: given an ordered list of attachment elements, returns the
// Makima tile placements in container space (padding applied by the caller)
// plus the total content height. Returns null when layout is impossible.
function computeComposerBoxes(containerEl, items) {
    const isFastchat = Boolean(containerEl.closest('.fc_tab_wrap, #fastchats_container, .fastchat-box'));
    const isMessenger = Boolean(isFastchat || containerEl.closest('.im-chat-input, .messenger-app--input, .messenger-layer, #im_container'));
    const isMobileModal = Boolean(containerEl.closest('#_edit_post_modal, #_new_post_modal'));
    // Comment attachments render via getChildrenWithLayout(240), which passes
    // maxHeight = maxWidth, so the composer preview uses the same 240x240 box.
    const isComment = containerEl.classList.contains('post-horizontal--comment');

    const padKey = isMobileModal ? 'm' : 'd';
    if (!containerEl.__mkPad || containerEl.__mkPadKey !== padKey) {
        const style = window.getComputedStyle(containerEl);
        containerEl.__mkPadKey = padKey;
        containerEl.__mkPad = {
            x: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0),
            top: parseFloat(style.paddingTop) || 0,
            bottom: parseFloat(style.paddingBottom) || 0,
            left: parseFloat(style.paddingLeft) || 0,
        };
    }
    const pad = containerEl.__mkPad;

    const parentEl = containerEl.parentElement;
    const msgBoxEl = isMessenger ? containerEl.closest('.im-chat-input--textarea, .messenger-app--input---messagebox') : null;
    let availW = (containerEl.clientWidth ? containerEl.clientWidth - pad.x : 0)
        || (msgBoxEl?.clientWidth || 0)
        || (parentEl ? parentEl.clientWidth - 40 : 0);
    if (!availW || availW < 120) {
        availW = isMobileModal
            ? Math.max(240, (window.innerWidth || 360) - 32)
            : (isFastchat ? 220 : (isMessenger ? 400 : 510));
    }
    const maxW = Math.min(isFastchat ? 240 : (isComment ? 240 : (isMessenger ? 420 : 510)), availW);
    const maxH = isFastchat
        ? Math.min(160, Math.round(maxW * 0.66))
        : (isComment ? maxW
            : (isMobileModal ? Math.min(230, Math.round(maxW * 0.66)) : Math.round(maxW * 0.666)));
    const GAP = 4;

    const visualItems = items.map((el) => {
        const type = el.dataset.type || 'photo';
        let w = parseInt(el.dataset.width, 10) || 0;
        let h = parseInt(el.dataset.height, 10) || 0;
        const img = el.querySelector('img');
        if ((!w || !h) && img) {
            w = img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0;
            h = img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0;
            if (w && h) {
                el.dataset.width = String(w);
                el.dataset.height = String(h);
            }
        }
        if (!w || !h) {
            w = type === 'video' ? 640 : 600;
            h = type === 'video' ? 360 : 450;
        }
        return type === 'video'
            ? { el, type: 'video', video: { width: w, height: h } }
            : { el, type: 'photo', photo: { width: w, height: h } };
    });

    const layout = computeMakimaGrid(visualItems, {
        maxWidth: maxW,
        maxHeight: maxH,
        gap: GAP,
        isFastchat: false,
    });

    if (!layout) return null;

    const tiles = [];
    let contentH = 0;

    if (layout.type === 'single') {
        const t = layout.tile;
        const isSingleVideoWithTitle = Boolean(!isMessenger && t.item.el.dataset.type === 'video' && t.item.el.dataset.title);
        tiles.push({ el: t.item.el, x: 0, y: 0, w: t.width, h: t.height, isSingle: true, videoTitle: isSingleVideoWithTitle });
        contentH = t.height + (isSingleVideoWithTitle ? 28 : 0);
    } else if (layout.type === 'split_left') {
        const totalFlex = (layout.leftTile.flex || 1.35) + 1;
        const leftW = layout.leftTile.width || Math.round(((maxW - GAP) * (layout.leftTile.flex || 1.35)) / totalFlex);
        const rightW = layout.rightTiles[0]?.width || (maxW - GAP - leftW);
        const totalH = layout.gridHeight;
        tiles.push({ el: layout.leftTile.item.el, x: 0, y: 0, w: leftW, h: totalH });

        const rCount = layout.rightTiles.length;
        const totalRightFlex = layout.rightTiles.reduce((acc, t) => acc + (t.flex || 1), 0) || rCount;
        const availRightH = totalH - GAP * Math.max(0, rCount - 1);
        let curY = 0;
        layout.rightTiles.forEach((rt, idx) => {
            const tileH = idx === rCount - 1
                ? totalH - curY
                : (rt.height || Math.round((availRightH * (rt.flex || 1)) / totalRightFlex));
            tiles.push({ el: rt.item.el, x: leftW + GAP, y: curY, w: rightW, h: tileH });
            curY += tileH + GAP;
        });
        contentH = totalH;
    } else if (Array.isArray(layout.rows)) {
        let curY = 0;
        layout.rows.forEach((row, rIdx) => {
            const rowH = row.height;
            const rowTiles = row.tiles || [];
            const totalFlex = rowTiles.reduce((acc, t) => acc + (t.flex || 1), 0) || 1;
            const availRowW = maxW - GAP * Math.max(0, rowTiles.length - 1);
            let curX = 0;
            rowTiles.forEach((t, tIdx) => {
                const tileW = tIdx === rowTiles.length - 1
                    ? maxW - curX
                    : (t.width || Math.round((availRowW * (t.flex || 1)) / totalFlex));
                tiles.push({ el: t.item.el, x: curX, y: curY, w: tileW, h: rowH });
                curX += tileW + GAP;
            });
            curY += rowH + (rIdx < layout.rows.length - 1 ? GAP : 0);
        });
        contentH = curY;
    }

    return { tiles, contentHeight: contentH, pad, isMessenger };
}

function applyComposerTileBox(boxes, t) {
    const { pad, isMessenger } = boxes;
    const { el, x, y, w, h, isSingle } = t;
    const leftBase = pad.left, padTop = pad.top;
    const isSingleVideoWithTitle = Boolean(!isMessenger && isSingle && el.dataset.type === 'video' && el.dataset.title);
    const sig = `${Math.round(leftBase + x)},${Math.round(padTop + y)},${Math.round(w)},${Math.round(h)},${isSingle ? 1 : 0},${isSingleVideoWithTitle ? 1 : 0}`;
    if (el.__mkSig === sig) return;
    el.__mkSig = sig;
    el.style.position = 'absolute';
    el.style.left = `${Math.round(leftBase + x)}px`;
    el.style.top = `${Math.round(padTop + y)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.classList.toggle('single_thumb', Boolean(isSingle));
    el.classList.toggle('compact_thumb', Math.round(h) < 65 || Math.round(w) < 90);
    el.classList.toggle('single_video_thumb', isSingleVideoWithTitle);
    const dr = el.querySelector('.draggable_thumb');
    if (isSingleVideoWithTitle) {
        if (dr) dr.style.height = `${Math.round(h)}px`;
        el.style.height = `${Math.round(h + 28)}px`;
    } else {
        if (dr) dr.style.height = '100%';
        el.style.height = `${Math.round(h)}px`;
    }
    el.style.margin = '0';
}

function layoutComposerHorizontal(containerEl) {
    if (!containerEl) return;
    if (containerEl.nodeType !== 1 && containerEl.nodes?.[0]) {
        containerEl = containerEl.nodes[0];
    }
    if (!containerEl || containerEl.nodeType !== 1) return;

    const items = Array.from(containerEl.children).filter(
        (el) => el.tagName === 'A' && el.classList.contains('upload-item')
    );

    if (items.length === 0) {
        containerEl.classList.remove('editable_thumbs', 'vkify_makima_composer');
        containerEl.style.height = '';
        containerEl.style.width = '';
        return;
    }

    containerEl.classList.add('editable_thumbs', 'vkify_makima_composer');

    const boxes = computeComposerBoxes(containerEl, items);
    if (!boxes) return;

    const { pad } = boxes;

    items.forEach((el, idx) => {
        if (el.getAttribute('index') !== String(idx)) el.setAttribute('index', String(idx));
        el.classList.add('thumb_wrap');
        const img = el.querySelector('img');
        if (img && !img.dataset.vkifyLoadBound) {
            img.dataset.vkifyLoadBound = '1';
            img.addEventListener('load', () => {
                if (img.naturalWidth && img.naturalHeight) {
                    el.dataset.width = String(img.naturalWidth);
                    el.dataset.height = String(img.naturalHeight);
                    scheduleComposerLayout(containerEl);
                }
            });
        }
    });

    boxes.tiles.forEach((t) => applyComposerTileBox(boxes, t));
    const px = `${Math.round(pad.top + pad.bottom + boxes.contentHeight)}px`;
    if (containerEl.style.height !== px) containerEl.style.height = px;
}

window.vkifyUpdateComposerMediaGrid = (rootEl) => {
    const root = rootEl?.nodes ? rootEl.nodes[0] : (rootEl || document);
    if (!root) return;
    if (root.classList?.contains('post-horizontal')) {
        layoutComposerHorizontal(root);
        return;
    }
    root.querySelectorAll?.('.post-horizontal').forEach(layoutComposerHorizontal);
};

function decorateHorizontalItem(anchorEl, opts = {}) {
    if (!anchorEl || anchorEl.nodeType !== 1) return;
    const type = opts.type || anchorEl.dataset.type || 'photo';
    const id = opts.id || anchorEl.dataset.id || '';
    const openId = opts.viewerId || id;
    const isVideo = type === 'video';
    const cleanPhotoId = String(id).split('_').slice(0, 2).join('_');

    if (opts.width) anchorEl.dataset.width = String(opts.width);
    if (opts.height) anchorEl.dataset.height = String(opts.height);
    if (opts.duration) anchorEl.dataset.duration = String(opts.duration);
    if (opts.title) anchorEl.dataset.title = String(opts.title);
    if (opts.platform) anchorEl.dataset.platform = String(opts.platform);
    if (opts.preview) anchorEl.dataset.preview = String(opts.preview);
    if (opts.fullsize_url) anchorEl.dataset.fullsize = String(opts.fullsize_url);

    anchorEl.classList.add('upload-item', 'thumb_wrap');
    anchorEl.setAttribute('draggable', 'false');
    if (isVideo) {
        anchorEl.classList.add('thumb_video_wrap');
        anchorEl.id = 'videoOpen';
    } else {
        anchorEl.setAttribute(
            'onclick',
            `if(!event.target.closest('.upload-delete, .ui_thumb_x_button, .ui_extra_btn_pe, .photo_thumb_btn_editor'))PhotoViewer.openById('${openId}', event)`
        );
    }

    const existingImg = anchorEl.querySelector('img');
    const previewSrc = opts.preview || existingImg?.getAttribute('src') || '';
    const duration = opts.duration || anchorEl.dataset.duration || '';
    const title = opts.title || anchorEl.dataset.title || '';
    const platform = opts.platform || anchorEl.dataset.platform || '';
    const photoOwnerId = Number(String(cleanPhotoId).split('_')[0]);
    const currentUserId = Number(window.openvk?.current_id || 0);
    const canEditPhoto = Boolean(!isVideo && currentUserId && photoOwnerId === currentUserId);

    anchorEl.innerHTML = `
        <div class="draggable_thumb clear_fix">
            <img class="preview" draggable="false" src="${previewSrc}" alt="..." />
            <div class="overlay"></div>
            ${isVideo ? `<div class="video_thumb_play"></div>` : ''}
            ${isVideo && (duration || platform) ? `
                <div class="video_thumb_label">
                    ${platform ? `<span class="video_thumb_label_item">${escapeHtml(videoPlatformLabel(platform))}</span>` : ''}
                    ${duration ? `<span class="video_thumb_label_item">${escapeHtml(duration)}</span>` : ''}
                </div>
            ` : ''}
            ${!isVideo ? `
                <div class="photo_thumb_btns_container ui_thumb_extra">
                    <div class="photo_thumb_btns_overlay">
                        <div class="photo_thumb_btns">
                            <div class="photo_thumb_btn_show ui_extra_btn_show" onmouseover="showTitle(this)" data-title="${tr('photo')}"></div>
                            ${canEditPhoto ? `<div class="photo_thumb_btn_editor ui_extra_btn_pe" data-photo-id="${cleanPhotoId}" data-src="${opts.fullsize_url || previewSrc}" data-large-src="${opts.fullsize_url || previewSrc}" onmouseover="showTitle(this)" data-title="${vtr('pe_act_stickers', 'Effects & stickers')}"></div>` : ''}
                        </div>
                    </div>
                </div>
            ` : ''}
            <div class="ui_thumb_x_button upload-delete" onmouseover="showTitle(this)" data-title="${tr('detach') || tr('delete')}">
                <div class="ui_thumb_x"></div>
            </div>
        </div>
        ${isVideo && title ? `
            <div class="video_item_info composer_video_item_info">
                <div class="video_item_title"><span class="video_name">${escapeHtml(title)}</span></div>
            </div>
        ` : ''}
    `;
}

vkify.bindOnce('composerAttachmentHandlers', () => {
    document.addEventListener('click', (e) => {
        const peBtn = e.target.closest('.ui_extra_btn_pe, .photo_thumb_btn_editor');
        if (peBtn && peBtn.closest('.post-horizontal')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const item = peBtn.closest('a.upload-item');
            const rawId = peBtn.dataset.photoId || item?.dataset?.id || '';
            const cleanId = String(rawId).split('_').slice(0, 2).join('_');
            const ownerId = Number(String(cleanId).split('_')[0]);
            const curUid = Number(window.openvk?.current_id || 0);
            if (cleanId && curUid && ownerId === curUid && typeof window.openVkStickersEditor === 'function') {
                window.openVkStickersEditor(cleanId, { fromComposer: true });
            }
            return;
        }

        const del = e.target.closest('.upload-delete, .ui_thumb_x_button');
        if (del && del.closest('.post-horizontal')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const item = del.closest('a.upload-item');
            const container = item?.parentElement;
            item?.remove();
            if (container) layoutComposerHorizontal(container);
            return;
        }
    }, true);

    u(document).on('click', '.vertical-attachment #small_remove_button, .vertical-attachment .vertical-attachment-remove:not(.lagged)', (e) => {
        e.preventDefault();
        u(e.target).closest('.vertical-attachment').remove();
    });
    u(document).on('click', '.post-horizontal .upload-delete, .post-horizontal .ui_thumb_x_button', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = e.target.closest('a.upload-item');
        const container = item?.parentElement;
        item?.remove();
        if (container) layoutComposerHorizontal(container);
    });
    u(document).on('click', '.post-buttons .upload-item', (e) => {
        if (e.target.closest('a[href^="/doc"], a[href^="/note"], a.viewerOpener, .audioEntry')) return;
        e.preventDefault();
        e.stopPropagation();
    });

    if (typeof PhotoViewer === 'function' && PhotoViewer.prototype && !PhotoViewer.prototype.__vkifyDeleteHooked) {
        PhotoViewer.prototype.__vkifyDeleteHooked = true;
        const origDeleteItem = PhotoViewer.prototype.deleteItem;
        PhotoViewer.prototype.deleteItem = async function (element) {
            const res = await origDeleteItem.apply(this, arguments);
            const rawId = element?.id || this.currentId || '';
            const cleanId = String(rawId).split('_').slice(0, 2).join('_');
            if (cleanId) {
                const containers = new Set();
                document.querySelectorAll(`.post-horizontal a.upload-item[data-type="photo"][data-id^="${cleanId}"]`).forEach((item) => {
                    if (item.parentElement) containers.add(item.parentElement);
                    item.remove();
                });
                containers.forEach((c) => scheduleComposerLayout(c));
            }
            return res;
        };
    }

    // Observe .post-horizontal changes (uploads, drag-drop swaps, pastes, resets)
    vkify.observeDOM((mutations) => {
        const toRelayout = new Set();
        for (const m of mutations) {
            if (m.type !== 'childList') continue;
            const target = m.target;
            if (target?.nodeType === 1 && target.classList?.contains('post-horizontal')) {
                Array.from(target.children).forEach((ch) => {
                    if (ch.tagName === 'A' && ch.classList.contains('upload-item') && !ch.querySelector('.draggable_thumb') && !ch.classList.contains('lagged')) {
                        decorateHorizontalItem(ch);
                    }
                });
                toRelayout.add(target);
            }
        }
        toRelayout.forEach((c) => scheduleComposerLayout(c));
    });
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

const appendHorizontal = (form, { type, id, viewerId, preview, page_url, key, fullsize_url, width, height, duration, title, platform }) => {
    if (!form?.length || !type || !id) return;
    const isVideo = type === 'video';
    const openId = viewerId || id;
    const href = page_url || id;
    const dataKey = key ? ` data-key="${key}"` : '';
    const container = form.find('.post-horizontal');
    container.append(`
        <a ${isVideo ? 'id="videoOpen"' : ''}
           draggable="false" href="/${type}${href}" class="upload-item thumb_wrap" data-type='${type}' data-id="${id}"${dataKey}>
            <img draggable="false" src="${preview}" alt='...'>
        </a>
    `);
    const added = container.nodes[0]?.lastElementChild;
    if (added) {
        decorateHorizontalItem(added, { type, id, viewerId: openId, preview, page_url: href, key, fullsize_url, width, height, duration, title, platform });
        layoutComposerHorizontal(container.nodes[0]);
    }
};

const appendVertical = (form, { type, id, html, undeletable }, playlistMode = false) => {
    if (!form?.length || !type || !id) return;
    const target = playlistMode ? '.PE_audios' : '.post-vertical';
    const dataTypeAttr = playlistMode ? '' : ` data-type='${type}'`;
    form.find(target).append(`
        <div class="vertical-attachment upload-item" draggable="false"${dataTypeAttr} data-id="${id}">
            <div class='vertical-attachment-content' draggable="false">${html || ''}</div>
            <div class='${undeletable ? 'lagged' : ''} vertical-attachment-remove'>
                <div id='small_remove_button'></div>
            </div>
        </div>
    `);
};

window.__appendToTextarea = (attachmentObj, textareaNode) => {
    const form = textareaNode?.find ? textareaNode : u(textareaNode);
    if (!form?.length || !attachmentObj) return;
    if (attachmentObj.alignment === 'vertical') {
        appendVertical(form, attachmentObj, false);
    } else {
        appendHorizontal(form, attachmentObj);
    }
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

const buildVideoUploadButtons = () => `
    <div class="video_choose_upload_area_cont clear_fix">
        <div class="choose_upload_area video_choose_upload_area picker-upload-btn" data-upload-tab="file" role="button" tabindex="0">
            <span class="choose_upload_area_label">${tr('upload_video')}</span>
        </div>
        <div class="video_add_external picker-upload-external-btn" data-upload-tab="youtube" role="button" tabindex="0">
            <span class="video_choose_upload_separator"></span>
            <span class="video_add_external_icon">${tr('video_youtube_upload')}</span>
        </div>
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

const renderAlbumHTML = (album) => {
    window.vkify?.ensureStyle?.('profile');
    return `
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
};

class AttachmentPickerBase {
    constructor(options) {
        this.form = options.form;
        this.club = Number(options.club) || 0;
        this.type = options.type || 'photo';
        this.playlistMode = !!options.playlistMode;
        this.selected = new Set();
        this.selectedData = new Map();
        this._lastSelectedEl = null;
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

    _installCloseGuard() {
        const msgbox = this.msgbox;
        if (!msgbox) return;
        const origShowClose = msgbox.__showCloseConfirmationDialog.bind(msgbox);
        msgbox.__showCloseConfirmationDialog = async () => {
            const hasNew = [...this.selected].some(id => !isAttached(this.form, this.type, id, this.playlistMode));
            if (!hasNew) return true;
            return origShowClose();
        };
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
        const bar = this.msgbox?.getNode().find('.ovk-diag-action');
        if (!bar?.length) return;
        const btn = bar.find('.picker-attach-selected');
        const cancelLink = bar.find('.picker-bottom-cancel');
        const count = this.selected.size;
        const hasStaticButtons = bar.find(':scope > :not(.picker-attach-selected):not(.picker-bottom-cancel)').length > 0;
        if (count > 0) {
            if (!hasStaticButtons && !cancelLink.length) {
                bar.prepend(`<a href="javascript:void(0)" class="picker-bottom-cancel">${tr('cancel')}</a>`);
            }
            if (!btn.length) bar.append(`<input type="button" class="button picker-attach-selected" value="${tr('attach')} (${count})">`);
            else btn.attr('value', `${tr('attach')} (${count})`);
        } else {
            btn.remove();
            if (!hasStaticButtons) cancelLink.remove();
        }
    }

    _getItemData(row, id) {
        return this.adapter?.getItemData?.(row, id) || { type: this.type, id };
    }

    _setRowSelected(row, id, select) {
        if (!row?.length || !id) return false;
        if (!select) {
            this.selected.delete(id);
            this.selectedData.delete(id);
            row.removeClass('selected');
            row.find('.picker-item-select span, .attachAudio span, .attachDocument span').text(tr('attach'));
            return true;
        }
        if (this.isSelected(id)) return true;
        const currentAttached = getAttachedCount(this.form, this.playlistMode);
        const pendingNew = [...this.selected].filter(sid => !isAttached(this.form, this.type, sid, this.playlistMode)).length;
        if (!this.playlistMode && currentAttached + pendingNew + 1 > MAX_ATTACHMENTS) {
            NewNotification(tr('error'), tr('too_many_attachments'), null, () => {}, 5000, false);
            return false;
        }
        this.selected.add(id);
        this.selectedData.set(id, this._getItemData(row, id));
        row.addClass('selected');
        row.find('.picker-item-select span, .attachAudio span, .attachDocument span').text(tr('detach'));
        return true;
    }

    handleItemSelect(row, id, event = null) {
        const targetEl = row?.nodes?.[0] || null;
        const targetSelect = !this.isSelected(id);

        if (event?.shiftKey && this._lastSelectedEl && targetEl && this._lastSelectedEl !== targetEl && this._lastSelectedEl.parentElement === targetEl.parentElement) {
            const siblings = Array.from(targetEl.parentElement.querySelectorAll('[data-picker-id]'));
            const aIdx = siblings.indexOf(this._lastSelectedEl);
            const bIdx = siblings.indexOf(targetEl);
            if (aIdx !== -1 && bIdx !== -1) {
                const [from, to] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
                for (let i = from; i <= to; i++) {
                    const sib = u(siblings[i]);
                    const sibId = sib.attr('data-picker-id');
                    if (!this._setRowSelected(sib, sibId, targetSelect) && targetSelect) break;
                }
                this._lastSelectedEl = targetEl;
                this.updateAttachButton();
                return;
            }
        }

        this._setRowSelected(row, id, targetSelect);
        this._lastSelectedEl = targetEl;
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
            const row = this.msgbox?.getNode().find(`[data-picker-id="${id}"]`);
            const data = row?.length ? this._getItemData(row, id) : this.selectedData.get(id);
            if (data) this.attachItem(data);
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
        this.msgbox.getNode().addClass('ovk-msg-sheet');

        this._installCloseGuard();

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
            this.selectedData.clear();
            this._lastSelectedEl = null;
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
            this.handleItemSelect(row, id, e);
        });

        node.on('click', '.picker-item-attach', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                this.handleItemSelect(row, id, e);
            } else {
                this.handleItemAttach(row, id);
            }
        });

        node.on('click', '.picker-attach-selected', () => {
            this.attachSelected();
            this.close();
        });

        node.on('click', '.picker-bottom-cancel', (e) => {
            e.preventDefault();
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
    const bestSize = photo.sizes?.[4] || photo.sizes?.[3] || photo.sizes?.[2] || photo.sizes?.[1] || photo.sizes?.[0];
    const maxSize = photo.sizes?.[9] || photo.sizes?.[photo.sizes.length - 1] || bestSize;
    const thumb = bestSize?.url || '';
    const preview = maxSize?.url || thumb;
    const fullsize = maxSize?.url || thumb;
    const w = maxSize?.width || bestSize?.width || photo.width || 0;
    const h = maxSize?.height || bestSize?.height || photo.height || 0;
    return `<a class="photos_choose_row picker-item-attach ${isSelected ? 'selected' : ''}" href="javascript:void(0)" 
               data-picker-id="${fullId}" data-key="${key}" data-page-url="${pageUrl}" data-preview="${preview}" data-fullsize="${fullsize}" data-width="${w}" data-height="${h}">
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

const fetchPhotos = async (ownerId, albumId, page = 0, rev = false) => {
    const params = { owner_id: ownerId, photo_sizes: 1, count: PHOTO_PER_PAGE, offset: page * PHOTO_PER_PAGE };
    if (albumId) {
        params.album_id = albumId;
        if (rev) params.rev = 1;
    }
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
        this.photos = await fetchPhotos(this.ownerId, this.albumId, 0, true);
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
                return await fetchPhotos(this.ownerId, this.albumId, this.page, true);
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
        return [];
    }

    getCallbacks() {
        return [];
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
            fullsize_url: row.attr('data-fullsize'),
            width: Number(row.attr('data-width')) || 0,
            height: Number(row.attr('data-height')) || 0
        };
    }

    async open() {
        await this._showMainView();
    }

    _mountView(view, title, buttons = [], callbacks = []) {
        this._currentView?.disconnectScrollers?.();
        this._currentView = view;

        if (!this.msgbox || !this.msgbox.getNode()?.nodes?.[0]?.isConnected) {
            this._showMessageBox(view, title, buttons, callbacks);
            return;
        }

        const node = this.msgbox.getNode();
        const head = node.find('.ovk-diag-head');
        const closeBtn = head.find('.ovk-diag-head-close').nodes[0];
        const applyBtn = head.find('.ovk-diag-head-apply').nodes[0];
        head.html('');
        if (view instanceof PhotoAlbumView) {
            const label = title || tr('paginator_back');
            const backEl = document.createElement('div');
            backEl.className = 'back picker-header-back';
            backEl.setAttribute('role', 'button');
            backEl.setAttribute('tabindex', '0');
            backEl.setAttribute('aria-label', tr('back'));
            const backIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            backIcon.setAttribute('class', 'mobileonly');
            backIcon.setAttribute('viewBox', '0 0 28 28');
            backIcon.setAttribute('width', '28');
            backIcon.setAttribute('height', '28');
            backIcon.setAttribute('fill', 'currentColor');
            backIcon.innerHTML = '<use href="#arrow-left-outline-28"></use>';
            const backLabel = document.createElement('span');
            backLabel.className = 'picker-header-back-label';
            backLabel.textContent = label;
            backEl.append(backIcon, backLabel);
            const titleSpan = document.createElement('span');
            titleSpan.className = 'ovk-diag-head-title picker-title-text mobileonly';
            titleSpan.textContent = label;
            head.nodes[0]?.append(backEl, titleSpan);
        } else {
            const titleSpan = document.createElement('span');
            titleSpan.className = 'ovk-diag-head-title picker-title-text';
            titleSpan.textContent = title;
            head.nodes[0]?.appendChild(titleSpan);
        }
        if (closeBtn) head.nodes[0]?.appendChild(closeBtn);
        if (applyBtn) head.nodes[0]?.appendChild(applyBtn);
        if (this.club !== 0 && view instanceof PhotoMainView) {
            this.addClubToggleLink();
        }

        const body = node.find('.ovk-diag-body');
        body.html(view.buildBody());
        if (body.nodes[0]) body.nodes[0].scrollTop = 0;

        this._lastSelectedEl = null;
        view.setupHandlers(node);
        this.updateAttachButton();
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
        this._mountView(view, tr('select_photo'), [], []);
    }

    async switchToAlbumView(albumId, title) {
        if (this._currentView instanceof PhotoMainView) {
            const stateKey = this.viewingUser ? 'user' : 'group';
            this._mainViewState[stateKey] = this._currentView.getState();
        }
        const view = new PhotoAlbumView(this, albumId, title);
        await ajloader.wrap(() => view.prefetch());
        this._mountView(view, title, view.getButtons(), view.getCallbacks());
    }

    async switchToMainView() {
        await this._showMainView();
    }

    async toggleContext() {
        if (this._currentView instanceof PhotoMainView) {
            const stateKey = this.viewingUser ? 'user' : 'group';
            this._mainViewState[stateKey] = this._currentView.getState();
        }
        this.viewingUser = !this.viewingUser;
        this.selected.clear();
        this.selectedData.clear();
        this._lastSelectedEl = null;
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
        this.msgbox.getNode().addClass('ovk-msg-sheet');
        this._installCloseGuard();
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

        node.on('click', '.picker-header-back', async (e) => {
            e.preventDefault();
            await this.switchToMainView();
        });

        node.on('click', '.picker-item-select', (e) => {
            e.preventDefault(); e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            this.handleItemSelect(row, row.attr('data-picker-id'), e);
        });

        node.on('click', '.picker-item-attach', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault(); e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                this.handleItemSelect(row, id, e);
            } else {
                this.handleItemAttach(row, id);
            }
        });

        node.on('click', '.picker-attach-selected', () => {
            this.attachSelected();
            this.close();
        });

        node.on('click', '.picker-bottom-cancel', (e) => {
            e.preventDefault();
            this.close();
        });
    }
}

const VideoAdapter = {
    title: tr('selecting_video'),
    width: '640px',
    supportsClubToggle: true,
    perPage: DEFAULT_PER_PAGE,
    emptyMessage: tr('no_videos'),
    rowsClass: 'video_block_layout',

    buildBody(picker, preRendered) {
        const { itemsHTML, emptyHTML } = getPreRenderedHTML(preRendered, VideoAdapter.emptyMessage, 'video_block_layout');
        const activeKey = picker.viewingUser ? 'user' : 'group';
        const hasClub = picker.club !== 0;
        return `<div class='attachment_selector'>
            ${buildVideoUploadButtons()}
            <div class="videos_choose_search">
                ${buildSearchUI('search_for_videos')}
            </div>
            <div class="picker-content" style="height: unset; padding: 0">
                ${buildDualContainers(activeKey, hasClub, itemsHTML, emptyHTML)}
            </div>
        </div>`;
    },

    setupHandlers(picker) {
        const node = picker.msgbox.getNode();

        node.on('click', '.picker-upload-btn, .picker-upload-external-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tab = u(e.currentTarget).attr('data-upload-tab') || 'file';
            const clubId = picker.club !== 0 && !picker.viewingUser ? Math.abs(picker.club) : 0;
            picker.close();
            window.showFastVideoUpload?.(picker.form, e, clubId, tab);
        });

        node.on('click', '.video_item__thumb_link', (e) => {
            if (u(e.target).closest('.picker-item-select').length) return;
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('[data-picker-id]');
            const id = row.attr('data-picker-id');
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                picker.handleItemSelect(row, id, e);
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
                picker.handleItemSelect(row, id, e);
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
            : await window.OVKAPI.call('video.get', { ...params, owner_id: picker.getOwnerId() });

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
        const durationStr = !platform && video.duration ? fmtTime(video.duration) : '';
        const vw = video.width || video.image?.[0]?.width || 640;
        const vh = video.height || video.image?.[0]?.height || 360;

        return `<div class="video_item ${selected ? 'selected' : ''}" data-picker-id="${fullId}" data-key="${key}" data-page-url="${pageUrl}" data-preview="${thumb}" data-url="${video.player || `/video${baseId}`}" data-title="${escapeHtml(video.title || '')}" data-duration="${escapeHtml(durationStr)}" data-platform="${escapeHtml(platform)}" data-width="${vw}" data-height="${vh}">
            <a class="video_item__thumb_link picker-item-attach" href="javascript:void(0)">
                <div class="video_item_thumb_wrap">
                    <div class="video_item_thumb" style="background-image: url('${thumb}')"></div>
                    <div class="video_item_controls">
                        <div class="video_thumb_label">
                            ${platform ? `<span class="video_thumb_label_item video_thumb_label_platform">${escapeHtml(videoPlatformLabel(platform))}</span>` : ''}
                            ${durationStr ? `<span class="video_thumb_label_item video_thumb_label_duration">${durationStr}</span>` : ''}
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
            fullsize_url: row.attr('data-url'),
            title: row.attr('data-title') || '',
            duration: row.attr('data-duration') || '',
            platform: row.attr('data-platform') || '',
            width: Number(row.attr('data-width')) || 640,
            height: Number(row.attr('data-height')) || 360
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
            const form = picker.form;
            const playlistMode = picker.playlistMode;
            picker.close();
            window.showAudioUploadPopup?.({
                ownerId: picker.getOwnerId(),
                targetForm: form,
                playlistMode,
                onUploaded: (newAudioEmbeds) => {
                    form?.closest?.('.model_content_textarea')?.addClass('shown');
                    newAudioEmbeds.forEach(audioEl => {
                        const id = audioEl.getAttribute('data-prettyid') || audioEl.getAttribute('data-realid') || audioEl.getAttribute('data-id');
                        appendVertical(form, {
                            type: 'audio',
                            id,
                            html: audioEl.outerHTML,
                            alignment: 'vertical'
                        }, playlistMode);
                    });
                }
            });
        });

        node.on('change', '.picker-search-type', (e) => {
            picker._searchType = e.target.value;
            picker.page = 0;
            picker.load();
        });

        // mobile: tap the row itself to mark it instead of the text button;
        // stopPropagation keeps stock's document-level .status handler from playing the track
        node.on('click', '.audio_attachment_header', (e) => {
            if (!matchMedia('(max-width: 768px)').matches) return;
            if (u(e.target).closest('.picker-item-select, .attachAudio, .playerButton, .mini_timer, .subTracks, a').length) return;
            e.preventDefault();
            e.stopPropagation();
            const row = u(e.target).closest('.audio_attachment_header');
            picker.handleItemSelect(row, row.attr('data-picker-id'));
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
            <div class="media_check_btn_wrap picker-item-select"><div class="media_check_btn"></div></div>
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
            const form = picker.form;
            const clubId = picker.club !== 0 && !picker.viewingUser ? Math.abs(picker.club) : NaN;
            picker.close();
            window.showDocumentUploadDialog?.("search", clubId, async (payload) => {
                if (!form?.length || !payload) return;
                if (typeof payload === 'string') {
                    const doc = new DOMParser().parseFromString(payload, 'text/html');
                    const mainItem = doc.querySelector('.docMainItem');
                    const id = mainItem?.dataset?.id || '';
                    if (mainItem && id) {
                        const clone = mainItem.cloneNode(true);
                        clone.querySelector('.doc_volume')?.remove();
                        appendVertical(form, {
                            type: 'doc',
                            id,
                            alignment: 'vertical',
                            html: `<div class="attachment_doc">${clone.outerHTML}</div>`
                        });
                    }
                    return;
                }
                const docId = payload.id;
                if (!docId) return;
                try {
                    const res = await window.OVKAPI.call('docs.getById', { docs: docId });
                    const d = Array.isArray(res) ? res[0] : (res?.items?.[0] || null);
                    const fullId = d ? `${d.owner_id}_${d.id}${d.access_key ? `_${d.access_key}` : ''}` : docId;
                    const title = d?.title || docId;
                    const urlParts = String(fullId).split('_');
                    const keyQuery = urlParts[2] ? `?key=${urlParts[2]}` : '';
                    appendVertical(form, {
                        type: 'doc',
                        id: fullId,
                        alignment: 'vertical',
                        html: `<div class="docMainItem attachment_doc attachment_note">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><polygon points="0 0 0 10 8 10 8 4 4 4 4 0 0 0"/><polygon points="5 0 5 3 8 3 5 0"/></svg>
                            <div class='attachment_note_content'>
                                <span class="attachment_note_text">${tr("document")}</span>
                                <span class="attachment_note_name"><a href="/doc${urlParts[0]}_${urlParts[1]}${keyQuery}">${ovk_proc_strtr(escapeHtml(title), 50)}</a></span>
                            </div>
                        </div>`
                    });
                } catch (_) {}
            }, form);
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
        const docItem = row.find('.docMainItem').nodes[0];
        if (docItem) {
            const clone = docItem.cloneNode(true);
            clone.querySelector('.doc_volume')?.remove();
            return {
                type: 'doc',
                id,
                alignment: 'vertical',
                html: `<div class="attachment_doc">${clone.outerHTML}</div>`
            };
        }
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

        // mobile: tap the row itself to mark it instead of the text button
        node.on('click', '.notesInsert [data-picker-id]', (e) => {
            if (!matchMedia('(max-width: 768px)').matches) return;
            if (u(e.target).closest('.picker-item-select, .attachAudio, a').length) return;
            const row = u(e.target).closest('[data-picker-id]');
            picker.handleItemSelect(row, row.attr('data-picker-id'));
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
            <div class="media_check_btn_wrap picker-item-select"><div class="media_check_btn"></div></div>
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
        const rawNoteId = String(id).split('_')[1] || id;
        return {
            type: 'note',
            id,
            alignment: 'vertical',
            html: `<div class="attachment_note">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><polygon points="0 0 0 10 8 10 8 4 4 4 4 0 0 0"/><polygon points="5 0 5 3 8 3 5 0"/></svg>
                <div class='attachment_note_content'>
                    <span class="attachment_note_text">${tr('note')}</span>
                    <span class="attachment_note_name"><a href="javascript:void(showArticle(${rawNoteId}));">${ovk_proc_strtr(escapeHtml(name), 66)}</a></span>
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

vkify.hook(window, 'showFastVideoUpload', (formNode, event, clubId = 0, initialTab = 'file') => {
    window.vkify?.ensureStyle?.('settings');
    let current_tab = initialTab === 'youtube' ? 'youtube' : 'file';
    const is_from_messenger = formNode && formNode.closest('.messenger-layer').length > 0;
    const resolvedClubId = Math.abs(Number(clubId || new URLSearchParams(location.search).get('gid') || 0)) || 0;
    const uploadEndpoint = resolvedClubId > 0 ? `/videos/upload?gid=${resolvedClubId}` : '/videos/upload';
    const msg = new CMessageBox({
        title: tr('upload_video'),
        close_on_buttons: false,
        warn_on_exit: true,
        unique_name: 'video_uploader',
        body: `
        <div id='_fast_video_upload'>
            <div id='_tabs'>
                <h2 class="page_block_h2 tabs_header">
                    <ul class="ui_tabs clear_fix">
                        <li><a class="ui_tab ui_tab_sel" data-name="file">${tr('video_file_upload')}</a></li>
                        <li><a class="ui_tab" data-name="youtube">${tr('video_youtube_upload')}</a></li>
                        <div class="ui_tabs_slider"></div>
                    </ul>
                </h2>
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
                    form_data.append('unlisted', is_from_messenger ? 1 : 0);
                    form_data.append('hash', vkify.getCsrf());

                    if (is_from_messenger) {
                        form_data.append('is_from_messenger', '1');
                        const im = window.im_variants?.getCompromise?.() || window.im;
                        if (im?.state?.getOperator?.()?.supposed_type === 'club') {
                            form_data.append('club', Math.abs(im.state.getOperator().id));
                        }
                    }

                    uploadBtn?.classList.add('lagged');
                    const ytRes = await fetch(uploadEndpoint, { method: 'POST', body: form_data });
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
                    form_data.append('unlisted', is_from_messenger ? 1 : 0);
                    form_data.append('hash', vkify.getCsrf());

                    if (is_from_messenger) {
                        form_data.append('is_from_messenger', '1');
                        const im = window.im_variants?.getCompromise?.() || window.im;
                        if (im?.state?.getOperator?.()?.supposed_type === 'club') {
                            form_data.append('club', Math.abs(im.state.getOperator().id));
                        }
                    }

                    uploadBtn?.classList.add('lagged');
                    const res = await fetch(uploadEndpoint, { method: 'POST', body: form_data });
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
                [...window.messagebox_stack]
                    .filter(m => !['post_composer_modal', 'post_editor_modal'].includes(m.unique_name))
                    .forEach(m => { m.close(); });
                if (!formNode) vkify.navigate(location.href);
            } else {
                fastError(append_result?.flash?.message || tr('error'));
                msg.close();
            }
        }, () => msg.close()]
    });

    msg.getNode().addClass('ovk-msg-sheet');
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

    switchTab(current_tab);
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
    const resolveForm = (el) => (el ? u(el).closest('form, #write') : u());

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
            const club = Number(video.dataset.club ?? 0);
            await openPicker('video', resolveForm(video), club);
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

// Pointer-based reordering for composer attachments. Native HTML5 drag & drop
// is suppressed entirely: it never fires on touch (the long-press opens the
// browser context menu instead) and its ghost-image UX is worse than lifting
// the tile itself. Touch needs a ~350ms hold; mouse drags start after a small
// movement threshold so clicks still open the viewer.
(function bindComposerTouchReorder() {
    const ITEM_SEL = '.post-buttons .post-horizontal > .upload-item, .post-buttons .post-vertical > .upload-item';
    const HOLD_MS = 350;
    let drag = null;
    let pendingCommit = null;
    let suppressClickUntil = 0;

    const updateDragPos = (s, x, y) => {
        if (s.isHorizontal) {
            s.item.__mkSig = null;
            s.item.style.left = `${Math.round(x - s.grabX)}px`;
            s.item.style.top = `${Math.round(y - s.grabY)}px`;
        } else {
            const tx = x - s.grabX - s.item.offsetLeft;
            const ty = y - s.grabY - s.item.offsetTop;
            s.item.style.transform = `translate(${tx}px, ${ty}px)`;
        }
    };

    // VK's grid sorter never mutates the DOM mid-drag: slot geometry is frozen
    // at activation, the target slot is determined from the frozen grid, and
    // siblings transition directly via left/top/width/height to their preview
    // positions. The actual DOM insertBefore happens once after the drop glide
    // finishes — avoiding both reflow feedback loops and transform/left-top
    // transition conflicts on release.
    const processDragMove = (s) => {
        const x = s.lastX, y = s.lastY;
        const item = s.item;
        updateDragPos(s, x, y);

        if (!s.isHorizontal) {
            const cy = item.offsetTop + (y - s.grabY - item.offsetTop) + item.offsetHeight / 2;
            const tiles = [];
            for (const t of s.container.children) {
                if (t !== item && t.classList?.contains('upload-item')) tiles.push(t);
            }
            let desired = 0;
            for (const t of tiles) {
                if (cy > t.offsetTop + t.offsetHeight / 2) desired++;
            }
            if (desired === s.previewIndex) return;
            s.previewIndex = desired;
            const ref = tiles[desired] || null;
            if (ref !== item.nextSibling) s.container.insertBefore(item, ref);
            return;
        }

        const mpX = x - s.containerRect.left;
        const mpY = y - s.containerRect.top;
        let desired = -1;
        for (let k = 0; k < s.slots.length; k++) {
            const b = s.slots[k];
            const ix = b.w * 0.12, iy = b.h * 0.12;
            if (mpX >= b.l + ix && mpX <= b.l + b.w - ix && mpY >= b.t + iy && mpY <= b.t + b.h - iy) {
                desired = k;
                break;
            }
        }
        if (desired < 0 || desired === s.previewIndex) return;
        s.previewIndex = desired;

        const previewOrder = s.sibs.slice();
        previewOrder.splice(desired, 0, item);
        s.previewOrder = previewOrder;

        const boxes = computeComposerBoxes(s.container, previewOrder);
        if (!boxes) return;
        s.targetBoxes = boxes;
        for (const t of boxes.tiles) {
            if (t.el === item) {
                s.targetTile = t;
                continue;
            }
            applyComposerTileBox(boxes, t);
        }
    };

    const activate = (s) => {
        if (s.activated) return;
        const allItems = Array.from(s.container.children).filter(
            (t) => t.classList?.contains('upload-item')
        );
        if (allItems.length <= 1) return;
        s.activated = true;
        s.isHorizontal = s.container.classList.contains('post-horizontal');
        s.grabX = s.lastX - s.item.offsetLeft;
        s.grabY = s.lastY - s.item.offsetTop;
        s.containerRect = s.container.getBoundingClientRect();
        s.slots = allItems.map((t) => ({
            l: t.offsetLeft,
            t: t.offsetTop,
            w: t.offsetWidth,
            h: t.offsetHeight,
        }));
        s.sibs = allItems.filter((t) => t !== s.item);
        s.startIndex = allItems.indexOf(s.item);
        s.previewIndex = s.startIndex;
        s.previewOrder = null;
        if (s.isHorizontal) {
            const initBoxes = computeComposerBoxes(s.container, allItems);
            s.targetBoxes = initBoxes;
            s.targetTile = initBoxes?.tiles.find((t) => t.el === s.item) || null;
        }
        s.item.classList.add('currently_dragging');
        s.item.style.zIndex = '20';
        s.item.style.pointerEvents = 'none';
        try { s.item.setPointerCapture?.(s.pointerId); } catch {}
        document.documentElement.classList.add('vkify-composer-dragging');
        if (s.pointerType === 'touch') navigator.vibrate?.(15);
    };

    const endDrag = () => {
        if (!drag) return;
        const s = drag;
        drag = null;
        clearTimeout(s.timer);
        if (!s.activated) return;
        suppressClickUntil = Date.now() + 450;
        document.documentElement.classList.remove('vkify-composer-dragging');
        s.item.classList.remove('currently_dragging');

        if (!s.isHorizontal) {
            s.item.style.zIndex = '';
            s.item.style.pointerEvents = '';
            s.item.style.transform = '';
            return;
        }

        // Glide the dragged tile into its target slot via left/top/width/height
        // before mutating DOM order (mirrors VK GridSorter._onMouseUp), then
        // commit insertBefore once the 150ms transition finishes.
        if (s.targetBoxes && s.targetTile) {
            applyComposerTileBox(s.targetBoxes, s.targetTile);
        }

        let commitTimer = null;
        const commit = () => {
            if (pendingCommit === commit) pendingCommit = null;
            clearTimeout(commitTimer);
            if (s.previewOrder && s.previewIndex !== s.startIndex) {
                const ref = s.sibs[s.previewIndex] || null;
                if (ref !== s.item.nextSibling) s.container.insertBefore(s.item, ref);
            }
            s.item.style.zIndex = '';
            s.item.style.pointerEvents = '';
            if (s.container.isConnected) {
                layoutComposerHorizontal(s.container);
            }
        };
        pendingCommit = commit;
        commitTimer = setTimeout(commit, 165);
    };

    ['submit', 'keydown'].forEach((ev) =>
        window.addEventListener(ev, () => {
            if (pendingCommit) pendingCommit();
        }, true)
    );

    document.addEventListener('pointerdown', (e) => {
        if (pendingCommit) pendingCommit();
        if (drag) return;
        if (e.pointerType !== 'touch' && !(e.pointerType === 'mouse' && e.button === 0)) return;
        const item = e.target.closest?.(ITEM_SEL);
        if (!item) return;
        const container = item.parentElement;
        if (!container || container.querySelectorAll(':scope > .upload-item').length <= 1) return;
        if (e.target.closest('button, .upload-delete, .ui_thumb_x_button')) return;
        const innerLink = e.target.closest('a');
        if (innerLink && innerLink !== item) return;
        drag = {
            item,
            container,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            grabX: 0,
            grabY: 0,
            activated: false,
            moved: false,
            timer: e.pointerType === 'touch'
                ? setTimeout(() => { if (drag) activate(drag); }, HOLD_MS)
                : null,
        };
    }, true);

    document.addEventListener('pointermove', (e) => {
        const s = drag;
        if (!s || e.pointerId !== s.pointerId) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.activated) {
            const dist2 = dx * dx + dy * dy;
            if (s.pointerType === 'mouse') {
                if (dist2 > 25) activate(s);
            } else if (dist2 > 169) {
                clearTimeout(s.timer);
                drag = null;
            }
            return;
        }
        s.lastX = e.clientX;
        s.lastY = e.clientY;
        s.moved = true;
        if (!s.queued) {
            s.queued = true;
            requestAnimationFrame(() => {
                s.queued = false;
                if (drag === s) processDragMove(s);
            });
        }
    }, true);

    ['pointerup', 'pointercancel'].forEach((ev) =>
        document.addEventListener(ev, (e) => {
            if (drag && e.pointerId === drag.pointerId) endDrag();
        }, true)
    );

    window.addEventListener('blur', endDrag);

    // kill the native drag session (ghost image + upstream al_wall.js handlers)
    window.addEventListener('dragstart', (e) => {
        if (e.target.closest?.(ITEM_SEL)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener('touchmove', (e) => {
        if (drag?.activated) e.preventDefault();
    }, { capture: true, passive: false });

    document.addEventListener('contextmenu', (e) => {
        const isMobileView = typeof window.isMobile === 'function'
            ? window.isMobile()
            : window.matchMedia('(max-width: 768px)').matches;
        if ((drag || isMobileView) && e.target.closest?.(ITEM_SEL)) {
            e.preventDefault();
        }
    });

    // Capture on window so this runs before document-level capture handlers
    // (such as media-modals.js's #videoOpen listener) after releasing a drag.
    window.addEventListener('click', (e) => {
        if (pendingCommit) pendingCommit();
        if (Date.now() < suppressClickUntil && e.target.closest?.(ITEM_SEL)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);
})();

})();
