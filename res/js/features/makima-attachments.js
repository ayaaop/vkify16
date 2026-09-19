import { computeMakimaGrid } from '../utils/makima-grid.js';

// Re-flows .attachments_b media tiles into a Makima mosaic on mobile, where the
// server-side fixed-width layout doesn't fit. Desktop keeps the PHP mosaic;
// without JS the mobile.css flat-stack fallback applies.
(function () {
    'use strict';

    const MOBILE_MQ = window.matchMedia('(max-width: 768px)');

    function tileItem(el) {
        const link = el.querySelector('a.media-href');
        let w = 0, h = 0;
        if (link) {
            w = parseInt(link.dataset.makimaW, 10) || 0;
            h = parseInt(link.dataset.makimaH, 10) || 0;
        }
        if (!w || !h) {
            const img = el.querySelector('img');
            if (img) {
                w = w || parseInt(img.getAttribute('width'), 10) || 0;
                h = h || parseInt(img.getAttribute('height'), 10) || 0;
            }
        }
        const isVideo = !!(link && link.classList.contains('compact_video'));
        return isVideo
            ? { type: 'video', video: { width: w, height: h } }
            : { type: 'photo', photo: { width: w, height: h } };
    }

    function prepare(container) {
        if (container.__makima) return;
        const els = Array.from(container.children)
            .filter(el => el.classList && el.classList.contains('attachment'));
        if (els.length < 2) return;
        container.__makima = {
            els: els,
            items: els.map(tileItem),
            origStyles: els.map(el => el.getAttribute('style') || ''),
            applied: false,
        };
    }

    function unapply(container) {
        const st = container.__makima;
        if (!st || !st.applied) return;
        st.els.forEach((el, i) => {
            el.setAttribute('style', st.origStyles[i]);
            container.appendChild(el);
        });
        Array.from(container.children).forEach(el => {
            if (!el.classList || !el.classList.contains('attachment')) el.remove();
        });
        container.classList.remove('makima');
        st.applied = false;
    }

    function apply(container) {
        const st = container.__makima;
        if (!st) return;
        if (st.applied) unapply(container);
        const maxW = container.clientWidth;
        if (maxW <= 0) return;
        const layout = computeMakimaGrid(st.items, {
            maxWidth: maxW,
            maxHeight: maxW,
            isFastchat: false,
        });
        if (!layout || layout.type === 'single') return;

        const place = (item, flex) => {
            const el = st.els[st.items.indexOf(item)];
            el.style.flex = String(flex != null ? flex : 1);
            el.style.height = '100%';
            return el;
        };

        if (layout.type === 'split_left') {
            const row = document.createElement('div');
            row.className = 'makima_row';
            row.style.height = layout.gridHeight + 'px';
            row.appendChild(place(layout.leftTile.item, layout.leftTile.flex));
            const col = document.createElement('div');
            col.className = 'makima_col';
            layout.rightTiles.forEach(t => col.appendChild(place(t.item, t.flex)));
            row.appendChild(col);
            container.appendChild(row);
        } else {
            layout.rows.forEach(r => {
                const row = document.createElement('div');
                row.className = 'makima_row';
                row.style.height = r.height + 'px';
                r.tiles.forEach(t => row.appendChild(place(t.item, t.flex)));
                container.appendChild(row);
            });
        }
        container.classList.add('makima');
        st.applied = true;
    }

    function relayoutAll() {
        if (!MOBILE_MQ.matches) return;
        document.querySelectorAll('.attachments_b').forEach(container => {
            prepare(container);
            apply(container);
        });
    }

    window.vkify?.onPage?.(relayoutAll);

    const onMqChange = () => {
        if (MOBILE_MQ.matches) {
            relayoutAll();
        } else {
            document.querySelectorAll('.attachments_b.makima').forEach(unapply);
        }
    };
    if (MOBILE_MQ.addEventListener) {
        MOBILE_MQ.addEventListener('change', onMqChange);
    } else if (MOBILE_MQ.addListener) {
        MOBILE_MQ.addListener(onMqChange);
    }

    let resizeRaf = false;
    window.addEventListener('resize', () => {
        if (!MOBILE_MQ.matches || resizeRaf) return;
        resizeRaf = true;
        requestAnimationFrame(() => {
            resizeRaf = false;
            document.querySelectorAll('.attachments_b.makima').forEach(apply);
        });
    }, { passive: true });

    // Covers ajax-inserted attachments (infinite scroll, new comments).
    window.vkify?.observeDOM?.((mutations) => {
        if (!MOBILE_MQ.matches) return;
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                const containers = node.classList && node.classList.contains('attachments_b')
                    ? [node]
                    : Array.from(node.querySelectorAll ? node.querySelectorAll('.attachments_b') : []);
                containers.forEach(container => {
                    prepare(container);
                    apply(container);
                });
            }
        }
    });
})();
