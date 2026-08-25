vkify.once('mediaModals', function () {

    const tr = window.tr;
    const escapeHtml = window.escapeHtml;
    const LoaderUtils = window.LoaderUtils;
    const fastError = window.fastError;
    const CF = window.ContentFetcher;
    const ModalUtils = window.ModalUtils;

    async function vkifyOpenVideo(video_arr = [], init_player = true, skipUrlUpdate = false, startAtTime = 0) {
        try {
            const loader = CF.createLoader();
            if (loader.isShown()) return;

            loader.show();
            const video_owner = video_arr[0];
            const video_id = video_arr[1];
            const pretty_id = `${video_owner}_${video_id}`;

            function updateVideoUrl(videoId) {
                CF.updateUrlParam('z', `video${videoId}`, { skip: skipUrlUpdate });
            }

            function clearVideoUrl() {
                CF.clearUrlParam('z');
            }

            let doc;
            try {
                doc = await CF.fetchPageContent(`/video${pretty_id}`, null, { ajaxQuery: true, showLoader: false });
            } catch (e) {
                loader.hide();
                if (e.message !== 'Page redirected') {
                    fastError(e.message);
                }
                return;
            }

            const titleEl = doc.querySelector('.video_info_title');
            const videoTitle = titleEl?.textContent?.trim() || tr('video');

            const authorEl = doc.querySelector('.video_info_author_name a');
            const authorName = authorEl?.textContent?.trim() || '';

            let player_html = '';
            let isYoutube = false;

            const videoBlock = doc.querySelector('.video_block_layout');
            if (videoBlock && init_player) {
                const videoEl = videoBlock.querySelector('video');
                const iframeEl = videoBlock.querySelector('iframe');

                if (videoEl) {
                    const playerUrl = videoEl.dataset.src || videoEl.getAttribute('src') || '';
                    const bsdnDiv = videoBlock.querySelector('.bsdn');
                    const dataId = bsdnDiv?.dataset?.id || pretty_id;
                    const dataName = bsdnDiv?.dataset?.name || videoTitle;
                    const dataAuthor = bsdnDiv?.dataset?.author || authorName;
                    player_html = `
                    <div class="video-player-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                        <div class='bsdn media' data-id="${escapeHtml(dataId)}" data-name="${escapeHtml(dataName)}" data-author="${escapeHtml(dataAuthor)}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                            <video class='media' data-src='${escapeHtml(playerUrl)}' style="width: 100%; height: 100%; object-fit: contain;"></video>
                        </div>
                    </div>
                `;
                } else if (iframeEl) {
                    isYoutube = true;
                    const iframeSrc = iframeEl.getAttribute('src') || '';
                    player_html = `
                    <div class="video-player-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                        <iframe
                           style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                           src="${escapeHtml(iframeSrc)}"
                           frameborder="0"
                           sandbox="allow-same-origin allow-scripts allow-popups"
                           allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                           allowfullscreen></iframe>
                    </div>
                `;
                }
            }

            const videoInfo = doc.querySelector('.video_info');
            let videoInfoHtml = '';
            if (videoInfo) {
                const viewButton = `
            <a href="/video${pretty_id}" class="video_view_button button button_light">
                <span class="video_view_link" style="display: inline!important">${tr("view_video")}</span>
            </a>`;
                const moreActions = videoInfo.querySelector('.video_info_more_actions');
                if (moreActions) {
                    moreActions.insertAdjacentHTML('beforebegin', viewButton);
                } else {
                    videoInfo.insertAdjacentHTML('beforeend', viewButton);
                }
                videoInfoHtml = videoInfo.innerHTML;
            }

            const videoComments = doc.querySelector('.video_comments');
            const videoCommentsHtml = videoComments ? videoComments.innerHTML : '';

            const content = `
        <div class="page_block">
            <div class="video_block_layout">
                ${player_html}
            </div>
            <div class="video_info">${videoInfoHtml}</div>
            <div class="clear_fix video_comments" id="video_comments_section" style="${videoCommentsHtml ? '' : 'display: none;'}">
                ${videoCommentsHtml || '<div class="pr pr_medium"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>'}
            </div>
        </div>`;

            const msgbox = ModalUtils.createModal({
                type: 'video',
                title: escapeHtml(videoTitle),
                content: content,
                showMinimize: true,
                closeOnButtons: false,
                warnOnExit: false
            });

            if (!isYoutube) {
                const bsdnNode = msgbox.getNode().find('.bsdn').nodes[0];
                if (bsdnNode) {
                    bsdnInitElement(bsdnNode);
                    const modalPlayer = msgbox.getNode().find('.bsdn > video').nodes[0];
                    if (modalPlayer && startAtTime > 0) {
                        if (!modalPlayer.src && modalPlayer.dataset.src) {
                            modalPlayer.src = modalPlayer.dataset.src;
                            modalPlayer.load();
                        }
                        modalPlayer.addEventListener('loadedmetadata', function() {
                            modalPlayer.currentTime = startAtTime;
                            modalPlayer.play();
                        }, { once: true });
                        if (modalPlayer.readyState >= 1) {
                            modalPlayer.currentTime = startAtTime;
                            modalPlayer.play();
                        }
                    }
                }
            }

            bsdnHydrate();
            async function loadVideoInfo() {
                const videoInfoTarget = msgbox.getNode().find('.video_info');

                await CF.loadInto(videoInfoTarget, `/video${pretty_id}`, null, {
                    fetchOptions: { ajaxQuery: false },
                    loaderOptions: { size: 'medium' },
                    render(doc) {
                        const results = u(doc);

                        const videoInfo = results.find('.video_info');
                        if (videoInfo.length > 0) {
                            const viewButton = `
            <a href="/video${pretty_id}" class="video_view_button button button_light">
                <span class="video_view_link" style="display: inline!important">${tr("view_video")}</span>
            </a>`;
                            const moreActions = videoInfo.find('.video_info_more_actions');
                            if (moreActions.length > 0) {
                                moreActions.before(viewButton);
                            } else {
                                videoInfo.append(viewButton);
                            }
                            videoInfoTarget.html(videoInfo.html());
                            bsdnHydrate();


                        } else {
                            videoInfoTarget.html(`<div class="video_info_title">${escapeHtml(videoTitle)}</div>`);
                        }

                        const videoComments = results.find('.video_comments');
                        if (videoComments.length > 0) {
                            msgbox.getNode().find('#video_comments_section').html(videoComments.html());
                            msgbox.getNode().find('#video_comments_section').attr('style', '');
                            bsdnHydrate();


                        }
                    }
                });
            }

            window._currentMediaModalRefresh = () => {
                if (document.contains(msgbox.getNode().nodes[0])) {
                    loadVideoInfo();
                }
            };

            ModalUtils.setupCloseButton(msgbox, '#__modalPlayerClose');
            ModalUtils.setupDimmerClose(msgbox);
            msgbox.getNode().find('#__modalPlayerClose').on('click', (e) => {
                e.preventDefault();
                msgbox.close();
            });

            msgbox.getNode().find('#__modalPlayerMinimize').on('click', (e) => {
                e.preventDefault();

                const miniplayer = u(`
                    <div class="miniplayer">
                        <div class="miniplayer-head">
                            <b>${escapeHtml(videoTitle)}</b>
                            <div class="miniplayer-head-buttons">
                                <div id="__miniplayer_return"></div>
                                <div id="__miniplayer_close"></div>
                            </div>
                        </div>
                        <div class="miniplayer-body"></div>
                    </div>
                `);

                msgbox.hide();

                const videoBlockLayout = msgbox.getNode().find('.video_block_layout').nodes[0];
                const originalParent = videoBlockLayout.parentNode;
                const originalNextSibling = videoBlockLayout.nextSibling;

                u('body').append(miniplayer);
                miniplayer.find('.miniplayer-body').nodes[0].append(videoBlockLayout);
                miniplayer.attr('style', 'left:100px;top:0px;');

                miniplayer.find('#__miniplayer_return').on('click', () => {
                    msgbox.reveal();
                    originalParent.insertBefore(videoBlockLayout, originalNextSibling);
                    miniplayer.remove();
                });

                miniplayer.find('#__miniplayer_close').on('click', () => {
                    msgbox.close();
                    miniplayer.remove();
                });

                $('.miniplayer').draggable({ cursor: 'grabbing', containment: 'window', cancel: '.miniplayer-body' });
                $('.miniplayer').resizable({
                    maxHeight: 2000,
                    maxWidth: 3000,
                    minHeight: 150,
                    minWidth: 200
                });
            });

            ModalUtils.setupCleanup(msgbox, () => {
                ModalUtils.unregisterModal(msgbox);
                clearVideoUrl();

                window._currentMediaModalRefresh = null;
            });

            updateVideoUrl(pretty_id);

            loader.hide();
        } catch (err) {
            console.error(err);
            CF.createLoader().hide();
        }
    }

    if (typeof window.OpenVideo === 'function') {
        vkify.hook(window, 'OpenVideo', vkifyOpenVideo, 'replace');
    } else {
        window.OpenVideo = vkifyOpenVideo;
    }

    u(document).on('click', '#videoOpen', (e) => {
        e.preventDefault()
        e.stopPropagation()

        try {
            const target = e.target.closest('#videoOpen')
            const vid = target.dataset.id
            const split = vid.split('_')

            OpenVideo(split)
        } catch(ec) {
            return
        }
    });

    async function vkifyOpenMiniature(e, photo, post, photo_id, type = "post", skipUrlUpdate = false) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        try {
            let photoOwnerId = parseInt(photo_id.split('_')[0]);
            let photoRealId = parseInt(photo_id.split('_')[1]);
            const currentUserId = window.openvk?.current_id || 0;

            try {
                await CF.fetchPageContent(`/photo${photo_id}`, null, { ajaxQuery: true, showLoader: false });
            } catch (e) {
                if (e.message !== 'Page redirected') {
                    console.warn('Could not check photo access:', e);
                }
                return;
            }

            let content;
            if (window.isMobile && window.isMobile()) {
                content = `
        <div class="pv_wrapper mobile-photo-modal">
            <div class="mobile-photo-header">
                <div class="mph-left">
                    <div id="__modal_photo_close" class="pv_back_btn" style="cursor:pointer;">
                        <svg width="28" height="28" viewBox="0 0 28 28"><use href="#arrow-left-outline-28"></use></svg>
                    </div>
                    <div class="pv_title_group">
                        <div class="pv_album_name"><div id='pv_actions_loader'></div></div>
                        <div class="pv_counter"></div>
                    </div>
                </div>
                <div class="mph-right">
                    <div class="pv_actions_more_wrap" style="display:none;"></div>
                </div>
            </div>

            <div class="mobile-photo-body pv_photo" style="overflow: hidden; position: relative; touch-action: none;">
                <img src="${photo}" id="pv_photo_img" style="transform-origin: center center;" />
                <div class="pv_nav_left" id="pv_nav_left" style="display: none;">
                    <div class="pv_nav_btn">
                        <div class="pv_nav_arrow"></div>
                    </div>
                </div>
                <div class="pv_nav_right" id="pv_nav_right" style="display: none;">
                    <div class="pv_nav_btn">
                        <div class="pv_nav_arrow"></div>
                    </div>
                </div>
            </div>

            <div class="mobile-photo-footer">
                <div class="pv_desc" style="display:none;"></div>
                <div class="mobile-photo-actions pv_bottom_actions"></div>
            </div>
            
            <div class="pv_right" style="display:none;"></div>
        </div>`;
            } else {
                content = `
        <div class="pv_wrapper">
            <div class="pv_left">
                <div class="pv_photo">
                    <img src="${photo}" id="pv_photo_img" />
                    <div class="pv_nav_left" id="pv_nav_left" style="display: none;">
                        <div class="pv_nav_btn">
                            <div class="pv_nav_arrow"></div>
                        </div>
                    </div>
                    <div class="pv_nav_right" id="pv_nav_right" style="display: none;">
                        <div class="pv_nav_btn">
                            <div class="pv_nav_arrow"></div>
                        </div>
                    </div>
                </div>
                <div class="pv_bottom_info">
                    <div class="pv_bottom_info_left">
                        <div class="pv_album_name"><div id='pv_actions_loader'></div></div>
                        <div class="pv_counter"></div>
                    </div>
                    <div class="pv_bottom_actions"></div>
                </div>
            </div>
            <div class="pv_right"></div>
        </div>`;
            }


            const msgbox = ModalUtils.createModal({
                type: 'photo',
                title: tr('photo'),
                content: content,
                closeOnButtons: false,
                warnOnExit: false
            });

            const pretty_id = photo_id;

            function updatePhotoUrl(photoId, albumId = null) {
                let value;
                if (albumId) {
                    value = `photo${photoId}%2Falbum${albumId}`;
                } else if (type === 'post' && post) {
                    value = `photo${photoId}%2Fwall${post}`;
                } else if (type === 'comment' && post) {
                    value = `photo${photoId}%2Fcomment${post}`;
                } else {
                    value = `photo${photoId}`;
                }
                CF.updateUrlParam('z', value, { skip: skipUrlUpdate });
            }

            function clearPhotoUrl() {
                CF.clearUrlParam('z');
            }

            ModalUtils.setupCloseButton(msgbox, '#__modal_photo_close');

            let json = null;
            let imagesCount = 0;
            let currentImageid = pretty_id;
            let shown_offset = 1;
            let offset = 0;
            const albums_per_page = 50;
            let currentAlbumId = null;

            function getIndex(photo_id = null) {
                if (!json || !json.body) return 1;
                return Object.keys(json.body).findIndex(item => item == (photo_id ?? currentImageid)) + 1;
            }

            function getByIndex(id) {
                if (!json || !json.body) return null;
                const ids = Object.keys(json.body);
                const _id = ids[id - 1];
                return json.body[_id];
            }

            function preloadPhoto(url) {
                if (!url) return;
                const img = new Image();
                img.src = url;
            }

            function preloadAdjacentPhotos() {
                if (!json || !json.body || imagesCount <= 1) return;

                const currentIndex = getIndex();
                const prevIndex = currentIndex <= 1 ? imagesCount : currentIndex - 1;
                const nextIndex = currentIndex >= imagesCount ? 1 : currentIndex + 1;

                const prevPhoto = getByIndex(prevIndex);
                const nextPhoto = getByIndex(nextIndex);

                if (prevPhoto?.url) preloadPhoto(prevPhoto.url);
                if (nextPhoto?.url) preloadPhoto(nextPhoto.url);
            }

            function reloadTitleBar() {
                const countText = imagesCount > 1 ? tr("photo_x_from_y", shown_offset, imagesCount) : '';
                msgbox.getNode().find('.pv_counter').html(countText);
            }

            async function loadContext(contextType, contextId) {
                if (contextType == 'post' || contextType == 'comment') {
                    const form_data = new FormData();
                    form_data.append('parentType', contextType);

                    const contextParam = contextType === 'comment' ? `1_${contextId}` : contextId;
                    const endpoint_url = `/iapi/getPhotosFromPost/${contextParam}`;

                    json = await CF.request(endpoint_url, {
                        method: 'POST',
                        body: form_data,
                        responseType: 'json',
                        ajaxQuery: false
                    });
                    imagesCount = Object.entries(json.body).length;
                } else if (contextType == 'album') {
                    currentAlbumId = contextId;
                    const params = {
                        'offset': offset,
                        'count': albums_per_page,
                        'owner_id': contextId.split('_')[0],
                        'album_id': contextId.split('_')[1],
                        'photo_sizes': 1
                    };

                    const result = await window.OVKAPI.call('photos.get', params);
                    const converted_items = {};

                    result.items.forEach(item => {
                        const id = item.owner_id + '_' + item.id;
                        converted_items[id] = {
                            'url': item.src_xbig,
                            'id': id,
                        };
                    });
                    imagesCount = result.count;

                    if (!json) json = { 'body': {} };
                    json.body = Object.assign(converted_items, json.body);
                }

                currentImageid = pretty_id;
            }

            async function slidePhoto(direction) {
                if (!json) {
                    return;
                }

                let current_index = getIndex();
                if (current_index >= imagesCount && direction == 1) {
                    shown_offset = 1;
                    current_index = 1;
                } else if (current_index <= 1 && direction == 0) {
                    shown_offset += imagesCount - 1;
                    current_index = imagesCount;
                } else if (direction == 1) {
                    shown_offset += 1;
                    current_index += 1;
                } else if (direction == 0) {
                    shown_offset -= 1;
                    current_index -= 1;
                }

                const nextPhoto = getByIndex(current_index);
                if (!nextPhoto) return;

                currentImageid = nextPhoto.id;
                const photoURL = json?.body?.[currentImageid]?.url || photo;

                msgbox.getNode().find('#pv_photo_img').attr('src', photoURL);

                reloadTitleBar();
                updatePhotoUrl(currentImageid, currentAlbumId);
                preloadAdjacentPhotos();

                await loadPhotoInfoForPhoto(currentImageid);
            }

            async function initializeNavigation() {
                if (type === 'album' && post && post.length > 0) {
                    currentAlbumId = post;
                    await loadContext('album', post);
                    shown_offset = getIndex();
                } else if (type === 'post' && post && post.length > 0) {
                    await loadContext('post', post);
                    shown_offset = getIndex();
                } else if (type === 'comment' && post && post.length > 0) {
                    await loadContext('comment', post);
                    shown_offset = getIndex();
                } else if (type === 'album') {
                    try {
                        const photoApi = await window.OVKAPI.call('photos.getById', {
                            'photos': pretty_id,
                            'extended': 1
                        });

                        if (photoApi && photoApi[0] && photoApi[0].album_id) {
                            const albumId = `${photoApi[0].owner_id}_${photoApi[0].album_id}`;
                            currentAlbumId = albumId;
                            await loadContext('album', albumId);
                            shown_offset = getIndex();
                        } else {
                            throw new Error('No album info available');
                        }
                    } catch (e) {
                        json = {
                            body: {
                                [pretty_id]: {
                                    url: photo,
                                    id: pretty_id,
                                    cached: false
                                }
                            }
                        };
                        imagesCount = 1;
                        shown_offset = 1;
                    }
                } else {
                    json = {
                        body: {
                            [pretty_id]: {
                                url: photo,
                                id: pretty_id,
                                cached: false
                            }
                        }
                    };
                    imagesCount = 1;
                    shown_offset = 1;
                }

                if (imagesCount > 1) {
                    msgbox.getNode().find('#pv_nav_left').attr('style', '');
                    msgbox.getNode().find('#pv_nav_right').attr('style', '');
                } else {
                    msgbox.getNode().find('#pv_nav_left').attr('style', 'display: none;');
                    msgbox.getNode().find('#pv_nav_right').attr('style', 'display: none;');
                }

                reloadTitleBar();
                preloadAdjacentPhotos();
            }

            msgbox.getNode().find('#pv_nav_left').on('click', (e) => {
                e.preventDefault();
                slidePhoto(0);
            });

            msgbox.getNode().find('#pv_nav_right').on('click', (e) => {
                e.preventDefault();
                slidePhoto(1);
            });
            
            if (window.isMobile && window.isMobile()) {
                const img = msgbox.getNode().find('#pv_photo_img').nodes[0];
                const container = msgbox.getNode().find('.mobile-photo-body').nodes[0];
                const windowNode = msgbox.getNode().find('.ovk-photo-view-window').nodes[0];
                const headerNode = msgbox.getNode().find('.mobile-photo-header').nodes[0];
                const footerNode = msgbox.getNode().find('.mobile-photo-footer').nodes[0];
                
                let scale = 1;
                let lastScale = 1;
                let currentX = 0;
                let currentY = 0;
                let startDistance = 0;
                let pinchMidX = 0;
                let pinchMidY = 0;
                let pinchStartX = 0;
                let pinchStartY = 0;
                let lastTap = 0;
                let singleTapTimer = null;
                let initialX = 0;
                let initialY = 0;
                let startTouchX = 0;
                let startTouchY = 0;
                let swipeAxis = null;
                let uiVisible = true;
                let opacity = 1;

                function getDistance(touches) {
                    return Math.hypot(
                        touches[0].clientX - touches[1].clientX,
                        touches[0].clientY - touches[1].clientY
                    );
                }

                function getMidpoint(touches) {
                    return {
                        x: (touches[0].clientX + touches[1].clientX) / 2,
                        y: (touches[0].clientY + touches[1].clientY) / 2,
                    };
                }

                const MAX_SCALE = 5;

                function clampPan() {
                    const imgW = img.naturalWidth || img.offsetWidth || container.offsetWidth;
                    const imgH = img.naturalHeight || img.offsetHeight || container.offsetHeight;
                    const cW = container.offsetWidth;
                    const cH = container.offsetHeight;
                    const renderedW = Math.min(imgW, cW);
                    const renderedH = Math.min(imgH, cH);
                    const maxX = Math.max(0, (renderedW * scale - cW) / 2);
                    const maxY = Math.max(0, (renderedH * scale - cH) / 2);
                    currentX = Math.max(-maxX, Math.min(maxX, currentX));
                    currentY = Math.max(-maxY, Math.min(maxY, currentY));
                }

                function updateTransform() {
                    if (scale < 1) { scale = 1; currentX = 0; currentY = 0; }
                    img.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
                }
                
                function updateOpacity() {
                    if (windowNode) windowNode.style.backgroundColor = `rgba(0,0,0,${opacity})`;
                    if (headerNode) headerNode.style.opacity = opacity;
                    if (footerNode) footerNode.style.opacity = opacity;
                }

                function setUiVisible(visible) {
                    uiVisible = visible;
                    if (headerNode) headerNode.classList.toggle('pv-ui-hidden', !visible);
                    if (footerNode) footerNode.classList.toggle('pv-ui-hidden', !visible);
                }

                function resetPosition(animated = true) {
                    if (animated) img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    currentX = 0;
                    currentY = 0;
                    opacity = 1;
                    updateTransform();
                    if (windowNode) windowNode.style.transition = 'background-color 0.2s';
                    if (headerNode) headerNode.style.transition = '';
                    if (footerNode) footerNode.style.transition = '';
                    updateOpacity();
                }

                container.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 2) {
                        e.preventDefault();
                        startDistance = getDistance(e.touches);
                        lastScale = scale;
                        swipeAxis = null;
                        img.style.transition = 'none';
                        const mid = getMidpoint(e.touches);
                        pinchMidX = mid.x;
                        pinchMidY = mid.y;
                        pinchStartX = currentX;
                        pinchStartY = currentY;
                    } else if (e.touches.length === 1) {
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - lastTap;
                        
                        if (tapLength < 300 && tapLength > 0) {
                            clearTimeout(singleTapTimer);
                            singleTapTimer = null;
                            e.preventDefault();
                            if (scale > 1) {
                                scale = 1;
                                currentX = 0;
                                currentY = 0;
                            } else {
                                const containerRect = container.getBoundingClientRect();
                                const tapX = e.touches[0].clientX - containerRect.left - containerRect.width / 2;
                                const tapY = e.touches[0].clientY - containerRect.top - containerRect.height / 2;
                                scale = 2;
                                currentX = -tapX * (scale - 1) / scale;
                                currentY = -tapY * (scale - 1) / scale;
                                clampPan();
                            }
                            img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
                            updateTransform();
                            lastTap = 0;
                        } else {
                            img.style.transition = 'none';
                            startTouchX = e.touches[0].clientX;
                            startTouchY = e.touches[0].clientY;
                            initialX = e.touches[0].clientX - currentX;
                            initialY = e.touches[0].clientY - currentY;
                            swipeAxis = null;
                            if (windowNode) windowNode.style.transition = 'none';
                            lastTap = currentTime;
                        }
                    }
                }, { passive: false });

                container.addEventListener('touchmove', (e) => {
                    if (e.touches.length === 2) {
                        e.preventDefault();
                        const currentDistance = getDistance(e.touches);
                        const newScale = Math.min(MAX_SCALE, Math.max(1, lastScale * (currentDistance / startDistance)));
                        const scaleDelta = newScale / scale;

                        const containerRect = container.getBoundingClientRect();
                        const originX = pinchMidX - containerRect.left - containerRect.width / 2;
                        const originY = pinchMidY - containerRect.top - containerRect.height / 2;
                        const curMid = getMidpoint(e.touches);

                        currentX = pinchStartX + (originX - pinchStartX) * (1 - scaleDelta) + (curMid.x - pinchMidX);
                        currentY = pinchStartY + (originY - pinchStartY) * (1 - scaleDelta) + (curMid.y - pinchMidY);

                        scale = newScale;
                        clampPan();
                        updateTransform();
                    } else if (e.touches.length === 1) {
                        if (scale > 1) {
                            e.preventDefault();
                            currentX = e.touches[0].clientX - initialX;
                            currentY = e.touches[0].clientY - initialY;
                            clampPan();
                            updateTransform();
                            swipeAxis = null;
                        } else if (scale === 1) {
                            const dx = e.touches[0].clientX - startTouchX;
                            const dy = e.touches[0].clientY - startTouchY;

                            if (!swipeAxis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                                swipeAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
                            }

                            e.preventDefault();
                            if (swipeAxis === 'x') {
                                currentX = e.touches[0].clientX - initialX;
                                currentY = 0;
                                updateTransform();
                            } else {
                                currentX = 0;
                                currentY = e.touches[0].clientY - initialY;
                                updateTransform();
                                opacity = 1 - Math.min(Math.abs(currentY) / 300, 1);
                                updateOpacity();
                            }
                        }
                    }
                }, { passive: false });

                container.addEventListener('touchend', (e) => {
                    if (e.touches.length === 0 && e.changedTouches.length === 1 && swipeAxis === null) {
                        const dx = e.changedTouches[0].clientX - startTouchX;
                        const dy = e.changedTouches[0].clientY - startTouchY;
                        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
                            clearTimeout(singleTapTimer);
                            singleTapTimer = setTimeout(() => {
                                singleTapTimer = null;
                                setUiVisible(!uiVisible);
                            }, 300);
                            swipeAxis = null;
                            return;
                        }
                    }

                    lastScale = scale;
                    img.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    if (scale < 1) {
                        scale = 1;
                        currentX = 0;
                        currentY = 0;
                        updateTransform();
                    } else if (scale === 1) {
                        if (swipeAxis === 'x' && Math.abs(currentX) > 60 && imagesCount > 1) {
                            const goNext = currentX < 0;
                            const exitX = goNext ? -window.innerWidth : window.innerWidth;
                            currentX = exitX;
                            updateTransform();
                            setTimeout(() => {
                                img.style.transition = 'none';
                                currentX = 0;
                                currentY = 0;
                                updateTransform();
                                slidePhoto(goNext ? 1 : 0);
                            }, 200);
                        } else if (swipeAxis === 'y' && Math.abs(currentY) > 200) {
                            const direction = currentY > 0 ? 1 : -1;
                            currentY = currentY + direction * window.innerHeight;
                            opacity = 0;
                            updateTransform();
                            
                            if (windowNode) windowNode.style.transition = 'background-color 0.2s';
                            if (headerNode) headerNode.style.transition = 'opacity 0.2s';
                            if (footerNode) footerNode.style.transition = 'opacity 0.2s';
                            updateOpacity();
                            
                            setTimeout(() => {
                                msgbox.close();
                            }, 200);
                        } else {
                            resetPosition(true);
                        }
                    }
                    swipeAxis = null;
                });
            }

            initializeNavigation();

            ModalUtils.setupKeyboardNav(msgbox, {
                37: () => slidePhoto(0),
                39: () => slidePhoto(1),
                27: () => msgbox.close()
            });

            ModalUtils.setupCleanup(msgbox, () => {
                ModalUtils.unregisterModal(msgbox);
                clearPhotoUrl();

                window._currentMediaModalRefresh = null;
            });

            async function loadPhotoInfoForPhoto(photoId) {
                u('#pv_actions_loader').html('');

                msgbox.getNode().find('.pv_bottom_actions').html('<div id="pv_bottom_actions_loader" style="height: 18px"></div>');
                LoaderUtils.show('#pv_bottom_actions_loader', { theme: 'baw', size: 'small' });

                const pvRightTarget = msgbox.getNode().find('.pv_right');

                try {
                    await CF.loadInto(pvRightTarget, `/photo${photoId}`, null, {
                        fetchOptions: { ajaxQuery: false, skipRedirectError: true },
                        loaderOptions: { size: 'medium' },
                        render(body) {
                            const pvRight = body.querySelector('.pv_right');
                            if (!pvRight) throw new Error('No content');

                            msgbox.getNode().find('.ovk-photo-view-window').removeClass('private');
                            pvRightTarget.html(pvRight.innerHTML);

                            const pvAlbumName = body.querySelector('.pv_album_name');
                            const pvAlbumContent = pvAlbumName ? pvAlbumName.innerHTML : '';
                            msgbox.getNode().find('.pv_album_name').html(pvAlbumContent);
                            msgbox.getNode().find('.pv_title_group').toggleClass('pv-no-album', !pvAlbumContent.trim());

                            const pvActions = body.querySelector('.pv_bottom_actions');
                            msgbox.getNode().find('.pv_bottom_actions').html(pvActions ? pvActions.innerHTML : '');

                            msgbox.getNode().find(".pv_right .bsdn").nodes.forEach(bsdnInitElement);

                            if (window.isMobile && window.isMobile()) {
                                const desc = msgbox.getNode().find('.pv_right .pv_desc').html();
                                if (desc && desc.trim()) {
                                    msgbox.getNode().find('.mobile-photo-footer .pv_desc').html(desc).attr('style', '');
                                } else {
                                    msgbox.getNode().find('.mobile-photo-footer .pv_desc').attr('style', 'display:none;');
                                }

                                const likes = msgbox.getNode().find('.pv_right .post_full_like_wrap').html();
                                msgbox.getNode().find('.mobile-photo-actions').html(likes || '');

                                let moreHtml = '';
                                if (pvActions) {
                                   const moreMenu = pvActions.querySelector('#pv_actions_more_menu');
                                   const deleteBtn = pvActions.querySelector('#_photoDelete');
                                   if (moreMenu) {
                                       moreHtml += moreMenu.innerHTML;
                                   }
                                   if (deleteBtn) {
                                       moreHtml += deleteBtn.outerHTML;
                                   }
                                }

                                if (moreHtml) {
                                    msgbox.getNode().find('.pv_actions_more_wrap').html(`
                                        <div class="ui_actions_menu_wrap" onmouseover="uiActionsMenu.show(this, null, {autopos: true});" onmouseout="uiActionsMenu.hide(this);">
                                            <div class="pv_actions_more mobile-three-dots" role="button" style="display:flex; align-items:center;">
                                                <svg width="28" height="28" viewBox="0 0 28 28"><use href="#more-vertical-28"></use></svg>
                                            </div>
                                            <div id="pv_actions_more_menu_mobile" class="ui_actions_menu dark">
                                                ${moreHtml}
                                            </div>
                                        </div>
                                    `).attr('style', 'display:block; cursor:pointer;');
                                } else {
                                    msgbox.getNode().find('.pv_actions_more_wrap').html('').attr('style', 'display:none;');
                                }

                                msgbox.getNode().find('#__mobile_photo_comment_btn').attr('href', `/photo${photoId}`);
                            }
                        },
                        onError() {
                            msgbox.getNode().find('.ovk-photo-view-window').addClass('private');
                            pvRightTarget.html('');
                            msgbox.getNode().find('.pv_album_name').html('');
                            msgbox.getNode().find('.pv_title_group').addClass('pv-no-album');
                            if (window.isMobile && window.isMobile()) {
                                 msgbox.getNode().find('.mobile-photo-footer .pv_desc').attr('style', 'display:none;');
                                 msgbox.getNode().find('.mobile-photo-actions').html('');
                                 msgbox.getNode().find('.pv_actions_more_wrap').html('').attr('style', 'display:none;');
                            }
                        }
                    });
                } catch (e) {
                    // Already handled via onError above.
                }

                window._currentMediaModalRefresh = () => {
                    if (document.contains(msgbox.getNode().nodes[0])) {
                        loadPhotoInfoForPhoto(currentImageid);
                    }
                };
            }

            async function loadPhotoInfo() {
                if (pretty_id) {
                    return loadPhotoInfoForPhoto(pretty_id);
                } else {
                    console.error('No photo ID available for loading photo info');
                    msgbox.getNode().find('.pv_right').html(`
                <div class="pv_author_block">
                    <div class="pv_author_name">${tr('error')}</div>
                </div>
            `);
                }
            }

            loadPhotoInfo();
            updatePhotoUrl(pretty_id, currentAlbumId);

            ModalUtils.setupDimmerClose(msgbox);
        } catch (err) {
            console.error(err);
        }
    }

    if (typeof window.OpenMiniature === 'function') {
        vkify.hook(window, 'OpenMiniature', vkifyOpenMiniature, 'replace');
    } else {
        window.OpenMiniature = vkifyOpenMiniature;
    }

    function clearZParam() {
        const url = new URL(window.location);
        url.searchParams.delete('z');
        history.replaceState(null, '', url);
    }

    function parseZParam() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const zParam = urlParams.get('z');
            if (!zParam) return null;

            const decoded = decodeURIComponent(zParam);

            const photoMatch = decoded.match(/^photo(-?\d+)_(\d+)(?:\/(album|wall|comment)(-?\d+(?:_\d+)?))?$/i);
            if (photoMatch) {
                const result = {
                    type: 'photo',
                    photoId: `${photoMatch[1]}_${photoMatch[2]}`,
                    contextType: null,
                    contextId: null
                };

                if (photoMatch[3]) {
                    const context = photoMatch[3].toLowerCase();
                    if (context === 'album') {
                        result.contextType = 'album';
                    } else if (context === 'comment') {
                        result.contextType = 'comment';
                    } else {
                        result.contextType = 'post';
                    }
                    result.contextId = photoMatch[4];
                }

                return result;
            }

            const videoMatch = decoded.match(/^video(-?\d+)_(\d+)$/i);
            if (videoMatch) {
                return {
                    type: 'video',
                    videoId: [videoMatch[1], videoMatch[2]]
                };
            }

            return null;
        } catch (err) {
            return null;
        }
    }

    async function openModalFromUrl() {
        const data = parseZParam();
        if (!data) return;

        if (data.type === 'photo') {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 2000);

                const photoApi = await window.OVKAPI.call('photos.getById', {
                    'photos': data.photoId,
                    'photo_sizes': 1
                }).catch(() => null);

                clearTimeout(timeout);

                if (!photoApi || !photoApi[0]) {
                    const msg = new CMessageBox({
                        title: tr('forbidden'),
                        body: tr('forbidden_comment'),
                        buttons: ['OK'],
                        callbacks: [clearZParam]
                    });
                    return;
                }

                const photo = photoApi[0];
                const photoUrl = photo.src_xbig || photo.src_big || photo.src;
                const type = data.contextType || 'photo';

                await window.OpenMiniature(null, photoUrl, data.contextId, data.photoId, type, true);
            } catch (err) {
                clearZParam();
            }
        } else if (data.type === 'video') {
            try {
                await window.OpenVideo(data.videoId, true, true);
            } catch (err) {
                clearZParam();
            }
        }
    }

    vkify.ready(openModalFromUrl);

    window.addEventListener('popstate', () => {
        if (parseZParam()) openModalFromUrl();
    });

    class PostPopupManager {
        constructor() {
            this.currentModal = null;
            this.originalUrl = null;
            this._commentsScroller = null;
            this.setupEventListeners();
            this.checkInitialUrl();
        }

        setupEventListeners() {
            document.addEventListener('click', (e) => {
                const link = e.target.closest('.scroll_container .post_link, .scroll_container .wall_text a[href^="/wall"]');
                if (!link) return;

                const href = link.getAttribute('href');
                if (!href || !href.match(/^\/wall-?\d+_\d+$/)) return;

                if (window.isMobile && window.isMobile()) {
                    return;
                }

                e.preventDefault();
                this.openPostPopup(href);
            }, true);

            window.addEventListener('popstate', () => {
                if (window.isMobile && window.isMobile()) return;

                const wallParam = CF.getUrlParam('w');
                const sortParam = CF.getUrlParam('sort');
                const pageParam = CF.getUrlParam('p');

                if (wallParam && wallParam.startsWith('wall')) {
                    const postPath = '/' + wallParam;
                    this.openPostPopup(postPath, false, sortParam, pageParam);
                } else if (this.currentModal) {
                    this.closePostPopup(false);
                }
            });
        }

        checkInitialUrl() {
            const wallParam = CF.getUrlParam('w');
            if (!wallParam || !wallParam.startsWith('wall')) return;

            const postPath = '/' + wallParam;
            if (window.isMobile && window.isMobile()) {
                window.router.route(postPath);
                return;
            }

            const sortParam = CF.getUrlParam('sort');
            const pageParam = CF.getUrlParam('p');
            this.openPostPopup(postPath, false, sortParam, pageParam);
        }

        async openPostPopup(postPath, updateUrl = true, sortParam = null, pageParam = null) {
            try {
                const loader = CF.createLoader();
                if (loader.isShown()) return;

                const postId = this.extractPostId(postPath);
                if (!postId) return;

                if (updateUrl) {
                    this.originalUrl = location.href;
                    const params = { w: postPath.substring(1) };
                    if (sortParam) params.sort = sortParam;
                    if (pageParam) params.p = pageParam;
                    CF.updateMultipleUrlParams(params, { state: { postPopup: postPath } });
                }

                const fetchUrl = new URL(postPath, location.origin);
                if (sortParam) fetchUrl.searchParams.set('sort', sortParam);
                if (pageParam) fetchUrl.searchParams.set('p', pageParam);

                const postContent = await CF.fetchPageContent(fetchUrl.toString(), '.wide_column', { showLoader: true });

                this.currentModal = ModalUtils.createModal({
                    type: 'post',
                    title: tr('post'),
                    content: `<div class="post-popup-content">${postContent.innerHTML}</div>`,
                    closeOnButtons: false,
                    warnOnExit: false
                });

                const modalNode = this.currentModal.getNode();

                const originalExitDialog = this.currentModal.__exitDialog.bind(this.currentModal);
                this.currentModal.__exitDialog = () => {
                    originalExitDialog();
                    this.handleModalClosed();
                };

                ModalUtils.setupCleanup(this.currentModal, () => {
                    ModalUtils.unregisterModal(this.currentModal);
                });
                ModalUtils.setupCloseButton(this.currentModal, '#__modalPlayerClose');
                ModalUtils.setupDimmerClose(this.currentModal, '.ovk-photo-view-dimmer');
                ModalUtils.setupKeyboardNav(this.currentModal, {
                    27: () => this.closePostPopup()
                });
                modalNode.on('click', '#__modalPlayerClose', () => {
                    this.closePostPopup();
                });

                modalNode.on('click', '.sort_link', (e) => {
                    e.preventDefault();
                    const sortLink = u(e.target).closest('.sort_link');
                    const href = sortLink.attr('href');
                    const sortMatch = href.match(/[?&]sort=([^&]+)/);

                    if (sortMatch) {
                        const sortParam = sortMatch[1];
                        this.refreshModalWithSort(postPath, sortParam);
                    }
                });

                modalNode.on('click', '.vkify-paginator a', (e) => {
                    e.preventDefault();
                    const paginatorLink = u(e.target).closest('a');
                    const href = paginatorLink.attr('href');

                    if (href && href.includes('?')) {
                        const urlParams = new URLSearchParams(href.split('?')[1]);
                        const pageParam = urlParams.get('p');
                        const sortParam = urlParams.get('sort');

                        if (pageParam && this._commentsScroller) {
                            this._commentsScroller.reset(Number(pageParam));
                            this._commentsScroller.loadNext();
                        }
                    }
                });

                window.processVkifyLocTags();

                this._setupCommentsScroller(postPath, sortParam);

            } catch (error) {
                console.error('Failed to load post:', error);
                CF.createLoader().hide();
                if (this.currentModal) {
                    this.closePostPopup(false);
                }
                if (updateUrl && error.message !== 'Page redirected') {
                    location.href = postPath;
                }
            }
        }

        handleModalClosed() {
            if (this._commentsScroller) {
                this._commentsScroller.disconnect();
                this._commentsScroller = null;
            }

            this.currentModal = null;

            CF.clearMultipleUrlParams(['w', 'sort', 'p'], {
                replace: !this.originalUrl || this.originalUrl === location.href.split('?')[0]
            });
            this.originalUrl = null;
        }

        async refreshModalWithSort(postPath, sortParam) {
            if (!this.currentModal) return;

            try {
                const modalNode = this.currentModal.getNode();
                const commentsContainer = modalNode.find('.page_block.comments');
                if (commentsContainer.length === 0) {
                    console.warn('Comments container not found in modal');
                    return;
                }

                const fetchUrl = new URL(postPath, location.origin);
                fetchUrl.searchParams.set('sort', sortParam);

                this._commentsScroller?.disconnect();

                const content = await ModalUtils.injectContent(
                    this.currentModal,
                    '.page_block.comments',
                    fetchUrl.toString(),
                    '.page_block.comments',
                    { showLoader: true, loaderOptions: { size: 'medium' } }
                );

                const modalPaginator = modalNode.find('.vkify-paginator:not(.vkify-paginator-at-top)');
                const newPaginator = content.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)');
                if (modalPaginator.length > 0 && newPaginator) {
                    modalPaginator.html(newPaginator.innerHTML);
                }

                CF.updateUrlParam('sort', sortParam, { replace: true, state: { postPopup: postPath } });

                window.processVkifyLocTags();

                this._setupCommentsScroller(postPath, sortParam);

            } catch (error) {
                console.error('Failed to refresh post with sort:', error);
                if (this.currentModal) {
                    const commentsContainer = this.currentModal.getNode().find('.page_block.comments');
                    if (commentsContainer.length > 0) {
                        LoaderUtils.hide(commentsContainer);
                        commentsContainer.html('<div class="post-popup-error">Failed to sort comments. Please try again.</div>');
                    }
                }
            }
        }

        async appendCommentsPage(postPath, pageParam, sortParam = null, signal = null) {
            if (!this.currentModal) return null;

            const modalNode = this.currentModal.getNode();
            const scrollContainer = modalNode.find('.scroll_container');
            if (scrollContainer.length === 0) {
                console.warn('Scroll container not found in modal');
                return null;
            }

            const fetchUrl = new URL(postPath, location.origin);
            fetchUrl.searchParams.set('p', pageParam);
            if (sortParam) fetchUrl.searchParams.set('sort', sortParam);

            const doc = await CF.fetchPageContent(fetchUrl.toString(), null, { signal });

            const newComments = doc.querySelectorAll('.scroll_container .post.reply');
            newComments.forEach(commentNode => {
                const commentId = commentNode.getAttribute('data-comment-id');
                if (commentId) {
                    const existingComment = modalNode.find(`[data-comment-id='${commentId}']`);
                    if (existingComment.length > 0) {
                        console.info('AJAX | Found duplicate comment, skipping');
                        return;
                    }
                }

                scrollContainer.nodes[0].appendChild(commentNode);
            });

            const modalPaginator = modalNode.find('.vkify-paginator:not(.vkify-paginator-at-top)');
            const newPaginator = doc.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)');
            if (modalPaginator.length > 0 && newPaginator) {
                modalPaginator.html(newPaginator.innerHTML);

                if (modalPaginator.nodes[0].closest('.scroll_container')) {
                    scrollContainer.nodes[0].appendChild(modalPaginator.nodes[0].parentNode);
                }
            }

            const params = { p: pageParam };
            if (sortParam) params.sort = sortParam;
            CF.updateMultipleUrlParams(params, { replace: true, state: { postPopup: postPath } });

            window.processVkifyLocTags();

            return doc;
        }

        _setupCommentsScroller(postPath, sortParam = null) {
            if (!this.currentModal) return;

            const modalNode = this.currentModal.getNode();
            const paginator = modalNode.find('.vkify-paginator:not(.vkify-paginator-at-top)');
            if (paginator.length === 0) return;

            if (this._commentsScroller) {
                this._commentsScroller.disconnect();
            }

            const activeTab = paginator.find('.active');
            const nextPage = u(activeTab.nodes[0] ? activeTab.nodes[0].nextElementSibling : null);
            if (nextPage.length === 0) return;

            let startPage = 2;
            const nextNum = Number(nextPage.html());
            if (!Number.isNaN(nextNum)) {
                startPage = nextNum;
            } else {
                const activeNum = Number(activeTab.html());
                if (!Number.isNaN(activeNum)) startPage = activeNum + 1;
            }

            this._commentsScroller = CF.infiniteScroll('.vkify-paginator:not(.vkify-paginator-at-top)', {
                container: modalNode,
                page: startPage,
                clickToLoad: false,
                load: async (page, signal) => {
                    return await this.appendCommentsPage(postPath, page, sortParam, signal);
                },
                render: () => {},
                hasMore: (doc) => !!doc && !!doc.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)'),
                onError: (err) => console.error('Failed to append comments:', err)
            });
        }

        closePostPopup(updateUrl = true) {
            if (this.currentModal) {
                const modal = this.currentModal;
                this.currentModal = null;
                modal.__exitDialog();

                if (updateUrl) {
                    CF.clearMultipleUrlParams(['w', 'sort', 'p'], {
                        replace: !this.originalUrl || this.originalUrl === location.href.split('?')[0]
                    });
                    this.originalUrl = null;
                }
            } else if (updateUrl) {
                CF.clearMultipleUrlParams(['w', 'sort', 'p'], {
                    replace: !this.originalUrl || this.originalUrl === location.href.split('?')[0]
                });
                this.originalUrl = null;
            }
        }

        extractPostId(postPath) {
            const match = postPath.match(/^\/wall(-?\d+)_(\d+)$/);
            return match ? { ownerId: match[1], postId: match[2] } : null;
        }
    }

    window.PostPopupManager = PostPopupManager;
    window.postPopupManager = new PostPopupManager();
});