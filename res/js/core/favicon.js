(function () {
    'use strict';

    if (typeof window === 'undefined' || window.Favicon) {
        return;
    }

    const base = (typeof vkify !== 'undefined' && vkify.resourceUrl)
        ? vkify.resourceUrl('icons/')
        : '/assets/packages/static/openvk/img/favicon/';

    const states = {
        custom: null,
        im: null,
        music: null
    };

    let currentAppliedUrl = null;

    function baseHref() {
        const ovkHat = document.body && document.body.classList.contains('ovkhat');
        return base + (ovkHat ? 'ovk.ico' : 'default.ico');
    }

    function resolve(name) {
        if (!name) {
            return baseHref();
        }
        if (
            name.startsWith('/') ||
            name.startsWith('http://') ||
            name.startsWith('https://') ||
            name.startsWith('data:')
        ) {
            return name;
        }
        if (!name.endsWith('.ico')) {
            name = name + '.ico';
        }
        return base + name;
    }

    function apply(url) {
        const href = resolve(url);
        if (currentAppliedUrl === href) {
            return;
        }
        currentAppliedUrl = href;

        if (typeof document === 'undefined') {
            return;
        }

        function doApply() {
            let links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel~="icon"]');
            if (!links || links.length === 0) {
                const link = document.createElement('link');
                link.rel = 'shortcut icon';
                link.href = href;
                if (document.head) {
                    document.head.appendChild(link);
                }
            } else {
                links.forEach(function (link) {
                    if (link.getAttribute('href') !== href) {
                        link.setAttribute('href', href);
                    }
                });
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', doApply, { once: true });
        } else {
            doApply();
        }
    }

    function update() {
        const active = states.custom || states.im || states.music || null;
        apply(active ? resolve(active) : baseHref());
    }

    const FaviconManager = {
        get DEFAULT_FAVICON() {
            return baseHref();
        },
        BASE_PATH: base,
        resolve: resolve,
        apply: apply,
        update: update,
        set: function (iconName) {
            states.custom = iconName ? String(iconName) : null;
            update();
        },
        setIm: function (count) {
            const num = Number(count) || 0;
            if (num <= 0) {
                states.im = null;
            } else if (num > 9) {
                states.im = 'im9+';
            } else {
                states.im = 'im' + num;
            }
            update();
        },
        setMusic: function (state) {
            if (!state) {
                states.music = null;
            } else if (state === 'playing' || state === 'play') {
                states.music = 'play';
            } else if (state === 'paused' || state === 'pause') {
                states.music = 'pause';
            } else {
                states.music = String(state);
            }
            update();
        },
        clear: function (source) {
            if (source && Object.prototype.hasOwnProperty.call(states, source)) {
                states[source] = null;
            } else {
                states.custom = null;
                states.im = null;
                states.music = null;
            }
            update();
        },
        getStates: function () {
            return Object.assign({}, states);
        },
        getActive: function () {
            return states.custom || states.im || states.music || baseHref();
        }
    };

    function setFavicon(iconName) {
        FaviconManager.set(iconName || null);
    }

    window.FaviconManager = FaviconManager;
    window.Favicon = FaviconManager;
    window.setFavicon = setFavicon;
})();
