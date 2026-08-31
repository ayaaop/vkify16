(function() {
'use strict';

vkify.musicPopup = vkify.musicPopup || {};

const __vkifyFavicon = vkify.resourceBase ? {
    get default() {
        const ico = vkify.getSetting('ovkHat') ? 'ovk.ico' : 'default.ico';
        return vkify.resourceUrl('icons/' + ico);
    },
    play: vkify.resourceUrl('icons/play.ico'),
    pause: vkify.resourceUrl('icons/pause.ico')
} : null;

function setFaviconUrl(url) {
    if (!url) return;
    const icon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (!icon) return;
    icon.setAttribute('href', url);
}

function updateFaviconFromPlayerState() {
    if (!__vkifyFavicon) return;

    const hasTrack = Boolean(window.player && window.player.currentTrack);
    if (!hasTrack) {
        setFaviconUrl(__vkifyFavicon.default);
        return;
    }

    if (window.player?.audioPlayer?.paused === false) {
        setFaviconUrl(__vkifyFavicon.play);
    } else {
        setFaviconUrl(__vkifyFavicon.pause);
    }
}

function patchPlayerFaviconOnce() {
    if (!__vkifyFavicon) return;
    if (!window.player) return;
    if (window.player.__vkifyPatchedFavicon) return;

    window.player.__vkifyPatchedFavicon = true;

    window.player.__setFavicon = function (state = 'playing') {
        if (state === 'playing') {
            setFaviconUrl(__vkifyFavicon.play);
        } else if (state === 'paused') {
            setFaviconUrl(__vkifyFavicon.pause);
        } else {
            setFaviconUrl(__vkifyFavicon.default);
        }
    };

    if (typeof window.player.__resetContext === 'function') {
        vkify.hook(window.player, '__resetContext', updateFaviconFromPlayerState, 'after');
    }

    if (typeof window.player.undump === 'function') {
        vkify.hook(window.player, 'undump', updateFaviconFromPlayerState, 'after');
    }

    if (window.player.audioPlayer && !window.player.audioPlayer.__vkifyFaviconBound) {
        window.player.audioPlayer.__vkifyFaviconBound = true;
        window.player.audioPlayer.addEventListener('play', updateFaviconFromPlayerState);
        window.player.audioPlayer.addEventListener('pause', updateFaviconFromPlayerState);
        window.player.audioPlayer.addEventListener('ended', updateFaviconFromPlayerState);
    }

    updateFaviconFromPlayerState();
}

function formatTime(seconds) {
    const s = Number(seconds) || 0;
    const minutes = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function hasMorePages() {
    const ctx = window.player?.context;
    if (!ctx?.playedPages?.length || !ctx.pagesCount) {
        return false;
    }
    return Math.max(...ctx.playedPages) < ctx.pagesCount;
}

function renderMusicPopupTracks(container) {
    if (!container || !window.player?.tracks?.length) return;

    const html = window.player.tracks
        .filter(track => track && track.id)
        .map(track => {
            const performer = escapeHtml(track.performer || tr('track_unknown'));
            const title = escapeHtml(track.name || tr('track_unknown'));
            const keysJson = escapeHtml(JSON.stringify(track.keys || {}));
            const url = escapeHtml(track.url || '');
            const length = Number(track.length) || 0;

            return `
<div class="scroll_node">
<div id="audioEmbed-${track.id}" data-realid="${track.id}" data-name="${performer} — ${title}" data-genre="Other" data-length="${length}" data-keys='${keysJson}' data-url="${url}" class="audioEmbed ctx_place">
    <audio class="audio"></audio>
    <div id="miniplayer" class="audioEntry">
        <div class="audioEntryWrapper" draggable="true">
            <div class="playerButton"><div class="playIcon"></div></div>
            <div class="status">
                <div class="mediaInfo noOverflow">
                    <div class="info">
                        <strong class="performer"><a draggable="false" href="/search?section=audios&amp;order=listens&amp;only_performers=on&amp;q=${encodeURIComponent(track.performer || '')}">${performer}</a></strong>
                        — <span draggable="false" class="title">${title}</span>
                    </div>
                </div>
            </div>
            <div class="mini_timer">
                <span class="nobold hideOnHover" data-unformatted="${length}">${formatTime(length)}</span>
                <div class="buttons">
                    <div class="report-icon musicIcon" data-id="6690" onclick="tippy.hideAll()"></div>
                    <div class="remove-icon musicIcon" data-id="${track.id}"></div>
                    <div class="add-icon-group musicIcon hidden" data-id="${track.id}"></div>
                </div>
            </div>
        </div>
        <div class="subTracks" draggable="false">
            <div class="lengthTrackWrapper">
                <div class="track lengthTrack">
                    <div class="selectableTrack">
                        <div class="selectableTrackRail"></div>
                        <div class="selectableTrackLoadProgress"><div class="load_bar"></div></div>
                        <div class="selectableTrackPlayed"></div>
                        <div class="slider"></div>
                    </div>
                </div>
            </div>
            <div class="volumeTrackWrapper">
                <div class="track volumeTrack">
                    <div class="selectableTrack">
                        <div class="selectableTrackRail"></div>
                        <div class="selectableTrackPlayed"></div>
                        <div class="slider"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</div>`;
        })
        .join('');

    const loadMoreNode = hasMorePages()
        ? `<div class="scroll_node loadMore_node"><a class="loadMore">${window.vkifylang?.loadmore || 'Load more'}</a></div>`
        : '';

    container.innerHTML = `
<div class="audiosContainer audiosSideContainer audiosPaddingContainer">
<div class="scroll_container">${html}${loadMoreNode}</div>
</div>`;
}

async function loadMoreAudio() {
    if (!window.player?.context?.playedPages?.length) return;

    const nextPage = Number(Math.max(...window.player.context.playedPages)) + 1;
    const loadMoreBtn = window.musHtml?.querySelector('.audiosContainer .loadMore');
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = `<div class="pr"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>`;
    }

    try {
        await window.player.loadContext(nextPage, true);
    } catch (e) {
        console.error(e);
    }

    const placeholder = window.musHtml?.querySelector('.vkifytracksplaceholder');
    if (placeholder) {
        renderMusicPopupTracks(placeholder);
    }

    const btn = window.musHtml?.querySelector('.loadMore');
    if (btn) {
        btn.onclick = async function (e) {
            e.preventDefault();
            await loadMoreAudio();
        };
    }

    if (typeof window.u === 'function' && window.player?.current_track_id) {
        u(`.audiosContainer .audioEmbed .audioEntry, .audios_padding .audioEmbed`).removeClass('nowPlaying');
        u(`.audiosContainer .audioEmbed[data-realid='${window.player.current_track_id}'] .audioEntry, .audios_padding .audioEmbed[data-realid='${window.player.current_track_id}'] .audioEntry`).addClass('nowPlaying');
    }
}

async function updateCurrentlyPlayingInfo(container) {
    if (!container) return;

    const contextUrl = window.player?.context?.object?.url;
    if (!contextUrl) {
        container.innerHTML = '';
        return;
    }

    const playingNowLnk = contextUrl.replace(/^\//, '');
    const currentlyPlayingText = window.vkifylang?.currentlyplaying || 'Currently playing: ';

    if (!window.OVKAPI?.call) {
        container.innerHTML = '';
        return;
    }

    try {
        if (/^(audios-?\d+)(\?.*)?$/.test(playingNowLnk)) {
            const userId = Number(playingNowLnk.match(/[^\d]*(\d+)/)?.[1]);
            if (!userId) {
                container.innerHTML = '';
                return;
            }

            const userData = await window.OVKAPI.call("users.get", { user_ids: userId, fields: "first_name" });
            const userName = userData?.[0]?.first_name;
            if (userName) {
                container.innerHTML = `${currentlyPlayingText}<a onclick="tippy.hideAll();" href="${escapeHtml(playingNowLnk)}">${tr('audios')} <b>${escapeHtml(userName)}</b></a>`;
            } else {
                container.innerHTML = '';
            }
            return;
        }

        if (/^(playlist\d+_\d+)(\?.*)?$/.test(playingNowLnk)) {
            const matches = playingNowLnk.match(/(\d+)_(\d+)/);
            if (!matches) {
                container.innerHTML = '';
                return;
            }

            const [, ownerId, playlistId] = matches.map(Number);
            const albumsData = await window.OVKAPI.call("audio.getAlbums", { owner_id: ownerId });
            const playlist = albumsData?.items?.find(item => item?.id === playlistId);

            if (playlist?.title) {
                container.innerHTML = `${currentlyPlayingText}<a onclick="tippy.hideAll();" href="${escapeHtml(playingNowLnk)}">${tr('playlist')} <b>${escapeHtml(playlist.title)}</b></a>`;
            } else {
                container.innerHTML = '';
            }
            return;
        }

        container.innerHTML = '';
    } catch (e) {
        console.error(e);
        container.innerHTML = '';
    }
}

function patchPlayerInitEventsOnce() {
    if (!window.player || window.player.__vkifyMusicPopupPatchedInitEvents) {
        return;
    }
    if (typeof window.player.initEvents !== 'function') {
        return;
    }

    window.player.__vkifyMusicPopupPatchedInitEvents = true;

    vkify.hook(window.player, 'initEvents', function () {
        if (!this.audioPlayer) {
            return;
        }

        const clampPercentValue = value => Math.max(0, Math.min(100, Number(value) || 0));

        const syncSeekUI = ps => {
            const normalized = clampPercentValue(ps).toFixed(3);
            this.uiPlayer.find(".trackPanel .track .selectableTrack .slider").attr('style', `left:calc(${normalized}% - 6.5px)`);
            this.uiPlayer.find(".trackPanel .track .selectableTrack .selectableTrackPlayed").attr('style', `width:${normalized}%`);

            if (this.linkedInlinePlayer) {
                this.linkedInlinePlayer.find(".subTracks .lengthTrackWrapper .slider").attr('style', `left:calc(${normalized}% - 6.5px)`);
                this.linkedInlinePlayer.find(".subTracks .lengthTrackWrapper .selectableTrackPlayed").attr('style', `width:${normalized}%`);
            }

            if (this.ajaxPlayer) {
                this.ajaxPlayer.find('#aj_player_track_length .slider').attr('style', `left:${normalized}%`);
            }
        };

        const syncVolumeUI = ps => {
            const normalized = clampPercentValue(ps).toFixed(1);
            this.uiPlayer.find(".volumePanel .selectableTrack .slider").attr('style', `left:calc(${normalized}% - 6.5px)`);
            this.uiPlayer.find(".volumePanel .selectableTrack .selectableTrackPlayed").attr('style', `width:${normalized}%`);

            if (this.linkedInlinePlayer) {
                this.linkedInlinePlayer.find(".subTracks .volumeTrackWrapper .slider").attr('style', `left:calc(${normalized}% - 6.5px)`);
                this.linkedInlinePlayer.find(".subTracks .volumeTrackWrapper .selectableTrackPlayed").attr('style', `width:${normalized}%`);
            }

            if (this.ajaxPlayer) {
                this.ajaxPlayer.find('#aj_player_volume .slider').attr('style', `left:${normalized}%`);
            }
        };

        const syncTimeUI = time => {
            const normalizedTime = Math.max(0, Number(time) || 0);
            this.uiPlayer.find(".time").html(fmtTime(normalizedTime));
            if (this.currentTrack) this.__updateTime(normalizedTime);

            if (this.linkedInlinePlayer) {
                this.linkedInlinePlayer.find('.mini_timer .nobold').html(fmtTime(normalizedTime));
            }

            if (this.ajaxPlayer) {
                this.ajaxPlayer.find('#aj_player_track_name #aj_time').html(fmtTime(normalizedTime));
            }
        };

        const syncSeekFromPlayer = forceTime => {
            const current_track = this.currentTrack;
            if (!current_track) return;

            const length = Number(current_track.length || this.audioPlayer.duration || 0);
            if (!(length > 0)) {
                syncSeekUI(0);
                syncTimeUI(0);
                return;
            }

            const rawTime = forceTime == null ? Number(this.audioPlayer.currentTime || 0) : Number(forceTime || 0);
            const safeTime = Math.max(0, Math.min(length, rawTime));
            syncTimeUI(safeTime);
            syncSeekUI((safeTime * 100) / length);
        };

        this.audioPlayer.ontimeupdate = () => {
            syncSeekFromPlayer();
        };

        this.audioPlayer.onloadedmetadata = () => {
            syncSeekFromPlayer();
        };

        this.audioPlayer.onvolumechange = () => {
            if (this._fading === true) {
                return;
            }

            const muted = this.audioPlayer.muted;
            const volume = muted ? 0 : this.audioPlayer.volume;
            const ps = volume * 100;

            syncVolumeUI(ps.toFixed(1));

            if (!muted) {
                localStorage.setItem('audio.volume', this.audioPlayer.volume);
            }
        };

        const initialSeekLength = Number(this.currentTrack?.length || this.audioPlayer.duration || 0);
        const initialSeekTimeRaw = Number(this.audioPlayer.currentTime || 0);
        const initialTimeLabel = String(this.uiPlayer.find('.time').html() || '').replace(/\s+/g, '').trim();
        const initialLabelIsZero = initialTimeLabel === '00:00' || initialTimeLabel === '0:00';
        const hasReliableInitialSeekTime = this.audioPlayer.readyState > 0 && initialSeekLength > 0 && initialSeekTimeRaw <= initialSeekLength && !initialLabelIsZero;
        syncSeekFromPlayer(hasReliableInitialSeekTime ? initialSeekTimeRaw : 0);

        const initialVolume = Math.max(0, Math.min(1, Number(this.audioPlayer.volume)));
        syncVolumeUI((initialVolume * 100).toFixed(1));

        if (!this.__vkifySeekResetBound && typeof this.setTrack === 'function') {
            this.__vkifySeekResetBound = true;
            vkify.hook(this, 'setTrack', function() {
                ensurePlayerContext(this);
                try {
                    if (this.audioPlayer) this.audioPlayer.currentTime = 0;
                } catch (e) {
                }
                syncTimeUI(0);
                syncSeekUI(0);
            }, 'before');
        }

        const clampPercent = e => {
            const rect = e.currentTarget.getBoundingClientRect();
            let ps = ((e.clientX - rect.left) * 100) / rect.width;
            ps = Math.max(0, Math.min(100, ps));
            if (ps < 2) ps = 0;
            if (ps > 98) ps = 100;
            return ps;
        };

        const bindOuterTrack = (scope, selector, callback, flag) => {
            if (!scope?.find) return;
            const node = scope.find(selector)[0];
            if (!node || node[flag]) return;
            node[flag] = true;

            const onPointer = e => {
                if (e.type === 'mousemove' && e.buttons !== 1) return;
                callback(clampPercent(e));
            };

            node.addEventListener('mousedown', onPointer);
            node.addEventListener('mousemove', onPointer);
        };

        bindOuterTrack(this.uiPlayer, '.trackPanel .track .selectableTrack', ps => {
            const len = Number(this.currentTrack?.length || this.audioPlayer.duration || 0);
            if (len > 0) this.audioPlayer.currentTime = (len * ps) / 100;
        }, '__vkifyOuterSeekBound');

        bindOuterTrack(this.uiPlayer, '.volumePanel .selectableTrack', ps => {
            this.audioPlayer.volume = ps / 100;
        }, '__vkifyOuterVolumeBound');

        bindOuterTrack(this.linkedInlinePlayer, '.subTracks .lengthTrackWrapper .selectableTrack', ps => {
            const len = Number(this.currentTrack?.length || this.audioPlayer.duration || 0);
            if (len > 0) this.audioPlayer.currentTime = (len * ps) / 100;
        }, '__vkifyOuterInlineSeekBound');

        bindOuterTrack(this.linkedInlinePlayer, '.subTracks .volumeTrackWrapper .selectableTrack', ps => {
            this.audioPlayer.volume = ps / 100;
        }, '__vkifyOuterInlineVolumeBound');
    }, 'after');

    try {
        window.player.initEvents();
    } catch (e) {
    }
}

function initTopPlayerOnce() {
    if (!vkify.bindOnce('musicPopupTopPlayer', initTopPlayerOnce)) return;

    const topPlayer = document.querySelector('#top_audio_player');
    const headerMusicBtn = document.querySelector('#headerMusicBtn');
    if (!topPlayer || !headerMusicBtn) {
        return;
    }

    const topPlayerTitle = topPlayer.querySelector('.top_audio_player_title');
    const topPlayerPlay = topPlayer.querySelector('.top_audio_player_play');
    const topPlayerPrev = topPlayer.querySelector('.top_audio_player_prev');
    const topPlayerNext = topPlayer.querySelector('.top_audio_player_next');

    if (!topPlayerTitle || !topPlayerPlay || !topPlayerPrev || !topPlayerNext) {
        return;
    }

    let currentTrackId = null;

    function updateTopPlayer() {
        if (window.player && window.player.currentTrack) {
            topPlayer.classList.add('top_audio_player_enabled');
            headerMusicBtn.style.display = 'none';

            if (currentTrackId !== window.player.currentTrack.id) {
                currentTrackId = window.player.currentTrack.id;
                topPlayerTitle.style.opacity = '0';
                setTimeout(() => {
                    topPlayerTitle.textContent = `${window.player.currentTrack.performer} — ${window.player.currentTrack.name}`;
                    topPlayerTitle.style.opacity = '1';
                }, 60);
            }

            topPlayer.classList.toggle('top_audio_player_playing', !window.player.audioPlayer.paused);
        } else {
            topPlayer.classList.remove('top_audio_player_enabled');
            topPlayerTitle.textContent = '';
            headerMusicBtn.removeAttribute('style');
            currentTrackId = null;
        }
    }

    vkify.musicPopup.updateTopPlayer = updateTopPlayer;

    topPlayerPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.player?.audioPlayer) {
            return;
        }
        if (window.player.audioPlayer.paused) {
            window.player.play();
        } else {
            window.player.pause();
        }
        updateTopPlayer();
    });

    topPlayerPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.player?.currentTrack) {
            window.player.playPreviousTrack();
        }
    });

    topPlayerNext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.player?.currentTrack) {
            window.player.playNextTrack();
        }
    });

    if (window.player?.audioPlayer) {
        window.player.audioPlayer.addEventListener('play', updateTopPlayer);
        window.player.audioPlayer.addEventListener('pause', updateTopPlayer);
    }

    const tryWrapUpdateFace = () => {
        if (!window.player || typeof window.player.__updateFace !== 'function') {
            return false;
        }
        if (window.player.__vkifyMusicPopupWrappedUpdateFace) {
            return true;
        }

        window.player.__vkifyMusicPopupWrappedUpdateFace = true;
        vkify.hook(window.player, '__updateFace', updateTopPlayer, 'after');
        return true;
    };

    tryWrapUpdateFace();
    updateTopPlayer();

    vkify.musicPopup.tryWrapUpdateFace = tryWrapUpdateFace;
}


