vkify.once('photoEditorLoader', function () {
    let loadPromise = null;

    function resolveAssetUrl(relPath) {
        if (window.vkify && typeof window.vkify.resourceUrl === 'function') {
            const url = window.vkify.resourceUrl(relPath);
            if (url && !url.startsWith('/')) return url;
        }
        const bundleScript = document.querySelector('script[src*="/resource/js/"]');
        if (bundleScript && bundleScript.src) {
            const base = bundleScript.src.replace(/\/js\/.*$/, '');
            return `${base}/${relPath.replace(/^\//, '')}`;
        }
        return `/themepack/vkify16/${document.querySelector('script[src*="/resource/js/"]')?.src.match(/\/vkify16\/([^/]+)\//)?.[1] || ''}/resource/${relPath.replace(/^\//, '')}`;
    }

    function ensurePhotoEditorLoaded() {
        if (window.__vkifyPhotoEditorImpl) {
            return Promise.resolve(window.__vkifyPhotoEditorImpl);
        }
        if (loadPromise) {
            return loadPromise;
        }

        let styleReady;
        if (window.vkify && typeof window.vkify.ensureStyle === 'function') {
            styleReady = window.vkify.ensureStyle('photo-editor');
        } else {
            const cssUrl = resolveAssetUrl('css/photo-editor.css');
            if (window.vkify && typeof window.vkify.loadStyle === 'function') {
                window.vkify.loadStyle(null, 'vkify-photo-editor-css', cssUrl);
            } else if (!document.getElementById('vkify-photo-editor-css')) {
                const link = document.createElement('link');
                link.id = 'vkify-photo-editor-css';
                link.rel = 'stylesheet';
                link.href = cssUrl;
                document.head.appendChild(link);
            }
            styleReady = Promise.resolve();
        }

        const jsUrl = resolveAssetUrl('js/dist/photo-editor.bundle.js');
        const scriptReady = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = jsUrl;
            script.async = true;
            script.onload = () => {
                if (window.__vkifyPhotoEditorImpl) {
                    resolve(window.__vkifyPhotoEditorImpl);
                } else {
                    reject(new Error('Photo editor bundle did not register implementation'));
                }
            };
            script.onerror = (err) => {
                loadPromise = null;
                reject(err);
            };
            document.head.appendChild(script);
        });
        loadPromise = Promise.all([styleReady, scriptReady])
            .then(([, impl]) => impl)
            .catch((err) => {
                loadPromise = null;
                throw err;
            });

        return loadPromise;
    }

    window.openVkPhotoEditor = async function (...args) {
        const impl = await ensurePhotoEditorLoaded();
        return impl.openVkPhotoEditor(...args);
    };

    window.openVkStickersEditor = async function (...args) {
        const impl = await ensurePhotoEditorLoaded();
        return impl.openVkStickersEditor(...args);
    };
});
