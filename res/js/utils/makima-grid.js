// Ported from Web/static/js/messages/components/makima_grid.js (layout math only).
// Used by features/makima-attachments.js for mobile mosaics.

/**
 * Extracts width, height and aspect ratio from a photo or video attachment.
 */
export function getMediaDimensions(att) {
    if (!att) return { width: 4, height: 3, ratio: 4 / 3 };

    if (att.type === 'photo') {
        const p = att.photo || {};
        let w = Number(p.width || p.orig_photo?.width);
        let h = Number(p.height || p.orig_photo?.height);

        if ((!w || !h || isNaN(w) || isNaN(h)) && Array.isArray(p.sizes) && p.sizes.length > 0) {
            for (let i = p.sizes.length - 1; i >= 0; i--) {
                const s = p.sizes[i];
                if (s && s.width && s.height && !isNaN(s.width) && !isNaN(s.height)) {
                    w = Number(s.width);
                    h = Number(s.height);
                    break;
                }
            }
        }

        if (!w || !h || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            w = 600;
            h = 450;
        }

        return { width: w, height: h, ratio: w / h };
    } else if (att.type === 'video') {
        const v = att.video?.video || att.video || {};
        let w = Number(v.width);
        let h = Number(v.height);

        if (!w || !h || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            w = 640;
            h = 360;
        }

        return { width: w, height: h, ratio: w / h };
    }

    return { width: 4, height: 3, ratio: 4 / 3 };
}

/**
 * Computes Makima mosaic layout for attachments.
 * Takes into account container dimensions (FastChats vs Standard Chat vs Mobile).
 *
 * @param {Array} visualItems - Array of { type: 'photo'|'video', photo/video, ... }
 * @param {Object} options - { isFastchat, depth, maxWidth, maxHeight }
 * @returns {Object} Layout object with gridWidth, gridHeight, and layoutRows or columns
 */