let friendsHtmlCache = null;
let friendsHtmlPromise = null;

async function getFriendsHtml() {
    if (typeof friendsHtmlCache === 'string') {
        return friendsHtmlCache;
    }
    if (friendsHtmlPromise) {
        return friendsHtmlPromise;
    }

    friendsHtmlPromise = (async () => {
        if (!window.OVKAPI?.call) {
            friendsHtmlCache = '';
            return friendsHtmlCache;
        }

        try {
            const friendsd = await window.OVKAPI.call("friends.get", {
                user_id: window.openvk?.current_id,
                fields: "first_name,last_name,photo_50",
                count: 100
            });

            const items = friendsd?.items || [];
            friendsHtmlCache = items
                .filter(item => item && item.id && item.id > 0 && !item.deactivated)
                .slice(0, Math.min(items.length, friendsd?.count || items.length))
                .map(item => {
                    return `
<a class="ui_rmenu_item ui_ownblock" onclick="tippy.hideAll();" href="/audios${item.id}">
<img class="ui_ownblock_img" src="${escapeHtml(item.photo_50 || '')}">
<div class="ui_ownblock_info">
    <div class="ui_ownblock_label">${escapeHtml(item.first_name || '')} ${escapeHtml(item.last_name || '')}</div>
</div>
</a>`;
                })
                .join('');
        } catch (e) {
            console.error(e);
            friendsHtmlCache = '';
        }

        return friendsHtmlCache;
    })();

    return friendsHtmlPromise;
}

