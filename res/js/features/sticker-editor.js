vkify.once('stickerEditor', () => {
    const editors = new Map();

    function mount(form) {
        const events = new AbortController();
        const drafts = [];
        const input = form.querySelector('#stickers_file_input');
        const container = form.querySelector('#drafts_container');
        const template = form.querySelector('[data-sticker-draft]');
        const dropzone = form.querySelector('[data-sticker-dropzone]');
        const error = form.querySelector('[data-sticker-upload-error]');
        const isNew = form.dataset.isNew === 'true';
        const previousTax = window.stickersWithdrawTax;
        const tax = Number(form.dataset.withdrawTax) || 0;
        window.stickersWithdrawTax = tax;
        let previousCover = form.querySelector('input[name="main_sticker_id"]:checked')?.value;
        let nextId = 0;
        let dragDepth = 0;

        const on = (node, name, callback) => node.addEventListener(name, callback, { signal: events.signal });
        const covers = () => [...form.querySelectorAll('[data-sticker-cover]')];
        const gifts = () => [...form.querySelectorAll('.sticker-gift-checkbox')];
        const emojiText = textarea => textarea?._contentEditable?.getText() ?? textarea?.value ?? '';
        const nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

        function updateChoices() {
            let cover = covers().find(control => control.checked && !control.disabled);
            if (!cover) {
                cover = covers().find(control => control.name === 'main_sticker_id' && control.value === previousCover && !control.disabled)
                    || covers().find(control => control.name === 'main_sticker_id' && !control.disabled)
                    || covers().find(control => !control.disabled);
                if (cover) cover.checked = true;
            }
            for (const checkbox of gifts()) {
                const card = checkbox.closest('[data-sticker-card]');
                checkbox.disabled = card.classList.contains('photos_deleted') || card.contains(cover);
                if (checkbox.disabled) checkbox.checked = false;
            }
            const selectedGifts = `${gifts().filter(control => control.checked).length} / 3`;
            form.querySelectorAll('#gift_selected_count, [data-sticker-gift-count]').forEach(count => {
                if (count.textContent !== selectedGifts) count.textContent = selectedGifts;
            });
            form.querySelectorAll('[data-sticker-card]').forEach(card => {
                const deleting = card.classList.contains('photos_deleted');
                const restore = card.querySelector('[data-sticker-restore]');
                if (restore) restore.hidden = !deleting;
                const actions = card.querySelector('.photos_edit_actions');
                if (actions) actions.inert = deleting;
            });
            const front = form.querySelector('#gift_front_sticker_name');
            if (front) {
                const card = cover?.closest('[data-sticker-card]');
                front.textContent = emojiText(card?.querySelector('.sticker-emoji-input')).trim() || (cover?.name === 'main_sticker_id' ? '#' + cover.value : '');
            }
        }

        function syncFiles() {
            const transfer = new DataTransfer();
            drafts.forEach((draft, index) => {
                transfer.items.add(draft.file);
                draft.cover.value = index;
            });
            input.files = transfer.files;
            form.querySelector('#draft_counter').textContent = drafts.length ? tr('stickers_count', drafts.length) : '';
            form.querySelector('[data-sticker-pending]').hidden = drafts.length === 0;
        }

        function release(draft) {
            if (draft.url) URL.revokeObjectURL(draft.url);
            if (draft.card.contains(window.ContentEditable?.lastFocused?.el)) window.ContentEditable.lastFocused = null;
            draft.card.remove();
        }

        function addFiles(files) {
            let invalid = false;
            for (const file of files) {
                if (!/\.(png|jpe?g|webp|gif|json|tgs)$/i.test(file.name)) {
                    invalid = true;
                    continue;
                }
                const card = template.content.firstElementChild.cloneNode(true);
                const textarea = card.querySelector('textarea');
                const cover = card.querySelector('[data-sticker-cover]');
                const id = `sticker_draft_${nextId++}`;
                textarea.id = id;
                cover.id = id + '_cover';
                cover.name = isNew ? 'main_sticker_index' : 'new_main_sticker_index';
                const draft = { file, card, cover, url: null };
                const thumb = card.querySelector('[data-sticker-thumb]');
                if (/\.(json|tgs)$/i.test(file.name)) {
                    const badge = document.createElement('span');
                    badge.className = 'sticker_editor_format';
                    badge.textContent = file.name.split('.').pop().toUpperCase();
                    thumb.append(badge);
                } else {
                    const image = document.createElement('img');
                    draft.url = URL.createObjectURL(file);
                    image.src = draft.url;
                    image.alt = file.name;
                    thumb.append(image);
                }
                card.querySelector('[data-sticker-filename]').textContent = file.name;
                card.querySelector('[data-sticker-filename]').title = file.name;
                drafts.push(draft);
                container.append(card);
                window.ContentEditable?.enhance(textarea);
            }
            error.hidden = !invalid;
            syncFiles();
            updateChoices();
        }

        on(input, 'change', () => addFiles([...input.files]));
        on(form, 'click', event => {
            const action = event.target.closest('[data-sticker-action]');
            if (action) {
                switch (action.dataset.stickerAction) {
                    case 'upload':
                        input.value = '';
                        input.click();
                        break;
                    case 'remove': {
                        const index = drafts.findIndex(draft => draft.card.contains(action));
                        const next = drafts[index + 1] || drafts[index - 1];
                        if (index !== -1) release(drafts.splice(index, 1)[0]);
                        syncFiles();
                        updateChoices();
                        (next?.card.querySelector('[data-sticker-action="remove"]') || form.querySelector('[data-sticker-action="upload"]')).focus({ preventScroll: true });
                        break;
                    }
                    case 'delete':
                        window.confirmDeletePack(form);
                        break;
                    case 'restore': {
                        const checkbox = action.closest('[data-sticker-card]').querySelector('[data-sticker-delete]');
                        if (checkbox?.checked) {
                            checkbox.click();
                            checkbox.focus({ preventScroll: true });
                        }
                        break;
                    }
                    case 'withdraw':
                        window.withdrawStickers(Number(form.dataset.packId), Number(form.dataset.balance));
                        break;
                }
            }
            const wrap = event.target.closest('.emoji-input-wrap');
            if (wrap && !event.target.closest('.emoji_picker_entrypoint')) {
                wrap.querySelector('textarea')?.focus();
            }
        });
        on(form, 'change', event => {
            const control = event.target;
            if (control.matches('[data-sticker-cover]') && control.checked) {
                covers().forEach(other => { if (other !== control) other.checked = false; });
                if (control.name === 'main_sticker_id') previousCover = control.value;
            }
            if (control.matches('.sticker-gift-checkbox') && control.checked && gifts().filter(checkbox => checkbox.checked).length > 3) {
                control.checked = false;
                if (typeof window.MessageBox === 'function') {
                    window.MessageBox(tr('error'), tr('stickers_gift_max_3_err'), [tr('ok')], [() => {}]);
                }
            }
            if (control.matches('[data-sticker-delete]')) {
                const card = control.closest('[data-sticker-card]');
                card.classList.toggle('photos_deleted', control.checked);
                card.querySelectorAll('[data-sticker-cover], .sticker-emoji-input').forEach(field => {
                    field.disabled = control.checked;
                    if (field.matches('[data-sticker-cover]') && control.checked) field.checked = false;
                    if (field._contentEditable) field._contentEditable.el.contentEditable = String(!control.checked);
                });
            }
            updateChoices();
            if (control.matches('[data-sticker-delete]') && control.checked) {
                control.closest('[data-sticker-card]').querySelector('[data-sticker-action="restore"]')?.focus({ preventScroll: true });
            }
        });
        on(form, 'input', event => {
            if (event.target.closest('.emoji-input-wrap')) updateChoices();
        });
        on(form, 'submit', () => {
            syncFiles();
            form.querySelectorAll('.sticker-emoji-input').forEach(textarea => {
                const text = emojiText(textarea);
                nativeValue.call(textarea, text);
                textarea.textContent = text;
            });
        });

        const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
        on(dropzone, 'dragenter', event => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            dragDepth++;
            dropzone.classList.add('is_dragover');
        });
        on(dropzone, 'dragover', event => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
        });
        on(dropzone, 'dragleave', event => {
            if (!isFileDrag(event)) return;
            event.stopPropagation();
            if (--dragDepth <= 0) dropzone.classList.remove('is_dragover');
        });
        on(dropzone, 'drop', event => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            dragDepth = 0;
            dropzone.classList.remove('is_dragover');
            addFiles([...event.dataTransfer.files]);
        });
        updateChoices();

        return () => {
            events.abort();
            drafts.forEach(release);
            drafts.length = 0;
            updateChoices();
            input.value = '';
            form.querySelector('[data-sticker-pending]').hidden = true;
            form.querySelector('#draft_counter').textContent = '';
            if (window.stickersWithdrawTax === tax) {
                if (previousTax === undefined) delete window.stickersWithdrawTax;
                else window.stickersWithdrawTax = previousTax;
            }
        };
    }

    vkify.onPage(() => {
        document.querySelectorAll('[data-sticker-editor]').forEach(form => {
            if (!editors.has(form)) editors.set(form, mount(form));
        });
    });
    vkify.onPageLifecycle('beforePageLeave', () => {
        editors.forEach(destroy => destroy());
        editors.clear();
    });
});
