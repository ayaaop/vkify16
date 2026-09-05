import { imImport, isCompactMode } from '../shared.js';

let installed = false;

export async function installClassicTabBar({ html, render, commonMod }) {
    if (installed) {
        return;
    }
    installed = true;

    const { TabBar, PeerTab, MessagesNewInterfaceBanner } = commonMod || {};
    if (!TabBar || !PeerTab) {
        console.error('vkify16 | classic tab bar aborted: missing TabBar or PeerTab');
        return;
    }

    let ImClass = window.im_class;
    if (!ImClass) {
        try {
            await imImport('./im.js');
            ImClass = window.im_class;
        } catch (e) {
            console.error('vkify16 | Failed to load im.js for tab bar:', e);
        }
    }

    if (!ImClass || !ImClass.prototype) {
        console.error('vkify16 | classic tab bar aborted: InstantMessagesAndRelated not found');
        return;
    }

    const originalRenderTabBar = ImClass.prototype._renderTabBar;

    ImClass.prototype._renderTabBar = function vkifyRenderTabBar() {
        try {
            return vkifyTabBar.call(this, { html, render, TabBar, PeerTab, MessagesNewInterfaceBanner });
        } catch (e) {
            console.error('vkify16 | tab bar render failed, falling back to upstream:', e);
            if (typeof originalRenderTabBar === 'function') {
                return originalRenderTabBar.call(this);
            }
        }
    };

    function vkifyTabBar({ html, render, TabBar, PeerTab, MessagesNewInterfaceBanner }) {
        if (!this.root) {
            return;
        }

        let wrap = this.root.querySelector('#im_page_tabs');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'im_page_tabs';
            this.root.insertAdjacentElement('afterbegin', wrap);
        }

        if (isCompactMode(this)) {
            wrap.innerHTML = '';
            return;
        }

        const tabs = this.getVisibleTabs();
        const activeTab = this.getSelectedTab();
        const activeTabId = activeTab?.getPageId?.() || '';

        const mainTabs = TabBar({
            tabs,
            activeTab,
            onTabSelect: (id) => this.selectTab(id),
        });

        let peerTabs = null;
        if (activeTabId === 'messenger' && this.messenger) {
            const messengerTab = this.getTab('messenger');
            const openedTabs = this.messenger.opened_tabs || [];
            const currentChat = this.messenger.currentChatId;
            if (openedTabs.length > 0) {
                peerTabs = html`
                    <div class="messages--peers-header-wrap">
                        <div class="messages--peers-tabs">
                            ${openedTabs.map((tab, idx) => html`
                                <${PeerTab}
                                    conv=${tab}
                                    active=${idx === currentChat}
                                    page=${messengerTab?.render_class || null} />
                            `)}
                        </div>
                    </div>
                `;
            }
        }

        if (mainTabs && mainTabs.props) {
            let children = mainTabs.props.children;
            if (!Array.isArray(children)) {
                children = children ? [children] : [];
            }
            children = children.filter((child) => {
                if (!child) {
                    return false;
                }
                if (MessagesNewInterfaceBanner && child.type === MessagesNewInterfaceBanner) {
                    return false;
                }
                const cls = child.props && (child.props.class || child.props.className);
                if (typeof cls === 'string' && cls.includes('im-new-interface-banner')) {
                    return false;
                }
                return true;
            });
            if (peerTabs != null) {
                children.push(peerTabs);
            }
            mainTabs.props.children = children;
        }

        render(mainTabs, wrap);
    }
}
