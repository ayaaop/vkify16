vkify.once('mediaModals', function () {
    if (typeof PhotoViewer === 'undefined' || typeof VideoViewer === 'undefined' || typeof DocsViewer === 'undefined' || typeof PostViewer === 'undefined') {
        console.warn('mediaModals: stock viewers not loaded');
        return;
    }

    const tr = window.tr;
    const _loader_link = '/assets/packages/static/openvk/img/loading_mini.gif';
    const LoaderUtils = window.LoaderUtils;
    const showLoader = (node) => { if (node && window.LoaderUtils) window.LoaderUtils.show(node); };
    const hideLoader = (node) => { if (node && window.LoaderUtils) window.LoaderUtils.hide(node); };

    document.addEventListener('click', async (e) => {
        const videoLink = e.target.closest('#videoOpen');
        if (!videoLink) return;
        const videoId = videoLink.dataset.id;
        if (!videoId) return;

        e.preventDefault();
        e.stopPropagation();

        const container = videoLink.closest('.attachments, .post');
        const siblingLinks = container
            ? Array.from(container.querySelectorAll('a[id="videoOpen"][data-id]'))
            : [videoLink];
        const ids = Array.from(new Set(siblingLinks.map((a) => a.dataset.id).filter(Boolean))).join(',');

        CMessageBox.toggleLoader(true);
        try {
            const viewer = new VideoViewer();
            viewer.setContext({ id: ids });
            await viewer.loadIdsOnlyContext();
            viewer.open();
            viewer.afterOpen(videoId);
        } catch (err) {
            console.error(err);
        }
        CMessageBox.toggleLoader(false);
    }, true);

    PhotoViewer.openById = async function (ids, event = null) {
        if (ids && (typeof ids.preventDefault === 'function' || ids.target || ids instanceof Event)) {
            const t = ids;
            ids = event;
            event = t;
        }
        if (event != null && typeof event.preventDefault === 'function') {
            event.preventDefault();
            event.stopPropagation();
        }

        const openId = String(ids || '').replace(/^["']+|["']+$/g, '');

        CMessageBox.toggleLoader(true);
        try {
            const viewer = new PhotoViewer();
            viewer.setContext({
                type: 'ids',
                id: openId,
            });
            await viewer.initalizeContext(null, openId);
            viewer.open();
            CMessageBox.toggleLoader(false);

            const baseId = openId;
            const actualId = viewer.itemsOrder.find(pid => {
                const parts = String(pid).split('_');
                return String(pid) === baseId || parts.slice(0, 2).join('_') === baseId;
            }) || openId;

            viewer.afterOpen(actualId, null);
        } catch (e) {
            console.error(e);
        }
        CMessageBox.toggleLoader(false);
    };

    function createPhotoFrame(isDoc = false) {
        return u(`
        <div class="ovk-photo-view-dimmer">
            <div class="ovk-photo-view-overlay ovk-photo-view-overlay-left"></div>
            <div class="ovk-photo-view-overlay ovk-photo-view-overlay-right"></div>
            <div class="ovk-photo-view-window">
                <div id="photo_top_controls">
                    <div id="ovk-photo-close" class="photo_top_button photo_top_close" role="button" tabindex="0" aria-label="${tr('close')}">
                        <div class="photo_close_icon"></div>
                    </div>
                </div>
                <div class="pv_wrapper ovk-photo-view ${isDoc ? 'doc_viewer' : ''}">
                    <div class="pv_left">
                        <div class="pv_photo photo_viewer_wrapper">
                            <img id="ovk-photo-img" style="display:none">
                            <div class="pv_nav_left ovk-photo-slide-left">
                                <div class="pv_nav_btn"></div>
                                <div class="pv_nav_arrow"></div>
                            </div>
                            <div class="pv_nav_right ovk-photo-slide-right">
                                <div class="pv_nav_btn"></div>
                                <div class="pv_nav_arrow"></div>
                            </div>
                        </div>
                        <div class="pv_bottom_info">
                            <div class="pv_bottom_info_left">
                                <div class="pv_album_name" id="photo_com_title_photos"></div>
                                <div class="pv_counter" id="pv_counter"></div>
                            </div>
                            <div class="pv_bottom_actions"></div>
                        </div>
                    </div>
                    <div class="pv_right ovk-photo-details ovk-modal-details"></div>
                </div>
            </div>
        </div>
        `);
    }

    PhotoViewer.prototype.createMsgbox = function () {
        this.modal = new CMessageBox({
            title: '',
            custom_template: createPhotoFrame(false),
        });

        this.modal.getNode().find('#ovk-photo-close, .ovk-photo-view-overlay').on('click', () => {
            if (this.mode == 'pptx') {
                this.setMode('vk');
                document.exitFullscreen();
            }
            this.close();
        });

        this.modal.getNode().find('.ovk-photo-slide-left').on('click', () => {
            if (this.count > 1) this.slide(-1);
        });
        this.modal.getNode().find('.ovk-photo-slide-right').on('click', () => {
            if (this.count > 1) this.slide(1);
        });

        showLoader(this.modal.getNode().find('.pv_photo').nodes[0]);
        showLoader(this.modal.getNode().find('.pv_right').nodes[0]);
    };

    const _photoUpdFrame = PhotoViewer.prototype._updFrame;
    PhotoViewer.prototype._updFrame = function (item) {
        _photoUpdFrame.call(this, item);
        if (!this.modal) return;
        const show = this.count > 1;
        this.modal.getNode().find('.pv_nav_left, .pv_nav_right').nodes.forEach(n => { n.style.display = show ? '' : 'none'; });

        const img = this.modal.getNode().find('#ovk-photo-img').nodes[0];
        const photo = this.modal.getNode().find('.pv_photo').nodes[0];
        if (!img || !photo) return;
        if (!img.dataset.prLoader) {
            img.dataset.prLoader = '1';
            img.addEventListener('load', () => {
                if (!img.src || img.src.endsWith(_loader_link)) return;
                img.style.display = '';
                hideLoader(photo);
            });
        }
        if (!img.src || img.src.endsWith(_loader_link)) {
            img.style.display = 'none';
            showLoader(photo);
        } else if (img.complete && img.naturalWidth > 0) {
            img.style.display = '';
            hideLoader(photo);
        } else {
            img.style.display = 'none';
            showLoader(photo);
        }
    };

    PhotoViewer.prototype._loadDetails = async function (itemId, context = null, event = null) {
        const entry = this.items[itemId];
        if (!entry) return;

        if (entry.cached != null && context == null) {
            this._getCurrentEntryCacheNode().last().innerHTML = entry.cached;
            if (entry.cachedBottom) {
                this.modal.getNode().find('.pv_bottom_actions').html(entry.cachedBottom);
            }
            return;
        }

        if (this.context.type == "chat" || this.mode == "tg" || this.context.type == null || (this.context.not_load_comments || false) == true) {
            if (window.im && window.im.state.is_debug) {
                this._getCurrentEntryCacheNode().last().innerHTML = itemId;
            }
            return;
        }

        let postfix_ = new URLSearchParams(entry.postfix || {});
        let next = null;
        if (context == 'pagination') {
            event.target.classList.add('lagged');
            const p = this._getPage(event.target);
            next = p[1];
            postfix_.set('p', p[0]);
        } else {
            const cacheNode = this._getCurrentEntryCacheNode().last();
            cacheNode.innerHTML = '';
            showLoader(cacheNode);
            this.modal.getNode().find('.pv_bottom_actions').html('');
        }

        let details;
        let bottomActions = '';
        try {
            let res = await fetch(this._getDetailsUrl(itemId, postfix_));
            if (res.status == 404 || res.status == 403) {
                throw new Error('not found photo page');
            }
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const detailsNode = doc.querySelector('.ovk-photo-details');
            details = detailsNode ? detailsNode.innerHTML : '';
            const bottomNode = doc.querySelector('.pv_bottom_actions');
            bottomActions = bottomNode ? bottomNode.innerHTML : '';
        } catch (e) {
            details = `<div>:( photo: ${itemId}</div>`;
            console.error(entry, e);
        }

        if (context == 'pagination') {
            this._appendDetailsAsPagination(next, event.target, details, entry);
        } else {
            this._addCachedDetailsToEntry(entry, details);
            entry.cachedBottom = bottomActions;
        }

        if (itemId === this.currentId) {
            this._getCurrentEntryCacheNode().last().innerHTML = entry.cached;
            this.modal.getNode().find('.pv_bottom_actions').html(context == 'pagination' ? '' : bottomActions);
            this._getCurrentEntryCacheNode().find(".bsdn").nodes.forEach(bsdnInitElement);
        }

        setClickableHeightForEls(this.modal.getNode(), this.modal.getNode().find(".ovk-photo-view-overlay").nodes, ".ovk-photo-view");
        this._updFrame();
    };

    DocsViewer.prototype.createMsgbox = function () {
        const template = u(`
        <div class="ovk-photo-view-dimmer ovk-msg-all">
            <div class="ovk-modal-video-window">
                <div id="video_top_controls_wrapper">
                    <div id="video_top_controls">
                        <div id="__modalDocClose" class="video_top_button video_top_close" role="button" tabindex="0" aria-label="${tr('close')}">
                            <div class="video_close_icon"></div>
                        </div>
                    </div>
                </div>
                <div class="page_block ovk-doc-viewer-body"></div>
            </div>
        </div>`);

        this.modal = new CMessageBox({
            title: '',
            custom_template: template,
        });
        showLoader(this.modal.getNode().find('.ovk-doc-viewer-body').nodes[0]);
        this.modal.getNode().find('#__modalDocClose').on('click', () => this.close());
        this.modal.getNode().find('.ovk-photo-view-dimmer').on('click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
    };

    DocsViewer.prototype._loadDetails = async function (ids) {
        const request = await fetch("/doc" + idUrlFromArray(ids));
        const body = new DOMParser().parseFromString(await request.text(), "text/html");
        const wrap = body.querySelector('.document_preview_page');
        if (!wrap) {
            CMessageBox.toggleLoader(false);
            return;
        }

        const pageBlock = this.modal.getNode().find('.ovk-doc-viewer-body').nodes[0];
        if (!pageBlock) return;
        pageBlock.innerHTML = '';

        wrap.querySelectorAll(':scope > *').forEach(el => {
            if (el.classList.contains('ovk-photo-details')) {
                pageBlock.insertAdjacentHTML('beforeend', el.innerHTML);
            } else {
                pageBlock.appendChild(el);
            }
        });
    };

    DocsViewer.prototype._updFrame = function () {
        // No title strip in this layout.
    };

    VideoViewer.prototype.createMsgbox = function () {
        const hasQueue = this.itemsByOrder.length > 1;
        const template = u(`
        <div class="ovk-photo-view-dimmer">
            <div class="ovk-photo-view-overlay ovk-photo-view-overlay-right"></div>
            <div class="ovk-modal-video-window">
                <div id="video_top_controls_wrapper">
                    <div id="video_top_controls">
                        <div id="__modal_player_close" class="video_top_button video_top_close" role="button" tabindex="0" aria-label="Close">
                            <div class="video_close_icon"></div>
                        </div>
                        <div id="__modal_player_minimize" class="video_top_button video_top_minimize" title="Minimize">
                            <div class="video_minimize_icon"></div>
                        </div>
                        <div id="toggleBar" class="video_top_button video_top_toggle_sideblock" title="Toggle sideblock">
                            <div class="video_toggle_sideblock_icon"></div>
                        </div>
                    </div>
                </div>
                <div class="page_block ovk-video-player-body">
                    <div class="video_block_layout" id="player-infos">
                        <div id="ovk-player-part">
                            <div class="top-part">
                                <b id="videoTitle"></b>
                                <div class="miniplayer-head-buttons">
                                    <div id="miniplayer_return"></div>
                                    <div id="miniplayer_close"></div>
                                </div>
                            </div>
                            <div class="center-part miniplayer-body" id="playerHtml"></div>
                            <div class="bottom-part miniplayer-body" ${hasQueue ? '' : 'style="display:none;"'}>
                                <div id="videoMoveArrows">
                                    <a id="move_back" class="hoverable_color">←</a>
                                    <a id="move_next" class="hoverable_color">→</a>
                                </div>
                            </div>
                        </div>
                        <div id="ovk-player-info" class="ovk-modal-details ovk-vid-details shown"></div>
                    </div>
                    <div id="player-video-queue">
                        <div id="player-video-name-of">${tr('playlist')}</div>
                        <div id="player-video-items"></div>
                    </div>
                </div>
            </div>
        </div>
        `);

        this.modal = new CMessageBox({
            title: '',
            custom_template: template,
        });

        const msgbox = this.modal;

        msgbox.getNode().find('#__modal_player_close, .ovk-photo-view-overlay, #miniplayer_close').on('click', () => this.close());
        msgbox.getNode().find('#__modal_player_minimize, #miniplayer_return').on('click', (e) => {
            e.preventDefault();
            if (this.isMinimized()) {
                this._returnFromMinimized();
            } else {
                msgbox.getNode().removeClass('queue-shown');
                this._showMinimized();
            }
        });
        msgbox.getNode().find('#toggleBar').on('click', (e) => {
            e.preventDefault();
            msgbox.getNode().toggleClass('queue-shown');
        });
        msgbox.getNode().find('#move_back').on('click', (e) => { e.preventDefault(); this.slide(-1); });
        msgbox.getNode().find('#move_next').on('click', (e) => { e.preventDefault(); this.slide(1); });
        msgbox.getNode().find('#player-video-queue').on('click', '.video-item', (e) => {
            e.preventDefault();
            const id = e.target.closest('.video-item').dataset.id;
            this.selectItemByApiId(id);
        });

        this.itemsByOrder.forEach(el => this._appendItemToQueue(el));
    };

    VideoViewer.prototype._showMinimized = function () {
        const node = this.modal.getNode();
        node.addClass('ovk-msg-minimized');
        u('body').removeClass('dimmed');
        u('html').attr('style', '');

        const el = $(node.nodes[0]);
        if (el.hasClass('ui-draggable')) {
            try { el.draggable('destroy'); } catch (e) {}
        }
        if (el.hasClass('ui-resizable')) {
            try { el.resizable('destroy'); } catch (e) {}
        }
        el.removeClass('ui-draggable ui-draggable-handle ui-resizable');
        node.find('.ui-resizable-handle').remove();

        el.draggable({ cursor: 'grabbing', containment: 'window', cancel: '.miniplayer-body' });
        el.resizable({ maxHeight: 700, maxWidth: 1000, minHeight: 150, minWidth: 200 });
    };

    VideoViewer.prototype._returnFromMinimized = function () {
        u('body').addClass('dimmed');
        u('html').attr('style', 'overflow-y: hidden;');
        const node = this.modal.getNode();
        node.removeClass('ovk-msg-minimized');
        node.attr('style', '');

        const el = $(node.nodes[0]);
        if (el.hasClass('ui-draggable')) {
            try { el.draggable('destroy'); } catch (e) {}
        }
        if (el.hasClass('ui-resizable')) {
            try { el.resizable('destroy'); } catch (e) {}
        }
        el.removeClass('ui-draggable ui-draggable-handle ui-resizable');
        node.find('.ui-resizable-handle').remove();
        this._draggable_ctx = null;
        this._resizeable_ctx = null;
    };

    VideoViewer.prototype._loadDetails = async function (itemId, context = null, event = null) {
        const entry = this.items[itemId];
        if (!entry) return;

        let postfix_ = new URLSearchParams(entry.postfix || {});
        let next = null;

        if (context == 'pagination') {
            event.target.classList.add('lagged');
            const p = this._getPage(event.target);
            postfix_.set('p', p[0]);
            next = p[1];
        }

        this.modal.getNode().removeClass('viewer-deleted');
        if (entry && entry.deleted == 1) {
            this.modal.getNode().addClass('viewer-deleted');
        }

        let details = '';
        if (entry.cached == null || context == 'pagination') {
            try {
                const fetcher = await fetch(this._getDetailsUrl(itemId, postfix_));
                const fetch_r = await fetcher.text();
                const results = new DOMParser().parseFromString(fetch_r, 'text/html');
                const _details = results.querySelector('.ovk-vid-details');
                details = _details ? _details.innerHTML : '';
            } catch (e) {
                console.error(e);
                makeError(String(e));
            }
        } else {
            details = entry.cached;
        }

        if (context == 'pagination') {
            this._appendDetailsAsPagination(next, event.target, details, entry);
        } else {
            this.modal.getNode().find('#ovk-player-info').html(details);
            this._addCachedDetailsToEntry(entry, details);
        }

        this._getCurrentEntryCacheNode().last().innerHTML = entry.cached;
        this.modal.getNode().find('#ovk-player-info .bsdn').nodes.forEach(item => bsdnInitElement(item));
    };

    PostViewer.prototype.createMsgbox = function () {
        const template = u(`
        <div class="ovk-photo-view-dimmer post_popup_modal">
            <div class="ovk-photo-view-overlay ovk-photo-view-overlay-right"></div>
            <div class="ovk-modal-video-window">
                <div id="video_top_controls_wrapper">
                    <div id="video_top_controls">
                        <div id="ovk-photo-close" class="video_top_button video_top_close" role="button" tabindex="0" aria-label="${tr('close')}">
                            <div class="video_close_icon"></div>
                        </div>
                    </div>
                </div>
                <div class="page_block post_viewer_page">
                    <div class="itemAuthor">
                        <a><img class="itemAuthorAva"></a>
                        <div class="itemAuthor2">
                            <span class="itemAuthorName"><a></a></span>
                            <a class="itemPostTime"></a>
                        </div>
                    </div>
                    <div class="photo_viewer_wrapper miniplayer-body">
                        <div id="itemContent"><div class="pr pr_medium"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div></div>
                    </div>
                    <div class="ovk-post-details miniplayer-body">
                        <div id="itemContentActions"></div>
                        <div id="itemContentComments" class="ovk-modal-details"></div>
                    </div>
                </div>
            </div>
        </div>
        `);

        this.modal = new CMessageBox({
            title: '',
            close_on_buttons: false,
            custom_template: template,
        });

        this.modal.getNode().find('#ovk-photo-close, .ovk-photo-view-overlay').on('click', () => this.close());
        this.modal.getNode().find('#move_back').on('click', () => this.slide(-1));
        this.modal.getNode().find('#move_next').on('click', () => this.slide(1));
    };

    PostViewer.prototype._updFrame = function (item, details_only = false) {
        this.modal.getNode().removeClass('viewer-deleted');
        if (item && item.deleted == true) {
            this.modal.getNode().addClass('viewer-deleted');
        }

        if (details_only || item != null) {
            this.modal.getNode().find('#itemContentComments').html(item.cached);
        }

        if (item && (this.currentId != item.id)) {
            this.modal.getNode().find('#itemContent').html(item.html);

            const post = this.modal.getNode().find('#itemContent > .post').first();
            if (!post.length) {
                setClickableHeightForEls(this.modal.getNode(), this.modal.getNode().find('.ovk-photo-view-overlay').nodes, '.photo_viewer_wrapper', -50);
                return;
            }

            post.addClass('in-window');

            const authorLink = post.find('.post_author .author').first();
            const authorName = authorLink.length ? authorLink.textContent : '';
            const authorUrl = authorLink.length ? authorLink.attr('href') : '';
            const authorAva = post.find('.post-avatar').first();
            const authorAvaSrc = authorAva.length ? authorAva.src : null;
            const dateLink = post.find('.post_date .post_link').first();
            const dates = dateLink.length ? dateLink.textContent : '';
            const postUrl = dateLink.length ? dateLink.attr('href') : '';

            if (authorAvaSrc) {
                this.modal.getNode().find('.itemAuthorAva').attr('src', authorAvaSrc).attr('style', '');
            } else {
                this.modal.getNode().find('.itemAuthorAva').attr('src', null).attr('style', 'display:none');
            }
            this.modal.getNode().find('.itemAuthorName a').html(escapeHtml(authorName));
            this.modal.getNode().find('.itemAuthorName a').attr('href', authorUrl);
            this.modal.getNode().find('.itemPostTime').html(escapeHtml(dates));
            this.modal.getNode().find('.itemPostTime').attr('href', postUrl);

            const likeWrap = post.find('.post_full_like_wrap').last();
            this.modal.getNode().find('#itemContentActions').html(likeWrap.length ? likeWrap.outerHTML : '');
        }

        setClickableHeightForEls(this.modal.getNode(), this.modal.getNode().find('.ovk-photo-view-overlay').nodes, '.photo_viewer_wrapper', -50);
    };
});
