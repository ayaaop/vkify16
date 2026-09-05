export function createPinnedMessageBar({ html, tr }) {
    return function VkPinnedMessageBar({ convo }) {
        if (!convo || typeof convo.hasPinned !== 'function' || !convo.hasPinned()) {
            return null;
        }

        const pinMsg = convo.getPinnedMessageObject();
        if (!pinMsg) return null;

        let senderName = tr ? tr('pinned_message') : 'Pinned message';
        try {
            const currentUserId = window.openvk ? window.openvk.current_id : window.im?.state?.getId();
            const senderId = pinMsg.from_id || (pinMsg.data ? pinMsg.data.from_id : null);
            const isMine = (pinMsg.isMine && pinMsg.isMine()) || (senderId && senderId === currentUserId);

            if (isMine) {
                senderName = tr ? tr('you') : 'You';
            } else {
                const sender = pinMsg.sender || (window.im?.cached_profiles && window.im.cached_profiles._findCachedProfileByIdEvenIfNotCached(senderId));
                if (sender && typeof sender.getName === 'function') {
                    senderName = sender.getName(false, true) || sender.getName(false);
                }
            }
        } catch (e) {
            console.error(e);
        }

        let textPreview = '';
        try {
            if (pinMsg.data && pinMsg.data.text) {
                textPreview = pinMsg.data.text;
            } else if (typeof pinMsg.getText === 'function') {
                textPreview = pinMsg.getText(true);
            }
        } catch (e) {
            textPreview = '';
        }

        if (!textPreview || textPreview.length === 0) {
            const atts = typeof pinMsg.getAttachments === 'function' ? pinMsg.getAttachments() : [];
            textPreview = atts && atts.length > 0
                ? '[' + (tr ? (tr('attachment') || 'Attachment') : 'Attachment') + ']'
                : '...';
        }

        const canUnpin = Boolean(
            (convo.peer && typeof convo.peer.can === 'function' && convo.peer.can('pin')) ||
            (convo.peer && typeof convo.peer.isAdmin === 'function' && convo.peer.isAdmin()) ||
            (pinMsg && typeof pinMsg.can === 'function' && pinMsg.can('pin'))
        );

        const handleClick = (e) => {
            e.preventDefault();
            window.im.messenger.showPinnedModal(convo);
        };

        const handleUnpin = (e) => {
            e.stopPropagation();
            window.im.messenger.unpinMessage(convo);
        };

        const titleText = (tr ? tr('pinned_message') : null) || 'Закреплённое сообщение';
        const unpinTitle = (tr ? tr('unpin_message') : null) || 'Открепить сообщение';
        const previewTrimmed = typeof ovk_proc_strtr === 'function'
            ? ovk_proc_strtr(String(textPreview), 65)
            : String(textPreview).substring(0, 65);

        return html`
            <div class="messenger-pinned-bar" onClick=${handleClick}>
                <div class="messenger-pinned-bar--content">
                    <div class="messenger-pinned-bar--title">${titleText}</div>
                    <div class="messenger-pinned-bar--text">
                        <b>${senderName}:</b> <span>${previewTrimmed}</span>
                    </div>
                </div>
                ${canUnpin ? html`
                    <div class="messenger-pinned-bar--close" onClick=${handleUnpin} title="${unpinTitle}">
                        <div class="cross"></div>
                    </div>
                ` : ''}
            </div>
        `;
    };
}
