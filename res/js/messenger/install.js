import { createInputArea } from './components/input-area.js';
import { createAttachmentMenu } from './components/attachment-menu.js';
import { createChatHeader } from './components/chat-header.js';
import { messengerPatch } from './shared.js';

// Hooks options.vnode on upstream's preact instance. Upstream modules can exist
// under two URLs (static vs ?mod= dynamic imports), so we match vnodes by
// component name and capture the constructor from the vnode itself rather than
// comparing against imported references.
export function installMessengerPatches({ html, tr, render, options, Fragment, getReplySnippet }) {
    const AttachmentMenu = createAttachmentMenu({ html, tr });
    const VkInputArea = createInputArea({ html, tr, AttachmentMenu, getReplySnippet });
    const ChatHeader = createChatHeader({ html, tr });

    const upstreamCtors = {};
    let renderingPeers = false;

    const VkPeerTabsSink = () => null;

    // Peers are appended as a child of .messenger-app--tabbar-wrap, as a regular
    // vnode in the same tree - a nested render() would leave foreign DOM that
    // upstream's diff can reparent on the next render.
    const TabBarWithPeers = (props) => {
        const node = upstreamCtors.TabBar(props);
        const { activeTab } = props;
        const isMessenger = activeTab && typeof activeTab.getPageId === 'function' && activeTab.getPageId() === 'messenger';
        if (!isMessenger || !upstreamCtors.PeerTabsView || !messengerPatch.peerTabs) {
            return node;
        }

        const peerProps = {
            ...messengerPatch.peerTabs,
            tabs: window.im?.messenger?.opened_tabs ?? messengerPatch.peerTabs.tabs,
            currentChat: window.im?.messenger?.currentChatId ?? messengerPatch.peerTabs.currentChat,
        };

        let peersNode = null;
        renderingPeers = true;
        try {
            peersNode = html`<${upstreamCtors.PeerTabsView} ...${peerProps} />`;
        } finally {
            renderingPeers = false;
        }

        if (node && node.props) {
            const cls = String(node.props.class || node.props.className || '');
            if (cls.includes('messenger-app--global-tabs')) {
                return [node, peersNode];
            }
            const ch = node.props.children;
            if (Array.isArray(ch)) {
                ch.push(peersNode);
            } else if (ch) {
                node.props.children = [ch, peersNode];
            } else {
                node.props.children = [peersNode];
            }
        }
        return node;
    };

    const getCurrentPeerAndPage = () => {
        const pt = messengerPatch.peerTabs;
        const page = pt ? pt.page : null;
        const peer = (page && page.toggled_peer_obj) || (pt && pt.convo ? pt.convo.peer : null);
        return { peer, page };
    };

    const origVnode = options.vnode;
    options.vnode = (vnode) => {
        if (origVnode) origVnode(vnode);
        try {
            let patched = false;
            const t = vnode.type;
            if (typeof t === 'function' && t.name) {
                if (t.name === 'InputArea' && t !== VkInputArea) {
                    vnode.type = VkInputArea;
                    patched = true;
                } else if (t.name === 'PeerTabsView' && !renderingPeers && t !== VkPeerTabsSink) {
                    upstreamCtors.PeerTabsView = upstreamCtors.PeerTabsView || t;
                    messengerPatch.peerTabs = vnode.props;
                    vnode.type = VkPeerTabsSink;
                    queueMicrotask(() => {
                        if (window.im && typeof window.im.updateTabs === 'function') {
                            window.im.updateTabs();
                        }
                    });
                    patched = true;
                } else if (t.name === 'TabBar' && t !== TabBarWithPeers) {
                    upstreamCtors.TabBar = upstreamCtors.TabBar || t;
                    vnode.type = TabBarWithPeers;
                    patched = true;
                }
            } else if (t === 'div' && vnode.props && vnode.props.id === 'chat-page' && !vnode.props['data-vkify-inner']) {
                // body.no-scroll rules on #chat-page break fixed positioning, so
                // the header must be a sibling
                const { peer, page } = getCurrentPeerAndPage();
                const header = html`<${ChatHeader} peer=${peer} page=${page} />`;
                const inner = html`<div ...${vnode.props} data-vkify-inner="1">${vnode.props.children}</div>`;
                vnode.type = Fragment;
                vnode.props = { children: [header, inner] };
                patched = true;
            }
            if (patched) {
                queueMicrotask(() => {
                    if (typeof window.updateNarrow === 'function') window.updateNarrow();
                });
            }
        } catch (e) {
            console.error('vkify16 | messenger patch hook failed:', e);
        }
    };
}