async function initMusicPopupTippyOnce() {
    const anchor = document.querySelector('#headerMusicLinkDiv');
    if (!anchor || anchor._tippy || anchor.__vkifyBindingTippy) {
        return;
    }
    anchor.__vkifyBindingTippy = true;

    const friendsHtml = await getFriendsHtml();

    const mushtml = `
<div class="bigPlayer ctx_place">
<div class="bigPlayerWrapper">
    <div class="playButtons">
        <div onmousedown="this.classList.add('pressed')" onmouseup="this.classList.remove('pressed')" class="playButton musicIcon" data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr('play_tip')}"><div class="playIcon"></div></div>
        <div class="arrowsButtons">
            <div class="nextButton musicIcon" data-tip="simple-black" data-align="bottom-start" data-tiptitle=""></div>
            <div class="backButton musicIcon" data-tip="simple-black" data-align="bottom-start" data-tiptitle=""></div>
        </div>
    </div>

    <div class="trackPanel">
        <div class="trackInfo">
            <div class="trackName">
                <span class="trackPerformers"><a href="/">?</a></span> —
                <span>?</span>
            </div>

            <div class="timer">
                <span class="time">00:00</span>
                <span>/</span>
                <span class="elapsedTime">-00:00</span>
            </div>
        </div>

        <div class="track">
            <div class="selectableTrack">
                <div class="selectableTrackRail"></div>
                <div class="selectableTrackLoadProgress">
                    <div class="load_bar"></div>
                </div>
                <div class="selectableTrackPlayed"></div>
                <div class="slider"></div>
            </div>
        </div>
    </div>

    <div class="volumePanel">
        <div class="volumePanelTrack">
            <div class="selectableTrack">
                <div class="selectableTrackRail"></div>
                <div class="selectableTrackPlayed" style="width:100%"></div>
                <div class="slider" style="left:calc(100% - 6.5px)"></div>
            </div>
        </div>
    </div>

    <div class="additionalButtons">
        <div class="repeatButton musicIcon" data-tip="simple-black" data-align="bottom-end" data-tiptitle="${tr('repeat_tip')}"></div>
        <div class="shuffleButton musicIcon" data-tip="simple-black" data-align="bottom-end" data-tiptitle="${tr('shuffle_tip')}"></div>
        <div class="deviceButton musicIcon" data-tip="simple-black" data-align="bottom-end" data-tiptitle="${tr('mute_tip')}"></div>
        <form name="status_popup_form" style="display: none !important;">
            <input type="text" name="status" size="50" value="${escapeHtml(window.openvk?.status || '')}">
            <input type="checkbox" name="broadcast" ${window.openvk?.broadcast_music ? 'checked' : ''}>
            <input type="hidden" name="hash" value="${vkify.getCsrf()}">
        </form>
        <div class="statusButton musicIcon${window.openvk?.broadcast_music ? ' pressed' : ''}" data-tip="simple-black" data-align="bottom-end" data-tiptitle="${tr('broadcast_audio')}"></div>
    </div>
</div>
</div>
<div class="wide_column_left">
<div class="wide_column_wrap">
    <div class="wide_column">
        <div class="vkifytracksplaceholder"></div>
        <div class="musfooter">
            <span class="playingNow"></span>
            <a id="ajclosebtn" onclick="tippy.hideAll();"><vkifyloc name="clear_playlist"></vkifyloc></a>
        </div>
    </div>
</div>
<div class="narrow_column_wrap">
    <div class="narrow_column">
        <div class="ui_rmenu ui_rmenu_pr audio_tabs">
            <a class="ui_rmenu_item" onclick="tippy.hideAll();" href="/audios${window.openvk?.current_id}">
                <span>${tr('my_music')}</span>
                <span class="ui_rmenu_extra_item addAudioSmall" onclick="tippy.hideAll(); showAudioUploadPopup(); return false;" data-href="/player/upload"><div class="addIcon"></div></span>
            </a>
            <a class="ui_rmenu_item" onclick="tippy.hideAll();" href="/audios/uploaded">${tr('my_audios_small_uploaded')}</a>
            <a class="ui_rmenu_item" onclick="tippy.hideAll();" href="/search?section=audios" id="ki">${tr('audio_new')}</a>
            <a class="ui_rmenu_item" onclick="tippy.hideAll();" href="/search?section=audios&order=listens" id="ki">${tr('audio_popular')}</a>
            <div class="ui_rmenu_sep"></div>
            <a class="ui_rmenu_item" onclick="tippy.hideAll();" href="/playlists${window.openvk?.current_id}" id="ki">${tr('my_playlists')}</a>
            <a class="ui_rmenu_item" onclick="tippy.hideAll(); return showNewPlaylistModal(event);" href="/audios/newPlaylist">${tr('new_playlist')}</a>
            <div class="ui_rmenu_sep"></div>
        </div>
        <div class="friends_audio_list">${friendsHtml}</div>
    </div>
</div>
</div>`;

    tippy(anchor, {
        content: mushtml,
        allowHTML: true,
        trigger: 'click',
        interactive: true,
        animation: 'up_down',
        placement: 'bottom-start',
        theme: 'musicpopup',
        arrow: false,
        zIndex: 99,
        getReferenceClientRect: () => {
            const searchBox = document.querySelector('.home_search');
            if (!searchBox) {
                const headerMusicBtn = document.querySelector('#headerMusicBtn');
                const rect = headerMusicBtn.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                };
            }

            const rect = searchBox.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
            };
        },
        maxWidth: 'var(--page-width)',
        appendTo: 'parent',
        popperOptions: { modifiers: [{ name: 'offset', options: { offset: [0, 0] } }] },
        onHidden() {
            window.musHtml = undefined;
            document.querySelector('.top_audio_player')?.classList.remove('audio_top_btn_active');
        },
        onShow() {
            if (!window.player || !window.player.tracks || window.player.tracks.length === 0) {
                vkify.navigate(`/audios${window.openvk?.current_id}`);
                return false;
            }
            document.querySelector('.top_audio_player')?.classList.add('audio_top_btn_active');
        },
        async onMount(instance) {
            window.musHtml = instance.popper;

            const placeholder = instance.popper.querySelector('.vkifytracksplaceholder');
            if (placeholder) {
                renderMusicPopupTracks(placeholder);

                const loadMoreBtn = instance.popper.querySelector('.loadMore');
                if (loadMoreBtn) {
                    loadMoreBtn.onclick = async function (e) {
                        e.preventDefault();
                        await loadMoreAudio();
                    };
                }
            }

            if (typeof window.u === 'function' && window.player?.current_track_id) {
                u(`.audiosContainer .audioEmbed .audioEntry, .audios_padding .audioEmbed`).removeClass('nowPlaying');
                u(`.audiosContainer .audioEmbed[data-realid='${window.player.current_track_id}'] .audioEntry, .audios_padding .audioEmbed[data-realid='${window.player.current_track_id}'] .audioEntry`).addClass('nowPlaying');
            }

            try {
                window.player?.__updateFace?.();
                window.player?.audioPlayer?.onvolumechange?.();
            } catch (e) {
            }

            const acont = instance.popper.querySelector('.audiosContainer.audiosSideContainer.audiosPaddingContainer');
            const aplaying = acont?.querySelector('.audioEntry.nowPlaying');
            if (acont && aplaying) {
                const aplayingRect = aplaying.getBoundingClientRect();
                const acontRect = acont.getBoundingClientRect();
                acont.scrollTo({
                    top: aplayingRect.top - acontRect.top + acont.scrollTop - (acont.clientHeight / 2) + (aplayingRect.height / 2),
                    behavior: 'smooth'
                });
            }

            const playingNowContainer = instance.popper.querySelector('.musfooter .playingNow');
            if (playingNowContainer) {
                playingNowContainer.innerHTML = `<span class="pr"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></span>`;
                await updateCurrentlyPlayingInfo(playingNowContainer);
            }

            if (typeof vkify.musicPopup.updateTopPlayer === 'function') {
                vkify.musicPopup.updateTopPlayer();
            }
            if (typeof vkify.musicPopup.updateSidebarPlayer === 'function') {
                vkify.musicPopup.updateSidebarPlayer();
            }
        }
    });

    anchor.__vkifyBindingTippy = false;
}