export function computeMakimaGrid(visualItems, options = {}) {
    const count = visualItems.length;
    if (count === 0) return null;

    const isFastchat = Boolean(options.isFastchat ?? window.im?.state?.isFastchat);
    const depth = options.depth || 0;

    let maxW = options.maxWidth;
    if (!maxW) {
        maxW = isFastchat ? 205 : 380;
        if (depth > 0) {
            maxW = Math.max(180, maxW - depth * 20);
        }
    }

    let maxH = options.maxHeight;
    if (!maxH) {
        maxH = isFastchat ? 230 : 350;
        if (depth > 0) {
            maxH = Math.max(180, maxH - depth * 15);
        }
    }

    const items = visualItems.map(item => ({
        att: item,
        dims: getMediaDimensions(item)
    }));

    if (count === 1) {
        const { width, height, ratio } = items[0].dims;
        const clampedRatio = Math.max(0.45, Math.min(2.4, ratio));
        let w, h;

        if (clampedRatio >= 1) {
            w = Math.min(width, maxW);
            h = Math.round(w / clampedRatio);
            if (h > maxH) {
                h = maxH;
                w = Math.round(h * clampedRatio);
            }
        } else {
            h = Math.min(height, maxH);
            w = Math.round(h * clampedRatio);
            if (w > maxW) {
                w = maxW;
                h = Math.round(w / clampedRatio);
            }
        }

        w = Math.max(isFastchat ? 60 : 90, Math.min(maxW, w));
        h = Math.max(isFastchat ? 60 : 90, Math.min(maxH, h));

        return {
            type: 'single',
            gridWidth: w,
            gridHeight: h,
            ratio: clampedRatio,
            tile: { item: items[0].att, width: w, height: h, ratio: clampedRatio }
        };
    }

    if (count === 2) {
        const r0 = items[0].dims.ratio;
        const r1 = items[1].dims.ratio;

        if (r0 >= 1.6 && r1 >= 1.6) {
            const h0 = Math.round(Math.min(maxH * 0.48, maxW / r0));
            const h1 = Math.round(Math.min(maxH * 0.48, maxW / r1));
            return {
                type: 'standard',
                gridWidth: maxW,
                gridHeight: h0 + h1 + 2,
                rows: [
                    { height: h0, ratio: maxW / h0, tiles: [{ item: items[0].att, flex: 1, height: h0 }] },
                    { height: h1, ratio: maxW / h1, tiles: [{ item: items[1].att, flex: 1, height: h1 }] }
                ]
            };
        }

        const avgR = (r0 + r1) / 2;
        let rowH = Math.round((maxW / 2) / avgR);
        rowH = Math.max(isFastchat ? 70 : 110, Math.min(maxH * 0.75, rowH));

        return {
            type: 'standard',
            gridWidth: maxW,
            gridHeight: rowH,
            rows: [
                {
                    height: rowH,
                    ratio: maxW / rowH,
                    tiles: [
                        { item: items[0].att, flex: 1, height: rowH },
                        { item: items[1].att, flex: 1, height: rowH }
                    ]
                }
            ]
        };
    }

    if (count === 3) {
        const r0 = items[0].dims.ratio;
        const r1 = items[1].dims.ratio;
        const r2 = items[2].dims.ratio;

        if (r0 >= 1.2 && r1 >= 1.2 && r2 >= 1.2) {
            const hTop = Math.round(Math.min(maxH * 0.52, maxW / r0));
            const hBottom = Math.round(Math.min(maxH - hTop - 2, (maxW / 2) / ((r1 + r2) / 2)));
            const safeBottom = Math.max(isFastchat ? 60 : 90, hBottom);

            return {
                type: 'standard',
                gridWidth: maxW,
                gridHeight: hTop + safeBottom + 2,
                rows: [
                    { height: hTop, ratio: maxW / hTop, tiles: [{ item: items[0].att, flex: 1, height: hTop }] },
                    {
                        height: safeBottom,
                        ratio: maxW / safeBottom,
                        tiles: [
                            { item: items[1].att, flex: 1, height: safeBottom },
                            { item: items[2].att, flex: 1, height: safeBottom }
                        ]
                    }
                ]
            };
        }

        // Classic Makima 3-photo: 1 dominant on left, 2 stacked on right
        const totalH = Math.round(Math.min(maxH, Math.max(isFastchat ? 120 : 180, maxW * 0.65)));
        const hSub = Math.round((totalH - 2) / 2);

        return {
            type: 'split_left',
            gridWidth: maxW,
            gridHeight: totalH,
            leftTile: { item: items[0].att, flex: 1.35, height: totalH },
            rightTiles: [
                { item: items[1].att, flex: 1, height: hSub },
                { item: items[2].att, flex: 1, height: hSub }
            ]
        };
    }

    if (count === 4) {
        const rowH = Math.round(Math.min(maxH * 0.48, Math.max(isFastchat ? 65 : 95, (maxW / 2) * 0.72)));
        return {
            type: 'standard',
            gridWidth: maxW,
            gridHeight: rowH * 2 + 2,
            rows: [
                {
                    height: rowH,
                    ratio: maxW / rowH,
                    tiles: [
                        { item: items[0].att, flex: 1, height: rowH },
                        { item: items[1].att, flex: 1, height: rowH }
                    ]
                },
                {
                    height: rowH,
                    ratio: maxW / rowH,
                    tiles: [
                        { item: items[2].att, flex: 1, height: rowH },
                        { item: items[3].att, flex: 1, height: rowH }
                    ]
                }
            ]
        };
    }

    let rowCounts = [];
    if (count === 5) rowCounts = [2, 3];
    else if (count === 6) rowCounts = [3, 3];
    else if (count === 7) rowCounts = [3, 2, 2];
    else if (count === 8) rowCounts = [2, 3, 3];
    else if (count === 9) rowCounts = [3, 3, 3];
    else rowCounts = [3, 3, 4];

    const numRows = rowCounts.length;
    const targetRowH = Math.round(Math.min(maxH * 0.45, Math.max(isFastchat ? 55 : 85, (maxH - (numRows - 1) * 2) / numRows)));

    let itemIdx = 0;
    const rows = [];
    let totalH = 0;

    for (let r = 0; r < numRows; r++) {
        const cInRow = rowCounts[r];
        const rowTiles = [];
        for (let c = 0; c < cInRow && itemIdx < count; c++) {
            rowTiles.push({
                item: items[itemIdx++].att,
                flex: 1,
                height: targetRowH
            });
        }
        rows.push({ height: targetRowH, ratio: maxW / targetRowH, tiles: rowTiles });
        totalH += targetRowH;
    }
    totalH += (numRows - 1) * 2;

    return {
        type: 'standard',
        gridWidth: maxW,
        gridHeight: totalH,
        rows: rows
    };
}
