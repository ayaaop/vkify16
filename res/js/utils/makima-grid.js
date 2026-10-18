// Port of OpenVK's PHP Makima layout (\openvk\Web\Util\Makima\Makima::computeMasonryLayout)
// and VK's ThumbsEdit.processThumbs. Used by features/attachment-picker.js
// (composer media grid) and features/makima-attachments.js (mobile wall/comment
// media reflow) so client-side grids match server-rendered post layouts.

const ORIENT_WIDE = 0;
const ORIENT_REGULAR = 1;
const ORIENT_SLIM = 2;

function getOrientation(ratio) {
    if (ratio >= 1.2) return ORIENT_WIDE;
    if (ratio >= 0.8) return ORIENT_REGULAR;
    return ORIENT_SLIM;
}

function calculateMultiThumbsHeight(ratios, w, m) {
    const sum = ratios.reduce((acc, r) => acc + r, 0) || 1;
    return (w - (ratios.length - 1) * m) / sum;
}

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
 * Computes Makima mosaic layout for attachments, matching
 * \openvk\Web\Util\Makima\Makima::computeMasonryLayout.
 *
 * @param {Array} visualItems - Array of { type: 'photo'|'video', photo/video, ... }
 * @param {Object} options - { isFastchat, depth, maxWidth, maxHeight, gap }
 * @returns {Object} Layout object with gridWidth, gridHeight, and single/split_left/rows
 */
