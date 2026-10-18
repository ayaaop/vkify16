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
            if (response.new_photo) {
                bigAvatar.setAttribute("onclick", `PhotoViewer.openById('${response.new_photo}', event);`);
            }
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

        document.querySelectorAll("#vkify_add_image, .add_image_text").forEach((el) => {
            if (!el.classList.contains("_add_image")) {
                el.style.display = "none";
            }
        });

        const avatarControls = document.querySelector(".avatar_controls");
        if (avatarControls) {
            avatarControls.style.display = "block";
            if (response.new_photo) {
                avatarControls.querySelectorAll("[data-pe-action]").forEach((btn) => {
                    btn.dataset.photoId = String(response.new_photo);
                    if (response.url) {
                        btn.dataset.src = response.url;
                        btn.dataset.largeSrc = response.url;
                    }
                });
            }
        }

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

        if (!options.skipSavedLabel && window.vkifyShowSavedLabel && target) {
            const form = target.closest('form') || target.closest('.page_block');
            if (form) vkifyShowSavedLabel(form);
        }
    }

    window.vkifyApplyAvatarUploadPatches = applyAvatarUploadPatches;

    function installAjaxPrefilter() {
        if (!window.$ || !$.ajaxPrefilter) return;

        $.ajaxPrefilter((options) => {
            const url = options.url;
            const isAvatars = url === '/al_avatars';
            const isClubAvatar = url && /^\/club\d+\/al_avatar$/.test(url);
            const isDeleteAvatar = url === '/delete_avatar' || (url && /^\/club\d+\/delete_avatar$/.test(url));
            if (!isAvatars && !isClubAvatar && !isDeleteAvatar) return;

            if (isDeleteAvatar) {
                const origDelSuccess = options.success;
                options.success = function(response, ...args) {
                    try {
                        if (typeof origDelSuccess === 'function') {
                            origDelSuccess.apply(this, [response, ...args]);
                        }
                    } catch (_) {}
                    if (response?.success && !response.has_new_photo) {
                        const avatarControls = document.querySelector(".avatar_controls");
                        if (avatarControls) avatarControls.style.display = "none";
                        document.querySelectorAll("#vkify_add_image, .add_image_text").forEach((el) => {
                            if (!el.classList.contains("_add_image")) {
                                el.style.display = "";
                            }
                        });
                    } else if (response?.success && response.new_photo) {
                        const avatarControls = document.querySelector(".avatar_controls");
                        if (avatarControls) {
                            avatarControls.querySelectorAll("[data-pe-action]").forEach((btn) => {
                                btn.dataset.photoId = String(response.new_photo);
                                if (response.url) {
                                    btn.dataset.src = response.url;
                                    btn.dataset.largeSrc = response.url;
                                }
                            });
                        }
                    }
                };
                return;
            }

            const isGroup = isClubAvatar;
            const clubMatch = isClubAvatar ? url.match(/^\/club(\d+)\/al_avatar$/) : null;
            const clubId = clubMatch ? Number(clubMatch[1]) : null;

            const origSuccess = options.success;
            options.success = function(response, ...args) {
                try {
                    if (typeof origSuccess === 'function') {
                        origSuccess.apply(this, [response, ...args]);
                    }
                } catch (_) {}
                applyAvatarUploadPatches(response, { isGroup, clubId });
            };
        });
    }

    function initAvatarUpload() {
        if (!window.OpenAvatarUpdateDialogue) return;

        vkify.bindOnce('avatar-upload-ajax-prefilter', installAjaxPrefilter);

        vkify.bindOnce('avatar-upload-edit-v2', () => {
            document.addEventListener('click', (e) => {
                const peTarget = e.target.closest('.avatar_controls [data-pe-action]');
                if (peTarget) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const action = peTarget.dataset.peAction;
                    let photoId = peTarget.dataset.photoId || '';
                    if (!photoId) {
                        const bigAva = document.querySelector('#bigAvatar');
                        const href = bigAva?.parentNode?.getAttribute?.('href') || '';
                        const m = href.match(/\/photo(-?\d+_\d+)/);
                        if (m) photoId = m[1];
                    }
                    if (!photoId) return;
                    const avatarBlock = peTarget.closest('.avatar_block');
                    const clubId = avatarBlock?.dataset?.club ? Number(avatarBlock.dataset.club) : null;
                    const src = peTarget.dataset.src || document.querySelector('#bigAvatar')?.src || '';
                    const largeSrc = peTarget.dataset.largeSrc || src;
                    const opts = { isAvatar: true, clubId, src, largeSrc };
                    if (action === 'spe' && typeof window.openVkStickersEditor === 'function') {
                        window.openVkStickersEditor(photoId, opts);
                    } else if (typeof window.openVkPhotoEditor === 'function') {
                        window.openVkPhotoEditor(photoId, opts);
                    }
                    return;
                }

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
