export function createPeerInfoView({ html, tr, PeerAvatar = null }) {
    const blacklistCache = new Map();
    return function PeerInfoView({ convo, page, togglePeerInfo }) {
        if (!convo || !convo.peer) return html``;

        // upstream rename handlers mutate the conversations-list peer, so
        // resolve through it when the open chat wraps a different instance
        const peer = window.im?.conversations?._findConv?.(convo.peer?.id)?.peer || convo.peer;
        const name = typeof peer.getName === 'function' ? peer.getName() : '';
        const url = typeof peer.getPageUrl === 'function' ? peer.getPageUrl() : '';
        const subtitle = typeof peer.getOnlineStatusString === 'function' ? peer.getOnlineStatusString() : '';
        const avatar = typeof peer.getAvatar === 'function' ? peer.getAvatar('mid') : '';
        const backLabel = tr('back');

        const isUser = peer.supposed_type === 'user';
        const isSelfSaved = typeof peer.isSavedMessages === 'function' && peer.isSavedMessages();
        const userId = isUser ? peer.data?.id : null;
        const firstName = isUser ? (peer.data?.first_name || name) : '';
        const isOnline = isUser && !isSelfSaved && (typeof peer.isOnline === 'function'
            ? peer.isOnline()
            : (peer.data?.last_seen && (Math.floor(Date.now() / 1000) - peer.data.last_seen.time <= 300)));

        const onBackClick = (e) => {
            e.preventDefault();
            try { window.im.openTabByName('conversations'); } catch (err) { console.error(err); }
        };

        const onPeerInfoClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof togglePeerInfo === 'function') {
                togglePeerInfo();
            } else if (page && typeof page.togglePeerInfo === 'function') {
                page.togglePeerInfo(peer);
            }
        };

        const openMenu = (trigger) => {
            if (window.isMobile && window.isMobile()) {
                return;
            }
            if (typeof uiActionsMenu === 'undefined' || !uiActionsMenu) {
                return;
            }
            if (!trigger.classList.contains('shown')) {
                uiActionsMenu.show(trigger, null, { align: 'right' });
            }
        };

        const onActionsClick = (e) => {
            if (e.target.closest('a, button')) {
                return;
            }
            e.stopPropagation();
            if (window.isMobile && window.isMobile()) {
                return;
            }
            if (typeof uiActionsMenu === 'undefined' || !uiActionsMenu) {
                return;
            }
            const wrap = e.currentTarget;
            if (wrap.classList.contains('shown')) {
                uiActionsMenu.show(wrap, null, {align: "right"});
            } else {
                openMenu(wrap);
            }
        };

        const onActionsMouseEnter = (e) => {
            openMenu(e.currentTarget);
        };

        const onActionsMouseLeave = (e) => {
            if (window.isMobile && window.isMobile()) {
                return;
            }
            if (typeof uiActionsMenu === 'undefined' || !uiActionsMenu) {
                return;
            }
            // Delayed hide: moving onto the portaled menu cancels it via the
            // dummy's own hover handlers; moving away lets it fire.
            uiActionsMenu.hide(e.currentTarget);
        };

        const onSearchClick = (e) => {
            e.preventDefault();
            try {
                window.im.openTabByName('search', true, {
                    q: '',
                    peer_id: peer.id,
                    referrer: window.im?.getSelectedTabId?.() || 'contact',
                });
            } catch (err) {
                console.error(err);
            }
        };

        const onInviteClick = (e) => {
            e.preventDefault();
            window.im.openTabByName('friends', true, { referrer: 'add_new', convo_id: peer.id });
        };

        const onMediaClick = (e) => {
            e.preventDefault();
            window.im.openTabByName('materials', true, { peer, initialType: 'photo' });
        };

        const onMuteClick = (e) => {
            e.preventDefault();
            try { window.openChatMuteModal?.(peer); } catch (err) { console.error(err); }
        };

        const onClearClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            new CMessageBox({
                title: tr('clear_history'),
                body: tr('clear_history_confirm'),
                buttons: [tr('yes'), tr('no')],
                callbacks: [async () => {
                    try {
                        await window.OVKAPI.call('messages.deleteConversation', { peer_id: peer.id });
                        if (peer._chunks) {
                            peer._chunks.chunks = [];
                            peer._chunks._map = new Map();
                            peer._chunks._messagesInited = true;
                            peer._chunks._invalidateCache();
                        }
                        if (convo) {
                            convo.last_message = null;
                            convo._last_message = null;
                        }
                        window.im.openTabByName('messenger');
                        window.im.messenger.update();
                        window.im.conversations?.update?.();
                        window.im?.event_handler?.updateGlobalUnreadCounter?.();
                    } catch (err) {
                        fastError(String(err));
                    }
                }, () => { }],
            });
        };

        const onReturnClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            (async () => {
                try {
                    await window.OVKAPI.call('messages.addChatUser', {
                        peer_id: peer.id,
                        user_id: window.im?.state?.getId?.(),
                    });
                    peer.data.left = 0;
                    peer.data.kicked = 0;
                    peer.data.chat_settings = peer.data.chat_settings || {};
                    peer.data.chat_settings.state = 'in';
                    peer.data.state = 'in';
                    peer.data.can_write = { allowed: true };

                    try {
                        const convById = await window.OVKAPI.call('messages.getConversationsById', { peer_ids: peer.id });
                        const cConv = convById?.items?.[0]?.conversation || convById?.items?.[0] || null;
                        const s = cConv?.chat_settings;
                        if (s) {
                            peer.data.photo_50 = s.photo_50 || s.photo?.photo_50 || '';
                            peer.data.photo_100 = s.photo_100 || s.photo?.photo_100 || '';
                            peer.data.photo_200 = s.photo_200 || s.photo?.photo_200 || '';
                            peer.data.avatar_max = s.avatar_max || '';
                            peer.data.photo_id = s.photo_id || null;
                        }
                    } catch (_) { }

                    const conv = window.im.conversations?._findConv?.(peer.id);
                    if (conv) {
                        if (conv._conversation) {
                            conv._conversation.can_write = { allowed: true };
                            if (conv._conversation.chat_settings) {
                                conv._conversation.chat_settings.state = 'in';
                            }
                        }
                        if (conv.peer && conv.peer !== peer) {
                            Object.assign(conv.peer.data, {
                                left: 0, kicked: 0,
                                can_write: { allowed: true },
                                photo_50: peer.data.photo_50, photo_100: peer.data.photo_100,
                                photo_200: peer.data.photo_200, avatar_max: peer.data.avatar_max,
                                photo_id: peer.data.photo_id,
                            });
                        }
                    }

                    try {
                        const fc = window.im?.fastChats?.openedChats?.find((c) => Number(c.peerId) === Number(peer.id));
                        if (fc) {
                            fc.canWrite = true;
                            fc.cantWriteReason = null;
                            fc.cantWriteText = null;
                            fc.photo = peer.getAvatar ? peer.getAvatar() : '';
                            window.im.fastChats.render();
                        }
                    } catch (_) { }

                    window.im.openTabByName('messenger');
                    window.im.messenger.update();
                    window.im.conversations?.update?.();
                } catch (err) {
                    fastError(String(err));
                }
            })();
        };

        const onLeaveClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            new CMessageBox({
                title: tr('leave_chat'),
                body: tr('leave_chat_confirm'),
                buttons: [tr('yes'), tr('no')],
                callbacks: [async () => {
                    try {
                        await window.OVKAPI.call('messages.removeChatUser', {
                            peer_id: peer.id,
                            user_id: window.im?.state?.getId?.(),
                        });
                        const leftData = {
                            left: 1, kicked: 0,
                            photo_50: '', photo_100: '', photo_200: '', avatar_max: '',
                            photo_id: null,
                            can_write: { allowed: false, reason: 916 },
                        };
                        Object.assign(peer.data, leftData);
                        peer.data.chat_settings = peer.data.chat_settings || {};
                        peer.data.chat_settings.state = 'left';
                        peer.data.state = 'left';

                        const conv = window.im.conversations?._findConv?.(peer.id);
                        if (conv) {
                            if (conv._conversation) {
                                conv._conversation.can_write = { allowed: false, reason: 916 };
                                if (conv._conversation.chat_settings) {
                                    conv._conversation.chat_settings.state = 'left';
                                }
                            }
                            if (conv.peer && conv.peer !== peer) {
                                Object.assign(conv.peer.data, leftData);
                            }
                        }

                        try {
                            const fc = window.im?.fastChats?.openedChats?.find((c) => Number(c.peerId) === Number(peer.id));
                            if (fc) {
                                fc.canWrite = false;
                                fc.cantWriteReason = 916;
                                fc.cantWriteText = window.im.fastChats.getCantWriteText(fc);
                                fc.photo = '';
                                window.im.fastChats.render();
                            }
                        } catch (_) { }

                        window.im.openTabByName('messenger');
                        window.im.messenger.update();
                        window.im.conversations?.update?.();
                    } catch (err) {
                        fastError(String(err));
                    }
                }, () => { }],
            });
        };

        const applyBlacklistState = (blockedByMe, canWritePrivate, blockedByThem) => {
            const allowed = canWritePrivate === 1;
            peer.data = peer.data || {};
            peer.data.blacklisted_by_me = blockedByMe ? 1 : 0;
            peer.data.can_write_private_message = canWritePrivate;
            peer.data.can_write = allowed
                ? { allowed: true }
                : { allowed: false, reason: (blockedByMe || blockedByThem) ? 900 : 901 };

            const conv = window.im?.conversations?._findConv?.(peer.id);
            if (conv) {
                if (conv._conversation) conv._conversation.can_write = peer.data.can_write;
                if (conv.peer && conv.peer.data && conv.peer.data !== peer.data) {
                    conv.peer.data.can_write = peer.data.can_write;
                    conv.peer.data.can_write_private_message = canWritePrivate;
                    conv.peer.data.blacklisted_by_me = blockedByMe ? 1 : 0;
                }
            }

            try {
                const fc = window.im?.fastChats?.openedChats?.find((c) => Number(c.peerId) === Number(peer.id));
                if (fc) {
                    const info = typeof peer.getCantWriteInfo === 'function'
                        ? peer.getCantWriteInfo()
                        : { allowed, reason: 0, text: '' };
                    fc.canWrite = info.allowed !== false;
                    fc.cantWriteReason = info.reason || null;
                    fc.cantWriteText = info.text || null;
                    window.im.fastChats.render();
                }
            } catch (_) { }

            if (userId != null) {
                blacklistCache.set(userId, {
                    blockedByMe: !!blockedByMe,
                    canWritePrivate,
                    blockedByThem: !!blockedByThem,
                });
            }
        };

        const queryBlacklistState = async () => {
            try {
                const res = await window.OVKAPI.call('users.get', {
                    user_ids: userId,
                    fields: 'blacklisted,blacklisted_by_me,can_write_private_message',
                });
                return Array.isArray(res) ? res[0] : null;
            } catch (_) {
                return null;
            }
        };

        const refreshBlacklistState = async (optimisticBanned) => {
            const userData = await queryBlacklistState();
            if (userData) {
                applyBlacklistState(
                    Number(userData.blacklisted_by_me) === 1,
                    Number(userData.can_write_private_message),
                    Number(userData.blacklisted) === 1,
                );
            } else {
                applyBlacklistState(optimisticBanned, optimisticBanned ? 0 : 1, false);
            }

            try { window.im?.messenger?.update?.(); } catch (_) { }
        };

        const onBlacklistClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const banned = isBlacklistedByMe;
            const run = async () => {
                try {
                    await window.OVKAPI.call(banned ? 'account.unban' : 'account.ban', { owner_id: userId });
                    await refreshBlacklistState(!banned);
                } catch (err) {
                    fastError(err && err.message ? err.message : String(err));
                }
            };
            if (banned) {
                run();
            } else {
                new CMessageBox({
                    title: tr('addition_to_bl'),
                    body: `<span>${escapeHtml(tr('adding_to_bl_sure', firstName || name))}</span>`,
                    buttons: [tr('yes'), tr('no')],
                    callbacks: [() => { run(); }, () => Function.noop],
                });
            }
        };

        const onReportClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.reportUser === 'function') {
                window.reportUser(userId);
            } else {
                console.error('vkify16 | reportUser is not available (moderation.js not loaded)');
            }
        };

        // blacklisted_by_me isn't in upstream's BASE_FIELDS; fetch it lazily
        // once per user so the menu shows the right blacklist label. Only the
        // label field is synced — convo-level can_write is already authoritative.
        if (isUser && !isSelfSaved && userId != null && peer.data?.blacklisted_by_me === undefined) {
            const cached = blacklistCache.get(userId);
            if (cached) {
                peer.data = peer.data || {};
                peer.data.blacklisted_by_me = cached.blockedByMe ? 1 : 0;
            } else if (!blacklistCache.has(userId)) {
                blacklistCache.set(userId, null);
                queryBlacklistState().then((userData) => {
                    if (!userData) {
                        return;
                    }
                    blacklistCache.set(userId, {
                        blockedByMe: Number(userData.blacklisted_by_me) === 1,
                        canWritePrivate: Number(userData.can_write_private_message),
                        blockedByThem: Number(userData.blacklisted) === 1,
                    });
                    peer.data = peer.data || {};
                    peer.data.blacklisted_by_me = Number(userData.blacklisted_by_me) === 1 ? 1 : 0;
                    try { window.im?.messenger?.update?.(); } catch (_) { }
                });
            }
        }

        const isBlacklistedByMe = isUser && Number(peer.data?.blacklisted_by_me) === 1;
        const isChat = peer.supposed_type === 'chat';
        const isILeft = typeof peer.isILeft === 'function' && peer.isILeft();
        const peerCan = (perm) => typeof peer.can !== 'function' || peer.can(perm);
        const canInvite = isChat && !isILeft && peerCan('invite_new');
        const canLeave = isChat && !isILeft && peerCan('leave_chat');
        const canReturn = isChat && isILeft && peerCan('return_to_chat');
        const isMuted = typeof peer.isMuted === 'function' && peer.isMuted();
        const menuItem = 'ui_actions_menu_item im-action';

        return html`
            <div class="messenger-app--header messages--peers-header-peer-name">
                <div class="messenger-app--header--back">
                    <a href="/im" onClick=${onBackClick}><svg class="mobileonly" width="28" height="28" viewBox="0 0 28 28"><use href="#arrow-left-outline-28" /></svg>${backLabel}</a>
                </div>
                <div class="messenger-app--header--info">
                    <div class="messenger-app--header--name">
                        <a href=${url} onClick=${onPeerInfoClick}>${name}</a>
                    </div>
                    <div class="messenger-app--header--online">${subtitle}</div>
                </div>
                <div class="messenger-app-header--actions">
                    <div class="messenger-app-header--more-actions ui_actions_menu_wrap ui_actions_menu_left_align" onClick=${onActionsClick} onMouseEnter=${onActionsMouseEnter} onMouseLeave=${onActionsMouseLeave}>
                        <div id="profile_more_btn" class="messenger-app-header--more-actions--trigger"></div>
                        <div id="profile_actions_tooltip" class="ui_actions_menu">
                            ${canInvite ? html`
                            <a class="${menuItem} im-action_invite" onClick=${onInviteClick}>
                                ${tr('chat_add_members_ext')}
                            </a>` : ''}
                            <a class="${menuItem} im-action_media" onClick=${onMediaClick}>
                                ${tr('conversation_materials')}
                            </a>
                            <a class="${menuItem} im-action_search" onClick=${onSearchClick}>
                                ${tr('convo_search_messages')}
                            </a>
                            <div class="ui_actions_menu_sep"></div>
                            <a class="${menuItem} ${isMuted ? 'im-action_unmute' : 'im-action_mute'}" onClick=${onMuteClick}>
                                ${isMuted ? tr('chat_unmute_notifications') : tr('chat_mute_notifications')}
                            </a>
                            <a class="${menuItem} im-action_clear" onClick=${onClearClick}>
                                ${tr('clear_history')}
                            </a>
                            ${(canLeave || canReturn || (isUser && !isSelfSaved)) ? html`<div class="ui_actions_menu_sep"></div>` : ''}
                            ${canReturn ? html`
                            <a class="${menuItem} im-action_return" onClick=${onReturnClick}>
                                ${tr('return_to_chat')}
                            </a>` : ''}
                            ${canLeave ? html`
                            <a class="${menuItem} im-action_leave" onClick=${onLeaveClick}>
                                ${tr('leave_chat')}
                            </a>` : ''}
                            ${isUser && !isSelfSaved ? html`
                            <a class="${menuItem} ${isBlacklistedByMe ? 'im-action_unblock' : 'im-action_block'}" data-name=${firstName} data-val=${isBlacklistedByMe ? 0 : 1} data-id=${userId} onClick=${onBlacklistClick}>
                                ${isBlacklistedByMe ? tr('bl_remove') : tr('bl_add')}
                            </a>
                            <a class="${menuItem} im-action_none" onClick=${onReportClick}>
                                ${tr('report')}
                            </a>
                            ` : ''}
                        </div>
                    </div>
                    <a href=${url} class="messenger-app--header--ava" onClick=${onPeerInfoClick}>
                        ${PeerAvatar
                            ? html`<${PeerAvatar} peer=${peer} className="avatar post-avatar" size="mid" loading="eager" />`
                            : html`<img src=${avatar} class="avatar post-avatar" width="50" alt=${name} />`}
                        ${isOnline ? html`<div class="messenger-app--header--online online"></div>` : ''}
                    </a>
                </div>
            </div>
        `;
    };
}
