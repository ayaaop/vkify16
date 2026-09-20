(() => {

const Hb = window.Handlebars;

const popupBodyTpl = Hb.compile(
    `<div id="upload_container">
<div id="firstStep">
    <b><a href="javascript:void(0)">{{limits}}</a></b>
    <ul>
        <li>{{req1}}</li>
        <li>{{req2}}</li>
    </ul>
    <div id="audio_upload">
        <input id="audio_input" multiple="" type="file" name="blob" accept="audio/*" style="display:none">
        <input value="{{upload_button}}" class="button" type="button" onclick="this.closest('#upload_container').querySelector('input[type=file]').click()">
    </div>
</div>
<div id="lastStep" style="display:none">
    <div id="lastStepContainers"></div>
    <div id="lastStepButtons" style="text-align: center;margin-top: 10px;">
        <input class="button" type="button" id="uploadMusicPopup" value="{{upload_button}}">
        <input class="button" type="button" id="backToUpload" onclick="this.closest('#upload_container').querySelector('input[type=file]').click()" value="{{select_another}}">
    </div>
</div>
</div>`
);

const audioFrameTpl = Hb.compile(
    `<div class='upload_container_element' data-index="{{audio_index}}">
        <div class='upload_container_name'>
            <span>{{display_name}}</span>
            <div id="small_remove_button"></div>
        </div>
        <table cellspacing="7" cellpadding="0" border="0" align="center">
            <tbody>
                <tr>
                    <td width="120" valign="top"><span class="nobold">{{lbl_performer}}:</span></td>
                    <td><input value='{{performer}}' name="performer" type="text" autocomplete="off" maxlength="80" /></td>
                </tr>
                <tr>
                    <td width="120" valign="top"><span class="nobold">{{lbl_name}}:</span></td>
                    <td><input type="text" value='{{name}}' name="name" autocomplete="off" maxlength="80" /></td>
                </tr>
                <tr>
                    <td width="120" valign="top"><span class="nobold">{{lbl_genre}}:</span></td>
                    <td><select name="genre">
                        {{#each genres}}
                        <option {{#if selected}}selected{{/if}} value='{{value}}'>{{value}}</option>
                        {{/each}}
                    </select></td>
                </tr>
                <tr>
                    <td width="120" valign="top"><span class="nobold">{{lbl_lyrics}}:</span></td>
                    <td><textarea name="lyrics" style="resize: vertical;max-height: 300px;">{{lyrics}}</textarea></td>
                </tr>
                <tr>
                    <td width="120" valign="top"></td>
                    <td>
                        <label class="checkbox"><input type="checkbox" name="explicit"><span>{{lbl_explicit}}</span></label>
                        <label class="checkbox"><input type="checkbox" name="unlisted"><span>{{lbl_unlisted}}</span></label>
                    </td>
                </tr>
                <tr id="percentage" style="visibility: collapse;">
                    <td width="120" valign="top" colspan="2">
                        <div class="progress">
                            <div class="progress-bar" style="width: 0%;"></div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>`
);

vkify.once("showAudioUploadPopup", () => {
    window.showAudioUploadPopup = async (options = {}) => {
        const ownerId = options.ownerId ?? window.openvk?.current_id ?? 0;

        const audioUploadPopup = new CMessageBox({
            title: tr('upload_audio'),
            body: popupBodyTpl({
                limits: tr('limits'),
                req1: tr('audio_requirements', 1, 30, 25),
                req2: tr('audio_requirements_2'),
                upload_button: tr('upload_button'),
                select_another: tr('select_another_file')
            }),
            buttons: [tr('close')],
            callbacks: [() => {
                if (window.__audio_upload_page === vkify.audioUploadPage) {
                    window.__audio_upload_page = null;
                }
                vkify.audioUploadPage = null;
                audioUploadPopup.close();
            }]
        });

        const modalNode = audioUploadPopup.getNode();
        modalNode.addClass('ovk-msg-sheet');

        const id3Src = '/assets/packages/static/openvk/js/node_modules/id3js/lib/id3.js';
        let id3 = window.id3;
        if (!id3) {
            try {
                id3 = await import(id3Src);
            } catch (e) {
                console.error('Failed to load id3js via dynamic import:', e);
            }
        }

        window.__audio_upload_page = vkify.audioUploadPage = new class {
            files_list = [];
            ownerId = ownerId;

            hideFirstPage() {
                modalNode.find('#firstStep').attr('style', 'display:none');
                modalNode.find('#lastStep').attr('style', 'display:block');
            }

            showFirstPage() {
                modalNode.find('#firstStep').attr('style', 'display:block');
                modalNode.find('#lastStep').attr('style', 'display:none');
            }

            async detectTags(blob) {
                const return_params = {
                    performer: '',
                    name: '',
                    genre: '',
                    lyrics: '',
                    explicit: 0,
                    unlisted: 0,
                };

                const fallback = () => {
                    console.info('Tags not found, setting default values.');
                    return_params.name = remove_file_format(blob.name);
                    return_params.genre = 'Other';
                    return_params.performer = tr('track_unknown');
                };

                let tags = null;
                if (id3) {
                    try {
                        tags = await (id3.fromFile ? id3.fromFile(blob) : id3.default?.fromFile?.(blob));
                    } catch(e) {
                        console.error(e);
                    }
                }

                if (tags != null) {
                    if (tags.title) {
                        return_params.name = tags.title;
                    } else {
                        return_params.name = remove_file_format(blob.name);
                    }

                    if (tags.artist) {
                        return_params.performer = tags.artist;
                    } else {
                        return_params.performer = tr('track_unknown');
                    }

                    if (tags.genre != null) {
                        if (tags.genre.split(', ').length > 1) {
                            const genres = tags.genre.split(', ');
                            genres.forEach(genre => {
                                if (window.openvk?.audio_genres && window.openvk.audio_genres.indexOf(genre) !== -1) {
                                    return_params.genre = genre;
                                }
                            });
                        } else {
                            if (window.openvk?.audio_genres && window.openvk.audio_genres.indexOf(tags.genre) !== -1) {
                                return_params.genre = tags.genre;
                            } else {
                                console.warn(`Unknown genre: ${tags.genre}`);
                                return_params.genre = 'Other';
                            }
                        }
                    } else {
                        return_params.genre = 'Other';
                    }

                    if (tags.comments != null) {
                        return_params.lyrics = tags.comments;
                    }
                } else {
                    fallback();
                }

                return return_params;
            }

            async appendFile(appender) {
                appender.info = await this.detectTags(appender.file);
                const audio_index = this.files_list.push(appender) - 1;
                this.appendAudioFrame(audio_index);
            }

            appendAudioFrame(audio_index) {
                const audio_element = this.files_list[audio_index];
                if (!audio_element) return;

                const genres = (window.openvk?.audio_genres || []).map(g => ({
                    value: g,
                    selected: g === audio_element.info.genre
                }));

                const html = audioFrameTpl({
                    audio_index,
                    display_name: ovk_proc_strtr(audio_element.file.name, 63),
                    performer: audio_element.info.performer,
                    name: audio_element.info.name,
                    lyrics: audio_element.info.lyrics,
                    genres,
                    lbl_performer: tr('performer'),
                    lbl_name: tr('audio_name'),
                    lbl_genre: tr('genre'),
                    lbl_lyrics: tr('lyrics'),
                    lbl_explicit: tr('audios_explicit'),
                    lbl_unlisted: tr('audios_unlisted')
                });

                modalNode.find('#lastStep #lastStepContainers').append(u(html));
            }
        };

        modalNode.find('#audio_upload input').on('change', (e) => {
            const files = e.target.files;
            if (files.length <= 0) return;

            Array.from(files).forEach(async file => {
                let has_duplicates = false;
                const appender = { 'file': file };

                const isAudio = (file.type && file.type.startsWith('audio/')) || /\.(mp3|ogg|wav|flac|m4a|aac)$/i.test(file.name);
                if (!isAudio) {
                    makeError(tr('only_audios_accepted', escapeHtml(file.name)));
                    return;
                }

                vkify.audioUploadPage.files_list.forEach(el => {
                    if (el && file.name === el.file.name) {
                        has_duplicates = true;
                    }
                });

                if (!has_duplicates) {
                    vkify.audioUploadPage.appendFile(appender);
                }
            });
            vkify.audioUploadPage.hideFirstPage();
        });

        modalNode.on('click', '.upload_container_element #small_remove_button', (e) => {
            if (modalNode.find('.uploading').length > 0) return;
            const element = u(e.target).closest('.upload_container_element');
            const element_index = Number(element.attr('data-index'));
            element.remove();
            if (vkify.audioUploadPage?.files_list) {
                vkify.audioUploadPage.files_list[element_index] = null;
            }
            if (modalNode.find('#lastStep .upload_container_element').length < 1) {
                vkify.audioUploadPage?.showFirstPage();
            }
        });

        modalNode.on("drop", "#upload_container", function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const fileInput = modalNode.find("#audio_input").nodes[0];
            if (fileInput) {
                fileInput.files = e.dataTransfer.files;
                u(fileInput).trigger("change");
            }
        });
        modalNode.on("dragover", "#upload_container", function (e) {
            e.preventDefault();
        });

        modalNode.find('#uploadMusicPopup').on('click', async () => {
            let uploadPage = '/player/upload';
            if (options.playlist) {
                uploadPage += `?playlist=${encodeURIComponent(options.playlist)}`;
            } else if (ownerId < 0) {
                uploadPage += `?gid=${encodeURIComponent(Math.abs(ownerId))}`;
            }
            let endRedir = '';
            let uploadedCount = 0;

            modalNode.find('#lastStepButtons').addClass('lagged');

            for (const elem of modalNode.find('#lastStepContainers .upload_container_element').nodes) {
                if (!elem) continue;

                const elemU = u(elem);
                const index = elem.dataset.index;
                const file = vkify.audioUploadPage?.files_list[index];
                if (!file || index === undefined || index === null || index === '') continue;

                elemU.addClass('lagged').find('.upload_container_name').addClass('uploading');

                const fd = typeof serializeForm === 'function' ? serializeForm(elem) : new FormData(elem);
                fd.append('blob', file.file);
                fd.append('ajax', 1);
                fd.append('hash', window.router?.csrf || u('meta[name=csrf]').attr('value'));

                const percentageNode = elemU.find("#percentage").nodes[0];
                if (percentageNode) {
                    percentageNode.style.visibility = "visible";
                }
                const xhr = new XMLHttpRequest();

                try {
                    const rawResult = await new Promise((resolve) => {
                        xhr.upload.addEventListener("progress", (event) => {
                            if (event.lengthComputable) {
                                const barNode = elemU.find(".progress-bar").nodes[0];
                                if (barNode) {
                                    barNode.style.width = (event.loaded / event.total * 100) + "%";
                                }
                            }
                        });
                        xhr.addEventListener("loadend", () => {
                            resolve(xhr);
                        });
                        xhr.open("POST", uploadPage, true);
                        xhr.send(fd);
                    });

                    const result = JSON.parse(rawResult.response);

                    if (result.success) {
                        endRedir = result.redirect_link;
                        uploadedCount++;
                    } else {
                        makeError(escapeHtml(result.flash?.message || tr('error')));
                    }
                } catch (e) {
                    console.error(e);
                    makeError(tr('error'));
                }

                await sleep(1000);
                elemU.remove();
            }

            audioUploadPopup.close();
            if (window.__audio_upload_page === vkify.audioUploadPage) {
                window.__audio_upload_page = null;
            }
            vkify.audioUploadPage = null;

            if (uploadedCount > 0) {
                const baseFetchUrl = ownerId < 0 ? `/audios-${Math.abs(ownerId)}` : `/audios${ownerId || window.openvk?.current_id || 0}`;
                const separator = baseFetchUrl.includes('?') ? '&' : '?';
                const fetchUrl = `${baseFetchUrl}${separator}_t=${Date.now()}`;
                try {
                    const doc = await window.ContentFetcher.fetchPageContent(fetchUrl, null, { showLoader: true });
                    const newAudioEmbeds = Array.from(doc.querySelectorAll('.audioEmbed')).slice(0, uploadedCount);
                    
                    if (typeof options.onUploaded === 'function') {
                        options.onUploaded(newAudioEmbeds);
                        return;
                    }

                    if (options.targetForm) {
                        const form = u(options.targetForm);
                        form.closest('.model_content_textarea').addClass('shown');
                        const target = options.playlistMode ? '.PE_audios' : '.post-vertical';
                        const dataTypeAttr = options.playlistMode ? '' : " data-type='audio'";
                        newAudioEmbeds.forEach(audioEl => {
                            const id = audioEl.getAttribute('data-prettyid') || audioEl.getAttribute('data-realid') || audioEl.getAttribute('data-id');
                            form.find(target).append(`
                                <div class="vertical-attachment upload-item" draggable="true"${dataTypeAttr} data-id="${id}">
                                    <div class='vertical-attachment-content' draggable="false">
                                        ${audioEl.outerHTML}
                                    </div>
                                    <div class="vertical-attachment-remove">
                                        <div id="small_remove_button"></div>
                                    </div>
                                </div>
                            `);
                        });
                        return;
                    }

                    const playlistEditPage = document.querySelector('.PE_playlistEditPage');
                    if (playlistEditPage) {
                        const peAudios = playlistEditPage.querySelector('.PE_audios');
                        if (peAudios) {
                            newAudioEmbeds.reverse().forEach(audioEl => {
                                const id = audioEl.getAttribute('data-prettyid') || audioEl.getAttribute('data-realid') || audioEl.getAttribute('data-id');
                                const itemHtml = `
                                    <div class="vertical-attachment upload-item" draggable="true" data-id="${id}">
                                        <div class="vertical-attachment-content" draggable="false">
                                            ${audioEl.outerHTML}
                                        </div>
                                        <div class="vertical-attachment-remove">
                                            <div id="small_remove_button"></div>
                                        </div>
                                    </div>
                                `;
                                u(peAudios).append(itemHtml);
                            });
                            if (window.updatePlaylistEmptyState) {
                                window.updatePlaylistEmptyState();
                            }
                        }
                    } else {
                        const audiosContainer = document.querySelector('.audiosContainer');
                        if (audiosContainer) {
                            const emptyErr = audiosContainer.querySelector('.content_page_error');
                            if (emptyErr) {
                                emptyErr.remove();
                            }

                            let target = audiosContainer;
                            let nodeClass = 'scroll_node';
                            
                            if (audiosContainer.classList.contains('audiosSideContainer')) {
                                let scrollContainer = audiosContainer.querySelector('.scroll_container');
                                if (!scrollContainer) {
                                    audiosContainer.insertAdjacentHTML('beforeend', '<div class="scroll_container"></div>');
                                    scrollContainer = audiosContainer.querySelector('.scroll_container');
                                }
                                target = scrollContainer;
                            } else if (audiosContainer.classList.contains('AudioPlaylistSnippet__list')) {
                                nodeClass = 'AudioPlaylistSnippet__audioRow scroll_node';
                            }

                            newAudioEmbeds.reverse().forEach(audioEl => {
                                const wrapper = document.createElement('div');
                                wrapper.className = nodeClass;
                                wrapper.appendChild(audioEl);
                                target.insertBefore(wrapper, target.firstChild);
                            });
                        } else if (endRedir && window.router) {
                            window.router.route(endRedir);
                        }
                    }
                } catch (e) {
                    console.error('Failed to post-process uploaded audio:', e);
                    if (options.onUploaded || options.targetForm) {
                        return;
                    }
                    if (endRedir && window.router) {
                        window.router.route(endRedir);
                    }
                }
            } else if (endRedir && window.router && !options.onUploaded && !options.targetForm) {
                window.router.route(endRedir);
            }
        });

        const actionEl = audioUploadPopup.getNode().find('.ovk-diag-action').nodes[0];
        if (actionEl) {
            actionEl.insertAdjacentHTML('afterbegin', `<a href="/search?section=audios" class="button button_light ovk-msg-btn" style="float: left; margin: 0;">${tr('audio_search')}</a>`);
        }
    };
});

})();
