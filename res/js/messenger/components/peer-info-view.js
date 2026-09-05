export function createPeerInfoView({ html, tr }) {
    return function PeerInfoView({ convo, page, togglePeerInfo }) {
        if (!convo || !convo.peer) return html``;

        const peer = convo.peer;
        const name = typeof peer.getName === 'function' ? peer.getName() : '';
        const url = typeof peer.getPageUrl === 'function' ? peer.getPageUrl() : '';
        const subtitle = typeof peer.getOnlineStatusString === 'function' ? peer.getOnlineStatusString() : '';
        const avatar = typeof peer.getAvatar === 'function' ? peer.getAvatar('mid') : '';
        const backLabel = tr('back');

        const isUser = peer.supposed_type === 'user';
        const isSelfSaved = typeof peer.isSavedMessages === 'function' && peer.isSavedMessages();
        const userId = isUser ? peer.data?.id : null;
        const firstName = isUser ? (peer.data?.first_name || name) : '';
        const isOnline = isUser && !isSelfSaved && peer.data?.last_seen && (Math.floor(Date.now() / 1000) - peer.data.last_seen.time <= 300);

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

        const onActionsClick = (e) => {
            e.stopPropagation();
            if (typeof uiActionsMenu !== 'undefined' && uiActionsMenu.toggle) {
                uiActionsMenu.toggle(e.currentTarget);
            }
        };

        return html`
            <div class="messenger-app--header messages--peers-header-peer-name">
                <div class="messenger-app--header--back">
                    <a href="/im" onClick=${onBackClick}>${backLabel}</a>
                </div>
                <div class="messenger-app--header--info">
                    <div class="messenger-app--header--name">
                        <a href=${url} onClick=${onPeerInfoClick}>${name}</a>
                    </div>
                    <div class="messenger-app--header--online">${subtitle}</div>
                </div>
                <div class="messenger-app-header--actions">
                    ${isUser && !isSelfSaved ? html`
                    <div class="messenger-app-header--more-actions ui_actions_menu_wrap ui_actions_menu_left_align" onClick=${onActionsClick}>
                        <div id="profile_more_btn" class="messenger-app-header--more-actions--trigger"></div>
                        <div id="profile_actions_tooltip" class="ui_actions_menu">
                            <a id="_bl_toggler" data-name=${firstName} data-val="1" data-id=${userId}>
                                ${tr('bl_add')}
                            </a>
                            <a href=${'javascript:reportUser(' + userId + ')'}>
                                ${tr('report')}
                            </a>
                        </div>
                    </div>
                    ` : ''}
                    <a href=${url} class="messenger-app--header--ava" onClick=${onPeerInfoClick}>
                        <img src=${avatar} class="avatar post-avatar" width="50" alt=${name} />
                        ${isOnline ? html`<div class="messenger-app--header--online online"></div>` : ''}
                    </a>
                </div>
            </div>
        `;
    };
}
