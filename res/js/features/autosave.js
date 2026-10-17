(function () {
    if (!window.vkify) return;

    const sidebarMap = {
        menu_bildoj: '.my_photos',
        menu_filmetoj: '.my_videos',
        menu_muziko: '.my_audios',
        menu_mesagoj: '.my_messages',
        menu_notatoj: '.my_notes',
        menu_grupoj: '.my_groups',
        menu_eventoj: '.my_events',
        menu_novajoj: '.my_feed',
        menu_aplikoj: '.my_apps',
        menu_stickers: '.my_stickers',
        menu_doxc: '.my_docs',
        menu_feva: '.my_fave',
        menu_ligiloj: '.custom_link',
        menu_standardo: '.ad_poster'
    };

    function toggleSidebarLink(name, checked) {
        const selector = sidebarMap[name];
        if (!selector) return;
        const nav = document.querySelector('.sidebar_inner');
        if (!nav) return;
        const links = nav.querySelectorAll(selector);
        links.forEach(link => link.style.display = checked ? '' : 'none');
        
        if (name === 'menu_ligiloj') {
            const langSelect = document.querySelector('#language-select');
            if (langSelect) langSelect.style.display = checked ? 'none' : 'flex';
        }
    }

    function getLabel(el) {
        const pageBlock = el.closest('.page_block');
        return pageBlock?.querySelector('.settings_saved_label') || null;
    }

    function showLoader(el) {
        const label = getLabel(el);
        if (!label || !window.LoaderUtils) return;
        clearTimeout(label._hideTimer);
        const textSpan = label.querySelector('.settings_saved_text');
        if (textSpan) textSpan.remove();
        if (!label.querySelector('.pr')) {
            LoaderUtils.show(label, { size: 'small' });
        }
    }

    function hideLoader(el) {
        const label = getLabel(el);
        if (!label) return;
        const loader = label.querySelector('.pr');
        if (loader) loader.remove();
    }

    function animateShow($el, duration = 200) {
        $el.css({ maxHeight: 0, overflow: 'hidden', display: 'block', transition: `max-height ${duration}ms ease-out` });
        const el = $el[0];
        void el.offsetHeight;
        $el.css({ maxHeight: $el.prop('scrollHeight') });
        clearTimeout(el._animTimer);
        el._animTimer = setTimeout(() => {
            $el.css({ maxHeight: '', overflow: '', transition: '' });
        }, duration);
    }

    function animateHide($el, duration = 200, callback) {
        const el = $el[0];
        $el.css({ overflow: 'hidden', transition: `max-height ${duration}ms ease-in`, maxHeight: $el.prop('scrollHeight') });
        void el.offsetHeight;
        $el.css({ maxHeight: 0 });
        clearTimeout(el._animTimer);
        el._animTimer = setTimeout(() => {
            $el.remove();
            if (callback) callback();
        }, duration);
    }

    function showSavedLabel(el, message) {
        const label = getLabel(el);
        message = message || window.tr?.('changes_saved') || 'Changes saved.';

        const form = el.closest('form');
        if (form) removeErrorMessage(form);

        if (!label) {
            if (!form) return;
            let msg = form.querySelector('.settings_saved_msg');
            if (msg) {
                clearTimeout(msg._hideTimer);
                $(msg).stop(true, true);
                msg.textContent = message;
            } else {
                msg = document.createElement('div');
                msg.className = 'information settings_saved_msg';
                msg.textContent = message;
                form.insertBefore(msg, form.firstChild);
                animateShow($(msg));
            }
            msg._hideTimer = setTimeout(() => {
                animateHide($(msg));
            }, 3000);
            return;
        }

        hideLoader(el);
        let textSpan = label.querySelector('.settings_saved_text');
        if (!textSpan) {
            textSpan = document.createElement('span');
            textSpan.className = 'settings_saved_text';
            label.appendChild(textSpan);
        }
        textSpan.textContent = message;
        void textSpan.offsetWidth;
        textSpan.classList.add('visible');

        clearTimeout(label._hideTimer);
        label._hideTimer = setTimeout(() => textSpan.classList.remove('visible'), 1500);
    }

    function removeErrorMessage(form) {
        const msg = form.querySelector('.settings_error_msg');
        if (msg) {
            clearTimeout(msg._hideTimer);
            $(msg).stop(true, true);
            animateHide($(msg));
        }
    }

    function showSaveError(form, message) {
        hideLoader(form);
        const label = getLabel(form);
        if (label) {
            const textSpan = label.querySelector('.settings_saved_text');
            if (textSpan) textSpan.remove();
        }

        message = message || window.vkifylang?.error_saving || 'Error saving settings.';
        let msg = form.querySelector('.settings_error_msg');
        if (msg) {
            clearTimeout(msg._hideTimer);
            $(msg).stop(true, true);
            msg.textContent = message;
        } else {
            msg = document.createElement('div');
            msg.className = 'msg msg_yellow settings_error_msg';
            msg.textContent = message;
            form.insertBefore(msg, form.firstChild);
            animateShow($(msg));
        }
    }

    function extractFlashMessage(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pageBody = doc.querySelector('.page_body');
        if (!pageBody) return null;

        const scripts = pageBody.querySelectorAll(':scope > script');
        for (const script of scripts) {
            const text = script.textContent;
            const match = text.match(/NewNotification\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*\)/s)
                       || text.match(/MessageBox\s*\(\s*(["'])(.*?)\1\s*,\s*(["'])(.*?)\3\s*,/s);
            if (match) {
                return { title: match[2], message: match[4] };
            }
        }
        return null;
    }

    function isFlashSuccess(title) {
        const successLabel = window.tr?.('changes_saved') || 'Changes saved.';
        return title === successLabel;
    }

    function flashFormData(formDataEl) {
        if (!formDataEl) return;
        window.vkify?.ensureStyle?.('settings');
        formDataEl.classList.remove('flash-error');
        void formDataEl.offsetWidth;
        formDataEl.classList.add('flash-error');
        clearTimeout(formDataEl._flashTimer);
        formDataEl._flashTimer = setTimeout(() => formDataEl.classList.remove('flash-error'), 3000);
    }

    function flashField(form, name) {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        const field = input.closest('.form_field');
        if (!field) return;
        flashFormData(field.querySelector('.form_data'));
    }

    function flashElement(el) {
        if (!el) return;
        const field = el.closest('.form_field');
        if (!field) return;
        flashFormData(field.querySelector('.form_data'));
    }

    const errorFieldMap = {
        invalid_email_address: ['email_contact', 'new_email'],
        invalid_email_address_comment: ['email_contact', 'new_email'],
        invalid_telegram_name: ['telegram'],
        invalid_telegram_name_comment: ['telegram'],
        invalid_real_name: ['first_name', 'last_name'],
        error_shorturl: ['pseudo'],
        backdrop_error_no_media: ['backdrop1', 'backdrop2'],
        error_shorturl_incorrect: ['shortcode', 'sc'],
        error_invalid_wall_value: ['wall'],
        error_when_uploading_photo: ['ava'],
        error_on_server_side: [],
        no_title_specified: ['title'],
        failed_to_change_topic: ['title'],
        app_err_url: ['url'],
        app_err_ava: ['ava'],
        app_err_note: ['note'],
        error_old_password: ['old_pass'],
        error_new_password: ['new_pass', 'repeat_pass'],
        incorrect_password: ['email_change_pass'],
        incorrect_2fa_code: ['email_change_code', 'password_change_code'],
        email_rate_limit_error: ['new_email'],
        user_already_exists: ['new_email']
    };

    function getErrorFields(form, title, message) {
        const tr = window.tr || ((key) => key);
        const msg = message || '';
        const normalize = (str) => str.replace(/\s+/g, ' ').trim();

        const matches = (key) => {
            const translated = normalize(tr(key));
            return title === translated || msg === translated;
        };

        const dataFields = form.querySelectorAll('[data-autosave-error]');
        for (const field of dataFields) {
            const key = field.dataset.autosaveError;
            const commentKey = key + '_comment';
            if (matches(key) || matches(commentKey)) {
                return [field.name];
            }
        }

        for (const [key, names] of Object.entries(errorFieldMap)) {
            if (matches(key)) {
                return names;
            }
        }

        return [];
    }

    function flashErrorFields(form, title, message, fallbackEl) {
        const fields = getErrorFields(form, title, message);
        if (fields.length) {
            fields.forEach(name => flashField(form, name));
        } else if (fallbackEl) {
            flashElement(fallbackEl);
        }
    }

    function initAutoSave() {
        const forms = document.querySelectorAll('form[data-autosave="true"]');
        forms.forEach(form => {
            if (form.dataset.autosaveBound) return;
            form.dataset.autosaveBound = '1';

            let lastSave = 0, pending = false, queued = false, reloadAfterSave = false, lastChangedEl = null;
            const MIN_INTERVAL = 1000, ERROR_COOLDOWN = 3000;

            function shouldReloadAfterSave(el) {
                if (!(el instanceof Element)) return false;
                if (!form.matches('form[action*="act=interface"]')) return false;

                return el.name === 'style' || el.name === 'theme_for_session';
            }

            function navigateToFreshPage() {
                const url = new URL(window.location.href);
                url.searchParams.set('_themeReload', Date.now().toString());
                window.location.replace(url.toString());
            }

            async function submitForm() {
                if (pending) { queued = true; return; }
                const now = Date.now(), wait = lastSave + MIN_INTERVAL - now;
                if (wait > 0) { setTimeout(submitForm, wait); return; }

                pending = true;
                const formData = new FormData(form);
                try {
                    const response = await fetch(form.action || window.location.href, {
                        method: 'POST',
                        body: formData,
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                        credentials: 'same-origin'
                    });
                    lastSave = Date.now();

                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const data = await response.json();
                        if (data.success) {
                            showSavedLabel(form);
                            if (reloadAfterSave) {
                                navigateToFreshPage();
                                return;
                            }
                        } else {
                            showSaveError(form, data.flash?.title);
                            flashErrorFields(form, data.flash?.title, data.flash?.message, lastChangedEl);
                            lastSave += ERROR_COOLDOWN;
                        }
                        pending = false;
                        reloadAfterSave = false;
                        if (queued) { queued = false; submitForm(); }
                        return;
                    }

                    if (!response.ok && response.status !== 302) {
                        showSaveError(form);
                        flashElement(lastChangedEl);
                        lastSave += ERROR_COOLDOWN;
                        pending = false;
                        reloadAfterSave = false;
                        if (queued) { queued = false; submitForm(); }
                        return;
                    }

                    const html = await response.text();
                    const flash = extractFlashMessage(html);
                    if (flash && !isFlashSuccess(flash.title)) {
                        showSaveError(form, flash.title);
                        flashErrorFields(form, flash.title, flash.message, lastChangedEl);
                        lastSave += ERROR_COOLDOWN;
                    } else {
                        showSavedLabel(form, flash ? flash.title : null);
                        if (reloadAfterSave) {
                            navigateToFreshPage();
                            return;
                        }
                    }
                } catch (e) {
                    vkify.warn('Auto-save failed:', e);
                    showSaveError(form);
                    flashElement(lastChangedEl);
                    lastSave = Date.now() + ERROR_COOLDOWN;
                }
                pending = false;
                reloadAfterSave = false;
                if (queued) { queued = false; submitForm(); }
            }

            form.addEventListener('submit', (e) => {
                e.preventDefault();
            });

            form.addEventListener('input', (e) => {
                const el = e.target;
                if (el.type === 'hidden' || el.type === 'file') return;
                if (form.querySelector('.settings_error_msg')) {
                    removeErrorMessage(form);
                }
            });

            form.addEventListener('change', (e) => {
                const el = e.target;
                if (el.type === 'hidden' || el.type === 'file') return;
                lastChangedEl = el;
                if (el.dataset.act === 'localstorage_item' || el.closest('#vkifySettings')) {
                    showSavedLabel(el);
                    return;
                }
                if (el.type === 'checkbox' && sidebarMap[el.name]) {
                    toggleSidebarLink(el.name, el.checked);
                }
                reloadAfterSave = reloadAfterSave || shouldReloadAfterSave(el);
                showLoader(form);
                submitForm();
            });
        });
    }

    window.vkifyShowSavedLabel = showSavedLabel;
    vkify.onPage(initAutoSave);
})();