function defaultPlayerContext() {
    return { object: null, pagesCount: 0, count: 0, playedPages: [] };
}

function ensurePlayerContext(player) {
    if (!player?.context) {
        player.context = defaultPlayerContext();
    }
}

function patchPlayerContextCheckOnce() {
    if (!window.player || window.player.__vkifyPatchedContextCheck) return;
    window.player.__vkifyPatchedContextCheck = true;

    const original = window.player.isAtCurrentContextPage;
    window.player.isAtCurrentContextPage = function() {
        if (!this.context?.object?.url) return false;
        return original.call(this);
    };

    window.player.hasContext = function() {
        ensurePlayerContext(this);
        return Boolean(this.context.object?.url);
    };

    if (typeof window.player.loadDump === 'function') {
        vkify.hook(window.player, 'loadDump', function(dump_object) {
            if (!dump_object?.context) {
                dump_object.context = defaultPlayerContext();
            }
        }, 'before');
    }
}

function bindAjCloseOnce() {
    if (!vkify.bindOnce('musicPopupAjClose', bindAjCloseOnce)) return;

    if (typeof window.u === 'function') {
        u(document).on('click', '#ajclosebtn', function (e) {
            e.preventDefault();
            window.player?.ajClose?.();
        });
    } else {
        document.addEventListener('click', function (e) {
            const t = e.target;
            if (t && t.id === 'ajclosebtn') {
                e.preventDefault();
                window.player?.ajClose?.();
            }
        });
    }
}

