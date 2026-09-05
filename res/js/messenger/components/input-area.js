import { createInputChrome } from './input-chrome.js';

export function createInputArea({ html, tr, AttachmentMenu, getReplySnippet, getEmojiHex }) {
    const { ReplyBar, EditBar, ForwardBar, MountainPill, inputEndClass } = createInputChrome({ html, tr, getReplySnippet });
    return function InputArea({ editMsg, replyTo, onRemoveReply, onSend, onKeyPress, currentDraft, onInput, togglePeerInfo, clickOnReply, convo, forwarded_msg, onRemoveForward }) {
        const is_editing = editMsg != null;
        const cls = inputEndClass({ editMsg, replyTo, forwarded_msg, convo });

        const hasContentEditable = typeof window !== 'undefined' && window.ContentEditable && typeof window.ContentEditable.isSupported === 'function' && window.ContentEditable.isSupported();
        let hiddenTextarea = null;

        const textareaRef = (el) => { hiddenTextarea = el; };

        const inputRef = (el) => {
            if (!el) return;
            if (hasContentEditable && !el._contentEditable && window.ContentEditable) {
                new window.ContentEditable(el, { hiddenInput: hiddenTextarea, submitOnEnter: true, placeholder: tr('enter_message') });
                if (currentDraft != null && typeof el.setText === 'function' && el.getText() !== currentDraft) {
                    el.setText(currentDraft);
                }
            } else if (hasContentEditable && el._contentEditable && currentDraft != null && el.getText() !== currentDraft) {
                el.setText(currentDraft);
            }
        };

        const inputEl = hasContentEditable ? html`
            <div class="im-chat-input--text-wrap">
                <textarea
                    class="small-textarea im_editable"
                    name="text"
                    style="display: none;"
                    ref=${textareaRef}
                ></textarea>
                <div
                    class="small-textarea content-editable im_editable im-chat-input--text"
                    contenteditable="true"
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder=${tr('enter_message')}
                    onInput=${onInput}
                    onKeyDown=${onKeyPress}
                    ref=${inputRef}
                ></div>
            </div>
        ` : html`
            <textarea
                class="small-textarea im_editable im-chat-input--text"
                name="text"
                placeholder=${tr('enter_message')}
                value=${currentDraft}
                onInput=${onInput}
                onKeyDown=${onKeyPress}
            ></textarea>
        `;

        return html`
        <div class="${cls}">
            <${ReplyBar} replyTo=${replyTo} onRemoveReply=${onRemoveReply} clickOnReply=${clickOnReply} />
            <${EditBar} editMsg=${editMsg} clickOnReply=${clickOnReply} />
            <${ForwardBar} forwarded_msg=${forwarded_msg} onRemoveForward=${onRemoveForward} />
            <${MountainPill} convo=${convo} />
            <div class="im-chat-input clear_fix im-chat-input_classic ${is_editing ? 'is_msg_editing' : ''}" id="write">
                <div class="im-chat-input--textarea messenger-app--input---messagebox">
                    <div class="im-chat-input--txt-wrap textareas has_emoji_picker">
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
                        ${inputEl}
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
