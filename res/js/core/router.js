window.isMobile = function() {
    return window.matchMedia("(max-width: 770px)").matches;
};

window.isMobileAndExpanded = function() {
    return window.isMobile() && document.body.classList.contains('menu-expanded');
};

window.router = new class Router {
    constructor() {
        this.managedStyleLinks = new Map();
        this._loadedScriptPaths = new Set();
        this._pendingScripts = new Map();
        this._activeNavigation = null;
        this._navigationId = 0;
        this._captureExistingManagedStyles();
        this._cacheExistingScripts();
        this.replaceHistory(location.href, 'page');
    }

    _cacheExistingScripts() {
        for (const script of document.querySelectorAll('script[src]')) {
            const path = this._normalizeScriptPath(script.src);
            if (path) this._loadedScriptPaths.add(path);
        }
    }

    _normalizeScriptPath(src) {
        if (!src) return null;
        try {
            return new URL(src, location.origin).href;
        } catch (e) {
            return null;
        }
    }

    _historyState(url, kind, state = {}) {
        return {
            ...(history.state && typeof history.state === 'object' ? history.state : {}),
            ...state,
            vkify: { kind, url: new URL(url, location.origin).href }
        };
    }

    pushHistory(url, kind = 'page', state = {}) {
        history.pushState(this._historyState(url, kind, state), '', url);
    }

    replaceHistory(url, kind = 'page', state = {}) {
        history.replaceState(this._historyState(url, kind, state), '', url);
    }

    updateHistory(url, { replace = false, kind = 'ui', state = {} } = {}) {
        if (replace) {
            this.replaceHistory(url, kind, state);
        } else {
            this.pushHistory(url, kind, state);
        }
    }

    get csrf() {
        return u("meta[name=csrf]").attr("value");
    }

    isNavigationInProgress() {
        return this._activeNavigation !== null;
    }

    cancelPendingNavigation() {
        this._activeNavigation?.controller.abort();
        this._activeNavigation = null;
        u('body').removeClass('ajax_request_made');
    }

    completeNavigation() {
        this._activeNavigation = null;
        u('body').removeClass('ajax_request_made');
    }

    canHandleNavigation(url) {
        return this.checkUrl(url);
    }

    _isScriptAlreadyLoaded(script) {
        if (!script.src) return false;
        const scriptPath = this._normalizeScriptPath(script.src);
        if (!scriptPath) return false;

        if (scriptPath.includes('monaco-editor') && scriptPath.includes('loader.js')) {
            return typeof window.require !== 'undefined' && typeof window.require.config === 'function';
        }

        return this._loadedScriptPaths.has(scriptPath);
    }

    loadScriptOnce(src, { id = null, crossorigin = 'anonymous', integrity = null } = {}) {
        const scriptPath = this._normalizeScriptPath(src);
        if (!scriptPath) {
            return Promise.reject(new Error('Invalid script src'));
        }

        if (this._loadedScriptPaths.has(scriptPath)) {
            return Promise.resolve(null);
        }

        const pending = this._pendingScripts.get(scriptPath);
        if (pending) return pending;

        const promise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            if (id) s.id = id;
            if (crossorigin) s.crossOrigin = crossorigin;
            if (integrity) s.integrity = integrity;
            s.async = false;
            s.src = src;
            s.onload = () => {
                this._loadedScriptPaths.add(scriptPath);
                resolve(s);
            };
            s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(s);
        }).finally(() => {
            this._pendingScripts.delete(scriptPath);
        });

        this._pendingScripts.set(scriptPath, promise);
        return promise;
    }

    _appendScript(script) {
        return new Promise((resolve, reject) => {
            const newScript = document.createElement('script');
            newScript.crossOrigin = 'anonymous';
            if (script.getAttribute('integrity')) {
                newScript.setAttribute('integrity', script.getAttribute('integrity'));
            }
            if (script.getAttribute('id')) {
                newScript.id = script.id;
            }
            if (script.getAttribute('type')) {
                newScript.type = script.type;
            }

            if (script.src) {
                const scriptPath = this._normalizeScriptPath(script.src);
                newScript.async = false;
                newScript.src = script.src;
                newScript.onload = () => {
                    if (scriptPath) this._loadedScriptPaths.add(scriptPath);
                    resolve();
                };
                newScript.onerror = () => {
                    console.warn('Failed to load external script:', script.src);
                    resolve();
                };
            } else {
                newScript.async = false;
                const wrappedContent = `
                    try {
                        ${script.textContent}
                    } catch (error) {
                        console.warn('Script execution failed during AJAX transition:', error);
                        if (error.message?.includes("can't access property")) {
                            console.warn('DOM access error detected, this page may not be compatible with AJAX routing');
                        }
                    }
                `;
                newScript.textContent = wrappedContent;
            }

            document.body.appendChild(newScript);

            if (!script.src) {
                resolve();
            }
        });
    }

    _closeMsgs() {
        window.messagebox_stack?.forEach(msg => {
            if (!msg.hidden) {
                msg.close();
            }
        });
    }

    _captureExistingManagedStyles() {
        document.querySelectorAll('link[rel="stylesheet"][data-vkify-route-style]').forEach(link => {
            const key = link.getAttribute('data-vkify-route-style') || link.href;
            if (key && !this.managedStyleLinks.has(key)) {
                this.managedStyleLinks.set(key, link);
            }
        });
    }

    _cloneManagedLink(source, key) {
        const link = document.createElement('link');
        link.rel = source.rel || 'stylesheet';
        Array.from(source.attributes).forEach(({ name, value }) => {
            if (name !== 'data-vkify-route-style') {
                link.setAttribute(name, value);
            }
        });
        link.setAttribute('data-vkify-route-style', key);
        return link;
    }

    async _syncManagedStyles(parsed_content) {
        if (!parsed_content) return;

        const desiredStyles = Array.from(parsed_content.querySelectorAll('link[rel="stylesheet"][data-vkify-route-style]')).map(link => {
            const key = link.getAttribute('data-vkify-route-style') || link.href;
            return key ? { key, link } : null;
        }).filter(Boolean);
        const desiredKeys = new Set(desiredStyles.map(item => item.key));

        for (const key of this.managedStyleLinks.keys()) {
            if (!desiredKeys.has(key)) {
                this.managedStyleLinks.get(key)?.remove();
                this.managedStyleLinks.delete(key);
            }
        }

        await Promise.all(desiredStyles.map(({ key, link }) => {
            if (this.managedStyleLinks.has(key)) return Promise.resolve();
            const managedLink = this._cloneManagedLink(link, key);
            this.managedStyleLinks.set(key, managedLink);
            return new Promise(resolve => {
                managedLink.addEventListener('load', resolve, { once: true });
                managedLink.addEventListener('error', resolve, { once: true });
                document.head.appendChild(managedLink);
            });
        }));
    }

    async _appendPage(parsed_content) {
        const requiredElements = ['.page_body', '.sidebar', '.page_header', '.appbar'];
        const missingElements = requiredElements.filter(selector => !parsed_content.querySelector(selector));
        if (missingElements.length > 0) {
            console.warn('Missing required elements for AJAX transition:', missingElements);
            throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
        }

        const scriptsToAppend = [];
        const pageBody = u(parsed_content.querySelector('.page_body'));
        const sidebar = u(parsed_content.querySelector('.sidebar'));
        const pageHeader = u(parsed_content.querySelector('.page_header'));
        const backdrop = u(parsed_content.querySelector('#backdrop'));
        const appbar = u(parsed_content.querySelector('.appbar'));

        await this._syncManagedStyles(parsed_content);

        if (pageBody.length < 1) {
            throw new Error('Invalid page has been loaded');
        }

        const currentSearchInput = u('.page_header #search_box input').nodes[0];
        const newSearchInput = pageHeader.find('#search_box input').nodes[0];
        if (currentSearchInput && newSearchInput) {
            currentSearchInput.value = newSearchInput.value;
        }

        window.__current_page_audio_context = null;
        parsed_content.querySelectorAll('.page_body script, script[data-vkify-route-script], body > script[src]').forEach(script => {
            if (!this._isScriptAlreadyLoaded(script)) scriptsToAppend.push(script);
        });

        u('.page_body').html(pageBody.html());
        u('.sidebar').html(sidebar.html());
        u('.appbar').html(appbar.html());

        if (backdrop.length > 0) {
            if (u('#backdrop').length === 0) {
                u('body').append('<div id="backdrop"></div>');
            }
            u('#backdrop').nodes[0].outerHTML = backdrop.nodes[0].outerHTML;
        } else {
            u('#backdrop').remove();
        }

        u("meta[name=csrf]").attr("value", u(parsed_content.querySelector('meta[name=csrf]')).attr('value'));
        window.setBaseTitle(parsed_content.title)

        for (const script of scriptsToAppend) {
            await this._appendScript(script);
        }
    }

    async _handleVKifyContentUpdate() {
        const pageBody = document.querySelector('.page_body');
        const context = { container: document, pageBody };
        await window.vkify?.runPageLifecycle?.('afterPageSwap', context);
        window.vkify?.onPageReady?.();
        await window.vkify?.runPageLifecycle?.('afterPageReady', context);
    }

    async _integratePage(scrolling = 0) {
        window.temp_y_scroll = null;
        u('.toTop').removeClass('has_down');

        const hash = window.location.hash;
        if (hash) {
            window.location.hash = '';
            window.location.hash = hash;
        } else {
            window.scrollTo(0, scrolling);
        }

        if (typeof bsdnHydrate === 'function') {
            bsdnHydrate();
        }

        await this._handleVKifyContentUpdate();
    }

    checkUrl(url) {
        if (window.openvk?.disable_ajax === 1) return false;
        if (parseInt(localStorage.getItem('ux.disable_ajax_routing') ?? '0', 10) === 1 || window.openvk?.current_id === 0) return false;
        if (!url) return false;

        try {
            const resolvedUrl = new URL(url, location.origin);
            if (resolvedUrl.origin !== location.origin) return false;
            if (resolvedUrl.searchParams.has('hash') || resolvedUrl.hash.includes('#close')) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    canHandlePopstateNavigation(event) {
        return this.checkUrl(location.href) && event.state?.vkify?.kind === 'page';
    }

    savePreviousPage() {
        this.prev_page_html = {
            url: location.href,
            pathname: location.pathname,
            html: u('.page_body').html(),
        };
    }

    async route(params = {}) {
        if (typeof params === 'string') params = { url: params };

        const resolvedUrl = new URL(params.url, location.origin);
        if (!this.checkUrl(resolvedUrl)) {
            location.assign(resolvedUrl);
            return { fullLoad: true };
        }

        this.cancelPendingNavigation();
        const navigation = {
            id: ++this._navigationId,
            controller: new AbortController(),
        };
        this._activeNavigation = navigation;
        u('body').addClass('ajax_request_made');

        try {
            const response = await fetch(resolvedUrl, {
                method: params.method || 'GET',
                body: params.body || null,
                credentials: 'same-origin',
                headers: { 'X-OpenVK-Ajax-Query': '1', ...(params.headers || {}) },
                signal: navigation.controller.signal,
            });
            if (this._activeNavigation !== navigation) return { aborted: true };
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (response.status === 204) {
                this.completeNavigation();
                return { noContent: true, url: response.url };
            }

            const parsedContent = new DOMParser().parseFromString(await response.text(), 'text/html');
            const nextBody = parsedContent.querySelector('body');
            if (!nextBody || nextBody.getAttribute('data-themepack') !== 'vkify16') {
                return { fullLoad: true, url: response.redirected ? response.url : resolvedUrl.href };
            }

            const finalUrl = new URL(response.redirected ? response.url : resolvedUrl, location.origin);
            finalUrl.searchParams.delete('al');
            finalUrl.searchParams.delete('hash');
            const oldPageBody = document.querySelector('.page_body');
            await window.vkify?.runPageLifecycle?.('beforePageLeave', { container: document, pageBody: oldPageBody });
            this._closeMsgs();
            await this._appendPage(parsedContent);
            if (this._activeNavigation !== navigation) return { aborted: true };

            if (params.history !== 'none') {
                if (params.history === 'replace' || params.push_state === false) {
                    this.replaceHistory(finalUrl, 'page');
                } else {
                    this.pushHistory(finalUrl, 'page');
                }
            }

            await this._integratePage(params.scrolling ?? 0);

            this.completeNavigation();
            return { committed: true, url: finalUrl.href };
        } catch (error) {
            if (error.name === 'AbortError') return { aborted: true };
            console.warn('AJAX routing failed:', error);
            if (this._activeNavigation === navigation) this.completeNavigation();
            return { error };
        }
    }
};

u(document).on('click', 'a', async (e) => {
    if (e.defaultPrevented || (typeof e.button === 'number' && e.button !== 0) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest?.('a');
    if (!link || link.dataset.pjax === 'false' || link.hasAttribute('download') || link.target && link.target !== '_self') return;
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:') || link.rel === 'nofollow') return;

    const url = new URL(link.href, location.origin);
    if (!window.router.checkUrl(url)) return;
    e.preventDefault();

    const result = await window.router.route({ url });
    if (result.fullLoad) location.assign(result.url || url);
    if (result.error) location.assign(url);
});

u(document).on('submit', 'form', async (e) => {
    if (e.defaultPrevented || u('#ajloader').hasClass('shown')) return;

    const form = e.target;
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    const rawAction = form.getAttribute('action');
    const action = new URL(rawAction && rawAction.trim() ? rawAction : location.href, location.origin);
    if (form.dataset.pjax === 'false' || form.target || form.onsubmit || action.origin !== location.origin || !window.router.checkUrl(action)) return;

    const target = u(form);
    if (target.closest('#write').first() && typeof collect_attachments_node === 'function') {
        collect_attachments_node(target);
    }

    e.preventDefault();
    u('#ajloader').addClass('shown');
    const formData = typeof serializeForm === 'function' ? serializeForm(form, e.submitter) : new FormData(form);
    if (method === 'GET') {
        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string' && value.trim()) action.searchParams.append(key, value);
        }
    }

    const result = await window.router.route({
        url: action,
        method,
        body: method === 'GET' ? null : formData,
        history: 'push',
    });
    u('#ajloader').removeClass('shown');
    if (result.fullLoad) {
        location.assign(result.url || action);
        return;
    }
    if (result.error) {
        if (method === 'GET') {
            location.assign(action);
        } else {
            console.error('AJAX form submission failed:', result.error);
            if (typeof showSystemMsg === 'function') {
                showSystemMsg(window.tr?.('something_not_right') || window.tr?.('error') || 'Error submitting form', 'err');
            } else if (typeof MessageBox === 'function') {
                MessageBox(window.tr?.('error') || 'Error', window.tr?.('something_not_right') || 'Error submitting form', [window.tr?.('close') || 'Close'], [Function.noop]);
            }
        }
        return;
    }
    if (window.jQuery) window.jQuery(e.target).trigger('submitted');
});

window.addEventListener('popstate', async (e) => {
    if (e.state?.vkify?.kind && e.state.vkify.kind !== 'page') return;
    if (!window.router.canHandlePopstateNavigation(e)) {
        location.assign(location.href);
        return;
    }

    const result = await window.router.route({ url: location.href, history: 'none' });
    if (result.fullLoad || result.error) location.assign(result.url || location.href);
});

window.processVkifyLocTags = function() {
    if (!window.vkifylang) return;
    
    document.querySelectorAll('vkifyloc').forEach(element => {
        const locName = element.getAttribute('name');
        if (locName && window.vkifylang[locName]) {
            let translatedText = window.vkifylang[locName];
            
            const args = element.getAttribute('args');
            if (args) {
                args.split(',').map(arg => arg.trim()).forEach((arg, index) => {
                    translatedText = translatedText.replace(new RegExp(`\\$${index + 1}`, 'g'), arg);
                });
            }
            
            element.outerHTML = translatedText;
        }
    });
};

window.initializeSearchOptions = function () {
    const searchForm = ge('real_search_form');
    const searchOptionsContainer = ge('search_options');
    if (!searchForm || !searchOptionsContainer) return;

    const performAjaxSearch = () => {
        if (!window.router) {
            searchForm.submit();
            return;
        }

        const formData = new FormData(searchForm);
        const searchParams = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            if (value?.trim()) {
                searchParams.append(key, value);
            }
        }

        const searchUrl = `/search?${searchParams.toString()}`;
        window.router.route({ url: searchUrl, push_state: false });
    };

    const searchOptions = searchOptionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"], select');
    searchOptions.forEach(element => {
        element.removeEventListener('change', element._searchChangeHandler);
        element._searchChangeHandler = () => setTimeout(performAjaxSearch, 100);
        element.addEventListener('change', element._searchChangeHandler);
    });

    const textInputs = searchOptionsContainer.querySelectorAll('input[type="text"]');
    textInputs.forEach(input => {
        clearTimeout(input._searchInputTimeout);
        input.removeEventListener('input', input._searchInputHandler);
        input._searchInputHandler = () => {
            clearTimeout(input._searchInputTimeout);
            input._searchInputTimeout = setTimeout(performAjaxSearch, 800);
        };
        input.addEventListener('input', input._searchInputHandler);
    });

    const resetButton = ge('search_reset');
    if (resetButton) {
        resetButton.removeEventListener('click', resetButton._searchResetHandler);
        resetButton._searchResetHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const searchInput = searchForm.querySelector('input[name="q"]');
            if (searchInput) {
                searchInput.value = '';
            }

            searchOptionsContainer.querySelectorAll('input[type="text"]').forEach(inp => inp.value = '');
            searchOptionsContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);
            searchOptionsContainer.querySelectorAll('input[type="radio"]').forEach(rad => {
                rad.checked = !!rad.dataset.default;
            });
            searchOptionsContainer.querySelectorAll('select').forEach(sel => sel.value = sel.dataset.default || '');

            resetButton.disabled = true;
            resetButton.value = resetButton.value.replace(/\.\.\.$/, '') + '...';

            setTimeout(() => {
                performAjaxSearch();
                setTimeout(() => {
                    resetButton.disabled = false;
                    resetButton.value = resetButton.value.replace(/\.\.\.$/, '');
                }, 500);
            }, 100);
        };
        resetButton.addEventListener('click', resetButton._searchResetHandler);
    }
};