function bindSliderTipPositionFixOnce() {
    if (!vkify.bindOnce('musicPopupSliderTipPositionFix', bindSliderTipPositionFixOnce)) return;

    const seekSelectors = [
        '.bigPlayer .trackPanel .selectableTrack',
        '.audioEntry .subTracks .lengthTrackWrapper .selectableTrack',
        '#aj_player_track_length .selectableTrack'
    ];
    const volumeSelectors = [
        '.bigPlayer .volumePanelTrack .selectableTrack',
        '.audioEntry .subTracks .volumeTrack .selectableTrack',
        '#aj_player_volume .selectableTrack'
    ];
    const seekSelectorStr = seekSelectors.join(', ');
    const volumeSelectorStr = volumeSelectors.join(', ');
    const combinedSelectorStr = `${seekSelectorStr}, ${volumeSelectorStr}`;

    const handleSeekTooltip = (e, track) => {
        if (!window.player?.currentTrack) return;
        if (window.player.isAtAudiosPage?.() && window.player.current_track_id === 0) return;
        if (document.querySelector('.ui-draggable-dragging')) return;

        e.stopImmediatePropagation();

        const parent = track.parentElement;
        const rect = track.getBoundingClientRect();
        const width = e.clientX - rect.left;
        const length = window.player.currentTrack.length || 0;
        const time = Math.max(0, Math.ceil((width * length) / rect.width));

        if (e.type === 'mousemove' && (e.buttons & 1)) {
            window.player.listen_coef -= 0.5;
            window.player.audioPlayer.currentTime = time;
        }
        if (e.type === 'click' || e.type === 'mouseup') {
            window.player.listen_coef -= 0.5;
            window.player.audioPlayer.currentTime = time;
        }

        let tip = parent.querySelector('.tip_result');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'tip_result';
            parent.appendChild(tip);
        }
        tip.textContent = fmtTime(time);
        const tipWidth = tip.offsetWidth || 30;
        const x = Math.max(0, Math.min(rect.width, width));
        const left = Math.max(0, Math.min(rect.width - tipWidth, x - (tipWidth / 2)));
        tip.style.left = `${left}px`;
    };

    const handleVolumeTooltip = (e, track) => {
        if (window.player?.isAtAudiosPage?.() && window.player.current_track_id === 0) return;
        if (document.querySelector('.ui-draggable-dragging')) return;

        e.stopImmediatePropagation();

        const parent = track.parentElement;
        const rect = track.getBoundingClientRect();
        const width = e.clientX - rect.left;
        const volume = Math.max(0, Math.min(1, width / rect.width));

        if (e.type === 'mousemove' && (e.buttons & 1)) {
            window.player.audioPlayer.volume = volume;
        }
        if (e.type === 'click' || e.type === 'mouseup') {
            window.player.audioPlayer.volume = volume;
        }

        let tip = parent.querySelector('.tip_result');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'tip_result';
            parent.appendChild(tip);
        }
        tip.textContent = `${(volume * 100).toFixed(0)}%`;
        const tipWidth = tip.offsetWidth || 30;
        const x = Math.max(0, Math.min(rect.width, width));
        const left = Math.max(0, Math.min(rect.width - tipWidth, x - (tipWidth / 2)));
        tip.style.left = `${left}px`;
    };

    const handleMouseout = e => {
        const track = e.target?.closest?.('.selectableTrack');
        if (!track) return;
        const tip = track.parentElement?.querySelector('.tip_result');
        if (tip) tip.remove();
    };

    const handleTrackPointer = e => {
        const track = e.target?.closest?.(combinedSelectorStr);
        if (!track) return;

        if (track.matches(seekSelectorStr)) {
            handleSeekTooltip(e, track);
        } else if (track.matches(volumeSelectorStr)) {
            handleVolumeTooltip(e, track);
        }
    };

    ['mousemove', 'click', 'mouseup'].forEach(evt => {
        document.addEventListener(evt, handleTrackPointer, true);
    });
    document.addEventListener('mouseout', handleMouseout, true);
}

