export function createInputChrome({ html, tr, getReplySnippet }) {
    function ReplyBar({ replyTo, onRemoveReply, clickOnReply }) {
        if (!replyTo) return null;
        const senderName = replyTo.sender && typeof replyTo.sender.getName === 'function'
            ? replyTo.sender.getName()
            : (replyTo.data && replyTo.data.from_id ? `id${replyTo.data.from_id}` : '');
        const t = tr('reply_to_message_user', senderName);
        const title = (t && !t.startsWith('@')) ? t : `В ответ ${senderName}`;
        return html`
            <div class="input-reply input-m" onclick=${(e) => {
                if (!e.target.closest('.input-close')) {
                    clickOnReply(replyTo);
                }
            }}>
                <div class="input-reply-content">
                    <div class="input-reply-title">${title}:</div>
                    <div class="input-reply-text" dangerouslySetInnerHTML=${{ __html: typeof replyTo.getText === 'function' ? replyTo.getText(false, true, false) : (replyTo.data?.text || '') }} />
                </div>
                <div class="input-close" onclick=${(e) => {
                    e.stopPropagation();
                    onRemoveReply();
                }}>×</div>
            </div>
        `;
    }

    function EditBar({ editMsg, clickOnReply }) {
        if (!editMsg) return null;
        return html`
            <div class="input-reply input-m" onclick=${(e) => {
                if (!e.target.closest('.input-close')) {
                    clickOnReply(editMsg);
                }
            }}>
                <div class="input-reply-content">
                    <span class="input-type">${tr("edit_of_message")}:</span>
                    <span class="input-reply-text">${getReplySnippet(editMsg)}</span>
                </div>
                <div class="input-close" onClick=${(e) => {
                    e.stopPropagation();
                    window.im.messenger.cancelEdit();
                }}>×</div>
            </div>
        `;
    }

    function ForwardBar({ forwarded_msg, onRemoveForward }) {
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        if (!isForwarded) return null;
        return html`
            <div class="input-reply input-m">
                <div class="input-reply-content">
                    <div class="input-reply-title">${tr("forwarded_messages_noun", forwarded_msg.length)}</div>
                    <div class="input-reply-text">
                        ${forwarded_msg.map((f, i) => html`
                            <div class="input-fwd-item" key=${f.id || i}>
                                <b>${f.sender && typeof f.sender.getName === 'function' ? f.sender.getName() : `id${f.from_id}`}:</b> ${typeof f.getText === 'function' ? f.getText(true, true) : (f.data?.text ? f.data.text.replace(/\[([a-zA-Z0-9_]+)(?:\|([^\]]*))?\]/g, (m, target, title) => (title && title.trim()) ? title.trim() : target) : (f.text || ''))}
                            </div>
                        `)}
                    </div>
                </div>
                <div class="input-close" onClick=${onRemoveForward}>×</div>
            </div>
        `;
    }

    function MountainPill({ convo }) {
        return html`
            <div class="messenger-mountain im-to-end" onClick=${(e) => {
                if (window.im?.messenger?.view?.scrollToEndOfChat) {
                    window.im.messenger.view.scrollToEndOfChat(e, convo);
                }
            }}>
                <div class="im-to-end--label">${tr("viewing_old_messages")}</div>
            </div>
        `;
    }

    function getCantWriteInfo(convo) {
        if (convo && typeof convo.getCantWriteInfo === 'function') {
            return convo.getCantWriteInfo();
        }
        if (convo && convo.peer && typeof convo.peer.getCantWriteInfo === 'function') {
            return convo.peer.getCantWriteInfo();
        }
        const current = window.im?.state?.getCurrentConvo?.();
        if (current && typeof current.getCantWriteInfo === 'function') {
            return current.getCantWriteInfo();
        }
        return { allowed: true, text: "" };
    }

    function CantWriteBar({ info }) {
        return html`
            <div class="post-buttons im-cant-write-container">
                <div class="messenger-app--cant-write">
                    <div class="im-cant-write-text">${(info && info.text) || tr('cannot_write_default')}</div>
                </div>
            </div>
        `;
    }

    function inputEndClass({ editMsg, replyTo, forwarded_msg, convo }) {
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        const canWrite = getCantWriteInfo(convo).allowed !== false;
        // No m-mountain here: updateMountainButton() toggles it, and emitting it
        // from the class list would pin the scroll pill visible forever.
        return [
            "messenger-app-end",
            (canWrite && (replyTo || editMsg || isForwarded)) ? 'm-selected' : '',
        ].join(" ");
    }

    return { ReplyBar, EditBar, ForwardBar, MountainPill, CantWriteBar, getCantWriteInfo, inputEndClass };
}
