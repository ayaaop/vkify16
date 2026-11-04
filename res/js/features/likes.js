(function () {
'use strict';

const Hb = window.Handlebars;

const loadingTpl = Hb.compile(
    `<div class="like_tt_wrap like_tt_loading">
        <div class="pr pr_baw"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>
    </div>`
);

const bodyTpl = Hb.compile(
    `<div class="like_tt_wrap">
        <a href="/{{final_type}}/{{id}}/likes" class="like_tt_header _title">
            {{count_label}}
        </a>
        <div class="like_tt_content">
            <div class="like_tt_hider">
                <div class="like_tt_owners _content{{#if me_hidden}} me_hidden{{/if}}">{{#each items}}<a class="like_tt_owner" title="{{first_name}} {{last_name}}" href="/id{{id}}"><img class="like_tt_image" src="{{photo_50}}" alt="{{first_name}} {{last_name}}"></a>{{/each}}</div>
            </div>
        </div>
    </div>`
);

const errorTpl = Hb.compile(
    `<div class="like_tt_wrap"><div class="like_tt_header">{{message}}</div></div>`
);

window.formatCompactCount = window.formatCompactCount || function (n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (Math.round(n / 1e5) / 10) + 'M';
    if (n >= 1e3) return (Math.round(n / 100) / 10) + 'K';
    return String(n);
};

// Make .html() on .action_count elements with a data-count attribute
// read/write the raw numeric value while formatting the visible text.
// This lets upstream code (e.g., al_wall.js' repost()) update repost
// counters without us editing OpenVK files.
(function wrapActionCountHtml() {
    if (u.prototype.__vkifyHtmlWrapped) return;
    u.prototype.__vkifyHtmlWrapped = true;
    const _origHtml = u.prototype.html;
    u.prototype.html = function (value) {
        const node = this.first();
        if (!node || !node.classList.contains('action_count') || !node.hasAttribute('data-count')) {
            return arguments.length === 0 ? _origHtml.call(this) : _origHtml.call(this, value);
        }
        if (arguments.length === 0) {
            return node.getAttribute('data-count') || '';
        }
        const raw = Number(value);
        if (Number.isNaN(raw)) return _origHtml.call(this, value);
        if (raw > 0) node.setAttribute('data-count', raw);
        return _origHtml.call(this, raw ? window.formatCompactCount(raw) : '');
    };
})();

function normalizeRepostCounter(id) {
    const anchor = document.getElementById(`reposts${id}`);
    if (!anchor) return;

    const existing = document.getElementById(`repostsCount${id}`);
    if (existing?.classList.contains('action_count')) return;

    const count = Number(existing?.textContent || 0) || 0;
    if (existing) {
        const previous = existing.previousSibling;
        const next = existing.nextSibling;
        if (previous?.nodeType === Node.TEXT_NODE) previous.textContent = previous.textContent.replace(/\(\s*$/, '');
        if (next?.nodeType === Node.TEXT_NODE) next.textContent = next.textContent.replace(/^\s*\)/, '');
    }

    const counter = document.createElement('span');
    counter.className = 'action_count';
    counter.id = `repostsCount${id}`;
    counter.setAttribute('data-count', count);
    counter.textContent = count ? window.formatCompactCount(count) : '';

    if (existing) {
        existing.replaceWith(counter);
    } else {
        anchor.appendChild(counter);
    }
}

vkify.bindOnce('repostCounterMarkup', () => {
    if (typeof window.repost !== 'function') return;
    vkify.hook(window, 'repost', id => normalizeRepostCounter(id), 'before');
});

const _likesCache = new Map();
const _likesCacheLimit = 100;
const _likesCacheTTL = 3000;
const _likesCacheSet = (key, value) => {
    if (_likesCache.size >= _likesCacheLimit) {
        const oldest = _likesCache.keys().next().value;
        _likesCache.delete(oldest);
    }
    _likesCache.set(key, value ? { ...value, _fetchedAt: Date.now() } : value);
};

function normalizeAvatarUrl(url) {
    if (!url) return window.vkify?.resourceUrl?.('camera_200.png') || '';
    if (url.includes('camera_200.png') && window.vkify?.resourceUrl) {
        return window.vkify.resourceUrl('camera_200.png');
    }
    return url;
}

function renderOwnerNodesHtml(items) {
    return items.map(item => {
        const name = escapeHtml(`${item.first_name || ''} ${item.last_name || ''}`.trim());
        const src = escapeHtml(normalizeAvatarUrl(item.photo_50));
        return `<a class="like_tt_owner" title="${name}" href="/id${item.id}"><img class="like_tt_image" src="${src}" alt="${name}"></a>`;
    }).join('');
}

function buildTooltipItems(likesList) {
    const viewerId = Number(window.openvk?.current_id) || 0;
    const rawItems = Array.isArray(likesList?.items) ? likesList.items : [];
    const viewerItem = getViewerItem(rawItems);
    const otherItems = (viewerId
        ? rawItems.filter(item => Number(item?.id) !== viewerId)
        : rawItems
    ).slice(0, 6).map(item => ({
        ...item,
        photo_50: normalizeAvatarUrl(item.photo_50),
    }));
    return viewerItem
        ? [{ ...viewerItem, photo_50: normalizeAvatarUrl(viewerItem.photo_50) }, ...otherItems]
        : otherItems;
}

function updateButtonLikesCount(el, count) {
    if (!el || !Number.isFinite(count) || count < 0) return;
    el.setAttribute('data-likes', count);
    let counter = el.querySelector('.action_count');
    if (!counter) {
        counter = document.createElement('span');
        counter.className = 'action_count';
        el.appendChild(counter);
    }
    counter.textContent = count ? window.formatCompactCount(count) : '';
}

function syncTooltipWithLikesList(el, tt, likesList) {
    if (!el || !tt || el.tt !== tt || !likesList) return;
    const count = Number.isFinite(Number(likesList.count))
        ? Number(likesList.count)
        : (parseInt(el.dataset.likes, 10) || 0);
    if (count <= 0) {
        el._vkifyAnimateLikeIn = false;
        tt.hide();
        return;
    }

    const ownersEl = tt.container?.querySelector('.like_tt_owners');
    const headerEl = tt.container?.querySelector('.like_tt_header');
    if (!ownersEl) return false;

    if (headerEl) {
        headerEl.textContent = tr('liked_by_x_people', count);
    }
    const items = buildTooltipItems(likesList);
    const nextIds = items.map(i => Number(i.id)).join(',');
    const curIds = [...ownersEl.querySelectorAll('.like_tt_owner')]
        .map(a => Number((a.getAttribute('href') || '').replace(/^\/id/, '')))
        .join(',');
    if (nextIds !== curIds) {
        ownersEl.innerHTML = renderOwnerNodesHtml(items);
    }
    const liked = isElementLiked(el);
    if (!el._vkifyAnimateLikeIn) {
        ownersEl.classList.toggle('me_hidden', !liked);
    }
    syncTooltipContentOpt(tt);
    return true;
}

async function refreshLikeFaces(btn, liked, likesCount, preloadedItems = null) {
    try {
        if (!vkify.isLoggedIn()) return;

        const scope = btn.first()?.closest('.post, .ovk-vid-details, .pv_wrapper');
        const bar = scope?.querySelector('.post_likes_faces');
        if (!bar) return;

        if (likesCount <= 0) {
            bar.hidden = true;
            return;
        }

        const type = btn.attr('data-type');
        const id = btn.attr('data-id');
        let likers = Array.isArray(preloadedItems) ? preloadedItems : [];
        if (!preloadedItems && type && id) {
            try {
                const res = await window.OVKAPI.call('likes.getList', {
                    extended: 1,
                    count: 3,
                    type: type,
                    owner_id: id.split('_')[0],
                    item_id: id.split('_')[1]
                });
                likers = res?.items || [];
            } catch (e) { }
        }

        const viewerId = window.openvk?.current_id || 0;
        const viewerAvatar = normalizeAvatarUrl(
            document.querySelector('#userMenuAvatar')?.src
            || document.querySelector('#mobileProfileAvatar')?.src
            || ''
        );
        const faceSrcs = [];
        if (liked && viewerAvatar) faceSrcs.push(viewerAvatar);
        for (const liker of likers) {
            if (faceSrcs.length >= 2) break;
            if (liked && liker.id == viewerId) continue;
            if (liker.photo_50) faceSrcs.push(normalizeAvatarUrl(liker.photo_50));
        }

        let facesToShow = faceSrcs;
        let moreCount = 0;
        if (likesCount > faceSrcs.length) {
            facesToShow = faceSrcs.slice(0, 1);
            moreCount = likesCount - 1;
        }
        const showChip = moreCount > 0 && moreCount < 100;

        const photos = bar.querySelector('.post_likes_faces_photos');
        photos.classList.toggle('has_counter', showChip);
        photos.innerHTML = facesToShow.map(src =>
            `<img src="${escapeHtml(src)}" class="avatar post_likes_face" width="24" height="24" alt="">`).join('')
            + (showChip ? `<span class="post_likes_faces_counter">+${moreCount}</span>` : '');

        const lang = window.vkifylang || {};
        bar.querySelector('.post_likes_faces_label').textContent = liked
            ? (likesCount > 1
                ? (lang.post_likes_summary_you || 'You and $1 people liked this').replace('$1', likesCount - 1)
                : (lang.post_likes_summary_only_you || 'You liked this'))
            : tr('liked_by_x_people', likesCount);
        bar.hidden = false;
    } catch (e) { }
}

function isElementLiked(el) {
    if (!el) return false;
    if (el.dataset.liked !== undefined) return el.dataset.liked === '1';
    if (el.classList.contains('my_like')) return true;
    return el.querySelector('.action_icon')?.id === 'liked';
}

function getViewerItem(items) {
    const viewerId = Number(window.openvk?.current_id) || 0;
    if (!viewerId) return null;
    const existing = Array.isArray(items)
        ? items.find(item => Number(item?.id) === viewerId)
        : null;
    if (existing) return existing;

    const photo = document.querySelector('#userMenuAvatar')?.src
        || document.querySelector('#mobileProfileAvatar')?.src
        || '';
    const fullName = (document.querySelector('.mobile-profile-name')?.textContent
        || document.querySelector('#userMenuName')?.textContent
        || '').replace(/\u00a0/g, ' ').trim();
    const spaceIdx = fullName.indexOf(' ');
    return {
        id: viewerId,
        first_name: spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName,
        last_name: spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : '',
        photo_50: photo,
    };
}

function syncTooltipContentOpt(tt) {
    const wrapped = tt?.container?.querySelector('.wrapped');
    if (wrapped && tt.opts) tt.opts.content = wrapped.innerHTML;
}

function animateViewerIn(el, tt) {
    if (!el?._vkifyAnimateLikeIn || !tt?.shown) return;
    el._vkifyAnimateLikeIn = false;
    if (!isElementLiked(el)) return;
    const ownersEl = tt.container?.querySelector('.like_tt_owners');
    if (!ownersEl) return;
    void ownersEl.offsetWidth;
    requestAnimationFrame(() => {
        ownersEl.classList.remove('me_hidden');
        syncTooltipContentOpt(tt);
    });
}

vkify.bindOnce('likeHandlers', () => {
    u(document).on('click', '.video_like_button, .post_like', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!vkify.requireAuth()) return false;

        const btn = u(this);
        const el = btn.first();
        if (btn.attr('data-vkify-like-pending') === '1') return false;

        const link = btn.attr('href');
        const heart = btn.find('.action_icon');
        const isLiked = heart.attr('id') === 'liked';
        const nextLiked = !isLiked;
        const isPost = btn.hasClass('post_like');
        const type = btn.attr('data-type');
        const hasLikesTooltip = (isPost || btn.hasClass('video_like_button'))
            && type !== 'audio_playlist';

        let counter = btn.find('.action_count');
        if (counter.length < 1) {
            btn.append('<span class="action_count"></span>');
            counter = btn.find('.action_count');
        }

        const currentLikes = parseInt(btn.attr('data-likes') || counter.text(), 10) || 0;
        const nextLikes = Math.max(0, currentLikes + (isLiked ? -1 : 1));

        btn.attr('data-vkify-like-pending', '1');
        heart.attr('id', nextLiked ? 'liked' : '');
        btn.attr('data-liked', nextLiked ? '1' : '0');
        btn.attr('data-likes', nextLikes);
        counter.text(nextLikes ? window.formatCompactCount(nextLikes) : '');
        if (isPost) btn.toggleClass('my_like', nextLiked);

        const cacheKey = type && btn.attr('data-id')
            ? `${type}:${btn.attr('data-id')}` : null;
        if (cacheKey) {
            const cached = _likesCache.get(cacheKey);
            const viewerItem = getViewerItem(cached?.items);
            const viewerId = Number(window.openvk?.current_id) || 0;
            if (cached) {
                const others = Array.isArray(cached.items)
                    ? cached.items.filter(item => Number(item?.id) !== viewerId)
                    : [];
                _likesCacheSet(cacheKey, {
                    ...cached,
                    count: nextLikes,
                    items: nextLiked && viewerItem ? [viewerItem, ...others] : others,
                });
            } else if (currentLikes === 0 && nextLiked && viewerItem) {
                _likesCacheSet(cacheKey, {
                    count: nextLikes,
                    items: [viewerItem],
                });
            }
        }

        if (hasLikesTooltip && el) {
            const tip = el.tt;
            if (nextLikes <= 0) {
                el._vkifyAnimateLikeIn = false;
                if (tip) tip.hide();
            } else {
                const ownersEl = tip?.container?.querySelector('.like_tt_owners');
                const headerEl = tip?.container?.querySelector('.like_tt_header');
                if (headerEl) headerEl.textContent = tr('liked_by_x_people', nextLikes);

                if (tip && ownersEl) {
                    if (tip.shown) {
                        ownersEl.classList.toggle('me_hidden', !nextLiked);
                        syncTooltipContentOpt(tip);
                    } else if (nextLiked && !window.isMobile?.()) {
                        ownersEl.classList.add('me_hidden');
                        syncTooltipContentOpt(tip);
                        window.vkifyLikesShow?.(el, { showdt: 0, animateMeIn: true });
                    } else {
                        ownersEl.classList.toggle('me_hidden', !nextLiked);
                        syncTooltipContentOpt(tip);
                    }
                } else if (nextLiked && !window.isMobile?.()) {
                    window.vkifyLikesShow?.(el, { showdt: 0, animateMeIn: true });
                }
            }
        }

        let ok = false;
        try {
            if (type === 'audio_playlist' || type === 'note') {
                const [owner_id, item_id] = (btn.attr('data-id') || '').split('_').map(Number);
                if (Number.isInteger(owner_id) && Number.isInteger(item_id)) {
                    await window.OVKAPI.call(isLiked ? 'likes.delete' : 'likes.add', {
                        type, owner_id, item_id
                    });
                    ok = true;
                }
            } else if (link) {
                ok = window.ky
                    ? (await window.ky.post(link), true)
                    : (await fetch(link, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })).ok;
            }
        } catch { }

        if (ok && !isLiked && typeof Doge !== 'undefined') Doge.show();

        if (!ok) {
            heart.attr('id', isLiked ? 'liked' : '');
            btn.attr('data-liked', isLiked ? '1' : '0');
            btn.attr('data-likes', currentLikes);
            counter.text(currentLikes ? window.formatCompactCount(currentLikes) : '');
            if (isPost) btn.toggleClass('my_like', isLiked);
            if (cacheKey) _likesCache.delete(cacheKey);
            if (hasLikesTooltip && el?.tt) {
                if (currentLikes <= 0) {
                    el.tt.hide({ fasthide: true });
                } else {
                    const ownersEl = el.tt.container?.querySelector('.like_tt_owners');
                    const headerEl = el.tt.container?.querySelector('.like_tt_header');
                    if (headerEl) headerEl.textContent = tr('liked_by_x_people', currentLikes);
                    if (ownersEl) ownersEl.classList.toggle('me_hidden', !isLiked);
                    syncTooltipContentOpt(el.tt);
                }
            }
        }

        btn.attr('data-vkify-like-pending', '0');

        let serverCount = ok ? nextLikes : currentLikes;
        let serverItems = null;
        if (ok && type && btn.attr('data-id') && type !== 'audio_playlist') {
            try {
                const rawId = btn.attr('data-id');
                const fresh = await window.OVKAPI.call('likes.getList', {
                    extended: 1,
                    count: 7,
                    type,
                    owner_id: rawId.split('_')[0],
                    item_id: rawId.split('_')[1],
                });
                if (fresh && Number.isFinite(Number(fresh.count))) {
                    serverCount = Number(fresh.count);
                    serverItems = fresh.items || [];
                    if (cacheKey) _likesCacheSet(cacheKey, fresh);
                    updateButtonLikesCount(el, serverCount);
                    if (hasLikesTooltip && el?.tt) {
                        syncTooltipWithLikesList(el, el.tt, fresh);
                    }
                }
            } catch { }
        }

        refreshLikeFaces(btn, ok ? nextLiked : isLiked, serverCount, serverItems);
        return false;
    });
});