window.initializeSearchOptionToggle = function () {
    const searchOptionsContainer = ge('search_options');
    if (!searchOptionsContainer) return;

    const searchOptionNames = searchOptionsContainer.querySelectorAll('.search_option_name');
    searchOptionNames.forEach(nameElement => {
        nameElement.removeEventListener('click', nameElement._toggleHandler);
        nameElement._toggleHandler = () => {
            const searchOption = nameElement.closest('.search_option');
            const searchOptionContent = searchOption?.querySelector('.search_option_content');
            if (searchOptionContent) {
                $(searchOptionContent).slideToggle(250, "swing");
            }
        };
        nameElement.addEventListener('click', nameElement._toggleHandler);
    });
};

vkify.ready(function () {
    if (window.__processPaginatorNextPage) {
        const original = window.__processPaginatorNextPage;
        window.__processPaginatorNextPage = async function (...args) {
            const result = await original.apply(this, args);
            window.router._handleVKifyContentUpdate();
            return result;
        };
    }

    setTimeout(() => {
        window.router?._handleVKifyContentUpdate();
    }, 100);

    const observer = new MutationObserver(mutations => {
        let shouldProcessLoc = false;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'VKIFYLOC' || node.querySelector('vkifyloc')) {
                        shouldProcessLoc = true;
                    }
                }
            });
        });

        if (shouldProcessLoc) window.processVkifyLocTags?.();
    });

    observer.observe(document.body, { childList: true, subtree: true });
});

vkify.onPageLifecycle('afterPageReady', () => {
    if (window.location.pathname === '/search') {
        window.initializeSearchOptions?.();
        window.initializeSearchOptionToggle?.();
    }
}, 'after');