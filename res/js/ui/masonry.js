vkify.once('masonry', () => {
    window.Masonry = (function () {
        const instances = new Map();
        const defaultOptions = {
            columns: 3,
            gap: 10,
            itemSelector: '.masonry-item',
            breakpoints: { 600: 2, 400: 1 }
        };

        function getColumnCount(container, options) {
            const width = container.clientWidth;
            const breakpoints = Object.entries(options.breakpoints).sort((a, b) => b[0] - a[0]);
            for (const [breakpoint, cols] of breakpoints) {
                if (width <= Number(breakpoint)) return cols;
            }
            return options.columns;
        }

        function getItemHeight(item, colWidth) {
            const img = item.querySelector('img');
            if (!img) return item.offsetHeight || 150;

            if (img.naturalWidth && img.naturalHeight) {
                return (img.naturalHeight / img.naturalWidth) * colWidth;
            }

            if (img.complete && img.offsetHeight > 0) {
                return item.offsetHeight;
            }

            return 150;
        }

        function layout(container, options) {
            const items = Array.from(container.querySelectorAll(options.itemSelector));
            if (!items.length) return;

            const cols = getColumnCount(container, options);
            const gap = options.gap;
            const cs = getComputedStyle(container);
            const padLeft = parseFloat(cs.paddingLeft) || 0;
            const padRight = parseFloat(cs.paddingRight) || 0;
            const padTop = parseFloat(cs.paddingTop) || 0;
            const padBottom = parseFloat(cs.paddingBottom) || 0;
            const contentWidth = container.clientWidth - padLeft - padRight;
            const colWidth = (contentWidth - gap * (cols - 1)) / cols;
            const colHeights = Array(cols).fill(0);

            container.classList.add('masonry-active');

            items.forEach((item) => {
                const shortestCol = colHeights.indexOf(Math.min(...colHeights));
                const x = padLeft + shortestCol * (colWidth + gap);
                const y = padTop + colHeights[shortestCol];

                item.style.width = colWidth + 'px';
                item.style.left = x + 'px';
                item.style.top = y + 'px';

                const itemHeight = getItemHeight(item, colWidth);
                colHeights[shortestCol] += itemHeight + gap;
            });

            container.style.height = padTop + padBottom + Math.max(...colHeights) - gap + 'px';
            vkify.paginator?.scheduleCheck?.();
        }

        function init(container, userOptions = {}) {
            if (typeof container === 'string') container = document.querySelector(container);
            if (!container) return null;

            const options = { ...defaultOptions, ...userOptions };

            const existing = instances.get(container);
            if (existing) {
                layout(container, options);
                attachImageListeners(container, () => layout(container, options));
                return existing.instance;
            }

            const doLayout = () => layout(container, options);

            requestAnimationFrame(doLayout);
            attachImageListeners(container, doLayout);

            let ro = null;
            if (typeof ResizeObserver !== 'undefined') {
                ro = new ResizeObserver(() => requestAnimationFrame(doLayout));
                ro.observe(container);
            }

            let resizeTimeout;
            const onResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(doLayout, 100);
            };

            window.addEventListener('resize', onResize);

            const instance = {
                container,
                options,
                layout: doLayout,
                destroy: () => destroy(container)
            };

            instances.set(container, { instance, onResize, resizeTimeout, ro });
            return instance;
        }

        function attachImageListeners(container, callback) {
            const images = container.querySelectorAll('img');
            images.forEach((img) => {
                if (img.complete && img.naturalHeight > 0) return;
                if (img.dataset.masonryListening) return;
                img.dataset.masonryListening = 'true';
                img.addEventListener('load', () => requestAnimationFrame(callback), { once: true });
                img.addEventListener('error', () => requestAnimationFrame(callback), { once: true });
            });
        }

        function destroy(container) {
            if (typeof container === 'string') container = document.querySelector(container);
            const data = instances.get(container);
            if (!data) return;

            window.removeEventListener('resize', data.onResize);
            data.ro?.disconnect();
            clearTimeout(data.resizeTimeout);

            const items = container.querySelectorAll(data.instance.options.itemSelector);
            items.forEach((item) => {
                item.style.width = '';
                item.style.left = '';
                item.style.top = '';
            });
            container.classList.remove('masonry-active');
            container.style.height = '';

            instances.delete(container);
        }

        function get(container) {
            if (typeof container === 'string') container = document.querySelector(container);
            return instances.get(container)?.instance || null;
        }

        function refresh(container) {
            if (typeof container === 'string') container = document.querySelector(container);
            const data = instances.get(container);
            if (data) {
                requestAnimationFrame(() => {
                    data.instance.layout();
                    attachImageListeners(container, data.instance.layout);
                });
            }
        }

        function initAll(selector, userOptions = {}) {
            const containers = document.querySelectorAll(selector);
            containers.forEach((container) => {
                init(container, userOptions);
            });
        }

        return { init, destroy, get, refresh, initAll };
    })();
});

function initAlbumMasonry() {
    if (document.querySelector('.album-flex')) {
        Masonry.initAll('.album-flex', { itemSelector: '.masonry-item', columns: 3, gap: 10, breakpoints: { 500: 2, 360: 1 } });
        requestAnimationFrame(() => vkify.paginator?.scheduleCheck?.());
    }
}
window.initAlbumMasonry = initAlbumMasonry;

vkify.onPage(initAlbumMasonry);