vkify.bindOnce('likesTooltip', () => {
    function renderLikesTooltip(el, tt, likesList) {
        const { id, type } = el.dataset;
        const liked = isElementLiked(el);
        const count = Number.isFinite(Number(likesList?.count))
            ? Number(likesList.count)
            : (parseInt(el.dataset.likes, 10) || 0);
        const items = buildTooltipItems(likesList);
        const viewerItem = getViewerItem(likesList?.items);
        const animateIn = Boolean(el._vkifyAnimateLikeIn && liked && viewerItem);
        const meHidden = Boolean(viewerItem) && (!liked || animateIn);

        tt.setContent(bodyTpl({
            final_type: type === 'post' ? 'wall' : type,
            id,
            count_label: tr('liked_by_x_people', count),
            items,
            me_hidden: meHidden,
        }));

        if (animateIn && tt.shown) {
            animateViewerIn(el, tt);
        }
    }

    async function loadLikes(el, tt) {
        const { id, type } = el.dataset;
        const cacheKey = `${type}:${id}`;
        const cached = _likesCache.get(cacheKey);
        const cacheFresh = Boolean(cached && (Date.now() - (cached._fetchedAt || 0) < _likesCacheTTL));

        if (tt._vkifyLikesKey === cacheKey && tt.container?.querySelector('.like_tt_owners') && cacheFresh) {
            return;
        }
        tt._vkifyLikesKey = cacheKey;
        if (!vkify.isLoggedIn()) {
            tt.setContent(errorTpl({ message: tr('login_required_error') }));
            return;
        }
        if (cached) {
            if (!tt.container?.querySelector('.like_tt_owners')
                || !syncTooltipWithLikesList(el, tt, cached)) {
                renderLikesTooltip(el, tt, cached);
            }
            if (cacheFresh) return;
        }
        if (tt._vkifyFetchingKey === cacheKey) return;
        tt._vkifyFetchingKey = cacheKey;
        try {
            const likesList = await window.OVKAPI.call('likes.getList', {
                extended: 1,
                count: 7,
                type,
                owner_id: id.split('_')[0],
                item_id: id.split('_')[1]
            });
            _likesCacheSet(cacheKey, likesList);
            if (el.getAttribute('data-vkify-like-pending') !== '1'
                && Number.isFinite(Number(likesList?.count))) {
                updateButtonLikesCount(el, Number(likesList.count));
            }
            if (el.tt !== tt || tt._vkifyLikesKey !== cacheKey) return;
            if (!tt.container?.querySelector('.like_tt_owners')
                || !syncTooltipWithLikesList(el, tt, likesList)) {
                renderLikesTooltip(el, tt, likesList);
            }
        } catch (e) {
            if (!cached && el.tt === tt && tt._vkifyLikesKey === cacheKey) {
                tt.setContent(errorTpl({ message: tr('error') }));
            }
        } finally {
            if (tt._vkifyFetchingKey === cacheKey) tt._vkifyFetchingKey = null;
        }
    }

    // VK calls Wall.likesShow from the like button's inline onmouseover.
    window.vkifyLikesShow = (el, extraOpts = {}) => {
        if (!el || window.isMobile?.() || !Number(el.dataset.likes)) return;
        if (extraOpts.animateMeIn) el._vkifyAnimateLikeIn = true;

        const existingTt = el.tt && el.tt.el ? el.tt : null;
        if (existingTt && el.showing && !el.hidetimer && extraOpts.showdt === undefined) {
            loadLikes(el, existingTt);
            return existingTt;
        }

        const opts = {
            dir: 'auto',
            slide: 15,
            typeClass: 'like_tt',
            shift: [11, 7, 7],
            showdt: extraOpts.showdt !== undefined ? extraOpts.showdt : 400,
            hidedt: 200,
            onShowStart: (tip) => {
                loadLikes(el, tip);
                animateViewerIn(el, tip);
            },
            onHide: (tip) => {
                tip._vkifyLikesKey = null;
                el._vkifyAnimateLikeIn = false;
            },
        };
        if (!existingTt) {
            opts.content = loadingTpl({});
        }
        const tt = window.showTooltip(el, opts);
        if (tt) {
            loadLikes(el, tt);
            if (tt.shown) tt.opts.showdt = 400;
        }
        return tt;
    };

    class VkifyLikersWindow {
        constructor() {
            this.modal = null;
            this.type = null;
            this.id = null;
            this.totalCount = 0;
            this.loadedCount = 0;
            this.offset = 0;
            this.perPage = 25;
            this.loadingMore = false;
        }

        async _loadLikers(offset = 0) {
            const apiType = this.type === 'wall' ? 'post' : this.type;
            const [owner_id, item_id] = String(this.id || '').split('_');
            return await window.OVKAPI.call('likes.getList', {
                type: apiType,
                owner_id,
                item_id,
                extended: 1,
                offset,
                count: this.perPage,
            });
        }

        _renderFanRow(item) {
            const rawName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
            const displayName = escapeHtml(typeof ovk_proc_strtr === 'function' ? ovk_proc_strtr(rawName, 50) : rawName);
            const fullName = escapeHtml(rawName);
            const ava = escapeHtml(normalizeAvatarUrl(item.photo_100 || item.photo_50));
            const onlineCls = item.online ? ' online' : '';
            return `<div class="fans_fan_row inl_bl" id="fans_fan_row${item.id}">`
                + `<div class="fans_fanph_wrap">`
                + `<a class="fans_fan_ph${onlineCls}" href="/id${item.id}">`
                + `<img class="fans_fan_img" src="${ava}" alt="${fullName}" loading="lazy">`
                + `</a>`
                + `</div>`
                + `<div class="fans_fan_name">`
                + `<a class="fans_fan_lnk" href="/id${item.id}" title="${fullName}">${displayName}</a>`
                + `</div>`
                + `</div>`;
        }

        _appendItems(resp) {
            const items = Array.isArray(resp?.items) ? resp.items : [];
            this.offset += items.length;
            this.loadedCount += items.length;
            this.totalCount = Number(resp?.count) || 0;

            const node = this.modal?.getNode();
            if (!node?.length) return;

            const countNode = node.find('.ui_tab_count').first();
            if (countNode) countNode.textContent = this.totalCount || '';

            const rowsEl = node.find('#wk_likes_rows').first();
            if (rowsEl && items.length) {
                rowsEl.insertAdjacentHTML('beforeend', items.map(item => this._renderFanRow(item)).join(''));
            }

            node.find('#wk_likes_more_link').remove();
            if (this.loadedCount < this.totalCount && items.length > 0) {
                node.find('#wk_likes_content').append(
                    `<a id="wk_likes_more_link" class="button button_gray button_wide show_more">${escapeHtml(tr('show_more'))}</a>`
                );
            }
        }

        async _loadMore() {
            if (this.loadingMore || this.loadedCount >= this.totalCount) return;
            this.loadingMore = true;
            const moreBtn = this.modal?.getNode()?.find('#wk_likes_more_link').first();
            if (moreBtn) moreBtn.classList.add('lagged');
            try {
                const res = await this._loadLikers(this.offset);
                this._appendItems(res);
            } catch {
                if (moreBtn) moreBtn.classList.remove('lagged');
            } finally {
                this.loadingMore = false;
            }
        }

        static async byTypeAndId(event, type, id) {
            if (event) event.preventDefault();
            if (!vkify.requireAuth()) return;

            window.tooltips?.hideAll?.();
            CMessageBox.toggleLoader(true);

            const win = new VkifyLikersWindow();
            win.type = type;
            win.id = id;

            try {
                const res = await win._loadLikers(0);
                const count = Number(res?.count) || 0;
                const titleHtml = `<ul class="ui_tabs clear_fix ui_tabs_header ui_tabs_box">`
                    + `<li id="likes_tab_likes">`
                    + `<div class="ui_tab ui_tab_sel">${escapeHtml(tr('liked_verb'))}<span class="ui_tab_count">${count || ''}</span></div>`
                    + `</li>`
                    + `</ul>`;
                const bodyHtml = `<div id="wk_likes_content" class="wk_likes_content">`
                    + `<div id="wk_likes_rows" class="fans_rows clear_fix"></div>`
                    + `</div>`;

                win.modal = new CMessageBox({
                    title: titleHtml,
                    body: bodyHtml,
                    unique_name: 'likeAsWin',
                });

                const modalNode = win.modal.getNode();
                if (!modalNode?.length) return;
                modalNode.addClass('vkify_likes_box');

                modalNode.on('click', '#wk_likes_more_link', (e) => {
                    e.preventDefault();
                    win._loadMore();
                });

                const diagBody = modalNode.find('.ovk-diag-body').first();
                if (diagBody) {
                    diagBody.addEventListener('scroll', () => {
                        if (win.loadingMore || win.loadedCount >= win.totalCount) return;
                        if (diagBody.scrollTop + diagBody.clientHeight >= diagBody.scrollHeight - 120) {
                            win._loadMore();
                        }
                    }, { passive: true });
                }

                win._appendItems(res);
            } catch {
                fastError?.(tr('error'));
            } finally {
                CMessageBox.toggleLoader(false);
            }
        }
    }

    window.LikersWindow = VkifyLikersWindow;

    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target.closest?.('.like_tt_header, .post_likes_faces');
        if (!link) return;
        const href = link.getAttribute('href') || '';
        const m = href.match(/^\/([^/]+)\/([^/]+)\/likes$/);
        if (!m) return;
        e.preventDefault();
        e.stopPropagation();
        VkifyLikersWindow.byTypeAndId(e, m[1], m[2]);
    }, true);
});

})();
