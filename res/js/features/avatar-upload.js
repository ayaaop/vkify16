(function() {
    if (!window.vkify) return;

    function applyAvatarUploadPatches(response, options) {
        if (!response?.success) return;

        const isGroup = options.isGroup;
        const clubId = options.clubId;
        const target = window.vkifyLastAvatarTarget;

        const bigAvatar = document.querySelector("#bigAvatar");
        if (bigAvatar) {
            bigAvatar.src = response.url;
            if (bigAvatar.parentNode && bigAvatar.parentNode.tagName === 'A' && response.new_photo) {
                bigAvatar.parentNode.href = "/photo" + response.new_photo;
            }
        }

        const mobileHeroImg = document.querySelector(".mobile-hero-img");
        if (mobileHeroImg) mobileHeroImg.src = response.url;

        const mobileHeroWrap = document.querySelector(".mobile-hero-img-wrap");
        if (mobileHeroWrap) {
            mobileHeroWrap.classList.add("has-avatar-photo");
            mobileHeroWrap.onclick = (event) => {
                event.preventDefault();
                if (response.new_photo) PhotoViewer.openById(response.new_photo, event);
            };
        }

        const mobileHeroEdit = document.querySelector(".mobile-hero-avatar-edit");
        if (mobileHeroEdit && typeof tr === 'function') {
            mobileHeroEdit.textContent = tr('upload_new_picture');
        }

        const addImageText = document.querySelector(".add_image_text");
        if (addImageText) addImageText.style.display = "none";

        const avatarControls = document.querySelector(".avatar_controls");
        if (avatarControls) avatarControls.style.display = "block";

        if (!isGroup) {
            const sidebarImg = document.querySelector(".ui_ownblock_img");
            if (sidebarImg) sidebarImg.src = response.url;

            const menuAvatar = document.querySelector("#userMenuAvatar");
            if (menuAvatar) menuAvatar.src = response.url;
        }

        const entityUrl = isGroup ? `/club${clubId}` : `/id${window.openvk?.current_id}`;
        if (entityUrl) {
            const altUrl = `/${entityUrl.substring(1)}`;
            document.querySelectorAll(`a[href="${entityUrl}"], a[href="${altUrl}"]`).forEach(link => {
                const img = link.querySelector('img');
                if (!img) return;
                const isAvatar = img.classList.contains('post-avatar') ||
                                 img.classList.contains('reply_img') ||
                                 img.classList.contains('cell_img') ||
                                 img.classList.contains('people_cell_img') ||
                                 img.closest('.people_cell_img') ||
                                 img.closest('.search_row .img') ||
                                 img.classList.contains('ui_ownblock_img') ||
                                 img.classList.contains('post_field_user_image') ||
                                 img.classList.contains('feedback_image') ||
                                 img.closest('.feedback_image') ||
                                 img.id === 'userMenuAvatar' ||
                                 img.id === 'bigAvatar';
                if (isAvatar) img.src = response.url;
            });
        }

        if (window.vkifyShowSavedLabel && target) {
            const form = target.closest('form') || target.closest('.page_block');
            if (form) vkifyShowSavedLabel(form);
        }
    }

    function installAjaxPrefilter() {
        if (!window.$ || !$.ajaxPrefilter) return;

        $.ajaxPrefilter((options) => {
            const url = options.url;
            const isAvatars = url === '/al_avatars';
            const isClubAvatar = url && /^\/club\d+\/al_avatar$/.test(url);
            if (!isAvatars && !isClubAvatar) return;

            const isGroup = isClubAvatar;
            const clubMatch = isClubAvatar ? url.match(/^\/club(\d+)\/al_avatar$/) : null;
            const clubId = clubMatch ? Number(clubMatch[1]) : null;

            const origSuccess = options.success;
            options.success = function(response, ...args) {
                if (typeof origSuccess === 'function') {
                    origSuccess.apply(this, [response, ...args]);
                }
                applyAvatarUploadPatches(response, { isGroup, clubId });
            };
        });
    }

    function initAvatarUpload() {
        if (!window.OpenAvatarUpdateDialogue) return;

        vkify.bindOnce('avatar-upload-ajax-prefilter', installAjaxPrefilter);

        vkify.bindOnce('avatar-upload-edit-v2', () => {
            document.addEventListener('click', (e) => {
                const target = e.target.closest('#vkify_add_image, #add_image, ._add_image, .add_image_text, ._edit_avatar_btn');
                if (!target) return;

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                window.vkifyLastAvatarTarget = target;

                const avatarBlock = target.closest('.avatar_block');
                const groupId = (avatarBlock ? avatarBlock.dataset.club : null) || target.dataset.club || null;
                const chatId = (avatarBlock ? avatarBlock.dataset.chat : null) || target.dataset.chat || null;

                window.OpenAvatarUpdateDialogue(groupId || null, chatId || null);
            }, true);
        });
    }

    vkify.onPage(initAvatarUpload);
})();
