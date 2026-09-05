import { isCompactMode } from '../shared.js';

const ATTACHMENTS = {
    photo:    { id: '__photoAttachment',    cls: 'attach_photo' },
    video:    { id: '__videoAttachment',    cls: 'attach_video' },
    audio:    { id: '__audioAttachment',    cls: 'attach_audio' },
    document: { id: '__documentAttachment', cls: 'attach_document' },
    note:     { id: '__notesAttachment',    cls: 'attach_note' },
    graffiti: { cls: 'attach_graffiti' },
};

const onGraffitiClick = (e) => typeof initGraffiti !== 'undefined' && initGraffiti(e);

const handleMenuShow = (...showArgs) => (e) => {
    if (typeof uiActionsMenu !== 'undefined') {
        uiActionsMenu.show(e.currentTarget, ...showArgs);
    }
};

const handleMenuHide = (e) => {
    if (typeof uiActionsMenu !== 'undefined') {
        uiActionsMenu.hide(e.currentTarget);
    }
};

function menuEntry(html, tr, key) {
    const { id, cls } = ATTACHMENTS[key];
    if (key === 'graffiti') {
        return html`
            <a class=${cls} onClick=${onGraffitiClick}>
                <div class="post-attach-menu__icon"></div>
                ${tr(key)}
            </a>
        `;
    }
    return html`
        <a id=${id} class=${cls}>
            <div class="post-attach-menu__icon"></div>
            ${tr(key)}
        </a>
    `;
}

function inlineEntry(html, tr, key) {
    const { id, cls } = ATTACHMENTS[key];
    return html`
        <a id=${id} class=${cls} data-tip="simple-black" data-align="bottom-start" data-tiptitle="${tr(key)}">
            <div class="post-attach-menu__icon"></div>
        </a>
    `;
}

const toMenuEntries = (html, tr, keys) => keys.map((key) => menuEntry(html, tr, key));

export function createAttachmentMenu({ html, tr }) {
    const keys = ['photo', 'video', 'audio', 'document', 'graffiti'];
    return function AttachmentMenu() {
        return html`
        <div id="wallAttachmentMenu" class="page_add_media post-attach-menu">
            <div class="ui_actions_menu_wrap ui_actions_menu_top ui_actions_menu_left_align"
                 onMouseOver=${handleMenuShow(null, {autopos: true})}
                 onMouseOut=${handleMenuHide}>
                <span class="post-attach-menu__trigger" id="moreAttachTriggerIm" tabindex="0" role="button"></span>
                <div class="ui_actions_menu" id="moreAttachTooltipIm">
                    ${toMenuEntries(html, tr, keys)}
                </div>
            </div>
        </div>
      `;
    };
}

export function createStockAttachmentMenu({ html, tr }) {
    return function StockAttachmentMenu({ im } = {}) {
        const compact = isCompactMode(im ?? (typeof window !== 'undefined' ? window.im : undefined));
        const inlineKeys = compact ? ['video', 'audio'] : [];
        const dropdownKeys = compact
            ? ['document', 'note', 'graffiti']
            : ['video', 'audio', 'document', 'note', 'graffiti'];
        return html`
        <div id="wallAttachmentMenu" class="page_add_media post-attach-menu post-attach-menu--inline">
            ${inlineEntry(html, tr, 'photo')}
            ${inlineKeys.map((key) => inlineEntry(html, tr, key))}
            <div class="ui_actions_menu_wrap ui_actions_menu_center_align"
                 onMouseOver=${handleMenuShow()}
                 onMouseOut=${handleMenuHide}>
                <a class="post-attach-menu__trigger" id="moreAttachTriggerIm" aria-haspopup="menu" aria-expanded="false">
                    <vkifyloc name="more" />
                </a>
                <div class="ui_actions_menu" id="moreAttachTooltipIm" style="display: none;" role="menu" aria-hidden="true">
                    ${toMenuEntries(html, tr, dropdownKeys)}
                </div>
            </div>
        </div>
        `;
    };
}
