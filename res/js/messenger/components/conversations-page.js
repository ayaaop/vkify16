import { imImport, isCompactMode, shouldShowBanner, dismissBanner } from '../shared.js';

let installed = false;

export async function installConversationsRenderer({ html, render, h, Fragment, commonMod }) {
    if (installed) {
        return;
    }
    installed = true;

    const { ConversationListView, MessagesNewInterfaceBanner } = commonMod || {};
    if (!ConversationListView || !MessagesNewInterfaceBanner || !html || !render || !h || !Fragment) {
        console.error('vkify16 | conversations renderer aborted: missing exports');
        return;
    }

    let convMod = null;
    try {
        convMod = await imImport('./pages/conversations.js');
    } catch (e) {
        console.error('vkify16 | Failed to load conversations page:', e);
        return;
    }

    const { ConversationsPage } = convMod || {};
    if (!ConversationsPage || !ConversationsPage.prototype) {
        console.error('vkify16 | conversations renderer aborted: ConversationsPage not found');
        return;
    }

    const origConversationsRender = ConversationsPage.prototype.render;

    ConversationsPage.prototype.render = function vkifyConversationsPageRender(container) {
        try {
            return vkifyRenderConversations.call(this, container, { html, render, h, Fragment, ConversationListView, MessagesNewInterfaceBanner });
        } catch (e) {
            console.error('vkify16 | conversations render failed, falling back to upstream:', e);
            if (typeof origConversationsRender === 'function') {
                return origConversationsRender.call(this, container);
            }
        }
    };

    function vkifyRenderConversations(container, deps) {
        const { html, render, h, Fragment, ConversationListView, MessagesNewInterfaceBanner } = deps;
        if (!container) {
            console.error('vkify16 | ConversationsPage.render called without container');
            return;
        }

        this.getNode().addClass('page-conversations');

        let orig_convs = [];
        try {
            orig_convs = window.im.conversations.convs;
        } catch (e) {
            console.error('vkify16 | ConversationsPage.render: no conversations', e);
        }

        let convs = [];
        try {
            if (window.im.conversations.isShowingUnread) {
                orig_convs.forEach((item) => {
                    if (!item.isRead()) {
                        convs.push(item);
                    }
                });
            } else {
                convs = orig_convs;
            }
        } catch (e) {
            convs = orig_convs;
        }

        const showBanner = shouldShowBanner(this) && !isCompactMode();
        const handleDismissBanner = (e) => {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            dismissBanner(() => this._update());
        };

        render(h(Fragment, null,
            showBanner ? html`<${MessagesNewInterfaceBanner} onClose=${handleDismissBanner} />` : null,
            html`<${ConversationListView}
                conversations=${convs}
                hasMore=${window.im.conversations.has_more_items}
                onLoadMore=${(e) => this.loadNext(e)}
                onCreateChat=${() => this._chatCreationModal()}
                onSearch=${(e) => this._onMessagesSearch(e)}
                isForward=${this.isForward()}
                page=${this}
                unreadMode=${window.im.conversations.isShowingUnread}
            />`
        ), container);
    }
}
