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

    function inputEndClass({ editMsg, replyTo, forwarded_msg }) {
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        // NOTE: no m-mountain/m-mountain-fatal here. Upstream 4c462220 drives
        // the scroll-to-end pill solely via updateMountainButton(), which adds
        // and REMOVES m-mountain as the viewport moves. Emitting mountain
        // classes from the class list (true whenever a scroll position exists)
        // pins the pill visible forever, since nothing ever removes them.
        return [
            "messenger-app-end",
            (replyTo || editMsg || isForwarded) ? 'm-selected' : '',
        ].join(" ");
    }

    return { ReplyBar, EditBar, ForwardBar, MountainPill, inputEndClass };
}
