window.isMobile = function() {
    return window.matchMedia("(max-width: 768px)").matches;
};

window.isMobileAndExpanded = function() {
    return window.isMobile() && document.body.classList.contains('menu-expanded');
};

vkify.ready(() => {
    let notices = null;
    const syncHeight = () => {
        const height = `${notices?.getBoundingClientRect().height || 0}px`;
        if (document.documentElement.style.getPropertyValue('--top-popups-height') !== height) {
            document.documentElement.style.setProperty('--top-popups-height', height);
            requestAnimationFrame(() => {
                window.updateLeftMenuInit?.();
                window.updateNarrow?.();
            });
        }
    };
    const resizeObserver = new ResizeObserver(syncHeight);
    const observeNotices = () => {
        const current = document.querySelector('.site-notices');
        if (current !== notices) {
            resizeObserver.disconnect();
            notices = current;
            if (notices) resizeObserver.observe(notices);
        }
        syncHeight();
    };
    const layout = document.querySelector('.layout');
    if (layout) new MutationObserver(observeNotices).observe(layout, { childList: true });
    new MutationObserver(syncHeight).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style']
    });
    observeNotices();
});

window.router = new class Router {
    constructor() {
        this.managedStyleLinks = new Map();
        this.managedRouteScripts = new Map();
        this._loadedScriptPaths = new Set();
        this._pendingScripts = new Map();
        this._activeNavigation = null;
        this._navigationId = 0;
        this._pageCache = new Map();
        this._captureExistingManagedStyles();
        this._cacheExistingScripts();
        this.replaceHistory(location.href, 'page');
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        let scrollSaveTimer = null;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(() => {
                if (!this._activeNavigation) this._saveScrollForCurrentEntry();
            }, 150);
        }, { passive: true });
    }

    _cacheExistingScripts() {
        for (const script of document.querySelectorAll('script[src]')) {
            const path = this._normalizeScriptPath(script.src);
            if (path) this._loadedScriptPaths.add(path);
        }
        for (const script of document.querySelectorAll('script[data-vkify-route-script]')) {
            const key = script.getAttribute('data-vkify-route-script');
            if (key) this.managedRouteScripts.set(key, script);
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
        const inherited = kind === 'page'
            ? {}
            : (history.state && typeof history.state === 'object' ? history.state : {});
        return {
            ...inherited,
            ...state,
            vkify: { kind, url: new URL(url, location.origin).href }
        };
    }

    _saveScrollForCurrentEntry() {
        const st = history.state;
        if (st && typeof st === 'object' && st.vkify) {
            history.replaceState({ ...st, vkify: { ...st.vkify, scroll: window.scrollY } }, '');
        }
    }

    _pageCacheSet(url, html) {
        this._pageCache.delete(url);
        this._pageCache.set(url, html);
        while (this._pageCache.size > 8) {
            this._pageCache.delete(this._pageCache.keys().next().value);
        }
    }

    _snapshotCurrentPage(url) {
        const pageBody = document.querySelector('.page_body');
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.page_header');
        const appbar = document.querySelector('.appbar');
        if (!pageBody || !header || !appbar) return;

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][data-vkify-route-style], style[data-vkify-route-style]'))
            .map(l => l.outerHTML).join('');
        const routeScripts = Array.from(document.querySelectorAll('script[data-vkify-route-script]'))
            .filter(s => !pageBody.contains(s))
            .map(s => s.outerHTML).join('');
        const backdrop = document.querySelector('#backdrop');
        const runtimeConfig = document.getElementById('_js_ep_script')?.outerHTML || '';
        const title = document.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const bodyClasses = ['no-sidebar', 'logged-out'].filter(cls => document.body.classList.contains(cls));
        const bodyClass = bodyClasses.length ? ` class="${bodyClasses.join(' ')}"` : '';
        const html = `<!doctype html><html><head><title>${title}</title><meta name="vkify-router" content="vkify16"><meta name="csrf" content="${this.csrf}">${styles}</head>` +
            `<body data-themepack="vkify16"${bodyClass}>${pageBody.outerHTML}${sidebar ? sidebar.outerHTML : ''}${header.outerHTML}${appbar.outerHTML}${backdrop ? backdrop.outerHTML : ''}${runtimeConfig}${routeScripts}</body></html>`;
        this._pageCacheSet(url, html);
    }

    pushHistory(url, kind = 'page', state = {}) {
        history.pushState(this._historyState(url, kind, state), '', url);
        this._currentUrl = new URL(url, location.origin).href;
    }

    replaceHistory(url, kind = 'page', state = {}) {
        history.replaceState(this._historyState(url, kind, state), '', url);
        this._currentUrl = new URL(url, location.origin).href;
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
                newScript.type = script.getAttribute('type');
            }
            if (script.hasAttribute('data-vkify-route-script')) {
                const routeKey = script.getAttribute('data-vkify-route-script');
                newScript.setAttribute('data-vkify-route-script', routeKey);
                this.managedRouteScripts.set(routeKey, newScript);
            } else if (!script.src) {
                newScript.setAttribute('data-vkify-page-script', '');
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
                const isModule = (script.getAttribute('type') || '').toLowerCase() === 'module';
                const wrappedContent = isModule ? script.textContent : `
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
        document.querySelectorAll('link[rel="stylesheet"][data-vkify-route-style], style[data-vkify-route-style]').forEach(node => {
            const key = node.getAttribute('data-vkify-route-style') || node.href;
            if (key && !this.managedStyleLinks.has(key)) {
                this.managedStyleLinks.set(key, node);
            }
        });
    }

    _cloneManagedLink(source, key) {
        if (source.tagName === 'STYLE') {
            const style = document.createElement('style');
            Array.from(source.attributes).forEach(({ name, value }) => {
                if (name !== 'data-vkify-route-style') {
                    style.setAttribute(name, value);
                }
            });
            style.setAttribute('data-vkify-route-style', key);
            style.textContent = source.textContent;
            return style;
        }
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

        const desiredStyles = Array.from(parsed_content.querySelectorAll('link[rel="stylesheet"][data-vkify-route-style], style[data-vkify-route-style]')).map(link => {
            const key = link.getAttribute('data-vkify-route-style') || link.href;
            return key ? { key, link } : null;
        }).filter(Boolean);
        const desiredKeys = new Set(desiredStyles.map(item => item.key));
        const desiredHrefs = new Set(
            Array.from(parsed_content.querySelectorAll('link[rel="stylesheet"][href]'))
                .map(link => this._normalizeScriptPath(link.getAttribute('href')))
                .filter(Boolean)
        );
        const desiredIds = new Set(
            Array.from(parsed_content.querySelectorAll('link[rel="stylesheet"][id], style[id]'))
                .map(node => node.id)
                .filter(Boolean)
        );
        const persistentStyleIds = new Set(['dark-mode-css', '2018-mode-css', 'vkify-style-square_avatars']);

        document.querySelectorAll('.vkify_style').forEach(node => {
            if (persistentStyleIds.has(node.id)) return;
            const routeKey = node.getAttribute('data-vkify-route-style')
                || (node.id?.startsWith('vkify-style-') ? node.id.slice('vkify-style-'.length)
                    : (node.id?.startsWith('vkify_style_') ? node.id.slice('vkify_style_'.length) : ''));
            const href = node.href ? this._normalizeScriptPath(node.getAttribute('href') || node.href) : null;
            const inNextPage = (routeKey && desiredKeys.has(routeKey))
                || (node.id && desiredIds.has(node.id))
                || (href && desiredHrefs.has(href));

            if (inNextPage) {
                if (routeKey && desiredKeys.has(routeKey) && !this.managedStyleLinks.has(routeKey)) {
                    node.setAttribute('data-vkify-route-style', routeKey);
                    this.managedStyleLinks.set(routeKey, node);
                }
            } else if (node.id && typeof window.vkify?.unloadStyle === 'function') {
                window.vkify.unloadStyle(node.id);
            } else {
                node.remove();
            }
        });

        for (const [key, existingNode] of Array.from(this.managedStyleLinks.entries())) {
            const href = existingNode?.href ? this._normalizeScriptPath(existingNode.getAttribute('href') || existingNode.href) : null;
            const inNextPage = desiredKeys.has(key)
                || (existingNode?.id && desiredIds.has(existingNode.id))
                || (href && desiredHrefs.has(href));
            if (!inNextPage) {
                if (existingNode?.id && typeof window.vkify?.unloadStyle === 'function') {
                    window.vkify.unloadStyle(existingNode.id);
                } else {
                    existingNode?.remove();
                }
                this.managedStyleLinks.delete(key);
            }
        }

        await Promise.all(desiredStyles.map(({ key, link }) => {
            const existing = this.managedStyleLinks.get(key);
            if (existing && existing.isConnected) {
                if (existing.tagName === 'STYLE' && link.tagName === 'STYLE' && existing.textContent !== link.textContent) {
                    existing.textContent = link.textContent;
                }
                return Promise.resolve();
            }
            const managedLink = this._cloneManagedLink(link, key);
            this.managedStyleLinks.set(key, managedLink);
            const anchor = document.getElementById('dark-mode-css') || document.getElementById('2018-mode-css') || document.querySelector('link[href*="/resource/css/mobile.css"]');
            const insertNode = () => {
                if (anchor && anchor.parentNode === document.head) {
                    document.head.insertBefore(managedLink, anchor);
                } else {
                    document.head.appendChild(managedLink);
                }
            };
            if (managedLink.tagName === 'STYLE') {
                insertNode();
                return Promise.resolve();
            }
            return new Promise(resolve => {
                managedLink.addEventListener('load', resolve, { once: true });
                managedLink.addEventListener('error', resolve, { once: true });
                insertNode();
            });
        }));
    }

    _syncManagedScripts(parsed_content) {
        const incomingScripts = Array.from(parsed_content.querySelectorAll('.page_body script, script[data-vkify-route-script], body > script[src], head > script[type="module"][src]'));
        const desiredRouteMap = new Map();
        const desiredScriptPaths = new Set();
        const desiredInlineTexts = new Set();

        for (const script of incomingScripts) {
            const routeKey = script.getAttribute('data-vkify-route-script');
            if (routeKey) desiredRouteMap.set(routeKey, script);
            const path = script.src ? this._normalizeScriptPath(script.getAttribute('src') || script.src) : null;
            if (path) desiredScriptPaths.add(path);
            else if (script.textContent) desiredInlineTexts.add(script.textContent.trim());
        }

        for (const [key, existingScript] of Array.from(this.managedRouteScripts.entries())) {
            const nextScript = desiredRouteMap.get(key);
            if (!nextScript) {
                existingScript?.remove();
                this.managedRouteScripts.delete(key);
                continue;
            }
            const existingPath = existingScript?.src ? this._normalizeScriptPath(existingScript.getAttribute('src') || existingScript.src) : null;
            const nextPath = nextScript.src ? this._normalizeScriptPath(nextScript.getAttribute('src') || nextScript.src) : null;
            if (!nextPath || existingPath !== nextPath) {
                existingScript?.remove();
                this.managedRouteScripts.delete(key);
            }
        }

        document.querySelectorAll('body > script[data-vkify-route-script], body > script[data-vkify-page-script]').forEach(script => {
            const routeKey = script.getAttribute('data-vkify-route-script');
            if (routeKey) {
                if (!desiredRouteMap.has(routeKey) || this.managedRouteScripts.get(routeKey) !== script) {
                    script.remove();
                }
                return;
            }
            const path = script.src ? this._normalizeScriptPath(script.getAttribute('src') || script.src) : null;
            if (path ? !desiredScriptPaths.has(path) : !desiredInlineTexts.has((script.textContent || '').trim())) {
                script.remove();
            } else if (!path) {
                script.remove();
            }
        });

        return incomingScripts.filter(script => !this._isScriptAlreadyLoaded(script));
    }

    _syncElementAttributes(target, source) {
        if (!target || !source) return;

        for (const attribute of Array.from(target.attributes)) {
            if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
        }
        for (const attribute of source.attributes) {
            target.setAttribute(attribute.name, attribute.value);
        }
    }

    _syncRuntimeConfig(parsed_content) {
        const configScript = parsed_content.querySelector('script#_js_ep_script');
        if (!configScript) return;

        try {
            const currentConfigScript = document.getElementById('_js_ep_script');
            if (currentConfigScript) {
                currentConfigScript.textContent = configScript.textContent;
            }
            new Function(configScript.textContent)();
        } catch (error) {
            console.warn('[vkify-router] Failed to synchronize runtime config:', error);
        }
    }

    async _appendPage(parsed_content) {
        const requiredElements = ['.page_body', '.page_header', '.appbar'];
        const missingElements = requiredElements.filter(selector => !parsed_content.querySelector(selector));
        if (missingElements.length > 0) {
            console.warn('Missing required elements for AJAX transition:', missingElements);
            throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
        }

        const pageBody = u(parsed_content.querySelector('.page_body'));
        const sidebar = u(parsed_content.querySelector('.sidebar'));
        const pageHeader = u(parsed_content.querySelector('.page_header'));
        const backdrop = u(parsed_content.querySelector('#backdrop'));
        const appbar = u(parsed_content.querySelector('.appbar'));

        const previousUserId = Number(window.openvk?.current_id || 0);
        await this._syncManagedStyles(parsed_content);
        this._syncRuntimeConfig(parsed_content);
        if (Number(window.openvk?.current_id || 0) !== previousUserId) {
            this._pageCache.clear();
        }

        if (pageBody.length < 1) {
            throw new Error('Invalid page has been loaded');
        }

        const searchInputValue = document.querySelector('.page_header #search_box input')?.value;

        window.__current_page_audio_context = null;
        const scriptsToAppend = this._syncManagedScripts(parsed_content);

        const nextPageHeaderNode = pageHeader.nodes[0];
        const currentPageHeaderNode = document.querySelector('.page_header');
        if (currentPageHeaderNode) {
            this._syncElementAttributes(currentPageHeaderNode, nextPageHeaderNode);
            currentPageHeaderNode.innerHTML = nextPageHeaderNode.innerHTML;
        } else {
            document.querySelector('.appbar')?.insertAdjacentHTML('afterend', nextPageHeaderNode.outerHTML);
        }
        const updatedSearchInput = document.querySelector('.page_header #search_box input');
        if (updatedSearchInput && searchInputValue !== undefined) {
            updatedSearchInput.value = searchInputValue;
        }

        u('.page_body').html(pageBody.html());
        const nextSidebarNode = sidebar.nodes[0];
        const currentSidebarNode = document.querySelector('.sidebar');
        if (nextSidebarNode) {
            if (currentSidebarNode) {
                this._syncElementAttributes(currentSidebarNode, nextSidebarNode);
                currentSidebarNode.innerHTML = nextSidebarNode.innerHTML;
            } else {
                document.querySelector('.page_body')?.insertAdjacentHTML('beforebegin', nextSidebarNode.outerHTML);
            }
        } else {
            currentSidebarNode?.remove();
        }
        try {
            const im = window.im_variants?.getCurrent();
            if (im?.state && typeof im.state._updateCounter === "function") {
                im.state._updateCounter(im.state.getUnreadCounter());
            }
            const userIm = window.im_variants?.getCurrentUser() || window.im;
            if (userIm?.state && typeof userIm.state.renderPinnedGroupsCounters === "function") {
                userIm.state.renderPinnedGroupsCounters();
            }
        } catch (e) {
            console.error(e);
        }
        document.body.classList.toggle('no-sidebar', Boolean(parsed_content.body?.classList.contains('no-sidebar') || !nextSidebarNode));
        document.body.classList.toggle('logged-out', Boolean(parsed_content.body?.classList.contains('logged-out')));

        u('.appbar').html(appbar.html());
        // Inner-HTML swaps keep the live element's class list, so propagate
        // the server-rendered appbar classes (e.g. appbar--transparent).
        // Dynamic state was already stripped by beforePageLeave handlers.
        if (appbar.length > 0) {
            const nextAppbarNode = appbar.nodes[0];
            const currentAppbarNode = document.getElementById('appbar');
            if (nextAppbarNode && currentAppbarNode) {
                currentAppbarNode.className = nextAppbarNode.className;
            }
        }

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
        // Leaving the messenger (no #im_container after the swap) must drop
        // the chat-page body lock; entering it is picked up by the IM renders.
        if (!document.querySelector('#im_container')) {
            document.body.classList.remove('no-scroll');
        }

        const isImPage = /^\/im(?:\/|$)/.test(window.location.pathname);
        document.body.classList.toggle('body_im', isImPage);
        document.body.classList.toggle('body_im_modern', isImPage && localStorage.getItem('tw.im.modern_mode') === '1');
        // Upstream stickers (4c462220) hydrate static Lottie thumbs after
        // every render; re-run after AJAX swaps so chat/sticker markup animates.
        try {
            window.initStaticLottieStickers?.();
        } catch (e) {
            console.error('vkify16 | initStaticLottieStickers failed:', e);
        }
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

    isAjaxDisabled() {
        return window.openvk?.disable_ajax === 1 || parseInt(localStorage.getItem('ux.disable_ajax_routing') ?? '0', 10) === 1;
    }

    checkUrl(url) {
        if (window.openvk?.disable_ajax === 1) return false;
        if (parseInt(localStorage.getItem('ux.disable_ajax_routing') ?? '0', 10) === 1) return false;
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
        const kind = event.state?.vkify?.kind;
        return this.checkUrl(location.href) && (kind === 'page' || kind === 'tab');
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

        try {
            const isGet = (params.method || 'GET') === 'GET';
            const cachedHtml = params.history === 'none' && isGet ? this._pageCache.get(resolvedUrl.href) : null;
            if (cachedHtml) {
                const oldPageBody = document.querySelector('.page_body');
                await window.vkify?.runPageLifecycle?.('beforePageLeave', { container: document, pageBody: oldPageBody });
                this._closeMsgs();
                this._snapshotCurrentPage(this._currentUrl || location.href);
                await this._appendPage(new DOMParser().parseFromString(cachedHtml, 'text/html'));
                if (this._activeNavigation !== navigation) return { aborted: true };
                await this._integratePage(params.scrolling ?? 0);
                this._currentUrl = resolvedUrl.href;
                this.completeNavigation();
                return { committed: true, url: resolvedUrl.href };
            }

            u('body').addClass('ajax_request_made');
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

            const responseText = await response.text();
            const parsedContent = new DOMParser().parseFromString(responseText, 'text/html');
            if (!parsedContent.querySelector('meta[name="vkify-router"][content="vkify16"]')) {
                return { fullLoad: true, url: response.redirected ? response.url : resolvedUrl.href };
            }

            const finalUrl = new URL(response.redirected ? response.url : resolvedUrl, location.origin);
            finalUrl.searchParams.delete('al');
            finalUrl.searchParams.delete('hash');
            const oldPageBody = document.querySelector('.page_body');
            await window.vkify?.runPageLifecycle?.('beforePageLeave', { container: document, pageBody: oldPageBody });
            this._closeMsgs();
            if (params.history !== 'none') this._saveScrollForCurrentEntry();
            this._snapshotCurrentPage(this._currentUrl || location.href);
            if (isGet) this._pageCacheSet(finalUrl.href, responseText);

            if (params.history !== 'none') {
                if (params.history === 'replace' || params.push_state === false) {
                    this.replaceHistory(finalUrl, 'page');
                } else {
                    this.pushHistory(finalUrl, 'page');
                }
            }

            await this._appendPage(parsedContent);
            if (this._activeNavigation !== navigation) return { aborted: true };

            await this._integratePage(params.scrolling ?? 0);
            this._currentUrl = finalUrl.href;

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

function resetVkifyComposer(form) {
    const formNode = form?.nodes ? form.nodes[0] : form;
    if (!formNode || typeof formNode.querySelectorAll !== 'function') return;

    formNode.querySelectorAll('input[name="horizontal_attachments"], input[name="vertical_attachments"], input[name="geo"], input[name="poll"], input[name="source"], input[name="reply_to_comment"]').forEach(el => {
        el.value = el.name === 'poll' || el.name === 'source' ? 'none' : '';
    });
    formNode.querySelectorAll('.post-horizontal, .post-vertical, .post-source, .post-has-geo, .post-replyto').forEach(el => {
        el.innerHTML = '';
        el.classList.remove('appended-geo', 'editable_thumbs', 'vkify_makima_composer');
        el.style.height = '';
        el.style.width = '';
    });
    formNode.querySelectorAll('.post-has-poll').forEach(el => {
        el.style.display = 'none';
    });

    const textarea = formNode.querySelector('textarea[name="text"]');
    if (textarea) {
        textarea.value = '';
        textarea._contentEditable?.el?.classList.remove('expanded-textarea');
        textarea.classList.remove('expanded-textarea');
        window.vkifyTextareaAutosize?.apply?.(textarea);
    }

    const container = formNode.closest('.model_content_textarea');
    if (container) container.classList.remove('shown', 'expanded-textarea');

    const root = formNode.closest('#write');
    if (root) {
        root.querySelectorAll('.post-opts input[type="checkbox"]:not([name="as_group"])').forEach(el => { el.checked = false; });
    }
}

window.resetVkifyComposer = resetVkifyComposer;

u(document).on('submit', 'form', async (e) => {
    if (e.defaultPrevented || u('#ajloader').hasClass('shown')) return;

    const form = e.target;
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    const rawAction = form.getAttribute('action');
    const action = new URL(rawAction && rawAction.trim() ? rawAction : location.href, location.origin);
    if (form.dataset.pjax === 'false' || form.target || form.onsubmit || action.origin !== location.origin || !window.router.checkUrl(action)) return;

    const target = u(form);
    if (target.closest('#write').first()) {
        e.preventDefault();

        if (typeof window.ajax_posting === 'function') {
            if (typeof window.bumpSelectedTabCountOnNewPost === 'function') {
                window.bumpSelectedTabCountOnNewPost(form);
            }

            try {
                await window.ajax_posting(e, target);
            } catch (err) {
                console.error('ajax_posting failed:', err);
                u('#ajloader').removeClass('shown');
                if (typeof showSystemMsg === 'function') {
                    showSystemMsg(window.tr?.('something_not_right') || window.tr?.('error') || 'Error', 'err');
                }
                return;
            }
        }

        return;
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
    const kind = e.state?.vkify?.kind;
    if (kind && kind !== 'page' && kind !== 'tab') return;
    if (!window.router.canHandlePopstateNavigation(e)) {
        location.assign(location.href);
        return;
    }

    const result = await window.router.route({ url: location.href, history: 'none', scrolling: e.state?.vkify?.scroll ?? 0 });
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

window.isLoadedFirstly = false;

window.addEventListener('DOMContentLoaded', () => {
    if (window.isLoadedFirstly) return;
    window.isLoadedFirstly = true;

    _checkViewers();
    CMessageBox.toggleLoader(false);
});

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