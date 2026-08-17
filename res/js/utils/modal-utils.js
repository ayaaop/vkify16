vkify.once('modalUtils', function() {
    const ModalUtils = {
        setupCleanup(component, cleanupFn) {
            const originalClose = component.close;
            component.close = function() {
                if (typeof cleanupFn === 'function') {
                    cleanupFn();
                }
                originalClose.call(this);
            };
            return component;
        },

        setupKeyboardNav(component, handlers) {
            const keyboardHandler = function(e) {
                if (component.hidden) return;

                const handled = handlers[e.keyCode];
                if (handled) {
                    e.preventDefault();
                    handled(e);
                }
            };

            u(document).on('keydown', keyboardHandler);

            const originalClose = component.close;
            component.close = function() {
                u(document).off('keydown', keyboardHandler);
                originalClose.call(this);
            };

            return keyboardHandler;
        },

        async injectContent(container, targetSelector, sourceUrl, sourceSelector, options = {}) {
            const containerNode = typeof container.getNode === 'function' ? container.getNode() : u(container);
            const target = containerNode.find(targetSelector);

            if (target.length === 0) {
                throw new Error(`Target not found in modal: ${targetSelector}`);
            }

            return window.ContentFetcher.loadInto(target, sourceUrl, sourceSelector, {
                ...options,
                showLoader: !!options.showLoader
            });
        },

        createModalTemplate(type, options = {}) {
            const templates = {
                video: (opts) => `
                    <div class="ovk-photo-view-dimmer">
                        <div class="ovk-modal-video-window${opts.isPrivate ? ' private' : ''}">
                            <div id="video_top_controls_wrapper">
                                <div id="video_top_controls">
                                    <div id="__modalPlayerClose" class="video_top_button video_top_close" role="button" tabindex="0" aria-label="Close">
                                        <div class="video_close_icon"></div>
                                    </div>
                                    ${opts.showMinimize ? `<div id="__modalPlayerMinimize" class="video_top_button video_top_minimize" title="Minimize">
                                        <div class="video_minimize_icon"></div>
                                    </div>` : ''}

                                </div>
                            </div>
                            <div class="page_block">
                                ${opts.content || ''}
                            </div>
                        </div>
                    </div>
                `,
                photo: (opts) => {
                    if (window.isMobile && window.isMobile()) {
                        return `
                        <div class="ovk-photo-view-dimmer">
                            <div class="ovk-photo-view-window${opts.isPrivate ? ' private' : ''}">
                                ${opts.content || ''}
                            </div>
                        </div>`;
                    }
                    return `
                    <div class="ovk-photo-view-dimmer">
                        <div class="ovk-photo-view-window${opts.isPrivate ? ' private' : ''}">
                            <div id="photo_top_controls">
                                <div id="__modal_photo_close" class="photo_top_button photo_top_close" role="button" tabindex="0" aria-label="Close">
                                    <div class="photo_close_icon"></div>
                                </div>
                            </div>
                            ${opts.content || ''}
                        </div>
                    </div>
                `;
                },
                post: (opts) => `
                    <div class="ovk-photo-view-dimmer post_popup_modal">
                        <div class="ovk-modal-video-window">
                            <div id="video_top_controls_wrapper">
                                <div id="video_top_controls">
                                    <div id="__modalPlayerClose" class="video_top_button video_top_close" role="button" tabindex="0" aria-label="Close">
                                        <div class="video_close_icon"></div>
                                    </div>
                                </div>
                            </div>
                            ${opts.content || ''}
                        </div>
                    </div>
                `
            };

            const template = templates[type];
            if (!template) {
                throw new Error(`Unknown modal template type: ${type}`);
            }

            return u(template(options));
        },

        createModal(options) {
            const { type, title, content, isPrivate, showMinimize, hasSourceInline, closeOnButtons, warnOnExit, uniqueName } = options;

            if (this.hasActiveModal()) {
                const activeModal = this.getActiveModal();
                if (activeModal && typeof activeModal.close === 'function') {
                    activeModal.close();
                }
            }

            const template = this.createModalTemplate(type, { content, isPrivate, showMinimize, hasSourceInline });

            const modal = new CMessageBox({
                title: title || '',
                custom_template: template,
                close_on_buttons: closeOnButtons !== undefined ? closeOnButtons : false,
                warn_on_exit: warnOnExit !== undefined ? warnOnExit : false,
                unique_name: uniqueName || null
            });

            this.registerModal(modal, type);

            return modal;
        },

        setupDimmerClose(component, dimmerSelector = '.ovk-photo-view-dimmer') {
            component.getNode().on('click', dimmerSelector, (e) => {
                if (u(e.target).hasClass(dimmerSelector.replace('.', ''))) {
                    component.close();
                }
            });
        },

        setupCloseButton(component, buttonSelector) {
            component.getNode().find(buttonSelector).on('click', (e) => {
                e.preventDefault();
                component.close();
            });
        },

        async checkPrivacyRestriction(ownerId, type = 'user') {
            if (ownerId <= 0) return false;

            const currentUser = window.openvk?.current_id || 0;
            if (currentUser == ownerId) return false;

            try {
                if (type === 'user') {
                    const userInfo = await window.OVKAPI.call('users.get', {
                        'user_ids': ownerId,
                        'fields': 'is_closed,can_access_closed'
                    });
                    const user = userInfo?.[0];
                    if (!user?.is_closed) return false;
                    return !user?.can_access_closed;
                } else if (type === 'photo') {
                    const photoUrl = `/photo${ownerId}`;
                    const response = await fetch(photoUrl, { method: 'HEAD' });
                    return response.status === 302 || !response.ok || response.redirected ||
                           response.status === 403 || response.status === 404;
                }
            } catch (e) {
                console.warn('Could not check privacy status:', e);
                return true;
            }

            return false;
        },

        modalRegistry: new Map(),

        registerModal(modal, type = 'default') {
            const modalId = modal === null || modal === undefined ? Symbol('modal') : modal;
            this.modalRegistry.set(modalId, { modal, type, timestamp: Date.now() });
            return modalId;
        },

        unregisterModal(modalId) {
            return this.modalRegistry.delete(modalId);
        },

        getActiveModal() {
            if (this.modalRegistry.size === 0) return null;
            const entries = Array.from(this.modalRegistry.entries());
            const latest = entries.sort((a, b) => b[1].timestamp - a[1].timestamp)[0];
            return latest ? latest[1].modal : null;
        },

        hasActiveModal() {
            return this.modalRegistry.size > 0;
        }
    };

    window.ModalUtils = ModalUtils;
});
