vkify.once('uiSearch', function () {
    if (window.uiSearch) return;

    window.uiSearch = {
        customConfigs: new Map(),

        init: function (element = null, config = {}) {
            if (element) {
                this.initializeElement(element, config);
            } else {
                const run = () => {
                    this.bindEvents();
                    this.initializeExistingFields();
                };

                vkify.ready(run);
            }
        },

        initializeElement: function (element, config = {}) {
            const searchContainer = element.closest
                ? element.closest('.ui_search')
                : (element.classList && element.classList.contains('ui_search') ? element : null);

            if (!searchContainer) return;

            const elementId = this.getElementId(searchContainer);
            this.customConfigs.set(elementId, {
                onInput: config.onInput || null,
                onChange: config.onChange || null,
                onReset: config.onReset || null,
                onSubmit: config.onSubmit || null,
                onButtonClick: config.onButtonClick || null,
                timeout: config.timeout || 0,
                processQuery: config.processQuery || null,
                ...config
            });

            const input = searchContainer.querySelector('.ui_search_field');
            if (input && input.value && input.value.trim() !== '') {
                searchContainer.classList.remove('ui_search_field_empty');
                this.updateResetButton(searchContainer, input.value.trim());
            }
        },

        getElementId: function (element) {
            if (element.id) return element.id;
            if (element.dataset && element.dataset.searchId) return element.dataset.searchId;

            const input = element.querySelector('.ui_search_field');
            const placeholder = input ? input.placeholder : '';
            const position = Array.from(document.querySelectorAll('.ui_search')).indexOf(element);
            return `ui_search_${position}_${placeholder.replace(/\s+/g, '_')}`;
        },

        bindEvents: function () {
            vkify.bindOnce('uiSearchEvents', () => {
                document.addEventListener('input', (e) => {
                    if (e.target && e.target.classList && e.target.classList.contains('ui_search_field')) {
                        this.handleInputChange(e.target, e);
                    }
                });

                document.addEventListener('click', (e) => {
                    if (e.target && e.target.classList && e.target.classList.contains('ui_search_reset')) {
                        this.reset(e.target, false, e);
                    } else if (e.target && e.target.classList && e.target.classList.contains('ui_search_button_search')) {
                        this.handleButtonClick(e.target, e);
                    }
                });

                document.addEventListener('change', (e) => {
                    if (e.target && e.target.classList && e.target.classList.contains('ui_search_field')) {
                        this.handleChange(e.target, e);
                    }
                });

                document.addEventListener('submit', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.ui_search')) {
                        this.handleSubmit(e);
                    }
                });

                document.addEventListener('focus', (e) => {
                    if (e.target && e.target.classList && e.target.classList.contains('ui_search_field')) {
                        this.handleFocus(e.target);
                    }
                }, true);

                document.addEventListener('blur', (e) => {
                    if (e.target && e.target.classList && e.target.classList.contains('ui_search_field')) {
                        this.handleBlur(e.target);
                    }
                }, true);
            });
        },

        getConfig: function (searchContainer) {
            const elementId = this.getElementId(searchContainer);
            return this.customConfigs.get(elementId) || {};
        },

        handleInputChange: function (input, event) {
            const searchContainer = input.closest('.ui_search');
            if (!searchContainer) return;

            const value = input.value.trim();
            const config = this.getConfig(searchContainer);

            if (value === '') {
                searchContainer.classList.add('ui_search_field_empty');
            } else {
                searchContainer.classList.remove('ui_search_field_empty');
            }

            this.updateResetButton(searchContainer, value);

            if (config.onInput) {
                const processedQuery = config.processQuery ? config.processQuery(value) : value;

                if (config.timeout > 0) {
                    if (searchContainer._searchTimeout) {
                        clearTimeout(searchContainer._searchTimeout);
                    }

                    searchContainer._searchTimeout = setTimeout(() => {
                        config.onInput(processedQuery, input, event);
                    }, config.timeout);
                } else {
                    config.onInput(processedQuery, input, event);
                }
            }
        },

        handleChange: function (input, event) {
            const searchContainer = input.closest('.ui_search');
            if (!searchContainer) return;

            const config = this.getConfig(searchContainer);
            if (config.onChange) {
                const value = input.value.trim();
                const processedQuery = config.processQuery ? config.processQuery(value) : value;
                config.onChange(processedQuery, input, event);
            }
        },

        handleButtonClick: function (button, event) {
            const searchContainer = button.closest('.ui_search');
            if (!searchContainer) return;

            const config = this.getConfig(searchContainer);
            if (config.onButtonClick) {
                event.preventDefault();
                const input = searchContainer.querySelector('.ui_search_field');
                if (input) {
                    const value = input.value.trim();
                    const processedQuery = config.processQuery ? config.processQuery(value) : value;
                    config.onButtonClick(processedQuery, input, event);
                }
            }
        },

        handleFocus: function (input) {
            const searchContainer = input.closest('.ui_search');
            if (searchContainer) {
                searchContainer.classList.add('ui_search_focused');
            }
        },

        handleBlur: function (input) {
            const searchContainer = input.closest('.ui_search');
            if (searchContainer) {
                searchContainer.classList.remove('ui_search_focused');
            }
        },

        updateResetButton: function (container, value) {
            const resetButton = container.querySelector('.ui_search_reset');
            if (!resetButton) return;

            if (value === '') {
                resetButton.style.visibility = 'hidden';
                resetButton.style.opacity = '0';
            } else {
                resetButton.style.visibility = 'visible';
                resetButton.style.opacity = '0.75';
            }
        },

        reset: function (resetButton, clearFocus = false, event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const searchContainer = resetButton.closest('.ui_search');
            if (!searchContainer) return false;

            const input = searchContainer.querySelector('.ui_search_field');
            if (!input) return false;

            const config = this.getConfig(searchContainer);

            input.value = '';
            searchContainer.classList.add('ui_search_field_empty');
            this.updateResetButton(searchContainer, '');

            if (!clearFocus) {
                input.focus();
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));

            if (config.onReset) {
                config.onReset(input, event);
            }

            return false;
        },

        handleSubmit: function (event) {
            const searchContainer = event.target.closest('.ui_search');
            if (!searchContainer) return true;

            const config = this.getConfig(searchContainer);
            if (config.onSubmit) {
                const input = searchContainer.querySelector('.ui_search_field');
                const result = config.onSubmit(input, event);
                if (result === false) {
                    event.preventDefault();
                    return false;
                }
            }
            return true;
        },

        initializeExistingFields: function () {
            const searchInputs = document.querySelectorAll('.ui_search_field');
            searchInputs.forEach(input => {
                if (input.value && input.value.trim() !== '') {
                    const searchContainer = input.closest('.ui_search');
                    if (searchContainer) {
                        searchContainer.classList.remove('ui_search_field_empty');
                        this.updateResetButton(searchContainer, input.value.trim());
                    }
                }
            });
        }

    };

    window.uiSearch.init();
});