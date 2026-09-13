(function () {
    'use strict';

    if (typeof window === 'undefined' || window.Favicon) {
        return;
    }

    const base = (typeof vkify !== 'undefined' && vkify.resourceUrl)
        ? vkify.resourceUrl('icons/')
        : '/assets/packages/static/openvk/img/favicon/';

    function resolve(name) {
        if (!name) {
            return base + 'default.ico';
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

    function setFaviconIcon(name) {
        const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel~="icon"]');
        const href = resolve(name);
        if (links.length === 0) {
            const link = document.createElement('link');
            link.rel = 'shortcut icon';
            link.href = href;
            if (document.head) {
                document.head.appendChild(link);
            }
            return;
        }
        links.forEach((link) => {
            if (link.getAttribute('href') !== href) {
                link.setAttribute('href', href);
            }
        });
    }

    window.setFavicon = setFaviconIcon;

    window.Favicon = {
        set: (name) => setFaviconIcon(name),
        clear: () => setFaviconIcon(null),
        setIm: (count) => {
            const num = Number(count) || 0;
            if (num <= 0) {
                setFaviconIcon(null);
            } else if (num > 9) {
                setFaviconIcon('im9+');
            } else {
                setFaviconIcon('im' + num);
            }
        },
        setMusic: (state) => {
            if (!state) {
                setFaviconIcon(null);
            } else if (state === 'playing' || state === 'play') {
                setFaviconIcon('play');
            } else if (state === 'paused' || state === 'pause') {
                setFaviconIcon('pause');
            } else {
                setFaviconIcon(String(state));
            }
        }
    };
})();
