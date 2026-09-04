export function createInputArea({ html, tr, AttachmentMenu, getReplySnippet }) {
    return function InputArea({ editMsg, replyTo, onRemoveReply, onSend, onKeyPress, currentDraft, onInput, togglePeerInfo, clickOnReply, convo, forwarded_msg, onRemoveForward }) {
        const is_editing = editMsg != null;
        const isForwarded = forwarded_msg && forwarded_msg.length && forwarded_msg.length > 0;
        const cls = [
            "messenger-app-end",
            (replyTo || editMsg || isForwarded) ? 'm-selected' : '',
            convo.hasScrollPosition() && (!editMsg && !replyTo) ? "m-mountain m-mountain-fatal" : "",
        ];

        return html`
        <div class="${cls.join(" ")}">
            ${replyTo && html`
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
            `}
            ${editMsg && html`
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
            `}
            ${isForwarded ? html`
                <div class="input-forward input-m">
                    <span aria-label="link" class="input-type">${tr("forwarded_messages_noun", forwarded_msg.length)}</span>
                    <span class="input-close" onClick=${onRemoveForward}><div class="cross"></div></span>
                </div>`
                : ""}
            <div class="messenger-mountain im-to-end" onClick=${(e) => { window.im.messenger.view.scrollToEndOfChat(e, convo) }}>
                <div class="im-to-end--label">${tr("viewing_old_messages")}</div>
            </div>
            <div class="im-chat-input clear_fix im-chat-input_classic ${is_editing ? 'is_msg_editing' : ''}" id="write">
                <div class="im-chat-input--textarea messenger-app--input---messagebox">
                    <div class="im-chat-input--txt-wrap">
                        <div class="im-chat-input--attach">
                            <a class="im-chat-input--attach-label im-attach-photo" tabindex="0" role="button"
                               aria-label=${tr('photo')} title=${tr('photo')}></a>
                        </div>
                        <div class="emoji_smile_wrap im-chat-input--smile-wrap">
                            <div class="emoji_picker_entrypoint emoji_smile">
                                <div class="emoji_smile_icon_vector emoji_smile_icon"></div>
                            </div>
                        </div>
                        <div class="im-chat-input--selector">
                            <${AttachmentMenu} />
                        </div>
                        <textarea
                            class="small-textarea im_editable im-chat-input--text"
                            name="text"
                            placeholder=${tr('enter_message')}
                            value=${currentDraft}
                            onInput=${onInput}
                            onKeyDown=${onKeyPress}></textarea>
                        <button type="button" class="im-send-btn im-chat-input--send"
                                onClick=${onSend}
                                aria-label=${!is_editing ? tr('send') : tr('edit_action_lr')}></button>
                    </div>
                    <div class="im-chat-input--scroll post-buttons">
                        <div class="im-chat-input--attaches">
                            <div class="multi_media_preview">
                                <div class="post-horizontal page_pics_preview media_preview clear_fix"></div>
                                <div class="post-vertical page_docs_preview media_preview clear_fix"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      `;
    };
}
