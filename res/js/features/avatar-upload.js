(function() {
    if (!window.vkify) return;

    function openAvatarUploadModal(btn) {
        const avatarBlock = btn.closest(".avatar_block");
        const clubId = (avatarBlock ? avatarBlock.dataset.club : null) || btn.dataset.club || null;
        const isGroup = !!clubId;
        console.log('[AvatarUpload] modal opened', { clubId, isGroup, url: isGroup ? '/club' + clubId + '/al_avatar' : '/al_avatars' });

        const body = `
        <div id="avatarUpload">
            <p>${isGroup ? tr('groups_avatar') : tr('friends_avatar')}</p>
            <p>${tr('formats_avatar')}</p><br>
            <label class="button" style="margin-left:45%;user-select:none" id="uploadbtn">
                ${tr("browse")}
                <input accept="image/*" type="file" id="_avaInput" name="blob" hidden style="display: none;">
            </label>
            <br><br>
            <p>${tr('troubles_avatar')}</p>
        </div>
        `;

        const msg = MessageBox(tr('uploading_new_image'), body, [tr('cancel')], [() => {}]);
        msg.attr("style", "width: 600px;");
        document.querySelector(".ovk-diag-body").style.padding = "13px";

        $("#avatarUpload input").on("change", (ev) => {
            const file = ev.currentTarget.files[0];
            console.log('[AvatarUpload] file selected', file ? { name: file.name, type: file.type, size: file.size } : null);
            const image = URL.createObjectURL(file);
            $(".ovk-diag-body")[0].innerHTML = `
                <span>${!isGroup ? tr("selected_area_user") : tr("selected_area_club")}</span>
                <p style="margin-bottom: 10px;">${tr("selected_area_rotate")}</p>
                <div class="cropper-image-cont" style="max-height: 274px;">
                    <img src="${image}" id="temp_uploadPic">
                    <div class="rotateButtons">
                        <div class="_rotateLeft hoverable"></div>
                        <div class="_rotateRight hoverable"></div>
                    </div>
                </div>
                <label class="checkbox" style="margin-top: 14px;">
                    <input id="publish_on_wall" type="checkbox" checked><span>${tr("publish_on_wall")}</span>
                </label>
            `;

            document.querySelector(".ovk-diag-action").insertAdjacentHTML("afterbegin", `
                <button type="button" class="button" style="margin-left: 4px;" id="_uploadImg">${tr("upload_button")}</button>
            `);

            const imageDiv = document.getElementById('temp_uploadPic');
            const cropper = new Cropper(imageDiv, {
                aspectRatio: NaN,
                zoomable: true,
                minCropBoxWidth: 150,
                minCropBoxHeight: 150,
                dragMode: 'move',
                background: false,
                center: false,
                guides: false,
                modal: true,
                viewMode: 2,
                cropstart() {
                    document.querySelector(".cropper-container")?.classList.add("moving");
                },
                cropend() {
                    document.querySelector(".cropper-container")?.classList.remove("moving");
                },
            });

            msg.attr("style", "width: 487px;");

            document.querySelector("#_uploadImg").onclick = (e) => {
                e?.preventDefault();
                e?.stopPropagation();
                cropper.getCroppedCanvas({
                    fillColor: '#fff',
                    imageSmoothingEnabled: false,
                    imageSmoothingQuality: 'high',
                }).toBlob(async (blob) => {
                    document.querySelector("#_uploadImg").classList.add("lagged");
                    console.log('[AvatarUpload] cropped blob', { size: blob?.size, type: blob?.type });
                    const formdata = new FormData();
                    formdata.append("blob", blob);
                    formdata.append("ajax", 1);
                    formdata.append("on_wall", Number(document.querySelector("#publish_on_wall").checked));
                    formdata.append("hash", vkify.getCsrf());
                    const uploadUrl = isGroup ? "/club" + clubId + "/al_avatar" : "/al_avatars";
                    console.log('[AvatarUpload] uploading to', uploadUrl, 'hash present:', !!vkify.getCsrf());

                    try {
                        const res = await ky.post(uploadUrl, { body: formdata, throwHttpErrors: false });

                        let response;
                        try {
                            response = await res.json();
                        } catch (e) {
                            response = null;
                        }

                        if (!res.ok || !response?.success) {
                            document.querySelector("#_uploadImg")?.classList.remove("lagged");
                            console.error('[AvatarUpload] upload error', { status: res.status, statusText: res.statusText, response });
                            fastError(response?.flash?.message || response?.message || "Upload failed");
                            return;
                        }

                        console.log('[AvatarUpload] upload response', response);
                        document.querySelector("#_uploadImg")?.classList.remove("lagged");
                        u("body").removeClass("dimmed");
                        document.querySelector("html").style.overflowY = "scroll";
                        u(".ovk-diag-cont").remove();

                        // 1. Update big avatar (profile main photo)
                        const bigAvatar = document.querySelector("#bigAvatar");
                        if (bigAvatar) {
                            bigAvatar.src = response.url;
                            if (bigAvatar.parentNode && bigAvatar.parentNode.tagName === 'A') {
                                bigAvatar.parentNode.href = "/photo" + response.new_photo;
                            }
                        }

                        // 1.5 Update mobile hero avatar and make it open the new photo
                        const mobileHeroImg = document.querySelector(".mobile-hero-img");
                        if (mobileHeroImg) {
                            mobileHeroImg.src = response.url;
                        }
                        const mobileHeroWrap = document.querySelector(".mobile-hero-img-wrap");
                        if (mobileHeroWrap) {
                            mobileHeroWrap.classList.add("has-avatar-photo");
                            mobileHeroWrap.onclick = (event) => {
                                event.preventDefault();
                                vkify.media.openPhotoLegacy(event, response.url, null, response.new_photo, null);
                            };
                        }
                        const mobileHeroEdit = document.querySelector(".mobile-hero-avatar-edit");
                        if (mobileHeroEdit && typeof tr === 'function') {
                            mobileHeroEdit.textContent = tr('upload_new_picture');
                        }

                        // 2. Toggle avatar control buttons visibility on profile page
                        const addImageText = document.querySelector(".add_image_text");
                        if (addImageText) addImageText.style.display = "none";
                        const avatarControls = document.querySelector(".avatar_controls");
                        if (avatarControls) avatarControls.style.display = "block";

                        // 3. Update global top menu and sidebar avatars for the current user
                        if (!isGroup) {
                            const sidebarImg = document.querySelector(".ui_ownblock_img");
                            if (sidebarImg) sidebarImg.src = response.url;

                            const menuAvatar = document.querySelector("#userMenuAvatar");
                            if (menuAvatar) menuAvatar.src = response.url;
                        }

                        // 4. Update post/comment/list avatars for this entity, verifying they are actual avatars
                        const entityUrl = isGroup ? `/club${clubId}` : `/id${window.openvk?.current_id}`;
                        const links = document.querySelectorAll(`a[href="${entityUrl}"], a[href="/${entityUrl.substring(1)}"]`);
                        links.forEach(link => {
                            const img = link.querySelector('img');
                            if (img) {
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
                                if (isAvatar) {
                                    img.src = response.url;
                                }
                            }
                        });

                        if (window.vkifyShowSavedLabel) {
                            const form = btn.closest('form') || btn.closest('.page_block');
                            if (form) vkifyShowSavedLabel(form);
                        }
                    } catch (err) {
                        document.querySelector("#_uploadImg")?.classList.remove("lagged");
                        console.error('[AvatarUpload] upload error', err);
                        fastError("Upload failed");
                    }
                });
            };

            $(".ovk-diag-body ._rotateLeft").on("click", () => cropper.rotate(90));
            $(".ovk-diag-body ._rotateRight").on("click", () => cropper.rotate(-90));
        });
    }

    function initAvatarUpload() {
        vkify.bindOnce('avatar-upload-edit-v2', () => {
            document.addEventListener('click', (e) => {
                const target = e.target.closest('#vkify_add_image, #add_image, ._add_image, .add_image_text, ._edit_avatar_btn');
                if (target) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    openAvatarUploadModal(target);
                }
            }, true);
        });
    }

    vkify.onPage(initAvatarUpload);
})();
