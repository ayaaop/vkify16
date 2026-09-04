export function createAttachmentMenu({ html, tr }) {
    return function AttachmentMenu() {
        return html`
        <div id="wallAttachmentMenu" class="page_add_media post-attach-menu">
            <div class="ui_actions_menu_wrap ui_actions_menu_top ui_actions_menu_left_align"
                 onMouseOver=${(e) => uiActionsMenu.show(e.currentTarget, null, {autopos: true})}
                 onMouseOut=${(e) => uiActionsMenu.hide(e.currentTarget)}>
                <span class="post-attach-menu__trigger" id="moreAttachTriggerIm" tabindex="0" role="button"></span>
                <div class="ui_actions_menu" id="moreAttachTooltipIm">
                    <a id="__photoAttachment" class="attach_photo">
                        <div class="post-attach-menu__icon"></div>
                        ${tr('photo')}
                    </a>
                    <a id="__videoAttachment" class="attach_video">
                        <div class="post-attach-menu__icon"></div>
                        ${tr('video')}
                    </a>
                    <a id="__audioAttachment" class="attach_audio">
                        <div class="post-attach-menu__icon"></div>
                        ${tr('audio')}
                    </a>
                    <a id="__documentAttachment" class="attach_document">
                        <div class="post-attach-menu__icon"></div>
                        ${tr('document')}
                    </a>
                    <a class="attach_graffiti" onClick=${(e) => typeof initGraffiti !== 'undefined' && initGraffiti(e)}>
                        <div class="post-attach-menu__icon"></div>
                        ${tr('graffiti')}
                    </a>
                </div>
            </div>
        </div>
      `;
    };
}
