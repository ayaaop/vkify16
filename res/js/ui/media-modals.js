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

    function isMobilePhotoView() {
        try {
            return typeof window !== 'undefined' && !!window.isMobile && window.isMobile();
        } catch (e) {
            return false;
        }
    }

    function createMobilePhotoFrame() {
        return u(`
        <div class="ovk-photo-view-dimmer">
            <div class="ovk-photo-view-window">
                <div class="pv_wrapper mobile-photo-modal">
                    <div class="mobile-photo-header">
                        <div class="mph-left">
                            <div id="__modal_photo_close" class="pv_back_btn" style="cursor:pointer;">
                                <svg width="28" height="28" viewBox="0 0 28 28"><use href="#arrow-left-outline-28"></use></svg>
                            </div>
                            <div class="pv_title_group">
                                <div class="pv_album_name"><div id="photo_com_title_photos"></div></div>
                                <div class="pv_counter"></div>
                            </div>
                        </div>
                        <div class="mph-right">
                            <div class="pv_actions_more_wrap" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="mobile-photo-body pv_photo photo_viewer_wrapper" style="overflow: hidden; position: relative; touch-action: none;">
                        <img id="ovk-photo-img" style="display:none">
                        <div class="pv_nav_left ovk-photo-slide-left" id="pv_nav_left">
                            <div class="pv_nav_btn">
                                <div class="pv_nav_arrow"></div>
                            </div>
                        </div>
                        <div class="pv_nav_right ovk-photo-slide-right" id="pv_nav_right">
                            <div class="pv_nav_btn">
                                <div class="pv_nav_arrow"></div>
                            </div>
                        </div>
                    </div>
                    <div class="mobile-photo-footer">
                        <div class="pv_desc" style="display:none;"></div>
                        <div class="mobile-photo-actions pv_bottom_actions"></div>
                    </div>
                    <div class="pv_right ovk-photo-details" style="display:none;"></div>
                </div>
            </div>
        </div>
        `);
    }

    function createPhotoFrame(isDoc = false) {
        if (isMobilePhotoView()) {
            return createMobilePhotoFrame();
        }
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

    function attachMobilePhotoGestures(viewer) {
        const node = viewer.modal.getNode();
        const img = node.find('#ovk-photo-img').nodes[0];
        const container = node.find('.mobile-photo-body').nodes[0];
        const windowNode = node.find('.ovk-photo-view-window').nodes[0];
        const headerNode = node.find('.mobile-photo-header').nodes[0];
        const footerNode = node.find('.mobile-photo-footer').nodes[0];
        if (!img || !container) {
            return null;
        }

        const state = {
            scale: 1, lastScale: 1, currentX: 0, currentY: 0,
            startDistance: 0, pinchMidX: 0, pinchMidY: 0,
            pinchStartX: 0, pinchStartY: 0, lastTap: 0,
            singleTapTimer: null, initialX: 0, initialY: 0,
            startTouchX: 0, startTouchY: 0, swipeAxis: null,
            uiVisible: true, opacity: 1, destroyed: false,
        };
        const MAX_SCALE = 5;

        const getDistance = (touches) => Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        const getMidpoint = (touches) => ({
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        });
        const clampPan = () => {
            const imgW = img.naturalWidth || img.offsetWidth || container.offsetWidth;
            const imgH = img.naturalHeight || img.offsetHeight || container.offsetHeight;
            const cW = container.offsetWidth;
            const cH = container.offsetHeight;
            const maxX = Math.max(0, (Math.min(imgW, cW) * state.scale - cW) / 2);
            const maxY = Math.max(0, (Math.min(imgH, cH) * state.scale - cH) / 2);
            state.currentX = Math.max(-maxX, Math.min(maxX, state.currentX));
            state.currentY = Math.max(-maxY, Math.min(maxY, state.currentY));
        };
        const updateTransform = () => {
            if (state.scale < 1) {
                state.scale = 1;
                state.currentX = 0;
                state.currentY = 0;
            }
            img.style.transform = `translate(${state.currentX}px, ${state.currentY}px) scale(${state.scale})`;
        };
        const updateOpacity = () => {
            if (windowNode) windowNode.style.backgroundColor = `rgba(0,0,0,${state.opacity})`;
            if (headerNode) headerNode.style.opacity = state.opacity;
            if (footerNode) footerNode.style.opacity = state.opacity;
        };
        const setUiVisible = (visible) => {
            state.uiVisible = visible;
            if (headerNode) headerNode.classList.toggle('pv-ui-hidden', !visible);
            if (footerNode) footerNode.classList.toggle('pv-ui-hidden', !visible);
        };
        const reset = (animated = true) => {
            if (animated) img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
            state.currentX = 0;
            state.currentY = 0;
            state.scale = 1;
            state.opacity = 1;
            updateTransform();
            if (windowNode) windowNode.style.transition = 'background-color 0.2s';
            if (headerNode) headerNode.style.transition = '';
            if (footerNode) footerNode.style.transition = '';
            updateOpacity();
        };

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                state.startDistance = getDistance(e.touches);
                state.lastScale = state.scale;
                state.swipeAxis = null;
                img.style.transition = 'none';
                const mid = getMidpoint(e.touches);
                state.pinchMidX = mid.x;
                state.pinchMidY = mid.y;
                state.pinchStartX = state.currentX;
                state.pinchStartY = state.currentY;
            } else if (e.touches.length === 1) {
                const now = Date.now();
                const tapLength = now - state.lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    clearTimeout(state.singleTapTimer);
                    state.singleTapTimer = null;
                    e.preventDefault();
                    if (state.scale > 1) {
                        state.scale = 1;
                        state.currentX = 0;
                        state.currentY = 0;
                    } else {
                        const rect = container.getBoundingClientRect();
                        const tapX = e.touches[0].clientX - rect.left - rect.width / 2;
                        const tapY = e.touches[0].clientY - rect.top - rect.height / 2;
                        state.scale = 2;
                        state.currentX = -tapX / 2;
                        state.currentY = -tapY / 2;
                        clampPan();
                    }
                    img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    updateTransform();
                    state.lastTap = 0;
                } else {
                    img.style.transition = 'none';
                    state.startTouchX = e.touches[0].clientX;
                    state.startTouchY = e.touches[0].clientY;
                    state.initialX = e.touches[0].clientX - state.currentX;
                    state.initialY = e.touches[0].clientY - state.currentY;
                    state.swipeAxis = null;
                    if (windowNode) windowNode.style.transition = 'none';
                    state.lastTap = now;
                }
            }
        };
        const onTouchMove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const newScale = Math.min(MAX_SCALE, Math.max(1, state.lastScale * (getDistance(e.touches) / state.startDistance)));
                const scaleDelta = newScale / state.scale;
                const rect = container.getBoundingClientRect();
                const originX = state.pinchMidX - rect.left - rect.width / 2;
                const originY = state.pinchMidY - rect.top - rect.height / 2;
                const curMid = getMidpoint(e.touches);
                state.currentX = state.pinchStartX + (originX - state.pinchStartX) * (1 - scaleDelta) + (curMid.x - state.pinchMidX);
                state.currentY = state.pinchStartY + (originY - state.pinchStartY) * (1 - scaleDelta) + (curMid.y - state.pinchMidY);
                state.scale = newScale;
                clampPan();
                updateTransform();
            } else if (e.touches.length === 1) {
                if (state.scale > 1) {
                    e.preventDefault();
                    state.currentX = e.touches[0].clientX - state.initialX;
                    state.currentY = e.touches[0].clientY - state.initialY;
                    clampPan();
                    updateTransform();
                    state.swipeAxis = null;
                } else if (state.scale === 1) {
                    const dx = e.touches[0].clientX - state.startTouchX;
                    const dy = e.touches[0].clientY - state.startTouchY;
                    if (!state.swipeAxis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                        state.swipeAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
                    }
                    e.preventDefault();
                    if (state.swipeAxis === 'x') {
                        state.currentX = e.touches[0].clientX - state.initialX;
                        state.currentY = 0;
                        updateTransform();
                    } else {
                        state.currentX = 0;
                        state.currentY = e.touches[0].clientY - state.initialY;
                        updateTransform();
                        state.opacity = 1 - Math.min(Math.abs(state.currentY) / 300, 1);
                        updateOpacity();
                    }
                }
            }
        };
        const onTouchEnd = (e) => {
            if (e.touches.length !== 0 || e.changedTouches.length !== 1) {
                state.swipeAxis = null;
                return;
            }
            if (state.swipeAxis === null) {
                const dx = e.changedTouches[0].clientX - state.startTouchX;
                const dy = e.changedTouches[0].clientY - state.startTouchY;
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
                    clearTimeout(state.singleTapTimer);
                    state.singleTapTimer = setTimeout(() => {
                        state.singleTapTimer = null;
                        setUiVisible(!state.uiVisible);
                    }, 300);
                    return;
                }
            }
            state.lastScale = state.scale;
            img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
            if (state.scale < 1) {
                reset();
            } else if (state.scale === 1) {
                const imagesCount = viewer.count || 1;
                if (state.swipeAxis === 'x' && Math.abs(state.currentX) > 60 && imagesCount > 1) {
                    const goNext = state.currentX < 0;
                    const exitX = goNext ? -window.innerWidth : window.innerWidth;
                    state.currentX = exitX;
                    updateTransform();
                    setTimeout(() => {
                        if (state.destroyed) return;
                        img.style.transition = 'none';
                        reset(false);
                        viewer.slide(goNext ? 1 : -1);
                    }, 200);
                } else if (state.swipeAxis === 'y' && Math.abs(state.currentY) > 200) {
                    const direction = state.currentY > 0 ? 1 : -1;
                    state.currentY = state.currentY + direction * window.innerHeight;
                    state.opacity = 0;
                    updateTransform();
                    if (windowNode) windowNode.style.transition = 'background-color 0.2s';
                    if (headerNode) headerNode.style.transition = 'opacity 0.2s';
                    if (footerNode) footerNode.style.transition = 'opacity 0.2s';
                    updateOpacity();
                    setTimeout(() => {
                        if (!state.destroyed) viewer.close();
                    }, 200);
                } else {
                    reset();
                }
            }
            state.swipeAxis = null;
        };

        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd);
        return {
            reset: () => reset(false),
            destroy: () => {
                state.destroyed = true;
                clearTimeout(state.singleTapTimer);
                container.removeEventListener('touchstart', onTouchStart);
                container.removeEventListener('touchmove', onTouchMove);
                container.removeEventListener('touchend', onTouchEnd);
            },
        };
    }

    PhotoViewer.prototype.createMsgbox = function () {
        this.modal = new CMessageBox({
            title: '',
            custom_template: createPhotoFrame(false),
        });

        this.modal.getNode().find('#ovk-photo-close, #__modal_photo_close, .ovk-photo-view-overlay').on('click', () => {
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

        if (this._mobileGestures && typeof this._mobileGestures.destroy === 'function') {
            try {
                this._mobileGestures.destroy();
            } catch (e) {
            }
            this._mobileGestures = null;
        }
        if (this.modal.getNode().find('.mobile-photo-modal').nodes.length > 0) {
            this._mobileGestures = attachMobilePhotoGestures(this);
        }

        showLoader(this.modal.getNode().find('.pv_photo').nodes[0]);
        showLoader(this.modal.getNode().find('.pv_right').nodes[0]);
    };

    const _photoUpdFrame = PhotoViewer.prototype._updFrame;
    PhotoViewer.prototype._updFrame = function (item) {
        if (this._mobileGestures && typeof this._mobileGestures.reset === 'function') {
            try {
                this._mobileGestures.reset();
            } catch (e) {
            }
        }
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

    const _origGetDetailsUrl = PhotoViewer.prototype._getDetailsUrl;
    if (typeof _origGetDetailsUrl === 'function') {
        PhotoViewer.prototype._getDetailsUrl = function (id, postfix) {
            const cleanId = (typeof id === 'string') ? id.replace(/^["']+|["']+$/g, '') : id;
            return _origGetDetailsUrl.call(this, cleanId, postfix);
        };
    }

    function syncMobilePhotoFooter(viewer, detailsHtml, bottomHtml, itemId) {
        try {
            const node = viewer.modal.getNode();
            if (node.find('.mobile-photo-modal').nodes.length === 0) {
                return;
            }
            const footerDesc = node.find('.mobile-photo-footer .pv_desc');
            const footerActions = node.find('.mobile-photo-actions');
            if (footerDesc.nodes.length === 0 || footerActions.nodes.length === 0) {
                return;
            }
            const tmp = document.createElement('div');
            tmp.innerHTML = detailsHtml || '';
            footerDesc.html('');
            const srcDesc = tmp.querySelector('.pv_desc');
            if (srcDesc && srcDesc.textContent.trim()) {
                Array.from(srcDesc.childNodes).forEach((child) => {
                    footerDesc.nodes[0].appendChild(child);
                });
                footerDesc.attr('style', '');
            } else {
                footerDesc.attr('style', 'display:none;');
            }
            footerActions.html('');
            const srcLikes = tmp.querySelector('.post_full_like_wrap');
            if (srcLikes) {
                Array.from(srcLikes.childNodes).forEach((child) => {
                    footerActions.nodes[0].appendChild(child);
                });
            }
            if (footerActions.find('.reply_link_wrap, .post_reply').nodes.length === 0) {
                const photoRef = String(itemId || '').replace(/^["']+|["']+$/g, '').split('_').slice(0, 2).join('_');
                if (photoRef && photoRef.includes('_')) {
                    const replyLink = document.createElement('a');
                    replyLink.className = 'reply_link_wrap mobileonly';
                    replyLink.href = '/photo' + photoRef;
                    replyLink.textContent = tr('comment');
                    footerActions.nodes[0].appendChild(replyLink);
                }
            }
            const wrap = node.find('.pv_actions_more_wrap');
            let moreHtml = '';
            try {
                const tmp = document.createElement('div');
                tmp.innerHTML = bottomHtml || '';
                const moreMenu = tmp.querySelector('#pv_actions_more_menu');
                const deleteBtn = tmp.querySelector('#_photoDelete');
                if (moreMenu) {
                    moreHtml += moreMenu.innerHTML;
                }
                if (deleteBtn) {
                    moreHtml += deleteBtn.outerHTML;
                }
            } catch (e) {
            }
            if (moreHtml) {
                wrap.html(`
                    <div class="ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this, null, {autopos: true});" onmouseout="uiActionsMenu.hide(this);">
                        <div class="pv_actions_more mobile-three-dots" role="button" style="display:flex; align-items:center;">
                            <svg width="28" height="28" viewBox="0 0 28 28"><use href="#more-vertical-28"></use></svg>
                        </div>
                        <div id="pv_actions_more_menu_mobile" class="ui_actions_menu dark">${moreHtml}</div>
                    </div>`).attr('style', 'display:block; cursor:pointer;');
            } else {
                wrap.html('').attr('style', 'display:none;');
            }
        } catch (e) {
        }
    }

    function clearMobilePhotoFooter(viewer) {
        try {
            const node = viewer.modal.getNode();
            if (node.find('.mobile-photo-modal').nodes.length === 0) {
                return;
            }
            node.find('.mobile-photo-footer .pv_desc').attr('style', 'display:none;');
            node.find('.mobile-photo-actions').html('');
            node.find('.pv_actions_more_wrap').html('').attr('style', 'display:none;');
        } catch (e) {
        }
    }

    PhotoViewer.prototype._loadDetails = async function (itemId, context = null, event = null) {
        const entry = this.items[itemId];
        if (!entry) return;

        const isMobileModal = this.modal && this.modal.getNode().find('.mobile-photo-modal').nodes.length > 0;

        if (entry.cached != null && context == null) {
            if (!isMobileModal) {
                this._getCurrentEntryCacheNode().last().innerHTML = entry.cached;
            }
            if (isMobileModal) {
                syncMobilePhotoFooter(this, entry.cached || '', entry.cachedBottom || '', itemId);
            } else if (entry.cachedBottom) {
                this.modal.getNode().find('.pv_bottom_actions').html(entry.cachedBottom);
            }
            return;
        }

        if (this.context.type == "chat" || this.mode == "tg" || this.context.type == null || (this.context.not_load_comments || false) == true) {
            if (window.im && window.im.state.is_debug) {
                this._getCurrentEntryCacheNode().last().innerHTML = itemId;
            }
            if (isMobileModal) {
                clearMobilePhotoFooter(this);
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
            if (!isMobileModal) {
                this._getCurrentEntryCacheNode().last().innerHTML = entry.cached;
            }
            if (isMobileModal) {
                syncMobilePhotoFooter(this, details, bottomActions, itemId);
            } else {
                this.modal.getNode().find('.pv_bottom_actions').html(context == 'pagination' ? '' : bottomActions);
            }
            this._getCurrentEntryCacheNode().find(".bsdn").nodes.forEach(bsdnInitElement);
        }

        if (!isMobileModal) {
            setClickableHeightForEls(this.modal.getNode(), this.modal.getNode().find(".ovk-photo-view-overlay").nodes, ".ovk-photo-view");
        }
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
                    <div class="photo_viewer_wrapper">
                        <div id="itemContent"><div class="pr pr_medium"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div></div>
                    </div>
                    <div class="ovk-post-details">
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

        this.modal.getNode().find('.post_viewer_page')
            .addClass('ovk-msg-all')
            .attr('data-id', this.modal.id);

        this.modal.getNode().find('#ovk-photo-close, .ovk-photo-view-overlay').on('click', () => this.close());
        this.modal.getNode().find('#move_back').on('click', () => this.slide(-1));
        this.modal.getNode().find('#move_next').on('click', () => this.slide(1));

        this.modal.getNode().on('click', (e) => {
            const link = e.target && typeof e.target.closest === 'function' ? e.target.closest('.sort_link') : null;
            if (!link) return;
            e.preventDefault();
            e.stopPropagation();

            const sort = new URL(link.href, location.href).searchParams.get('sort');
            const postId = this.currentId || this.context.id;
            if (!sort || !postId) return;

            CMessageBox.toggleLoader(true);
            this._downloadPage(postId, new URLSearchParams({ sort }))
                .then((htmls) => {
                    const it = this.items[postId];
                    if (it) {
                        it.html = htmls[0];
                        it.cached = htmls[1];
                    }
                    this._updFrame({ html: htmls[0], cached: htmls[1] });
                })
                .catch((err) => console.error(err))
                .finally(() => CMessageBox.toggleLoader(false));
        });
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

    const _origResetMsgboxDetails = typeof window.reset_msgbox_details === 'function' ? window.reset_msgbox_details : null;
    window.reset_msgbox_details = function vkifyResetMsgboxDetails(boxTarget) {
        let msgId = null;
        if (boxTarget && boxTarget.nodes && boxTarget.nodes[0]) {
            msgId = boxTarget.nodes[0].dataset.id;
        } else if (boxTarget && boxTarget.dataset) {
            msgId = boxTarget.dataset.id;
        }
        if (!msgId) return;

        const msg = typeof find_msgbox_by_id === 'function' ? find_msgbox_by_id(msgId) : null;
        if (msg && msg._viewer && typeof msg._viewer._removeCacheForCurrentEntry === 'function') {
            msg._viewer._removeCacheForCurrentEntry();
        }
    };

    if (_origResetMsgboxDetails) {
        window.reset_msgbox_details._orig = _origResetMsgboxDetails;
    }
});
