export function createActionsBar({ html, tr }) {
    function actionTab(role, label, onClick, iconOnly = false) {
        return html`
            <div class=${'message-tab message-tab--' + role}>
                <a onClick=${onClick}
                   title=${iconOnly ? label : null}
                   aria-label=${iconOnly ? label : null}>${label}</a>
            </div>
        `;
    }

    return function VkActionsBar({ selectedMessages, count, onDelete, onUnselect, onReply, onForwardClick, onViewers, onPin, onReport }) {
        if (!count) {
            return null;
        }

        let canDeleteThemAll = true;
        let canForward = count < 500;
        (selectedMessages || []).forEach((msg) => {
            if (!msg || typeof msg.can !== 'function' || msg.can('delete') == false) {
                canDeleteThemAll = false;
            }
            if (!msg || typeof msg.can !== 'function' || msg.can('forward') == false) {
                canForward = false;
            }
        });

        const firstMsg = selectedMessages && selectedMessages.length === 1 ? selectedMessages[0] : null;
        const canReply = firstMsg && (typeof firstMsg.can === 'function' ? firstMsg.can('reply') : !firstMsg.isDeleted());
        const canPin = firstMsg && typeof firstMsg.can === 'function' && firstMsg.can('pin');
        const canViewers = firstMsg && typeof firstMsg.can === 'function' && firstMsg.can('viewers');
        const canReport = firstMsg && typeof firstMsg.can === 'function' && firstMsg.can('report');
        const view = window.im?.messenger?.view;

        return html`
            <div class="messages--actions shown">
                <div>
                    <div class="message-tab-counter message-tab"><a onClick=${onUnselect}>${tr('selected_messages', count)}</a></div>
                </div>
                <div>
                    ${count === 1 && canPin ? actionTab(
                        firstMsg.isPinned() ? 'unpin' : 'pin',
                        firstMsg.isPinned() ? tr('unpin') : tr('pin'),
                        () => { if (onPin) onPin(firstMsg); else view?.onPinButtonClick?.(null, firstMsg); },
                        true,
                    ) : ''}
                    ${count === 1 && canViewers ? actionTab('viewers', tr('message_viewers'),
                        () => { if (onViewers) onViewers(firstMsg); else view?.onViewersButtonClick?.(null, firstMsg); },
                        true,
                    ) : ''}
                    ${count === 1 && canReport ? actionTab('report', tr('report'),
                        () => { if (onReport) onReport(firstMsg); else view?.onReportButtonClick?.(null, firstMsg); },
                        true,
                    ) : ''}
                    ${canDeleteThemAll ? actionTab('delete', tr('delete_message'), onDelete, true) : ''}
                    ${count === 1 && canReply ? actionTab('reply', tr('reply_to_message'), onReply) : ''}
                    ${canForward ? actionTab('forward', tr('forward_messages'), onForwardClick) : ''}
                </div>
            </div>
        `;
    };
}
