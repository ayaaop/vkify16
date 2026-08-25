vkify.once('contentFetcher', function() {
    const ContentFetcher = {
        async request(url, options = {}) {
            const {
                method = 'GET',
                body = null,
                headers = {},
                responseType = 'text',
                ajaxQuery = true,
                showLoader = false,
                target = null,
                loaderOptions = {},
                skipRedirectError = false,
                signal = null,
                credentials = 'same-origin',
                throwOnError = true,
                validate = null,
                onError = null,
                errorMessage = null
            } = options;

            const reqHeaders = { ...headers };
            if (ajaxQuery !== false && !reqHeaders['X-OpenVK-Ajax-Query']) {
                reqHeaders['X-OpenVK-Ajax-Query'] = '1';
            }

            const loaderHandle = this._showLoader({ showLoader, target, loaderOptions });

            try {
                const response = await fetch(url, {
                    method,
                    headers: reqHeaders,
                    body,
                    signal,
                    credentials
                });

                if (response.redirected && !skipRedirectError && throwOnError !== false) {
                    const tr = window.tr || ((key) => key);
                    const msg = new CMessageBox({
                        title: tr('error'),
                        body: tr('forbidden'),
                        buttons: ['OK'],
                        callbacks: [() => { msg.close(); }]
                    });
                    const err = new Error('Page redirected');
                    err.response = response;
                    throw err;
                }

                if (!response.ok && throwOnError !== false) {
                    const err = new Error(`HTTP ${response.status}`);
                    err.response = response;
                    throw err;
                }

                if (typeof validate === 'function' && !validate(response) && throwOnError !== false) {
                    const err = new Error('Request validation failed');
                    err.response = response;
                    throw err;
                }

                if (responseType === 'response') return response;
                if (responseType === 'blob') return await response.blob();
                if (responseType === 'json') return await response.json();
                if (responseType === 'document') {
                    const html = await response.text();
                    return this.extractDomContent(html, options.selector);
                }

                return await response.text();
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                if (typeof onError === 'function') {
                    onError(err);
                } else if (errorMessage && throwOnError !== false) {
                    console.error(errorMessage, err);
                    if (typeof NewNotification === 'function') {
                        NewNotification(window.tr('error'), errorMessage, null);
                    }
                }
                if (throwOnError !== false) throw err;
                return null;
            } finally {
                this._hideLoader(loaderHandle);
            }
        },

        async postForm(url, body, options = {}) {
            const formData = body instanceof FormData ? body : new FormData(body);
            if (options.csrf !== false) {
                const csrf = vkify.getCsrf();
                if (csrf) formData.set('hash', csrf);
            }

            return this.request(url, {
                ...options,
                method: 'POST',
                body: formData,
                ajaxQuery: options.ajaxQuery === true
            });
        },

        async fetchPageContent(url, selector, options = {}) {
            return this.request(url, {
                ...options,
                responseType: 'document',
                selector
            });
        },

        _showLoader(options) {
            if (!options.showLoader) return null;

            if (options.target) {
                if (!window.LoaderUtils) return null;
                const target = window.LoaderUtils._asUmbrella(options.target);
                target.html('');
                window.LoaderUtils.show(target, options.loaderOptions || { size: 'medium' });
                return { target };
            }

            const loader = this.createLoader();
            if (!loader.isShown()) loader.show();
            return { loader };
        },

        _hideLoader(handle) {
            if (!handle) return;
            if (handle.target) {
                window.LoaderUtils.hide(handle.target);
            } else if (handle.loader) {
                handle.loader.hide();
            }
        },

        async loadInto(target, url, selector, options = {}) {
            const node = window.LoaderUtils ? window.LoaderUtils._asUmbrella(target) : u(target);

            try {
                const content = await this.fetchPageContent(url, selector, {
                    ...(options.fetchOptions || {}),
                    ...options,
                    showLoader: options.showLoader !== false,
                    target: node,
                    loaderOptions: options.loaderOptions
                });

                if (typeof options.render === 'function') {
                    options.render(content, node);
                } else if (options.mode === 'append') {
                    node.nodes[0].appendChild(content);
                } else {
                    node.html(content.innerHTML || content);
                }

                if (typeof options.onAfterInsert === 'function') {
                    options.onAfterInsert(content, node);
                }

                if (options.hydrate && typeof bsdnHydrate === 'function') {
                    bsdnHydrate();
                }

                return content;
            } catch (err) {
                if (typeof options.onError === 'function') {
                    options.onError(err, node);
                } else if (options.errorMessage) {
                    node.html(`<div class="error-message">${options.errorMessage}</div>`);
                }

                throw err;
            }
        },

        infiniteScroll(trigger, options = {}) {
            const {
                root = null,
                rootMargin = '200px 0px',
                threshold = 0,
                page: startPage = 1,
                getNextPage = (p) => p + 1,
                load,
                render = () => {},
                hasMore = (result) => !!result,
                container,
                disabled = () => {
                    try {
                        return localStorage.getItem('ux.auto_scroll') === '0';
                    } catch (e) {
                        return false;
                    }
                },
                onError = (err, cont) => console.error(err),
                loaderOptions = { size: 'small' },
                clickToLoad = true
            } = options;

            if (typeof load !== 'function') {
                throw new Error('ContentFetcher.infiniteScroll: load callback is required');
            }

            let currentPage = startPage;
            let loading = false;
            let exhausted = false;
            let abortController = null;
            let observer = null;

            const resolveContainer = () => {
                if (typeof container === 'function') {
                    const result = container();
                    return window.LoaderUtils ? window.LoaderUtils._asUmbrella(result) : u(result);
                }
                if (container) {
                    return window.LoaderUtils ? window.LoaderUtils._asUmbrella(container) : u(container);
                }
                return u(document.body);
            };

            const resolveTrigger = () => {
                if (typeof trigger === 'string') {
                    return resolveContainer().find(trigger).nodes[0] || null;
                }
                if (trigger && trigger.nodes) return trigger.nodes[0] || null;
                return trigger || null;
            };

            const resolveRoot = () => {
                if (root === null || root === undefined) return getScrollRoot();
                if (typeof root === 'string') return u(root).nodes[0] || null;
                if (root && root.nodes) return root.nodes[0] || null;
                return root;
            };

            const getScrollRoot = () => {
                const tr = resolveTrigger();
                if (!tr) return null;
                let el = tr.parentElement;
                while (el && el !== document.body && el !== document.documentElement) {
                    const style = window.getComputedStyle(el);
                    if (/(auto|scroll|overlay)/.test(style.overflow + style.overflowY + style.overflowX)) {
                        return el;
                    }
                    el = el.parentElement;
                }
                return null;
            };

            const showLoader = (tr) => {
                if (!tr || !window.LoaderUtils) return;
                const $tr = u(tr);
                if ($tr.hasClass('button')) {
                    window.LoaderUtils.showInButton($tr);
                } else {
                    window.LoaderUtils.show($tr, loaderOptions);
                }
            };

            const hideLoader = (tr) => {
                if (!tr || !window.LoaderUtils) return;
                const $tr = u(tr);
                window.LoaderUtils.restoreButton($tr);
                window.LoaderUtils.hide($tr);
            };

            const disconnect = () => {
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                if (abortController) {
                    abortController.abort();
                    abortController = null;
                }
            };

            const doLoad = async () => {
                if (loading || exhausted || disabled()) return;

                const tr = resolveTrigger();
                if (!tr) {
                    exhausted = true;
                    disconnect();
                    return;
                }

                loading = true;
                abortController = new AbortController();
                showLoader(tr);

                try {
                    const result = await load(currentPage, abortController.signal);
                    if (abortController.signal.aborted) return;

                    const cont = resolveContainer();
                    await render(result, cont, currentPage);

                    if (!hasMore(result, currentPage)) {
                        exhausted = true;
                        disconnect();
                        return;
                    }

                    currentPage = getNextPage(currentPage);
                    reconnect();
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    onError(err, resolveContainer());
                } finally {
                    loading = false;
                    hideLoader(resolveTrigger() || tr);
                }
            };

            const reconnect = () => {
                if (observer) observer.disconnect();
                const tr = resolveTrigger();
                if (!tr || exhausted) return;

                observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) doLoad();
                    });
                }, { root: resolveRoot(), rootMargin, threshold });

                observer.observe(tr);
            };

            if (clickToLoad) {
                const cont = resolveContainer();
                const handler = (e) => {
                    e.preventDefault();
                    doLoad();
                };
                if (typeof trigger === 'string') {
                    cont.on('click', trigger, handler);
                } else {
                    cont.on('click', handler);
                }
            }

            reconnect();

            return {
                disconnect,
                reset(newPage = startPage) {
                    if (abortController) {
                        abortController.abort();
                        abortController = null;
                    }
                    currentPage = newPage;
                    exhausted = false;
                    loading = false;
                    reconnect();
                },
                loadNext: doLoad,
                get page() { return currentPage; },
                get isExhausted() { return exhausted; }
            };
        },

        extractDomContent(html, selector) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            if (typeof selector === 'string') {
                const element = doc.querySelector(selector);
                if (!element) {
                    throw new Error(`Element not found: ${selector}`);
                }
                return element;
            } else if (Array.isArray(selector)) {
                const results = {};
                selector.forEach(sel => {
                    const key = typeof sel === 'object' ? sel.key : sel;
                    const query = typeof sel === 'object' ? sel.selector : sel;
                    results[key] = doc.querySelector(query);
                });
                return results;
            }

            return doc;
        },

        _updateUrl(url, options = {}) {
            if (window.router?.updateHistory) {
                window.router.updateHistory(url, {
                    replace: options.replace,
                    kind: options.kind || 'ui',
                    state: options.state || {},
                });
                return;
            }
            if (options.replace) {
                location.replace(url);
            } else {
                location.assign(url);
            }
        },

        updateUrlParam(param, value, options = {}) {
            if (options.skip) return;
            try {
                const url = new URL(window.location.href);
                url.searchParams.set(param, value);
                this._updateUrl(url, options);
            } catch (err) {
                console.warn(`Failed to update URL param ${param}:`, err);
            }
        },

        updateMultipleUrlParams(params, options = {}) {
            if (options.skip) return;
            try {
                const url = new URL(window.location.href);
                Object.entries(params).forEach(([key, value]) => {
                    if (value === null || value === undefined) url.searchParams.delete(key);
                    else url.searchParams.set(key, value);
                });
                this._updateUrl(url, options);
            } catch (err) {
                console.warn('Failed to update URL params:', err);
            }
        },

        clearUrlParam(param, options = {}) {
            if (options.skip) return;
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete(param);
                this._updateUrl(url, options);
            } catch (err) {
                console.warn(`Failed to clear URL param ${param}:`, err);
            }
        },

        clearMultipleUrlParams(params, options = {}) {
            if (options.skip) return;
            try {
                const url = new URL(window.location.href);
                params.forEach(param => url.searchParams.delete(param));
                this._updateUrl(url, options);
            } catch (err) {
                console.warn('Failed to clear URL params:', err);
            }
        },

        getUrlParam(param) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get(param);
            } catch (err) {
                return null;
            }
        },

        createLoader() {
            return {
                show() {
                    if (!u('#ajloader').hasClass('shown')) {
                        CMessageBox.toggleLoader();
                    }
                },
                hide() {
                    if (u('#ajloader').hasClass('shown')) {
                        CMessageBox.toggleLoader();
                    }
                },
                isShown() {
                    return u('#ajloader').hasClass('shown');
                }
            };
        }
    };

    window.ContentFetcher = ContentFetcher;
});
