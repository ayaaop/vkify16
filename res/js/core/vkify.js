(function () {
    if (window.vkify) {
        return;
    }

    window.ge = function (el) { return document.getElementById(el); };
    window.geByClass = function (el) { return document.querySelector('.' + el); };
    window.geByClass1 = function (el) { return document.querySelectorAll('.' + el); };

    const loadedStyles = {};
    const hookedFunctions = {};
    const onceRegistry = {};
    let resourceBase = null;
    let themeBase = null;

    function genHash(str) {
        let hash = 0;
        for (const char of str) {
            hash = (hash << 5) - hash + char.charCodeAt(0);
            hash |= 0;
        }
        return hash;
    }

    function hookFunc(target, funcName, callback, mode) {
        mode = mode || 'after';
        const original = target[funcName];
        if (typeof original !== 'function') {
            console.warn('[vkify] Cannot hook non-function:', funcName);
            return null;
        }

        const hookId = 'hook_' + genHash(original.toString() + funcName + Date.now());

        hookedFunctions[hookId] = {
            mode: mode,
            original: original,
            target: target,
            name: funcName
        };

        target[funcName] = function (...args) {
            if (mode === 'before') {
                callback.apply(this, args);
                return original.apply(this, args);
            }

            if (mode === 'replace') {
                return callback.apply(this, args);
            }

            if (mode === 'then') {
                const result = original.apply(this, args);
                callback.apply(this, args);
                return result;
            }

            const result = original.apply(this, args);
            if (result instanceof Promise) {
                return result.then(async (resolved) => {
                    await callback.apply(this, args);
                    return resolved;
                });
            }
            callback.apply(this, args);
            return result;
        };

        return hookId;
    }

    function unhookFunc(hookId) {
        const hooked = hookedFunctions[hookId];
        if (!hooked) {
            console.warn('[vkify] hook not found:', hookId);
            return false;
        }
        try {
            hooked.target[hooked.name] = hooked.original;
            delete hookedFunctions[hookId];
            return true;
        } catch (e) {
            console.error('[vkify] failed to unhook:', hookId, e);
            return false;
        }
    }

    function loadStyle(style, id, remoteUrl) {
        if (!id) {
            id = 'vkify_stl_' + genHash(style || remoteUrl || '');
        }
        if (!ge(id)) {
            if (!style && remoteUrl) {
                document.head.insertAdjacentHTML('beforeend',
                    '<link rel="stylesheet" class="vkify_style" id="' + id + '" href="' + remoteUrl + '">');
            } else if (style) {
                document.head.insertAdjacentHTML('beforeend',
                    '<style class="vkify_style" id="' + id + '">' + style + '</style>');
            }
        }
        loadedStyles[id] = style || remoteUrl;
        return id;
    }

    function unloadStyle(id) {
        if (loadedStyles[id]) {
            const el = ge(id);
            if (el) el.remove();
            delete loadedStyles[id];
            return true;
        }
        return false;
    }

    const settingsCookieDays = 365;
    let settings = {};
    const defaults = {};
    const cookieNames = {};

    function getCookie(name) {
        const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : null;
    }

    function setCookie(name, value, days) {
        let expires = '';
        if (days) {
            const d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + d.toUTCString();
        }
        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
    }

    function registerSetting(key, defaultValue, cookieName) {
        defaults[key] = defaultValue;
        cookieNames[key] = cookieName || ('vkify_' + key);
        const stored = getCookie(cookieNames[key]);
        if (stored !== null) {
            settings[key] = stored === '1' || stored === 'true';
        } else {
            settings[key] = defaultValue;
        }
    }

    function loadSettings() {
        for (const key in cookieNames) {
            const stored = getCookie(cookieNames[key]);
            if (stored !== null) {
                settings[key] = stored === '1' || stored === 'true';
            } else if (!settings.hasOwnProperty(key)) {
                settings[key] = defaults[key];
            }
        }
    }

    function saveSettings() {
        for (const key in cookieNames) {
            setCookie(cookieNames[key], settings[key] ? '1' : '0', settingsCookieDays);
        }
    }

    function setSetting(key, value) {
        settings[key] = value;
        if (cookieNames[key]) {
            setCookie(cookieNames[key], value ? '1' : '0', settingsCookieDays);
        }
    }

    function getSetting(key) {
        return settings.hasOwnProperty(key) ? settings[key] : defaults[key];
    }

    function restoreDefaults() {
        settings = Object.assign({}, defaults);
        saveSettings();
    }

    function detectBasePaths() {
        if (resourceBase) return;
        const cs = document.currentScript;
        if (cs && cs.src) {
            resourceBase = cs.src.replace(/\/js\/core\/vkify\.js(?:\?.*)?$/, '');
            themeBase = resourceBase.replace(/\/resource$/, '');
        }
    }
    detectBasePaths();

    function getResourceUrl(path) {
        if (!resourceBase) detectBasePaths();
        if (!path) return resourceBase || '';
        const sep = path.startsWith('/') ? '' : '/';
        return (resourceBase || '') + sep + path;
    }

    function getThemeUrl(path) {
        if (!themeBase) detectBasePaths();
        if (!path) return themeBase || '';
        const sep = path.startsWith('/') ? '' : '/';
        return (themeBase || '') + sep + path;
    }

    function once(key, fn) {
        if (onceRegistry[key]) return onceRegistry[key].result;
        onceRegistry[key] = { executed: true, result: undefined };
        if (typeof fn === 'function') {
            onceRegistry[key].result = fn();
        }
        return onceRegistry[key].result;
    }

    function hasRun(key) {
        return !!onceRegistry[key];
    }

    function bindOnce(key, setupFn) {
        if (onceRegistry['bind_' + key]) return false;
        onceRegistry['bind_' + key] = { executed: true };
        if (typeof setupFn === 'function') {
            setupFn();
        }
        return true;
    }

    function navigate(url) {
        if (window.router && typeof window.router.route === 'function') {
            window.router.route(url);
        } else {
            window.location.href = url;
        }
    }

    function getCsrf() {
        return window.router?.csrf ?? document.querySelector('meta[name="csrf"]')?.getAttribute('value') ?? '';
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // Shared by any popup/menu/tooltip system that needs to pick a side of the
    // trigger with enough room in the viewport (tooltips.js, tooltips-simple.js,
    // action-menu.js).
    function getOptimalPlacement(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const space = {
            top: rect.top,
            bottom: viewportHeight - rect.bottom,
            left: rect.left,
            right: viewportWidth - rect.right,
        };

        const minSpace = 100;
        let placement = 'top';

        if (space.bottom > space.top && space.bottom > minSpace) {
            placement = 'bottom';
        } else if (space.top > minSpace) {
            placement = 'top';
        } else if (space.right > space.left && space.right > minSpace) {
            placement = 'right';
        } else if (space.left > minSpace) {
            placement = 'left';
        }

        if (rect.top < 50 && placement === 'top') {
            placement = 'bottom';
        }

        return placement;
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function onPageReady() {}

    const pageLifecycleCallbacks = {
        beforePageLeave: { before: [], after: [] },
        afterPageSwap: { before: [], after: [] },
        afterPageReady: { before: [], after: [] },
    };

    function onPageLifecycle(phase, callback, priority = 'after') {
        const bucket = pageLifecycleCallbacks[phase];
        if (!bucket || typeof callback !== 'function') return () => {};
        const group = priority === 'before' ? bucket.before : bucket.after;
        const entry = { callback };
        group.push(entry);
        return () => {
            const idx = group.indexOf(entry);
            if (idx !== -1) group.splice(idx, 1);
        };
    }

    async function runPageLifecycle(phase, context = {}) {
        const bucket = pageLifecycleCallbacks[phase];
        if (!bucket) return;
        for (const { callback } of bucket.before) {
            await callback(context);
        }
        for (const { callback } of bucket.after) {
            await callback(context);
        }
    }

    function onPage(fn) {
        ready(fn);
        return onPageLifecycle('afterPageReady', fn);
    }

    const domObserverCallbacks = [];
    let sharedDomObserver = null;

    function observeDOM(callback, options = {}) {
        if (typeof callback !== 'function') return null;
        const id = 'obs_' + genHash(callback.toString() + Date.now());
        domObserverCallbacks.push({ id, callback, filter: options.filter || null });

        if (!sharedDomObserver) {
            sharedDomObserver = new MutationObserver((mutations) => {
                for (const { callback, filter } of domObserverCallbacks) {
                    try {
                        if (filter) {
                            const filtered = mutations.filter(m => filter(m));
                            if (filtered.length) callback(filtered);
                        } else {
                            callback(mutations);
                        }
                    } catch (e) {
                        console.warn('[vkify] DOM observer callback error:', e);
                    }
                }
            });
            ready(() => {
                sharedDomObserver.observe(document.body, { childList: true, subtree: true });
            });
        }
        return id;
    }

    function unobserveDOM(id) {
        const idx = domObserverCallbacks.findIndex(c => c.id === id);
        if (idx !== -1) {
            domObserverCallbacks.splice(idx, 1);
            return true;
        }
        return false;
    }

    window.vkify = {
        onPageReady: onPageReady,
        onPage: onPage,
        onPageLifecycle: onPageLifecycle,
        runPageLifecycle: runPageLifecycle,

        hook: hookFunc,
        unhook: unhookFunc,

        loadStyle: loadStyle,
        unloadStyle: unloadStyle,
        get loadedStyles() { return Object.assign({}, loadedStyles); },

        get settings() { return settings; },
        set settings(val) { settings = val; },
        registerSetting: registerSetting,
        getSetting: getSetting,
        setSetting: setSetting,
        loadSettings: loadSettings,
        saveSettings: saveSettings,
        restoreDefaults: restoreDefaults,
        get defaults() { return Object.assign({}, defaults); },

        hash: genHash,

        getCookie: getCookie,
        setCookie: setCookie,

        navigate: navigate,
        getCsrf: getCsrf,
        debounce: debounce,
        getOptimalPlacement: getOptimalPlacement,

        resourceUrl: getResourceUrl,
        themeUrl: getThemeUrl,
        get resourceBase() { return resourceBase; },
        get themeBase() { return themeBase; },

        once: once,
        hasRun: hasRun,
        bindOnce: bindOnce,
        ready: ready,

        observeDOM: observeDOM,
        unobserveDOM: unobserveDOM,

        log: function (...args) {
            console.log('[vkify]', ...args);
        },

        warn: function (...args) {
            console.warn('[vkify]', ...args);
        },

        error: function (...args) {
            console.error('[vkify]', ...args);
        }
    };

})();

window.dismissHttpWarning = function() {
    const warningEl = document.querySelector('.http-warning-popup');
    if (warningEl) {
        warningEl.style.display = 'none';
    }
    vkify.setCookie('vkify_popup_shown_http_warn', '1', 36500);
};

vkify.ready(() => {
    const warningEl = document.querySelector('.http-warning-popup');
    if (warningEl) {
        const isHttp = location.protocol === 'http:' && !location.host.includes('localhost') && !location.host.includes('127.0.0.1');
        const isDismissed = vkify.getCookie('vkify_popup_shown_http_warn') === '1';
        
        if (isHttp && !isDismissed) {
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }
    }

    const currentTheme = document.body.getAttribute('data-themepack');
    if (currentTheme !== 'vkify16') {
        if (typeof NewNotification === 'function') {
            NewNotification(
                window.vkifylang?.something_not_right || "Something isn't right.",
                window.vkifylang?.themepack_warn || "Please set \"VKify16\" in the styles settings again, or reload the page.",
                null,
                () => {},
                2147483647,
                false
            );
        }
    }



    const musicKeysDown = [32, 37, 39, 107, 109];
    const musicKeysUp = [87, 65, 83, 68, 82, 77];

    const handleKeyPropagation = (e) => {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            const keysToBlock = e.type === 'keydown' ? musicKeysDown : (e.type === 'keyup' ? musicKeysUp : []);
            if (keysToBlock.includes(e.keyCode || e.which)) {
                e.stopPropagation();
            }
        }
    };

    document.documentElement.addEventListener('keydown', handleKeyPropagation, false);
    document.documentElement.addEventListener('keyup', handleKeyPropagation, false);
});