async function init() {
    patchPlayerContextCheckOnce();
    patchPlayerFaviconOnce();
    patchPlayerInitEventsOnce();
    initTopPlayerOnce();
    bindAjCloseOnce();
    bindSliderTipPositionFixOnce();
    await initMusicPopupTippyOnce();

    if (typeof vkify.musicPopup.tryWrapUpdateFace === 'function') {
        vkify.musicPopup.tryWrapUpdateFace();
    }
}

function updatePlaylistBookmarkButton(el, wasUnbookmark) {
    const isBookmarked = !wasUnbookmark;

    el.setAttribute('id', isBookmarked ? 'unbookmarkPlaylist' : 'bookmarkPlaylist');

    if (el.classList.contains('ActionButton--add')) {
        el.classList.toggle('ActionButton--add--added', isBookmarked);
        const textSpan = el.querySelector('.ActionButton--add__text');
        if (textSpan) {
            textSpan.innerHTML = isBookmarked ? tr('unbookmark') : tr('bookmark');
        } else {
            el.innerHTML = isBookmarked ? tr('unbookmark') : tr('bookmark');
        }
        return;
    }

    const label = el.querySelector('.action_label');
    if (label) {
        label.innerHTML = isBookmarked ? tr('unbookmark') : tr('bookmark');
        el.classList.toggle('post_add', !isBookmarked);
        el.classList.toggle('post_remove', isBookmarked);
        return;
    }

    if (el.classList.contains('audio_pl__actions_add') || el.classList.contains('audio_pl__actions_remove')) {
        el.classList.toggle('audio_pl__actions_add', !isBookmarked);
        el.classList.toggle('audio_pl__actions_remove', isBookmarked);
        return;
    }

    el.innerHTML = isBookmarked ? tr('unbookmark') : tr('bookmark');
}

