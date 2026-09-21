import { imImport, fallbackReplySnippet, fallbackEmojiHex, fallbackRecentSmiles, fallbackRecentSmileClick, fallbackPeerAvatar, ensureVideoPreviews, syncBodyNoScroll, isCompactMode } from './shared.js';
import { isMobileViewport } from './mobile-mode.js';
import { createPeerInfoView } from './components/peer-info-view.js';
import { createPinnedMessageBar } from './components/pinned-message-bar.js';
import { createAttachmentMenu } from './components/attachment-menu.js';
import { createInputArea } from './components/input-area.js';
import { createStockInputArea } from './components/input-area-stock.js';
import { installClassicTabBar } from './components/classic-tab-bar.js';
import { installConversationsRenderer } from './components/conversations-page.js';

let installed = false;

let lastRenderError = null;

function logRenderErrorOnce(prefix, e) {
    const key = String(prefix) + ' :: ' + String((e && e.message) || e);
    if (key === lastRenderError) {
        return;
    }
    lastRenderError = key;
    console.error(prefix, e);
}

export async function installMessengerRenderer() {
    if (installed) {
        return;
    }
    installed = true;

    const moduleUrls = [
        './pages/messenger.js',
        './components/message.js',
        './components/common.js',
        './components/render.js',
        '../node_modules/preact/dist/preact.mjs',
    ];
    const results = await Promise.allSettled(moduleUrls.map((u) => imImport(u)));
    const [messengerPagesMod, messageMod, commonMod, renderMod, preactMod] = results.map((r, i) => {
        if (r.status === 'rejected') {
            console.error('vkify16 | Failed to load', moduleUrls[i], ':', r.reason && r.reason.message, r.reason);
            return null;
        }
        return r.value;
    });

    const { MessengerPage } = messengerPagesMod || {};
    const { MessageListView } = messageMod || {};
    const { ActionsBar, ErrorConversation, MentionAutocomplete } = commonMod || {};
    const {
        PeerAvatar: UpstreamPeerAvatar,
        getReplySnippet: upstreamReplySnippet,
        getEmojiHex: upstreamEmojiHex,
        getDisplayRecentSmiles: upstreamRecentSmiles,
        onRecentSmileClick: upstreamRecentSmileClick,
    } = commonMod || {};
    const { html, render } = renderMod || {};
    const { h, Fragment } = preactMod || {};

    if (!MessengerPage || !MessageListView || !ActionsBar || !ErrorConversation || !html || !render || !h || !Fragment) {
        console.error('vkify16 | messenger renderer aborted: module exports missing', {
            messengerPagesMod, messageMod, commonMod, renderMod, preactMod,
        });
        return;
    }

    const origMessengerRender = MessengerPage.prototype.render;
    const origGetCurrentAttachments = MessengerPage.prototype.getCurrentAttachments;

    const getReplySnippet = upstreamReplySnippet || fallbackReplySnippet;
    const getEmojiHex = upstreamEmojiHex || fallbackEmojiHex;
    const getDisplayRecentSmiles = upstreamRecentSmiles || fallbackRecentSmiles;
    const onRecentSmileClick = upstreamRecentSmileClick || fallbackRecentSmileClick;
    const PeerAvatar = UpstreamPeerAvatar || (({ className = '', onClick = null }) => fallbackPeerAvatar({ html, className, onClick }));

    const tr = (typeof window.tr === 'function' ? window.tr : (key) => key);

    const AttachmentMenu = createAttachmentMenu({ html, tr });
    const VkInputArea = createInputArea({ html, tr, AttachmentMenu, getReplySnippet, getEmojiHex, MentionAutocomplete });
    const StockInputArea = createStockInputArea({ html, tr, getDisplayRecentSmiles, onRecentSmileClick, getEmojiHex, getReplySnippet, PeerAvatar, MentionAutocomplete });
    const PeerInfoView = createPeerInfoView({ html, tr });
    const PinnedMessageBar = createPinnedMessageBar({ html, tr });

    const use2018 = window.vkify ? window.vkify.getSetting('mode2018') : false;
    const InputAreaComponent = (use2018 || isMobileViewport()) ? VkInputArea : StockInputArea;

    await installClassicTabBar({ html, render, commonMod });
    await installConversationsRenderer({ html, render, h, Fragment, commonMod });

    MessengerPage.prototype.render = async function vkifyMessengerPageRender(container, options = {}, messenger = null) {
        if (!container) {
            console.error('vkify16 | MessengerPage.render called without container');
            return;
        }

        const orig_messenger = messenger || window.im?.messenger;
        if (!orig_messenger) {
            console.error('vkify16 | MessengerPage.render: no messenger');
            return;
        }

        try {
            const result = await vkifyRenderMessenger.call(this, container, options, orig_messenger, {
                html, render, h, Fragment, ErrorConversation, MessageListView,
                ActionsBar, PeerInfoView, PinnedMessageBar, InputAreaComponent,
            });
            lastRenderError = null;
            return result;
        } catch (e) {
            logRenderErrorOnce('vkify16 | messenger render failed, falling back to upstream:', e);
            try {
                render(null, container);
            } catch (_) {
            }
            if (typeof origMessengerRender === 'function') {
                try {
                    const fallbackResult = await origMessengerRender.call(this, container, options, messenger);
                    lastRenderError = null;
                    return fallbackResult;
                } catch (e2) {
                    logRenderErrorOnce('vkify16 | upstream fallback render also failed:', e2);
                }
            }
        }
    };

    function peerTabsSignature(messenger) {
        try {
            const tabs = Array.isArray(messenger && messenger.opened_tabs) ? messenger.opened_tabs : [];
            const ids = tabs.map((t) => {
                const id = (t && t.peer && t.peer.id != null) ? t.peer.id : ((t && t.id != null) ? t.id : '');
                return String(id);
            });
            return ids.join(',') + '|' + String(messenger && messenger.currentChatId != null ? messenger.currentChatId : '');
        } catch (e) {
            return '';
        }
    }

    async function vkifyRenderMessenger(container, options, orig_messenger, deps) {
        const { html, render, h, Fragment, ErrorConversation, MessageListView, ActionsBar, PeerInfoView, PinnedMessageBar, InputAreaComponent } = deps;
        try {
            orig_messenger.currentDraft = this.getCurrentText() || '';
        } catch (e) {
        }
        syncBodyNoScroll();

        this.getNode().addClass('page-other');

        const currentConv = orig_messenger.getCurrentChat();
        if (!currentConv) {
            render(html`<${ErrorConversation} />`, container);
            return;
        }

        const peer = currentConv.peer;
        const sp = currentConv.getScrollPosition();
        let messages = null;
        if (peer && typeof peer.isMessagesInited === 'function' && peer.isMessagesInited() && sp) {
            messages = sp.getDayDividedMessages();
        }
        ensureVideoPreviews(messages);

        const isSavedMessages = peer && peer.id == window.im?.state?.getId();
        // Upstream keeps the visible date across re-renders (this.currentVisibleDate);
        // fall back to the last chunk date like upstream render does.
        const initialDate = this.currentVisibleDate || ((messages && messages.length > 0)
            ? (messages[messages.length - 1].readable_date || messages[messages.length - 1].date || '')
            : '');

        const pinned = (currentConv.hasPinned && currentConv.hasPinned())
            ? html`<${PinnedMessageBar} convo=${currentConv} />`
            : null;
        const headerWrapClass = 'messenger-app--header-wrap' + (pinned ? ' has-pinned' : '');

        const chatPage = html`
            <div id="chat-page">
                <div class="chat-window ${isSavedMessages ? 'saved-msgs' : ''}">
                    <div class=${headerWrapClass}>
                        <${PeerInfoView}
                            convo=${currentConv}
                            page=${this}
                            togglePeerInfo=${() => { this.togglePeerInfo(); }}
                        />
                        ${pinned}
                    </div>
                    <${ActionsBar}
                        selectedMessages=${orig_messenger.selected_messages_objs}
                        count=${orig_messenger.selected_messages_count}
                        onDelete=${() => this.callDeletion()}
                        onUnselect=${() => orig_messenger.unselectAll()}
                        onReply=${() => this.onReplyButtonClick()}
                        onForwardClick=${() => this.onForwardClick()}
                        onViewers=${(msg) => this.onViewersButtonClick(null, msg || orig_messenger.selected_messages_objs[0])}
                        onPin=${(msg) => this.onPinButtonClick(null, msg || orig_messenger.selected_messages_objs[0])}
                        onReport=${(msg) => this.onReportButtonClick(null, msg || orig_messenger.selected_messages_objs[0])}
                    />
                    <div class="messenger-app messenger-layer">
                        ${initialDate ? html`
                            <div class="im_floating_date_wrap" onClick=${(e) => this.onFloatingDateClick(e)}>
                                <b id="im_floating_date_text">${initialDate}</b>
                            </div>
                        ` : ''}
                        <${MessageListView}
                            convo=${currentConv}
                            dayDividedChunks=${messages}
                            page=${this} />
                        ${!options.removeInput ? html`<${InputAreaComponent}
                            convo=${currentConv}
                            editMsg=${orig_messenger.editMsg}
                            replyTo=${orig_messenger.replyTo}
                            onRemoveReply=${() => orig_messenger.removeReply()}
                            onSend=${() => orig_messenger.onSendMessage()}
                            onKeyPress=${(e) => this.onTextareaKeyPress(e)}
                            currentDraft=${orig_messenger.currentDraft}
                            onInput=${(e) => {
                                const val = (e && e.target && (e.target.value !== undefined
                                    ? e.target.value
                                    : (e.target._contentEditable ? e.target._contentEditable.getText() : e.target.innerText))) || '';
                                this.currentDraft = val;
                                orig_messenger.currentDraft = val;
                                try {
                                    this.checkMentionTrigger(e.target);
                                } catch (err) {
                                    console.error('vkify16 | checkMentionTrigger failed:', err);
                                }
                            }}
                            togglePeerInfo=${(e) => { this.togglePeerInfo(); }}
                            clickOnReply=${(msg, e) => { this.clickOnReply(msg, e); }}
                            forwarded_msg=${orig_messenger.forwarded_msg}
                            onRemoveForward=${() => orig_messenger.removeForward()}
                            mentionActive=${orig_messenger.mentionActive}
                            mentionMatches=${orig_messenger.mentionMatches}
                            mentionSelectedIndex=${orig_messenger.mentionSelectedIndex}
                            onApplyMention=${(item) => { this.applyMention(item); }}
                        />` : ''}
                    </div>
                </div>
            </div>
        `;

        render(chatPage, container);

        // New upstream scroll model (4c462220): the pill/observer/underflow
        // helpers live on the page instance. Mirror showHook/render side
        // effects so the mountain pill, read receipts and underflow fill keep
        // working; every call is guarded for older upstream.
        try {
            if (typeof this.updateMountainButton === 'function') this.updateMountainButton();
        } catch (e) {
            console.error('vkify16 | updateMountainButton failed:', e);
        }
        try {
            if (typeof this._setupReadObserver === 'function') this._setupReadObserver();
        } catch (e) {
            console.error('vkify16 | _setupReadObserver failed:', e);
        }
        try {
            if (typeof this._setupVisibilityListener === 'function') this._setupVisibilityListener();
        } catch (e) {
            console.error('vkify16 | _setupVisibilityListener failed:', e);
        }
        try {
            if (typeof this._setupResizeListener === 'function') this._setupResizeListener();
        } catch (e) {
            console.error('vkify16 | _setupResizeListener failed:', e);
        }
        try {
            if (typeof this._checkAndFillUnderflow === 'function') this._checkAndFillUnderflow();
        } catch (e) {
            console.error('vkify16 | _checkAndFillUnderflow failed:', e);
        }
        try {
            this._updPadding();
        } catch (e) {
            console.error('vkify16 | _updPadding failed:', e);
        }

        // Classic rail: refresh peer tabs when they actually change. The
        // messenger re-renders on every keystroke/LongPoll tick, so compare a
        // signature of opened_tabs+currentChatId and only re-render the bar
        // on a real change. updateTabs only re-renders the tab bar — no
        // recursion into here.
        try {
            if (currentConv && !isCompactMode(window.im) && typeof window.im?.updateTabs === 'function') {
                const sig = peerTabsSignature(orig_messenger);
                if (sig !== this._vkifyLastPeerTabsSig) {
                    this._vkifyLastPeerTabsSig = sig;
                    window.im.updateTabs();
                }
            }
        } catch (e) {
            console.error('vkify16 | tab bar refresh failed:', e);
        }
    }

    MessengerPage.prototype.getCurrentAttachments = function vkifyGetCurrentAttachments() {
        try {
            if (typeof origGetCurrentAttachments === 'function') {
                const orig = origGetCurrentAttachments.call(this);
                if (orig && (orig[0] || orig[1])) {
                    return orig;
                }
            }
        } catch (e) {
        }
        const h = this.container ? this.container.querySelector('.post-horizontal') : null;
        const v = this.container ? this.container.querySelector('.post-vertical') : null;
        return [h ? h.innerHTML : '', v ? v.innerHTML : ''];
    };

    const origTogglePeerInfo = MessengerPage.prototype.togglePeerInfo;

    // Upstream 5796d6fa moved the toggle logic inside `if (false)`, leaving
    // the method a no-op: header/author clicks and the contact page's own
    // "back" button no longer open/close the peer tab. Restore the toggle
    // here, keeping upstream's new close() of the contact tab on the way
    // back (IMTab.close() now also drops the container and re-renders tabs).
    MessengerPage.prototype.togglePeerInfo = async function vkifyTogglePeerInfo(sender = null) {
        const messenger = window.im?.messenger;
        if (!messenger || messenger.is_switching === true) {
            return;
        }
        messenger.is_switching = true;
        try {
            if (window.im.getSelectedTabId?.() == "contact") {
                const contactTab = window.im.getTab?.("contact");
                if (contactTab) {
                    contactTab.close();
                }
                window.im.openTabByName('messenger');
            } else {
                const _c = window.im.state?.getCurrentConvo?.();
                if (_c?.peer && !(typeof _c.peer.isILeft === 'function' && _c.peer.isILeft())) {
                    await _c.peer.checkMembers?.();
                }
                window.im.openTabByName?.('contact', false, {
                    peer: { "peer": sender }
                });
            }
        } catch (e) {
            console.error('vkify16 | togglePeerInfo failed, deferring to upstream:', e);
            if (typeof origTogglePeerInfo === 'function') {
                try {
                    return await origTogglePeerInfo.call(this, sender);
                } catch (e2) {
                    console.error('vkify16 | upstream togglePeerInfo also failed:', e2);
                }
            }
        } finally {
            messenger.is_switching = false;
        }
    };

}
