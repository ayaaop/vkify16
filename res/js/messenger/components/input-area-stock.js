import { createStockAttachmentMenu } from './attachment-menu.js';
import { createInputChrome } from './input-chrome.js';

export function createStockInputArea({ html, tr, getDisplayRecentSmiles, onRecentSmileClick, getEmojiHex, getReplySnippet, PeerAvatar }) {
    const StockAttachmentMenu = createStockAttachmentMenu({ html, tr });
    const { ReplyBar, EditBar, ForwardBar, MountainPill, inputEndClass } = createInputChrome({ html, tr, getReplySnippet });

    return function StockInputArea({ editMsg, replyTo, onRemoveReply, onSend, onKeyPress, currentDraft, onInput, togglePeerInfo, clickOnReply, convo, forwarded_msg, onRemoveForward }) {
        const is_editing = editMsg != null;
        const current_user = window.im.state.getOperator();
        const corresponder = window.im.state.getCurrentConvo();
        const recentSmiles = getDisplayRecentSmiles();
        const cls = inputEndClass({ editMsg, replyTo, forwarded_msg, convo }) + " stock-input-bar";

        return html`
        <div class="${cls}">
            <${ReplyBar} replyTo=${replyTo} onRemoveReply=${onRemoveReply} clickOnReply=${clickOnReply} />
            <${EditBar} editMsg=${editMsg} clickOnReply=${clickOnReply} />
            <${ForwardBar} forwarded_msg=${forwarded_msg} onRemoveForward=${onRemoveForward} />
            <${MountainPill} convo=${convo} />
            <div class="post-buttons">
                <div class="model_content_textarea messenger-app--input has_emoji_picker expanded-textarea" id="write">
                    <img class="ava" src=${current_user.getAvatar("mid", false)} alt=${current_user.getName()} />
                    <div class="messenger-app--input---messagebox">
                        <div class="textareas has_emoji_picker">
                            ${(typeof window !== 'undefined' && window.ContentEditable && typeof window.ContentEditable.isSupported === 'function' && window.ContentEditable.isSupported()) ? html`
                                <div
                                    class="small-textarea content-editable"
                                    contenteditable="true"
                                    role="textbox"
                                    aria-multiline="true"
                                    data-placeholder=${tr('enter_message')}
                                    onInput=${onInput}
                                    onKeyDown=${onKeyPress}
                                    ref=${(el) => {
                                        if (el && !el._contentEditable && window.ContentEditable) {
                                            new window.ContentEditable(el, { submitOnEnter: true, placeholder: tr('enter_message') });
                                            if (currentDraft && el.getText() !== currentDraft) {
                                                el.setText(currentDraft);
                                            }
                                        } else if (el && el._contentEditable && currentDraft != null && el.getText() !== currentDraft) {
                                            el.setText(currentDraft);
                                        }
                                    }}
                                ></div>
                            ` : html`
                                <textarea
                                    class="small-textarea"
                                    placeholder=${tr('enter_message')}
                                    value=${currentDraft}
                                    onInput=${onInput}
                                    onKeyDown=${onKeyPress}
                                ></textarea>
                            `}
                            <div class="emoji_picker_entrypoint"></div>
                        </div>
                        <div class="post-horizontal"></div>
                        <div class="post-vertical"></div>
                        <div class="input--messagebox-buttons">
                            <div class="input--messagebox-left">
                                <button class="button" onClick=${onSend}>${!is_editing ? tr('send') : tr('edit_action_lr')}</button>
                                <div class="im-recent-smiles-bar">
                                    ${recentSmiles.map(s => html`
                                        <span
                                            class="im-recent-smile-btn"
                                            title="${s}"
                                            data-emoji="${s}"
                                            onClick=${(e) => onRecentSmileClick(s, e)}
                                        >
                                            <span class="emoji emoji_${getEmojiHex(s)}">${s}</span>
                                        </span>
                                    `)}
                                </div>
                            </div>
                            <${StockAttachmentMenu} />
                        </div>
                    </div>
                    <${PeerAvatar}
                        peer=${replyTo ? replyTo.sender : corresponder.peer}
                        className="ava ava2"
                        loading="eager"
                        saved_messages_ava=${false}
                        orig_ava=${false}
                        onClick=${() => { window.im.openTabByName("contact") }} />
                </div>
            </div>
        </div>
        `;
    };
}
