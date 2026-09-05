export function createInputChrome({ html, tr, getReplySnippet }) {
    function ReplyBar({ replyTo, onRemoveReply, clickOnReply }) {
        if (!replyTo) return null;
        return html`
            <div class="input-reply input-m" onclick=${(e) => {
                if (!e.target.closest('.input-close')) {
                    clickOnReply(replyTo);
                }
            }}>
                <div class="input-reply-content">
                    <span class="input-type">${tr("reply_to", replyTo.sender ? replyTo.sender.getName() : "")}:</span>
                    <span class="input-reply-text">${getReplySnippet(replyTo)}</span>
                </div>
                <span class="input-close" onClick=${(e) => {
                    e.stopPropagation();
                    onRemoveReply();
                }}><div class="cross"></div></span>
            </div>
        `;
    }

    function EditBar({ editMsg, clickOnReply }) {
        if (!editMsg) return null;
        return html`
            <div class="input-edit input-m" onclick=${(e) => {
                if (!e.target.closest('.input-close')) {
                    clickOnReply(editMsg);
                }
            }}>
                <div class="input-reply-content">
                    <span class="input-type">${tr("edit_of_message")}:</span>
                    <span class="input-reply-text">${getReplySnippet(editMsg)}</span>
                </div>
                <span class="input-close" onClick=${(e) => {
                    e.stopPropagation();
                    window.im.messenger.cancelEdit();
                }}><div class="cross"></div></span>
            </div>
        `;
    }

    function ForwardBar({ forwarded_msg, onRemoveForward }) {
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        if (!isForwarded) return null;
        return html`
            <div class="input-forward input-m">
                <span aria-label="link" class="input-type">${tr("forwarded_messages_noun", forwarded_msg.length)}</span>
                <span class="input-close" onClick=${onRemoveForward}><div class="cross"></div></span>
            </div>
        `;
    }

    function MountainPill({ convo }) {
        return html`
            <div class="messenger-mountain im-to-end" onClick=${(e) => { window.im.messenger.view.scrollToEndOfChat(e, convo) }}>
                <div class="im-to-end--label">${tr("viewing_old_messages")}</div>
            </div>
        `;
    }

    function inputEndClass({ editMsg, replyTo, forwarded_msg, convo }) {
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        return [
            "messenger-app-end",
            (replyTo || editMsg || isForwarded) ? 'm-selected' : '',
            convo && typeof convo.hasScrollPosition === 'function' && convo.hasScrollPosition() && (!editMsg && !replyTo) ? "m-mountain m-mountain-fatal" : "",
        ].join(" ");
    }

    return { ReplyBar, EditBar, ForwardBar, MountainPill, inputEndClass };
}