vkify.bindOnce('playlistBookmark', () => {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('#bookmarkPlaylist, #unbookmarkPlaylist');
        if (!el) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const wasUnbookmark = el.id === 'unbookmarkPlaylist';

        const formData = new FormData();
        formData.append('hash', vkify.getCsrf());

        el.classList.add('lagged');
        ky.post(`/playlist${el.dataset.id}/action?act=${wasUnbookmark ? 'unbookmark' : 'bookmark'}`, { body: formData }).json().then((response) => {
            if (response.success) {
                updatePlaylistBookmarkButton(el, wasUnbookmark);
                el.classList.remove('lagged');
            } else {
                fastError(response.flash.message);
            }
        }).catch((err) => {
            console.error(err);
            el.classList.remove('lagged');
        });
    }, true);
});

vkify.bindOnce('statusBroadcastToggle', () => {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.bigPlayer .additionalButtons .statusButton');
        if (!btn) return;

        e.preventDefault();

        const parent = btn.closest('.additionalButtons') || btn.closest('.bigPlayer');
        if (!parent) return;

        const form = parent.querySelector('form[name="status_popup_form"]');
        if (!form) return;

        const isPressed = btn.classList.contains('pressed');
        const newBroadcastState = !isPressed;

        // Toggle visual state immediately
        btn.classList.toggle('pressed', newBroadcastState);

        // Sync other statusButtons and checkboxes on the page
        document.querySelectorAll('.bigPlayer .additionalButtons .statusButton').forEach(otherBtn => {
            if (otherBtn !== btn) {
                otherBtn.classList.toggle('pressed', newBroadcastState);
            }
        });
        document.querySelectorAll('input[name="broadcast"]').forEach(checkbox => {
            checkbox.checked = newBroadcastState;
        });

        const statusVal = form.querySelector('input[name="status"]')?.value || '';
        const hashVal = form.querySelector('input[name="hash"]')?.value || '';

        const formData = new FormData();
        formData.append('status', statusVal);
        formData.append('broadcast', Number(newBroadcastState));
        formData.append('hash', hashVal);

        try {
            let ok = false;
            if (window.ky) {
                const response = await window.ky.post('/edit?act=status', { body: formData });
                ok = response.ok;
            } else {
                const response = await fetch('/edit?act=status', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                ok = response.ok;
            }

            if (!ok) {
                throw new Error('Server returned non-ok status');
            }
            if (window.openvk) {
                window.openvk.broadcast_music = newBroadcastState;
            }
        } catch (err) {
            console.error(err);
            // Revert visual state if failed
            btn.classList.toggle('pressed', isPressed);
            document.querySelectorAll('.bigPlayer .additionalButtons .statusButton').forEach(otherBtn => {
                if (otherBtn !== btn) {
                    otherBtn.classList.toggle('pressed', isPressed);
                }
            });
            document.querySelectorAll('input[name="broadcast"]').forEach(checkbox => {
                checkbox.checked = isPressed;
            });
        }
    }, true);
});

vkify.onPage(init);
})();