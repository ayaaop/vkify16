import { isCompactMode, syncBodyNoScroll } from '../shared.js';

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

    // Never import im.js ourselves: upstream loads that entry with ?mod=
    // while its internal imports are query-less, so a query-less import
    // would evaluate a SECOND copy (double window.im_class assignment and
    // double auto-init) and our prototype patch could land on the dead one.
    // Take the class from the live instance / published reference instead.
    let ImClass = (window.im && window.im.constructor) || window.im_class;
    if (!ImClass || !ImClass.prototype || typeof ImClass.prototype._renderTabBar !== 'function') {
        ImClass = await new Promise((resolve) => {
            let tries = 0;
            const timer = setInterval(() => {
                const found = (window.im && window.im.constructor) || window.im_class;
                if ((found && found.prototype && typeof found.prototype._renderTabBar === 'function') || ++tries > 100) {
                    clearInterval(timer);
                    resolve(found);
                }
            }, 100);
        });
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
        try {
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
                                        key=${tab?.peer ? tab.peer.id : (tab?.id || idx)}
                                        conv=${tab}
                                        active=${idx === currentChat}
                                        page=${messengerTab?.render_class || null} />
                                `)}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) {
            // Peer tabs are decorative: never let them take down the whole
            // tab bar (which would fall back to stock entirely).
            console.error('vkify16 | peer tabs failed, continuing without them:', e);
            peerTabs = null;
        }

        if (mainTabs && mainTabs.props) {
            const kids = dropBannerVNodes(mainTabs.props.children);
            if (peerTabs != null) {
                kids.push(peerTabs);
            }
            mainTabs.props.children = kids;
        }

        render(mainTabs, wrap);
        syncBodyNoScroll();
    }

    function isBannerVNode(child) {
        if (!child || typeof child !== 'object') {
            return false;
        }
        const t = child.type;
        if (!t) {
            return false;
        }
        if (MessagesNewInterfaceBanner && t === MessagesNewInterfaceBanner) {
            return true;
        }
        // Fall back to the component name: survives a dual module instance
        // (e.g. stale HTTP cache serving different copies of common.js),
        // where identity comparison fails but the banner must still go.
        if (typeof t === 'function' && t.name === 'MessagesNewInterfaceBanner') {
            return true;
        }
        if (typeof t === 'string') {
            const cls = child.props && (child.props.class || child.props.className);
            if (typeof cls === 'string' && cls.includes('im-new-interface-banner')) {
                return true;
            }
        }
        return false;
    }

    function dropBannerVNodes(children) {
        if (!children) {
            return [];
        }
        const arr = Array.isArray(children) ? children : [children];
        const out = [];
        for (const child of arr) {
            if (!child) {
                continue;
            }
            if (isBannerVNode(child)) {
                continue;
            }
            out.push(child);
        }
        return out;
    }
}
