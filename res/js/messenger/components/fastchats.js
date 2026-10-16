import { imImport } from '../shared.js';

let installed = false;

function formatFcTextFallback(raw) {
    if (!raw) return '';
    let s = typeof window.escapeHtml === 'function'
        ? window.escapeHtml(raw)
        : String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s\)]+)\)/g, (m, title, url) => {
        const ext = /^https?:\/\//i.test(url);
        return `<a href="${url}" ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''} class="chat-link">${title}</a>`;
    });
    s = s.replace(/\[([a-zA-Z0-9_]+)(?:\|([^\]]*))?\]/gi, (m, target, title) => {
        const lower = target.toLowerCase();
        const display = (title && title.trim()) ? title.trim() : target;
        if (lower === 'all' || lower === 'online') {
            return `<b class="mention mention-mass">${display.startsWith('@') ? display : '@' + display}</b>`;
        }
        return `<a href="/${lower}" class="mention chat-link">${display}</a>`;
    });
    s = s.replace(/(^|[\s\(\[\{<]|&gt;)(https?:\/\/[^\s<>"'\]\)]+)/g, (m, prefix, url) => {
        return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`;
    });
    if (typeof window.encode_emojis === 'function') s = window.encode_emojis(s);
    if (typeof window.nl2br === 'function') s = window.nl2br(s);
    else s = s.replace(/\r?\n/g, '<br>');
    return s;
}

function formatFcDate(ts, formatTime) {
    if (!ts) return '';
    const d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    if (d.toDateString() === now.toDateString()) {
        if (typeof formatTime === 'function') {
            return formatTime(ts, false);
        }
        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    let out = pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
    if (d.getFullYear() !== now.getFullYear()) {
        out += '.' + String(d.getFullYear()).slice(2);
    }
    return out;
}

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedName(html, fullName, query) {
    if (!query || !query.trim()) {
        return fullName;
    }
    const q = query.trim();
    const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
    const parts = String(fullName).split(re);
    return parts.map((part, idx) => (idx % 2 === 1 ? html`<em class="fc_clist_hl">${part}</em>` : part));
}

function handleOpenFull(e, peerId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const targetUrl = '/im?sel=' + peerId;
    if (window.im?.messenger && typeof window.im.messenger.selectConversationByPeerId === 'function' && document.querySelector('#im_container')) {
        window.im.messenger.selectConversationByPeerId(peerId);
    } else if (window.router && typeof window.router.route === 'function') {
        window.router.route(targetUrl);
    } else {
        window.location.href = targetUrl;
    }
}

function handleHeaderDrag(e, initialPos, onFocus, onMove, onClickHeader) {
    if (e.button !== 0) return;
    if (e.target.closest('.fc_tab_close_wrap, .fc_tab_max_wrap, .fc_tab_pin_wrap, .fc_head_close, .fc_head_openfull, .fc_head_actions')) {
        return;
    }

    e.preventDefault();
    if (onFocus) onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const windowEl = e.currentTarget.closest('.rb_box_wrap, .fc_chat_box, .fc_friends_window');
    if (!windowEl) return;

    const rect = windowEl.getBoundingClientRect();
    const curX = initialPos && typeof initialPos.x === 'number' ? initialPos.x : rect.left;
    const curY = initialPos && typeof initialPos.y === 'number' ? initialPos.y : rect.top;

    let hasDragged = false;

    const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!hasDragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            hasDragged = true;
            document.body.classList.add('fc_dragging');
        }

        if (hasDragged) {
            const boxW = windowEl.offsetWidth || 270;
            const boxH = windowEl.offsetHeight || 30;
            const maxW = window.innerWidth - boxW;
            const maxH = window.innerHeight - boxH;
            let newX = Math.max(0, Math.min(maxW, curX + dx));
            let newY = Math.max(0, Math.min(maxH, curY + dy));
            if (maxH - newY < 10) newY = maxH;
            if (newY < 10) newY = 0;
            if (maxW - newX < 10) newX = maxW;
            if (newX < 10) newX = 0;

            if (onMove) {
                onMove({ x: newX, y: newY, toBottom: newY >= maxH - 5 });
            }
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('fc_dragging');

        if (!hasDragged && onClickHeader) {
            onClickHeader();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function handleResizeDrag(e, currentW, currentH, onFocus, onResize) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (onFocus) onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const windowEl = e.currentTarget.closest('.rb_box_wrap');
    const logEl = windowEl ? windowEl.querySelector('.fc_tab_log, .fc_messages_list') : null;
    const tabWrapEl = windowEl ? windowEl.querySelector('.fc_tab_wrap') : null;
    const initW = currentW || (tabWrapEl ? tabWrapEl.offsetWidth : 270);
    const initH = currentH || (logEl ? logEl.offsetHeight : 250);

    document.body.classList.add('fc_dragging');

    const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const newW = Math.max(250, Math.min(window.innerWidth - 80, initW + dx));
        const newH = Math.max(150, Math.min(window.innerHeight - 120, initH + dy));
        if (onResize) {
            onResize({ width: newW, height: newH });
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('fc_dragging');
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function ensureAttachmentMsg(msg) {
    if (!msg || typeof msg.getAttachments === 'function') {
        return msg;
    }
    const rawAtts = msg.attachments || msg.data?.attachments || [];
    const atts = Array.isArray(rawAtts)
        ? rawAtts
        : (typeof rawAtts === 'object' && rawAtts !== null ? Object.values(rawAtts) : []);
    return Object.assign(Object.create(msg), {
        getAttachments(includeLinks = false) {
            if (includeLinks) return atts;
            return atts.filter((a) => a && a.type !== 'link' && a.type !== 'share');
        },
    });
}

function formatFcReplyDate(ts, formatTime) {
    if (!ts) return '';
    const d = ts instanceof Date ? ts : new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return '';
    const tr = typeof window.tr === 'function' ? window.tr : (k) => k;
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    const timeStr = typeof formatTime === 'function'
        ? formatTime(d, false)
        : pad(d.getHours()) + ':' + pad(d.getMinutes());
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return timeStr;
    }
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const monthTr = String(tr('month_gen_' + month) || month).toLowerCase();
    return d.getFullYear() !== now.getFullYear()
        ? `${day} ${monthTr} ${d.getFullYear()} ${timeStr}`
        : `${day} ${monthTr} ${timeStr}`;
}

function groupMessagesForVk(messages, currentUserId, chat, currentUserAvatar, formatTime) {
    const groups = [];
    if (!Array.isArray(messages)) return groups;

    for (const msg of messages) {
        if (!msg) continue;
        const isOut = Boolean(msg.from_id === currentUserId || msg.out === 1);
        const fromId = isOut ? currentUserId : Number(msg.from_id || chat.peerId);
        const isUnread = !isOut && (msg.read_state === 0 || msg.read_state === false || msg.unread === 1);
        const isTargetUnread = Boolean(chat.firstUnreadMsgId && Number(msg.id) === Number(chat.firstUnreadMsgId));
        const atts = Array.isArray(msg.attachments)
            ? msg.attachments
            : (Array.isArray(msg.data?.attachments) ? msg.data.attachments : []);
        const isSticker = atts.some((a) => a && a.type === 'sticker');
        const isGift = (typeof msg.isSpecial === 'function' && msg.isSpecial('gift'))
            || atts.some((a) => a && a.type === 'gift');
        const msgDate = Number(msg.date || 0);
        const dateStr = msg.time_str || formatFcDate(msgDate, formatTime);
        const authorName = isOut ? (typeof window.tr === 'function' ? window.tr('you') : 'You') : (msg.author_name || chat.title || '');
        const authorAva = (isOut ? currentUserAvatar : (msg.author_photo || chat.photo)) || '/assets/packages/static/openvk/img/camera_50.png';
        const authorLink = fromId < 0 ? `/club${Math.abs(fromId)}` : `/id${fromId}`;

        const prev = groups.length > 0 ? groups[groups.length - 1] : null;
        const canMerge = prev
            && !isTargetUnread
            && !isSticker
            && !prev.isSticker
            && !isGift
            && !prev.isGift
            && prev.fromId === fromId
            && prev.isOut === isOut
            && prev.isUnread === isUnread
            && (!msgDate || !prev.lastDate || Math.abs(msgDate - prev.lastDate) < 300);

        if (canMerge) {
            prev.messages.push(msg);
            prev.lastDate = msgDate || prev.lastDate;
            if (dateStr) prev.dateStr = dateStr;
        } else {
            groups.push({
                key: `grp_${msg.id}`,
                fromId,
                isOut,
                isUnread,
                isTargetUnread,
                isSticker,
                isGift,
                authorName,
                authorAva,
                authorLink,
                date: msgDate,
                lastDate: msgDate,
                dateStr,
                messages: [msg],
            });
        }
    }
    return groups;
}

export async function installFastChatsRenderer({ html, render, commonMod, messageMod }) {
    if (installed) {
        return;
    }
    installed = true;

    let fcMod = null;
    try {
        fcMod = await imImport('./components/fastchats.js');
    } catch (e) {
        console.error('vkify16 | fastchats module load failed:', e);
    }

    const formatFastChatMessageText = (fcMod && fcMod.formatFastChatMessageText) || formatFcTextFallback;
    const formatTime = (commonMod && commonMod.formatTime) || null;
    const Attachment = (messageMod && messageMod.Attachment) || null;
    const openForwardedMessageModal = (messageMod && messageMod.openForwardedMessageModal) || null;

    let convMod = null;
    try {
        convMod = await imImport('./pages/conversations.js');
    } catch (_) {
    }
    const ConversationClass = convMod && convMod.Conversation;
    if (ConversationClass && ConversationClass.prototype) {
        if (typeof ConversationClass.prototype.setTyping === 'function' && !ConversationClass.prototype._vkifyFcSetTypingPatched) {
            ConversationClass.prototype._vkifyFcSetTypingPatched = true;
            const origSetTyping = ConversationClass.prototype.setTyping;
            ConversationClass.prototype.setTyping = async function vkifySetTyping(...args) {
                const res = await origSetTyping.apply(this, args);
                try {
                    window.im?.fastChats?.render?.();
                } catch (_) {
                }
                setTimeout(() => {
                    try {
                        window.im?.fastChats?.render?.();
                    } catch (_) {
                    }
                }, 5100);
                return res;
            };
        }
        if (typeof ConversationClass.prototype.clearTyping === 'function' && !ConversationClass.prototype._vkifyFcClearTypingPatched) {
            ConversationClass.prototype._vkifyFcClearTypingPatched = true;
            const origClearTyping = ConversationClass.prototype.clearTyping;
            ConversationClass.prototype.clearTyping = function vkifyClearTyping(...args) {
                const res = origClearTyping.apply(this, args);
                try {
                    window.im?.fastChats?.render?.();
                } catch (_) {
                }
                return res;
            };
        }
    }

    let FastChatsClass = window.im && window.im.fastChats && window.im.fastChats.constructor;
    if (!FastChatsClass || !FastChatsClass.prototype) {
        FastChatsClass = await new Promise((resolve) => {
            let tries = 0;
            const timer = setInterval(() => {
                const found = window.im && window.im.fastChats && window.im.fastChats.constructor;
                if ((found && found.prototype) || ++tries > 100) {
                    clearInterval(timer);
                    resolve(found);
                }
            }, 100);
        });
    }

    if (!FastChatsClass || !FastChatsClass.prototype) {
        console.error('vkify16 | FastChats class not found');
        return;
    }

    const origRender = FastChatsClass.prototype.render;
    const origOpenChat = FastChatsClass.prototype.openChat;
    const origToggleChat = FastChatsClass.prototype.toggleChat;
    const origToggleOnline = FastChatsClass.prototype.toggleOnlineWindow;

    // Give newly opened chats fixed docking to the right dock by default, like VK 2016
    FastChatsClass.prototype.openChat = async function vkifyOpenChat(peerId, isMinimized = false, save = true, position = null, zIndex = null) {
        const existing = this.openedChats.find((c) => Number(c.peerId) === Number(peerId));
        const hadPos = Boolean(position);
        const res = await origOpenChat.call(this, peerId, isMinimized, save, position, zIndex);
        const chat = this.openedChats.find((c) => Number(c.peerId) === Number(peerId));
        if (chat) {
            if (!existing && !hadPos) {
                chat.isFixed = true;
                chat.position = null;
            }
            if (!isMinimized && chat.isFixed !== false) {
                this.openedChats.forEach((c) => {
                    if (Number(c.peerId) !== Number(peerId) && c.isFixed !== false && !c.isMinimized) {
                        c.isMinimized = true;
                    }
                });
                if (this.onlineWindow && (!this.onlineWindow.position || this.onlineWindow.isFixed !== false)) {
                    this.onlineWindow.isOpened = false;
                }
                if (save) this.saveState();
            }
            this.render();
        }
        return res;
    };

    FastChatsClass.prototype.toggleChat = function vkifyToggleChat(peerId) {
        const chat = this.openedChats.find((c) => Number(c.peerId) === Number(peerId));
        if (!chat) return;
        const wasFixed = chat.isFixed !== false && !chat.position;
        if (wasFixed) {
            chat.isMinimized = !chat.isMinimized;
            if (!chat.isMinimized) {
                this.openedChats.forEach((c) => {
                    if (Number(c.peerId) !== Number(peerId) && c.isFixed !== false && !c.isMinimized) {
                        c.isMinimized = true;
                    }
                });
                if (this.onlineWindow && (!this.onlineWindow.position || this.onlineWindow.isFixed !== false)) {
                    this.onlineWindow.isOpened = false;
                }
                this.focusChat(peerId);
                if (chat.firstUnreadMsgId) {
                    setTimeout(() => this.scrollToUnread(peerId), 50);
                } else {
                    setTimeout(() => this.scrollToBottom(peerId), 50);
                }
                setTimeout(() => this.markChatAsRead(peerId), 150);
            } else {
                chat.isFocused = false;
            }
            this.saveState();
            this.render();
            return;
        }
        return origToggleChat.call(this, peerId);
    };

    FastChatsClass.prototype.toggleOnlineWindow = function vkifyToggleOnlineWindow() {
        const nextOpened = !this.onlineWindow.isOpened;
        if (nextOpened && (!this.onlineWindow.position || this.onlineWindow.isFixed !== false)) {
            this.openedChats.forEach((c) => {
                if (c.isFixed !== false && !c.isMinimized) {
                    c.isMinimized = true;
                }
            });
        }
        return origToggleOnline.call(this);
    };

    const VkOnlineDock = ({ fc }) => {
        const onlineWindow = fc.onlineWindow || {};
        const friends = onlineWindow.friends || [];
        const allFriends = onlineWindow.allFriends || [];
        const openedChats = fc.openedChats || [];
        const onlineCount = friends.length;

        const anyFixedActive = (onlineWindow.isOpened && !onlineWindow.position)
            || openedChats.some((c) => !c.isMinimized && c.isFixed !== false && !c.position);

        const wrapCls = [
            'chat_onl_wrap',
            openedChats.length > 0 ? 'chat_expand' : '',
            anyFixedActive ? 'chat_active' : '',
        ].filter(Boolean).join(' ');

        return html`
            <div id="chat_onl_wrap" class=${wrapCls} style="display: block;">
                <div class="chat_tt_wrap"></div>
                <div class="chat_onl_inner">
                    <div class="chat_cont_scrolling" style=${openedChats.length > 5 ? 'max-height: 260px; overflow-y: auto;' : ''}>
                        <div class="chat_onl_height">
                            ${openedChats.map((chat) => {
                                const peerId = chat.peerId;
                                const friend = allFriends.find((f) => Number(f.id) === Number(peerId))
                                    || friends.find((f) => Number(f.id) === Number(peerId));
                                const isOnline = Boolean(friend && (friend.online === 1 || friend.online === true));
                                const isMobileOnline = Boolean(isOnline && friend?.last_seen?.platform && friend.last_seen.platform !== 7);
                                const ava = chat.photo || friend?.photo_50 || '/assets/packages/static/openvk/img/camera_50.png';
                                const href = Number(peerId) >= 2000000000
                                    ? `/im?sel=${peerId}`
                                    : (Number(peerId) < 0 ? `/club${Math.abs(peerId)}` : `/id${peerId}`);
                                const imgContCls = [
                                    'chat_tab_imgcont',
                                    '_chat_tab_image',
                                    isOnline ? 'online' : '',
                                    isMobileOnline ? 'mobile' : '',
                                ].filter(Boolean).join(' ');
                                const unread = Number(chat.unreadCount || 0);
                                const conv = window.im?.conversations?._findConv?.(peerId);
                                const activity = conv && typeof conv.getActivityMsg === 'function' ? conv.getActivityMsg() : null;
                                const isTyping = Boolean(activity && activity[1] && activity[1].length > 0);

                                return html`
                                    <a
                                        key=${`dock_${peerId}`}
                                        class="chat_tab_wrap"
                                        id=${`chat_tab_icon_${peerId}`}
                                        href=${href}
                                        data-tip="simple-black"
                                        data-align="left"
                                        data-tiptitle=${chat.title || ''}
                                        onClick=${(e) => {
                                            if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                fc.toggleChat(peerId);
                                            }
                                        }}
                                    >
                                        <div class=${imgContCls}>
                                            <div
                                                class="chat_tab_close"
                                                onClick=${(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    fc.closeChat(peerId);
                                                }}
                                            ></div>
                                            <img class="chat_tab_img" src=${ava} alt=${chat.title || ''} />
                                        </div>
                                        <div class="chat_tab_typing_wrap" style=${isTyping ? 'display: block;' : ''}>
                                            <div class="chats_sp chat_tab_typing_icon"></div>
                                        </div>
                                        ${unread > 0 ? html`<div class="chat_tab_counter">${unread}</div>` : null}
                                    </a>
                                `;
                            })}
                        </div>
                    </div>
                    <div class="chat_cont_sh_top"></div>
                    <div class="chat_cont_sh_bottom"></div>
                    <a
                        class="chat_tab_wrap fc_online_tab_pinned ${onlineWindow.isFocused ? 'fc_focused' : ''}"
                        id="chat_tab_wrap"
                        onClick=${(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fc.toggleOnlineWindow();
                        }}
                    >
                        <div class="chat_onl_cont">
                            <div class="chat_onl fc_online_tab_label" id="chat_onl">${onlineCount}</div>
                        </div>
                    </a>
                </div>
            </div>
        `;
    };

    const VkClistWindow = ({ fc }) => {
        const tr = typeof window.tr === 'function' ? window.tr : (k) => k;
        const onlineWindow = fc.onlineWindow || {};
        if (!onlineWindow.isOpened) {
            return null;
        }

        const friends = onlineWindow.friends || [];
        const allFriends = onlineWindow.allFriends || [];
        const showAll = Boolean(onlineWindow.showAll);
        const searchQuery = onlineWindow.searchQuery || '';
        const position = onlineWindow.position;
        const zIndex = onlineWindow.zIndex || 10000;
        const isFocused = Boolean(onlineWindow.isFocused);
        const openedChats = fc.openedChats || [];
        const onlineCount = friends.length;

        const baseList = (searchQuery || showAll)
            ? (allFriends.length > 0 ? allFriends : friends)
            : friends;

        const filteredFriends = baseList.filter((f) => {
            if (!searchQuery) return true;
            const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        });

        const isFixed = !position;
        const toBottom = isFixed || Boolean(onlineWindow.toBottom);
        const boxStyle = position
            ? `position: fixed; left: ${position.x}px; top: ${position.y}px; z-index: ${zIndex}; margin: 0; display: block;`
            : `position: fixed; bottom: 0px; right: 72px; z-index: ${zIndex}; margin: 0; display: block;`;

        const wrapCls = [
            'rb_box_wrap',
            'fixed',
            'fc_friends_window',
            isFixed ? 'fc_fixed' : '',
            isFocused ? 'rb_active fc_focused' : 'rb_inactive',
            toBottom ? 'fc_tobottom' : '',
        ].filter(Boolean).join(' ');

        const unpinClist = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const x = Math.max(10, window.innerWidth - 72 - 270 - 10);
            const y = Math.max(10, window.innerHeight - 367);
            onlineWindow.isFixed = false;
            onlineWindow.toBottom = true;
            fc.moveOnline({ x, y });
        };

        return html`
            <div
                id="rb_box_fc_clist"
                class=${wrapCls}
                style=${boxStyle}
                onClick=${() => fc.focusOnline()}
            >
                <div id="fc_clist" class="fc_tab_wrap ${toBottom ? 'fc_tobottom' : ''}" style="width: 270px;">
                    <div
                        class="fc_tab_head fc_head"
                        onMouseDown=${(e) => handleHeaderDrag(
                            e,
                            position,
                            () => fc.focusOnline(),
                            (pos) => {
                                onlineWindow.isFixed = false;
                                onlineWindow.toBottom = Boolean(pos.toBottom);
                                fc.moveOnline({ x: pos.x, y: pos.y });
                            },
                            null
                        )}
                    >
                        <a
                            class="fc_tab_close_wrap fc_head_close"
                            onClick=${(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                fc.closeOnlineWindow();
                            }}
                        >
                            <div class="chats_sp fc_tab_close"></div>
                        </a>
                        ${isFixed ? html`
                            <a
                                class="fc_tab_pin_wrap"
                                onMouseDown=${(e) => e.stopPropagation()}
                                onClick=${unpinClist}
                            >
                                <div class="chats_sp fc_tab_pin"></div>
                            </a>
                        ` : null}
                        <div class="fc_tab_title fc_head_title noselect">${tr('friends_online_count', onlineCount)}</div>
                    </div>
                    <div id="fc_ctabs_cont">
                        <div class="fc_ctab fc_ctab_active">
                            <div class="fc_contacts_wrap">
                                <div id="fc_contacts" class="fc_contacts fc_friends_list" style="height: 299px;">
                                    ${filteredFriends.length > 0 ? filteredFriends.map((f) => {
                                        const fullName = `${f.first_name || ''} ${f.last_name || ''}`.trim();
                                        const isOnline = f.online === 1 || f.online === true;
                                        const isMobileOnline = Boolean(isOnline && f.last_seen?.platform && f.last_seen.platform !== 7);
                                        const opened = openedChats.find((c) => Number(c.peerId) === Number(f.id));
                                        const conv = window.im?.conversations?._findConv && window.im.conversations._findConv(f.id);
                                        const unreadCount = opened ? (opened.unreadCount || 0) : Number(conv?.unread_count || 0);
                                        const photoCls = [
                                            'fc_contact_photo',
                                            isOnline ? 'online' : '',
                                            isMobileOnline ? 'mobile' : '',
                                        ].filter(Boolean).join(' ');

                                        return html`
                                            <a
                                                key=${f.id}
                                                href="/id${f.id}"
                                                id=${`fc_contact${f.id}`}
                                                class="fc_contact fc_friend_row clear_fix"
                                                onClick=${(e) => {
                                                    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        fc.onOnlineFriendClick(f);
                                                    }
                                                }}
                                            >
                                                <span
                                                    class=${photoCls}
                                                    onClick=${(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (window.router && typeof window.router.route === 'function') {
                                                            window.router.route(`/id${f.id}`);
                                                        } else {
                                                            window.location.href = `/id${f.id}`;
                                                        }
                                                    }}
                                                >
                                                    <img
                                                        src=${f.photo_50 || '/assets/packages/static/openvk/img/camera_50.png'}
                                                        class="fc_contact_photo fc_avatar"
                                                    />
                                                </span>
                                                <span class="fc_contact_status"></span>
                                                <span class="fc_contact_name fc_name">
                                                    ${renderHighlightedName(html, fullName, searchQuery)}
                                                    <span id=${`fc_contact_unread${f.id}`} class="fc_contact_unread">
                                                        ${unreadCount > 0 ? html` <b>+${unreadCount}</b>` : ''}
                                                    </span>
                                                </span>
                                            </a>
                                        `;
                                    }) : html`
                                        <div class="fc_clist_empty fc_friends_hint">
                                            ${tr('fastchat_search_hint')}
                                        </div>
                                    `}
                                </div>
                            </div>
                            <div
                                class="fc_clist_filter_wrap fc_search_wrap"
                                onClick=${(e) => {
                                    e.stopPropagation();
                                    const inp = e.currentTarget.querySelector('#fc_clist_filter');
                                    if (inp) inp.focus();
                                }}
                            >
                                <div class="chats_sp fc_clist_search_icon"></div>
                                <div class="fc_clist_online_wrap">
                                    <div
                                        class="fc_clist_online fc_toggle_offline_btn ${!showAll ? 'fc_clist_online_active' : ''}"
                                        data-tip="simple-black"
                                        data-align="top"
                                        data-tiptitle=${!showAll
                                            ? tr('show_all_friends', allFriends.length || onlineCount)
                                            : tr('show_online_only', onlineCount)}
                                        onClick=${(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            fc.toggleShowAllOnline();
                                        }}
                                    ></div>
                                </div>
                                <div class="fc_clist_filter">
                                    <input
                                        type="text"
                                        class="dark fc_search_input"
                                        id="fc_clist_filter"
                                        placeholder=${tr('start_typing_name')}
                                        value=${searchQuery}
                                        onInput=${(e) => fc.onOnlineSearch(e.target.value)}
                                        onKeyDown=${(e) => {
                                            if (e.key === 'Escape') {
                                                e.stopPropagation();
                                                if (searchQuery) {
                                                    fc.onOnlineSearch('');
                                                } else {
                                                    fc.closeOnlineWindow();
                                                }
                                            } else if (e.key === 'Enter' && filteredFriends.length > 0) {
                                                e.preventDefault();
                                                fc.onOnlineFriendClick(filteredFriends[0]);
                                            }
                                        }}
                                        onClick=${(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="fc_pointer_offset" style="bottom: 28px;">
                        <div class="fc_tab_pointer"></div>
                    </div>
                </div>
            </div>
        `;
    };

    const VkChatWindow = ({ fc, chat }) => {
        const tr = typeof window.tr === 'function' ? window.tr : (k) => k;
        const peerId = chat.peerId;
        const isFixed = chat.isFixed !== false && !chat.position;

        if (chat.isMinimized && isFixed) {
            return null;
        }

        const zIndex = chat.zIndex || 10000;
        const isFocused = Boolean(chat.isFocused);
        const toBottom = isFixed || Boolean(chat.toBottom !== false);
        const boxW = chat.width || 270;
        const logH = chat.height || 250;

        let pointerBottom = 68;
        if (isFixed && typeof document !== 'undefined') {
            const iconEl = document.getElementById(`chat_tab_icon_${peerId}`);
            if (iconEl) {
                const rect = iconEl.getBoundingClientRect();
                if (rect.height > 0) {
                    pointerBottom = Math.max(36, Math.round(window.innerHeight - rect.top - rect.height / 2 - 4));
                }
            }
        }

        let boxStyle;
        if (isFixed) {
            boxStyle = `position: fixed; bottom: 0px; right: 72px; z-index: ${zIndex}; margin: 0; display: block;`;
        } else if (chat.isMinimized) {
            const left = chat.position ? chat.position.x : Math.max(10, window.innerWidth - 360);
            boxStyle = `position: fixed; left: ${left}px; bottom: 0px; z-index: ${zIndex}; margin: 0; display: block;`;
        } else if (chat.position) {
            boxStyle = `position: fixed; left: ${chat.position.x}px; top: ${chat.position.y}px; z-index: ${zIndex}; margin: 0; display: block;`;
        } else {
            boxStyle = `position: fixed; bottom: 0px; right: 72px; z-index: ${zIndex}; margin: 0; display: block;`;
        }

        const wrapCls = [
            'rb_box_wrap',
            'fixed',
            'fc_chat_box',
            isFixed ? 'fc_fixed' : '',
            chat.isMinimized ? 'rb_minimized fc_tab_minimized' : '',
            isFocused ? 'rb_active fc_focused' : 'rb_inactive',
            toBottom ? 'fc_tobottom' : '',
        ].filter(Boolean).join(' ');

        const unpinChat = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const x = Math.max(10, window.innerWidth - 72 - boxW - 10);
            const y = Math.max(10, window.innerHeight - (logH + 68));
            chat.isFixed = false;
            chat.toBottom = true;
            fc.moveChat(peerId, { x, y });
        };

        const groups = groupMessagesForVk(chat.messages || [], fc.currentUserId, chat, fc.currentUserAvatar, formatTime);
        const unread = Number(chat.unreadCount || 0);
        const conv = window.im?.conversations?._findConv?.(peerId);
        const activity = conv && typeof conv.getActivityMsg === 'function' ? conv.getActivityMsg() : null;
        const isTyping = Boolean(activity && activity[1] && activity[1].length > 0);
        const typingText = isTyping ? String(activity[0] || '').replace(/\.\.\.$/, '') : '';

        return html`
            <div
                id=${`rb_box_fc_peer${peerId}`}
                class=${wrapCls}
                data-peer-id=${peerId}
                style=${boxStyle}
                onClick=${() => fc.focusChat(peerId)}
            >
                <div class="fc_tab_wrap ${toBottom ? 'fc_tobottom' : ''}" style=${`width: ${boxW}px;`}>
                    <div
                        class="fc_tab_head fc_head clear_fix"
                        onMouseDown=${(e) => handleHeaderDrag(
                            e,
                            chat.position,
                            () => fc.focusChat(peerId),
                            (pos) => {
                                chat.isFixed = false;
                                chat.toBottom = Boolean(pos.toBottom);
                                fc.moveChat(peerId, { x: pos.x, y: pos.y });
                            },
                            () => {
                                if (!isFixed || chat.isMinimized) {
                                    fc.toggleChat(peerId);
                                }
                            }
                        )}
                    >
                        <a
                            class="fc_tab_close_wrap fc_head_close"
                            onClick=${(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                fc.closeChat(peerId);
                            }}
                        >
                            <div class="chats_sp fc_tab_close"></div>
                        </a>
                        <a
                            class="fc_tab_max_wrap fc_head_openfull"
                            href="/im?sel=${peerId}"
                            title=${tr('go_to_dialog')}
                            onMouseDown=${(e) => e.stopPropagation()}
                            onClick=${(e) => handleOpenFull(e, peerId)}
                        >
                            <div class="chats_sp fc_tab_max"></div>
                        </a>
                        ${isFixed ? html`
                            <a
                                class="fc_tab_pin_wrap"
                                onMouseDown=${(e) => e.stopPropagation()}
                                onClick=${unpinChat}
                            >
                                <div class="chats_sp fc_tab_pin"></div>
                            </a>
                        ` : null}
                        <div class="fc_tab_title fc_head_title noselect">
                            ${chat.title}
                            ${unread > 0 ? html` <span class="fc_tab_count">(${unread})</span>` : null}
                        </div>
                    </div>

                    ${!chat.isMinimized ? html`
                        <div class="fc_tab">
                            <div class="fc_tab_log_wrap">
                                <div class="fc_tab_notify_wrap"></div>
                                <div
                                    class="fc_tab_log fc_messages_list"
                                    id=${`fc_messages_${peerId}`}
                                    style=${`height: ${logH}px;`}
                                    onScroll=${() => {
                                        if (window.im?.fastChats) {
                                            window.im.fastChats.markChatAsRead(peerId);
                                        }
                                    }}
                                >
                                    <div class="fc_tab_log_msgs _fc_tab_log_msgs">
                                        ${chat.hasMore ? html`
                                            <div
                                                class="fc_load_more _fc_msgs_more ${chat.isLoadingOlder ? 'fc_loading' : ''}"
                                                onClick=${() => !chat.isLoadingOlder && fc.loadOlderMessages(peerId)}
                                            >
                                                ${chat.isLoadingOlder ? tr('loading') : tr('show_previous_messages')}
                                            </div>
                                        ` : null}

                                        ${chat.isLoading && groups.length === 0 ? html`
                                            <div class="fc_loading_state">
                                                <div class="pr pr_medium" style="opacity: 1;">
                                                    <div class="pr_bt"></div>
                                                    <div class="pr_bt"></div>
                                                    <div class="pr_bt"></div>
                                                </div>
                                            </div>
                                        ` : null}

                                        ${!chat.isLoading && groups.length === 0 ? html`
                                            <div class="fc_log_empty fc_empty_history" id=${`fc_log_empty${peerId}`}>
                                                ${tr('no_messages_in_dialog')}
                                            </div>
                                        ` : null}

                                        ${groups.map((grp) => {
                                            const wrapCls = [
                                                'fc_msgs_wrap',
                                                'clear_fix',
                                                grp.isOut ? 'fc_msgs_out' : '',
                                                grp.isUnread ? 'fc_msgs_unread' : '',
                                                grp.isSticker ? 'fc_msg_sticker' : '',
                                                grp.isGift ? 'msg-gift' : '',
                                            ].filter(Boolean).join(' ');

                                            const firstMsg = grp.messages[0];
                                            const senderGender = firstMsg?.sender?.getGender
                                                ? firstMsg.sender.getGender()
                                                : (firstMsg?.sender?.sex === 1 ? 'female' : (firstMsg?.sender?.sex === 2 ? 'male' : 'neutral'));

                                            const bubbleContent = html`
                                                <div class="fc_msgs">
                                                    ${grp.isGift ? html`
                                                        <div class="fc_msg_postfix">
                                                            ${tr('msg_sent_gift_' + senderGender).toLowerCase()}:
                                                        </div>
                                                    ` : null}
                                                    <div class="fc_msgs_list">
                                                        ${grp.messages.map((msg, idx) => {
                                                            const isLast = idx === grp.messages.length - 1;
                                                            const msgUnread = !grp.isOut && (msg.read_state === 0 || msg.read_state === false || msg.unread === 1);
                                                            const msgCls = [
                                                                'fc_msg',
                                                                'fc_msg_row',
                                                                msgUnread ? 'fc_msg_unread' : '',
                                                                isLast ? 'fc_msg_last' : '',
                                                            ].filter(Boolean).join(' ');

                                                            const replyMessage = msg.reply_message || msg.data?.reply_message || null;
                                                            let replyFromId = null;
                                                            let replyAuthorName = '...';
                                                            let replyAuthorAvatar = '/assets/packages/static/openvk/img/camera_50.png';
                                                            let replyDateStr = '';
                                                            let replyHtml = '';
                                                            if (replyMessage) {
                                                                replyFromId = replyMessage.from_id || replyMessage.data?.from_id;
                                                                const replySender = replyMessage.sender
                                                                    || replyMessage.data?.sender
                                                                    || (window.im?.cached_profiles?._findCachedProfileByIdEvenIfNotCached?.(replyFromId));
                                                                if (replySender && typeof replySender.getName === 'function') {
                                                                    replyAuthorName = replySender.getName();
                                                                    if (typeof replySender.getAvatar === 'function') {
                                                                        replyAuthorAvatar = replySender.getAvatar('mid', false) || replyAuthorAvatar;
                                                                    }
                                                                } else if (replyFromId) {
                                                                    replyAuthorName = 'id' + replyFromId;
                                                                }
                                                                const repTs = replyMessage.date || replyMessage.data?.date || (typeof replyMessage.getSentTime === 'function' ? replyMessage.getSentTime() : null);
                                                                replyDateStr = formatFcReplyDate(repTs, formatTime);
                                                                if (typeof replyMessage.getText === 'function') {
                                                                    replyHtml = replyMessage.getText(false);
                                                                } else {
                                                                    replyHtml = formatFastChatMessageText(replyMessage.text || replyMessage.body || replyMessage.data?.text || '');
                                                                }
                                                            }
                                                            const replyHref = replyFromId ? (Number(replyFromId) < 0 ? `/club${Math.abs(replyFromId)}` : `/id${replyFromId}`) : 'javascript:void(0)';

                                                            const fwdMessages = msg.fwd_messages
                                                                || msg.data?.fwd_messages
                                                                || (typeof msg.getFwdMessages === 'function' ? msg.getFwdMessages() : null);
                                                            const attachmentsList = Array.isArray(msg.attachments)
                                                                ? msg.attachments
                                                                : (Array.isArray(msg.data?.attachments) ? msg.data.attachments : []);
                                                            const msgForAttachment = ensureAttachmentMsg(msg);
                                                            const htmlText = typeof msg.getText === 'function'
                                                                ? msg.getText(false)
                                                                : formatFastChatMessageText(msg.text || msg.body || (msg.data && (msg.data.text || msg.data.body)) || '');

                                                            return html`
                                                                <div
                                                                    key=${msg.id}
                                                                    id=${`fc_msg${msg.id}`}
                                                                    class=${msgCls}
                                                                    data-msg-id=${msg.id}
                                                                >
                                                                    ${replyMessage ? html`
                                                                        <div
                                                                            class="reply-msg-container"
                                                                            onClick=${(e) => {
                                                                                e.stopPropagation();
                                                                                if (typeof openForwardedMessageModal === 'function') {
                                                                                    openForwardedMessageModal(replyMessage);
                                                                                } else {
                                                                                    handleOpenFull(e, peerId);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <div class="reply-msg-head">
                                                                                <a
                                                                                    href=${replyHref}
                                                                                    target="_blank"
                                                                                    class="reply-avatar-link"
                                                                                    onClick=${(e) => e.stopPropagation()}
                                                                                >
                                                                                    <img class="reply-avatar" src=${replyAuthorAvatar} alt=${replyAuthorName} />
                                                                                </a>
                                                                                <a
                                                                                    href=${replyHref}
                                                                                    target="_blank"
                                                                                    class="reply-author-name"
                                                                                    onClick=${(e) => e.stopPropagation()}
                                                                                >
                                                                                    ${replyAuthorName}
                                                                                </a>
                                                                                ${replyDateStr ? html`<span class="reply-date">${replyDateStr}</span>` : null}
                                                                            </div>
                                                                            <div
                                                                                class="reply-text"
                                                                                dangerouslySetInnerHTML=${{ __html: replyHtml || tr('attachment') }}
                                                                            />
                                                                        </div>
                                                                    ` : null}
                                                                    <div
                                                                        class="fc_msg_text"
                                                                        dangerouslySetInnerHTML=${{ __html: htmlText }}
                                                                    />
                                                                    ${fwdMessages && fwdMessages.length > 0 ? html`
                                                                        <div class="fwd-messages-container">
                                                                            ${fwdMessages.map((fwd, fIdx) => {
                                                                                const fwdFromId = fwd.from_id || fwd.data?.from_id;
                                                                                const fwdHref = fwdFromId ? (Number(fwdFromId) < 0 ? `/club${Math.abs(fwdFromId)}` : `/id${fwdFromId}`) : 'javascript:void(0)';
                                                                                const fwdSender = fwd.sender
                                                                                    || fwd.data?.sender
                                                                                    || (window.im?.cached_profiles?._findCachedProfileByIdEvenIfNotCached?.(fwdFromId));
                                                                                const fwdName = fwdSender?.getName
                                                                                    ? fwdSender.getName()
                                                                                    : (fwdFromId ? 'id' + fwdFromId : '...');
                                                                                const fwdAva = fwdSender?.getAvatar
                                                                                    ? fwdSender.getAvatar('mid', false)
                                                                                    : '/assets/packages/static/openvk/img/camera_50.png';
                                                                                const fwdTs = fwd.date || fwd.data?.date || (typeof fwd.getSentTime === 'function' ? fwd.getSentTime() : null);
                                                                                const fwdDateStr = typeof fwd.getDate === 'function' ? fwd.getDate(0) : formatFcReplyDate(fwdTs, formatTime);
                                                                                const fwdHtml = typeof fwd.getText === 'function'
                                                                                    ? fwd.getText(false)
                                                                                    : formatFastChatMessageText(fwd.text || fwd.body || fwd.data?.text || '');
                                                                                const fwdAtts = fwd.attachments || fwd.data?.attachments || (typeof fwd.getAttachments === 'function' ? fwd.getAttachments() : []);
                                                                                const fwdForAttachment = ensureAttachmentMsg(fwd);
                                                                                return html`
                                                                                    <div class="fwd-message-block" key=${fIdx}>
                                                                                        <div class="fwd-message-head">
                                                                                            <a href=${fwdHref} target="_blank" class="fwd-avatar-link">
                                                                                                <img class="fwd-avatar" src=${fwdAva} alt=${fwdName} />
                                                                                            </a>
                                                                                            <div class="fwd-author-info">
                                                                                                <a class="fwd-author-name" href=${fwdHref} target="_blank">${fwdName}</a>
                                                                                                ${fwdDateStr ? html`<span class="fwd-date">${fwdDateStr}</span>` : null}
                                                                                            </div>
                                                                                        </div>
                                                                                        ${fwdHtml ? html`
                                                                                            <div
                                                                                                class="fwd-text"
                                                                                                dangerouslySetInnerHTML=${{ __html: fwdHtml }}
                                                                                            />
                                                                                        ` : null}
                                                                                        ${Attachment && fwdAtts.length > 0 ? html`
                                                                                            <div class="fc_msg_attachments fc_attachments_wrap">
                                                                                                ${fwdAtts.map((att) => html`
                                                                                                    <div class="fc_attachment_row" key=${att.type + (att[att.type]?.id || '')}>
                                                                                                        <${Attachment} msg=${fwdForAttachment} att=${att} />
                                                                                                    </div>
                                                                                                `)}
                                                                                            </div>
                                                                                        ` : null}
                                                                                    </div>
                                                                                `;
                                                                            })}
                                                                        </div>
                                                                    ` : null}
                                                                    ${Attachment && attachmentsList.length > 0 ? html`
                                                                        <div class="fc_msg_attachments fc_attachments_wrap ${!htmlText ? 'fc_msg_attachments_notext' : ''}">
                                                                            ${attachmentsList.map((att) => html`
                                                                                <div class="fc_attachment_row" key=${att.type + (att[att.type]?.id || '')}>
                                                                                    <${Attachment} msg=${msgForAttachment} att=${att} />
                                                                                </div>
                                                                            `)}
                                                                        </div>
                                                                    ` : null}
                                                                </div>
                                                            `;
                                                        })}
                                                    </div>
                                                    ${grp.dateStr ? html`<div class="fc_msgs_date">${grp.dateStr}</div>` : null}
                                                </div>
                                            `;

                                            return html`
                                                ${grp.isTargetUnread ? html`
                                                    <div class="fc_unread_divider" id=${`fc_unread_${peerId}`} key=${`unread_${grp.key}`}>
                                                        <span class="fc_unread_divider_text">${tr('unread_messages')}</span>
                                                    </div>
                                                ` : null}
                                                <div
                                                    key=${grp.key}
                                                    class=${wrapCls}
                                                    data-from=${grp.fromId}
                                                    data-date=${grp.date}
                                                >
                                                    ${grp.isOut ? html`
                                                        <div class="fc_msgs_out_inner">
                                                            <div class="fc_msgs_inner">
                                                                ${bubbleContent}
                                                            </div>
                                                        </div>
                                                    ` : html`
                                                        <div class="fc_msgs_inner">
                                                            <div class="fc_msgs_author">
                                                                <a
                                                                    class="fc_msgs_img"
                                                                    href=${grp.authorLink}
                                                                    style=${`background-image: url('${grp.authorAva}');`}
                                                                    title=${grp.authorName}
                                                                ></a>
                                                            </div>
                                                            ${bubbleContent}
                                                        </div>
                                                    `}
                                                </div>
                                            `;
                                        })}
                                    </div>
                                    <div
                                        class="fc_tab_typing ${isTyping ? 'fc_tab_typing_shown' : ''}"
                                        id=${`fc_tab_typing${peerId}`}
                                        style=${isTyping ? 'opacity: 1;' : 'opacity: 0;'}
                                    >
                                        <div
                                            class="pr fc_tab_typing_icon _fc_tab_typing_progress"
                                            style=${isTyping ? 'display: block;' : 'display: none;'}
                                        >
                                            <div class="pr_bt"></div>
                                            <div class="pr_bt"></div>
                                            <div class="pr_bt"></div>
                                        </div>
                                        <div class="fc_tab_typing_name _fc_tab_typing_name">${typingText}</div>
                                    </div>
                                </div>
                            </div>

                            ${chat.canWrite === false ? html`
                                <div class="fc_tab_txt_wrap fc_input_bar fc_cant_write_bar">
                                    <div class="fc_cant_write_text">${chat.cantWriteText || tr('cannot_write_default')}</div>
                                </div>
                            ` : html`
                                <div class="fc_tab_txt_wrap fc_input_bar">
                                    <div class="fc_tab_txt">
                                        <div class="emoji_cont _emoji_field_wrap">
                                            <div class="emoji_smile_wrap">
                                                <div class="fc_emoji_btn emoji_picker_entrypoint emoji_smile" title=${tr('smiles')}>
                                                    <div class="emoji_smile_icon_vector emoji_smile_icon"></div>
                                                </div>
                                            </div>
                                            <textarea
                                                class="fc_editable fc_textarea dark"
                                                placeholder=${tr('enter_your_message')}
                                                value=${chat.text || ''}
                                                onInput=${(e) => {
                                                    fc.onTextChange(peerId, e.target.value);
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = Math.min(80, Math.max(28, e.target.scrollHeight)) + 'px';
                                                }}
                                                onKeyDown=${(e) => fc.onKeyDown(e, peerId)}
                                                onFocus=${() => fc.focusChat(peerId)}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            `}
                        </div>
                    ` : null}

                    <div class="fc_pointer_offset" style=${`bottom: ${pointerBottom}px;`}>
                        <div class="fc_tab_pointer fc_tab_pointer_peer"></div>
                    </div>
                </div>
                ${!isFixed && !chat.isMinimized ? html`
                    <div
                        class="rb_resize_wrap"
                        onMouseDown=${(e) => handleResizeDrag(
                            e,
                            boxW,
                            logH,
                            () => fc.focusChat(peerId),
                            ({ width, height }) => {
                                chat.width = width;
                                chat.height = height;
                                fc.render();
                            }
                        )}
                    >
                        <div class="chats_sp rb_resize"></div>
                    </div>
                ` : null}
            </div>
        `;
    };

    FastChatsClass.prototype.render = function vkifyFastChatsRender() {
        try {
            const container = document.querySelector('#fastchats_container');
            if (!container) return;

            if (!this.shouldBeShown()) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';

            render(html`
                <div class="vkify_fc_root">
                    <${VkOnlineDock} fc=${this} />
                    <${VkClistWindow} fc=${this} />
                    ${(this.openedChats || []).map((chat) => html`
                        <${VkChatWindow} key=${chat.peerId} fc=${this} chat=${chat} />
                    `)}
                </div>
            `, container);

            try {
                window.vkify?.simpleTooltips?.init?.(container);
            } catch (_) {
            }
        } catch (e) {
            console.error('vkify16 | fastchats render failed, falling back to upstream:', e);
            if (typeof origRender === 'function') {
                return origRender.call(this);
            }
        }
    };

    if (window.im?.fastChats && window.im.fastChats.isInserted) {
        window.im.fastChats.render();
    }
}
