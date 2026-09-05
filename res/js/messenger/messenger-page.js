import { imImport, fallbackReplySnippet, fallbackEmojiHex, fallbackRecentSmiles, fallbackRecentSmileClick, fallbackPeerAvatar, ensureVideoPreviews } from './shared.js';
import { createPeerInfoView } from './components/peer-info-view.js';
import { createPinnedMessageBar } from './components/pinned-message-bar.js';
import { createAttachmentMenu } from './components/attachment-menu.js';
import { createInputArea } from './components/input-area.js';
import { createStockInputArea } from './components/input-area-stock.js';
import { installClassicTabBar } from './components/classic-tab-bar.js';
import { installConversationsRenderer } from './components/conversations-page.js';
import { installCompactPlaceholder } from './components/compact-placeholder.js';

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
    const { ActionsBar, ErrorConversation } = commonMod || {};
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
    const VkInputArea = createInputArea({ html, tr, AttachmentMenu, getReplySnippet, getEmojiHex });
    const StockInputArea = createStockInputArea({ html, tr, getDisplayRecentSmiles, onRecentSmileClick, getEmojiHex, getReplySnippet, PeerAvatar });
    const PeerInfoView = createPeerInfoView({ html, tr });
    const PinnedMessageBar = createPinnedMessageBar({ html, tr });

    const use2018 = window.vkify ? window.vkify.getSetting('mode2018') : false;
    const InputAreaComponent = use2018 ? VkInputArea : StockInputArea;

    await installClassicTabBar({ html, render, commonMod });
    await installConversationsRenderer({ html, render, h, Fragment, commonMod });
    try {
        installCompactPlaceholder({ html, render, commonMod });
    } catch (e) {
        console.error('vkify16 | compact placeholder banner upgrade failed:', e);
    }

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

    async function vkifyRenderMessenger(container, options, orig_messenger, deps) {
        const { html, render, h, Fragment, ErrorConversation, MessageListView, ActionsBar, PeerInfoView, PinnedMessageBar, InputAreaComponent } = deps;
        try {
            const inputEl = this.getNode().find('#write .content-editable, #write .small-textarea').last().get(0);
            orig_messenger.currentDraft = inputEl && typeof inputEl.value !== 'undefined' ? inputEl.value : '';
        } catch (e) {
        }

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
        const initialDate = (messages && messages.length > 0)
            ? (messages[messages.length - 1].readable_date || messages[messages.length - 1].date || '')
            : '';

        const pinned = (currentConv.hasPinned && currentConv.hasPinned())
            ? html`<${PinnedMessageBar} convo=${currentConv} />`
            : null;
        const headerWrapClass = 'messenger-app--header-wrap' + (pinned ? ' has-pinned' : '');

        const header = html`
            <div class=${headerWrapClass}>
                <${PeerInfoView}
                    convo=${currentConv}
                    page=${this}
                    togglePeerInfo=${() => { this.togglePeerInfo(); }}
                />
                ${pinned}
            </div>
        `;

        const chatPage = html`
            <div id="chat-page" class="chat-window ${isSavedMessages ? 'saved-msgs' : ''}">
                <${ActionsBar}
                    selectedMessages=${orig_messenger.selected_messages_objs}
                    count=${orig_messenger.selected_messages_count}
                    onDelete=${() => this.callDeletion()}
                    onUnselect=${() => orig_messenger.unselectAll()}
                    onReply=${() => this.onReplyButtonClick()}
                    onForwardClick=${() => this.onForwardClick()}
                    onViewers=${(msg) => this.onViewersButtonClick(null, msg || orig_messenger.selected_messages_objs[0])}
                />
                ${initialDate ? html`
                    <div class="im_floating_date_wrap" onClick=${(e) => this.onFloatingDateClick(e)}>
                        <b id="im_floating_date_text">${initialDate}</b>
                    </div>
                ` : ''}
                <div class="messenger-app messenger-layer">
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
                        onInput=${(e) => { this.currentDraft = e.target.value; }}
                        togglePeerInfo=${(e) => { this.togglePeerInfo(); }}
                        clickOnReply=${(msg, e) => { this.clickOnReply(msg, e); }}
                        forwarded_msg=${orig_messenger.forwarded_msg}
                        onRemoveForward=${() => orig_messenger.removeForward()}
                    />` : ''}
                </div>
            </div>
        `;

        render(h(Fragment, null, header, chatPage), container);

        try {
            this._updPadding();
        } catch (e) {
            console.error('vkify16 | _updPadding failed:', e);
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

}