export function computeMakimaGrid(visualItems, options = {}) {
    const count = visualItems.length;
    if (count === 0) return null;

    const isFastchat = Boolean(options.isFastchat ?? window.im?.state?.isFastchat);
    const depth = options.depth || 0;

    let maxW = options.maxWidth;
    if (!maxW || maxW < 0) {
        maxW = isFastchat ? 205 : 510;
        if (depth > 0) {
            maxW = Math.max(180, maxW - depth * 20);
        }
    }

    let maxH = options.maxHeight;
    if (!maxH || maxH < 0) {
        maxH = Math.round(maxW * 0.666);
        if (depth > 0) {
            maxH = Math.max(180, maxH - depth * 15);
        }
    }

    const gap = options.gap ?? 2;

    const items = visualItems.map(item => ({
        att: item,
        dims: getMediaDimensions(item)
    }));

    // ── 1 Item ──────────────────────────────────────────────
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

    const rawRatios = items.map(it => it.dims.ratio);
    const orients = rawRatios.map(getOrientation);
    // Clamp extreme portrait/panorama ratios (e.g. tall phone screenshots) so
    // multi-tile grids don't collapse columns/rows into tiny slivers.
    const ratios = rawRatios.map(r => Math.max(0.6, Math.min(1.8, r)));
    const avgRatio = ratios.reduce((acc, r) => acc + r, 0) / count;
    const maxRatio = maxW / maxH;

    // ── 2 Items (Makima.php case 2) ─────────────────────────
    if (count === 2) {
        const r0 = ratios[0], r1 = ratios[1];

        // Two wide pics that can be stacked on top of each other
        if (
            orients[0] === ORIENT_WIDE && orients[1] === ORIENT_WIDE
            && avgRatio > 1.4 * maxRatio && Math.abs(r0 - r1) < 0.2
        ) {
            const computedHeight = Math.ceil(Math.min(maxW / r0, Math.min(maxW / r1, (maxH - gap) / 2)));
            const w = Math.ceil(maxW);
            return {
                type: 'standard',
                gridWidth: w,
                gridHeight: computedHeight * 2 + gap,
                rows: [
                    { height: computedHeight, ratio: w / computedHeight, tiles: [{ item: items[0].att, flex: 1, width: w, height: computedHeight }] },
                    { height: computedHeight, ratio: w / computedHeight, tiles: [{ item: items[1].att, flex: 1, width: w, height: computedHeight }] }
                ]
            };
        }

        // Two wide or two regular pics side by side with equal widths
        if (
            (orients[0] === ORIENT_WIDE && orients[1] === ORIENT_WIDE)
            || (orients[0] === ORIENT_REGULAR && orients[1] === ORIENT_REGULAR)
        ) {
            const computedWidth = (maxW - gap) / 2;
            const h = Math.ceil(Math.min(computedWidth / r0, Math.min(computedWidth / r1, maxH)));
            const w0 = Math.ceil(computedWidth);
            const w1 = Math.ceil(maxW) - gap - w0;
            return {
                type: 'standard',
                gridWidth: Math.ceil(maxW),
                gridHeight: h,
                rows: [
                    {
                        height: h,
                        ratio: maxW / h,
                        tiles: [
                            { item: items[0].att, flex: 1, width: w0, height: h },
                            { item: items[1].att, flex: 1, width: w1, height: h }
                        ]
                    }
                ]
            };
        }

        // Next to each other, different ratios
        const w0 = ((maxW - gap) / r1) / ((1 / r0) + (1 / r1));
        const w1 = maxW - w0 - gap;
        const h = Math.ceil(Math.min(maxH, Math.min(w0 / r0, w1 / r1)));
        const cw0 = Math.ceil(w0);
        const cw1 = Math.ceil(maxW) - gap - cw0;

        return {
            type: 'standard',
            gridWidth: Math.ceil(maxW),
            gridHeight: h,
            rows: [
                {
                    height: h,
                    ratio: maxW / h,
                    tiles: [
                        { item: items[0].att, flex: w0, width: cw0, height: h },
                        { item: items[1].att, flex: w1, width: cw1, height: h }
                    ]
                }
            ]
        };
    }

    // ── 3 Items (Makima.php case 3) ─────────────────────────
    if (count === 3) {
        const r0 = ratios[0], r1 = ratios[1], r2 = ratios[2];

        // Three wide photos: one on top, two below
        if (orients[0] === ORIENT_WIDE && orients[1] === ORIENT_WIDE && orients[2] === ORIENT_WIDE) {
            const hCover = Math.min(maxW / r0, (maxH - gap) * (2 / 3));
            const w2 = (maxW - gap) / 2;
            const h = Math.min(maxH - hCover - gap, Math.min(w2 / r1, w2 / r2));
            const r0H = Math.ceil(hCover);
            const r1H = Math.ceil(h);
            const cw0 = Math.ceil(w2);
            const cw1 = Math.ceil(maxW) - gap - cw0;

            return {
                type: 'standard',
                gridWidth: Math.ceil(maxW),
                gridHeight: Math.ceil(gap + hCover + h),
                rows: [
                    { height: r0H, ratio: maxW / r0H, tiles: [{ item: items[0].att, flex: 1, width: Math.ceil(maxW), height: r0H }] },
                    {
                        height: r1H,
                        ratio: maxW / r1H,
                        tiles: [
                            { item: items[1].att, flex: 1, width: cw0, height: r1H },
                            { item: items[2].att, flex: 1, width: cw1, height: r1H }
                        ]
                    }
                ]
            };
        }

        // One on the left, two stacked on the right
        const wCover = Math.min(maxH * r0, (maxW - gap) * (3 / 4));
        const h1 = (r1 * (maxH - gap)) / (r2 + r1);
        const h0 = maxH - gap - h1;
        const w = Math.max(1, Math.min(maxW - gap - wCover, Math.min(h1 * r2, h0 * r1)));
        const availW = Math.ceil(maxW) - gap;
        const leftW = Math.round((availW * wCover) / (wCover + w));
        const rightW = availW - leftW;
        const totalH = Math.ceil(maxH);
        const ch0 = Math.ceil(h0);
        const ch1 = totalH - gap - ch0;

        return {
            type: 'split_left',
            gridWidth: Math.ceil(maxW),
            gridHeight: totalH,
            leftTile: { item: items[0].att, flex: wCover / w, width: leftW, height: totalH },
            rightTiles: [
                { item: items[1].att, flex: h0, width: rightW, height: ch0 },
                { item: items[2].att, flex: h1, width: rightW, height: ch1 }
            ]
        };
    }

    // ── 4 Items (Makima.php case 4) ─────────────────────────
    if (count === 4) {
        const r0 = ratios[0], r1 = ratios[1], r2 = ratios[2], r3 = ratios[3];

        // Four wide photos: one on top, three below
        if (
            orients[0] === ORIENT_WIDE && orients[1] === ORIENT_WIDE
            && orients[2] === ORIENT_WIDE && orients[3] === ORIENT_WIDE
        ) {
            const hCover = Math.min(maxW / r0, (maxH - gap) * (2 / 3));
            const hRaw = (maxW - 2 * gap) / (r1 + r2 + r3);
            const w0 = hRaw * r1;
            const w1 = hRaw * r2;
            const w2 = hRaw * r3;
            const h = Math.min(maxH - gap - hCover, hRaw);
            const r0H = Math.ceil(hCover);
            const r1H = Math.ceil(h);
            const cw0 = Math.ceil(w0);
            const cw1 = Math.ceil(w1);
            const cw2 = Math.ceil(maxW) - 2 * gap - cw0 - cw1;

            return {
                type: 'standard',
                gridWidth: Math.ceil(maxW),
                gridHeight: Math.ceil(hCover + gap + h),
                rows: [
                    { height: r0H, ratio: maxW / r0H, tiles: [{ item: items[0].att, flex: 1, width: Math.ceil(maxW), height: r0H }] },
                    {
                        height: r1H,
                        ratio: maxW / r1H,
                        tiles: [
                            { item: items[1].att, flex: w0, width: cw0, height: r1H },
                            { item: items[2].att, flex: w1, width: cw1, height: r1H },
                            { item: items[3].att, flex: w2, width: cw2, height: r1H }
                        ]
                    }
                ]
            };
        }

        // One on the left, three stacked on the right
        const wCover = Math.min(maxH * r0, (maxW - gap) * (2 / 3));
        const wRaw = (maxH - 2 * gap) / (1 / r1 + 1 / r2 + 1 / r3);
        const h0 = wRaw / r1;
        const h1 = wRaw / r2;
        const h2 = wRaw / r3 + gap;
        const w = Math.max(1, Math.min(wRaw, maxW - gap - wCover));
        const availW = Math.ceil(maxW) - gap;
        const leftW = Math.round((availW * wCover) / (wCover + w));
        const rightW = availW - leftW;
        const totalH = Math.ceil(maxH);
        const ch0 = Math.ceil(h0);
        const ch1 = Math.ceil(h1);
        const ch2 = totalH - 2 * gap - ch0 - ch1;

        return {
            type: 'split_left',
            gridWidth: Math.ceil(maxW),
            gridHeight: totalH,
            leftTile: { item: items[0].att, flex: wCover / w, width: leftW, height: totalH },
            rightTiles: [
                { item: items[1].att, flex: h0, width: rightW, height: ch0 },
                { item: items[2].att, flex: h1, width: rightW, height: ch1 },
                { item: items[3].att, flex: h2, width: rightW, height: ch2 }
            ]
        };
    }

    // ── 5+ Items (Makima.php / ThumbsEdit.processThumbs default branch) ──
    const ratiosCropped = avgRatio > 1.1
        ? ratios.map(r => Math.max(r, 1.0))
        : ratios.map(r => Math.min(r, 1.0));

    const tries = [];

    // Try two lines (at least 2 items per row, balanced row counts)
    for (let firstLine = 2; firstLine <= count - 2; firstLine++) {
        const secondLine = count - firstLine;
        if (Math.abs(firstLine - secondLine) > 2) continue;
        tries.push({
            config: [firstLine, secondLine],
            heights: [
                calculateMultiThumbsHeight(ratiosCropped.slice(0, firstLine), maxW, gap),
                calculateMultiThumbsHeight(ratiosCropped.slice(firstLine), maxW, gap)
            ]
        });
    }

    // Try three lines (at least 2 items per row, balanced row counts)
    for (let firstLine = 2; firstLine <= count - 4; firstLine++) {
        for (let secondLine = 2; secondLine <= count - firstLine - 2; secondLine++) {
            const thirdLine = count - firstLine - secondLine;
            const maxInRow = Math.max(firstLine, secondLine, thirdLine);
            const minInRow = Math.min(firstLine, secondLine, thirdLine);
            if (maxInRow - minInRow > 2) continue;
            tries.push({
                config: [firstLine, secondLine, thirdLine],
                heights: [
                    calculateMultiThumbsHeight(ratiosCropped.slice(0, firstLine), maxW, gap),
                    calculateMultiThumbsHeight(ratiosCropped.slice(firstLine, firstLine + secondLine), maxW, gap),
                    calculateMultiThumbsHeight(ratiosCropped.slice(firstLine + secondLine), maxW, gap)
                ]
            });
        }
    }

    let optimalConfiguration = null;
    let optimalHeights = null;
    let optimalDifference = Infinity;

    for (const candidate of tries) {
        const { config, heights } = candidate;
        let confH = gap * (heights.length - 1);
        for (const h of heights) confH += h;

        let confDiff = Math.abs(confH - maxH);
        if (config.length > 1) {
            if (config[0] > config[1] || (config.length >= 3 && config[1] > config[2])) {
                confDiff = (confDiff + 50) * 1.5;
            }
        }

        if (!optimalConfiguration || confDiff < optimalDifference) {
            optimalConfiguration = config;
            optimalHeights = heights;
            optimalDifference = confDiff;
        }
    }

    let itemIdx = 0;
    let totalHeight = 0;
    const rows = [];

    for (let i = 0; i < optimalConfiguration.length; i++) {
        const lineChunksNum = optimalConfiguration[i];
        const lineHeight = optimalHeights[i];
        totalHeight += lineHeight;
        const rowH = Math.ceil(lineHeight);

        let totalWidth = 0;
        const rowTiles = [];
        for (let j = 0; j < lineChunksNum && itemIdx < count; j++) {
            const thumbRatio = ratiosCropped[itemIdx];
            const att = items[itemIdx].att;
            itemIdx++;
            const isLast = j === lineChunksNum - 1;
            const w = isLast
                ? Math.max(1, Math.ceil(maxW) - totalWidth - gap * Math.max(0, lineChunksNum - 1))
                : Math.ceil(thumbRatio * lineHeight);
            totalWidth += w;
            rowTiles.push({
                item: att,
                flex: thumbRatio,
                width: w,
                height: rowH
            });
        }
        rows.push({ height: rowH, ratio: maxW / rowH, tiles: rowTiles });
    }

    const gridHeight = Math.ceil(totalHeight + gap * (optimalHeights.length - 1));

    return {
        type: 'standard',
        gridWidth: Math.ceil(maxW),
        gridHeight,
        rows
    };
}
