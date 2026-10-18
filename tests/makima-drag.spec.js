// @ts-check
// Verifies pointer-based reorder of Makima composer attachments on a real
// page: a 16-tile grid is injected into the wall composer, then the last
// (bottom-left) tile is dragged diagonally onto the top-right area. Asserts
// the reorder commits without oscillation and stays cheap.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
        window.__mk = { moCalls: 0, moMs: 0, inserts: 0, orderLog: [] };
        const MO = window.MutationObserver;
        window.MutationObserver = class extends MO {
            constructor(cb) {
                super((muts, obs) => {
                    const t0 = performance.now();
                    window.__mk.moCalls++;
                    const r = cb(muts, obs);
                    window.__mk.moMs += performance.now() - t0;
                    return r;
                });
            }
        };
        const origIns = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function (n, r) {
            if (this.classList?.contains?.('post-horizontal')) window.__mk.inserts++;
            return origIns.call(this, n, r);
        };
        setInterval(() => {
            const c = document.querySelector('.post-horizontal.vkify_makima_composer');
            if (c) window.__mk.orderLog.push([...c.children].map(e => e.dataset.id).join(','));
        }, 60);
    });

    await page.goto('http://localhost/login');
    await page.locator('input[name="login"]').first().fill('example@example.com');
    await page.locator('input[name="password"]').first().fill('example');
    await page.locator('input[name="password"]').first().press('Enter');
    await page.waitForLoadState('networkidle');
});

test('composer makima drag-reorder does not oscillate', async ({ page }) => {
    await page.goto('http://localhost/wall2');
    const write = page.locator('.postFeedWrapperMicroblog #write');
    await expect(write).toBeVisible();

    // inject 16 photo attachments with varied aspect ratios (worst case for
    // the order-sensitive makima reflow)
    await page.evaluate(() => {
        const cont = document.querySelector('.postFeedWrapperMicroblog #write .post-buttons .post-horizontal');
        const dims = [[600, 450], [1280, 720], [500, 500], [800, 600], [900, 1200], [640, 360]];
        for (let i = 0; i < 16; i++) {
            const [w, h] = dims[i % dims.length];
            const a = document.createElement('a');
            a.className = 'upload-item';
            a.dataset.type = 'photo';
            a.dataset.width = String(w);
            a.dataset.height = String(h);
            a.dataset.id = `pw_${String(i).padStart(2, '0')}`;
            const img = document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
            a.appendChild(img);
            cont.appendChild(a);
        }
    });
    await expect(page.locator('.postFeedWrapperMicroblog #write .post-horizontal.vkify_makima_composer')).toBeVisible();
    await page.waitForTimeout(400);

    const tiles = page.locator('.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item');
    await expect(tiles).toHaveCount(16);

    // scroll the composer into view, pick last (bottom) and target tile
    await write.scrollIntoViewIfNeeded();
    const getCenter = async (loc) => {
        const b = await loc.boundingBox();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const src = await getCenter(tiles.nth(15));
    const dst = await getCenter(tiles.nth(2));

    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
        // small jitter emulates a real finger/cursor and would feed a
        // reflow-driven reorder loop if one existed
        const jx = (i % 3) - 1, jy = ((i + 1) % 3) - 1;
        await page.mouse.move(
            src.x + ((dst.x - src.x) * i) / steps + jx,
            src.y + ((dst.y - src.y) * i) / steps + jy
        );
        await page.waitForTimeout(30);
        if (i === 12) {
            // dwell mid-grid — the stationary-pointer oscillation case
            await page.mouse.move(dst.x / 2 + src.x / 2 + 1, dst.y / 2 + src.y / 2 + 1);
            await page.waitForTimeout(500);
        }
    }
    await page.mouse.up();
    await page.waitForTimeout(400);

    const stats = await page.evaluate(() => window.__mk);
    const finalOrder = await page.$$eval(
        '.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item',
        els => els.map(e => e.dataset.id)
    );

    console.log('stats:', JSON.stringify({
        moCalls: stats.moCalls, moMs: Math.round(stats.moMs), inserts: stats.inserts,
    }));
    console.log('final order:', finalOrder.join(','));
    const uniq = [...new Set(stats.orderLog)];
    console.log('distinct orderings observed:', uniq.length);

    // pw_15 must have moved forward in the grid
    expect(finalOrder.indexOf('pw_15')).toBeLessThan(12);
    // bounded reorder churn — a clean diagonal drag commits a handful of moves
    expect(stats.inserts).toBeLessThan(15);
    // no flip-flopping: order changes are bounded too (each insert = one change)
    let transitions = 0;
    for (let i = 1; i < stats.orderLog.length; i++) {
        if (stats.orderLog[i] !== stats.orderLog[i - 1]) transitions++;
    }
    console.log('order transitions:', transitions);
    expect(transitions).toBeLessThan(15);
});

test('video drag-release does not open video modal, release glides smoothly, and 4-tile Makima matches PHP', async ({ page }) => {
    await page.goto('http://localhost/wall2');
    const write = page.locator('.postFeedWrapperMicroblog #write');
    await expect(write).toBeVisible();

    // 4 mixed attachments (1 portrait + 2 photos + 1 video) -> PHP Makima 1-left + 3-right
    await page.evaluate(() => {
        const cont = document.querySelector('.postFeedWrapperMicroblog #write .post-buttons .post-horizontal');
        if (!cont) return;
        cont.innerHTML = '';
        const items = [
            { type: 'photo', w: 900, h: 1200, id: '1_1' },
            { type: 'photo', w: 800, h: 600, id: '1_2' },
            { type: 'photo', w: 600, h: 600, id: '1_3' },
            { type: 'video', w: 1280, h: 720, id: '1_4' },
        ];
        for (const it of items) {
            const a = document.createElement('a');
            a.className = 'upload-item';
            if (it.type === 'video') a.id = 'videoOpen';
            a.href = `/${it.type}${it.id}`;
            a.dataset.type = it.type;
            a.dataset.width = String(it.w);
            a.dataset.height = String(it.h);
            a.dataset.id = it.id;
            const img = document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
            a.appendChild(img);
            cont.appendChild(a);
        }
    });
    await expect(page.locator('.postFeedWrapperMicroblog #write .post-horizontal.vkify_makima_composer')).toBeVisible();
    await page.waitForTimeout(300);

    // Verify 4 mixed items use PHP's 1-left + 3-right layout (tile 0 at x=0, tiles 1..3 sharing x > 0)
    const boxes = await page.$$eval(
        '.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item',
        els => els.map(e => {
            const el = /** @type {HTMLElement} */ (e);
            return {
                id: el.dataset.id,
                l: el.offsetLeft,
                t: el.offsetTop,
                w: el.offsetWidth,
                h: el.offsetHeight,
            };
        })
    );
    expect(boxes[0].l).toBe(0);
    expect(boxes[1].l).toBeGreaterThan(boxes[0].w);
    expect(boxes[2].l).toBe(boxes[1].l);
    expect(boxes[3].l).toBe(boxes[1].l);
    expect(boxes[2].t).toBeGreaterThan(boxes[1].t);
    expect(boxes[3].t).toBeGreaterThan(boxes[2].t);

    // Drag the video (4th tile) onto the 2nd tile slot and release
    await write.scrollIntoViewIfNeeded();
    const tiles = page.locator('.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item');
    const vBox = await tiles.nth(3).boundingBox();
    const tBox = await tiles.nth(1).boundingBox();
    if (!vBox || !tBox) throw new Error('Missing tile boundingBox');
    const sx = vBox.x + vBox.width / 2, sy = vBox.y + vBox.height / 2;
    const dx = tBox.x + tBox.width / 2, dy = tBox.y + tBox.height / 2 + 15;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(sx + ((dx - sx) * i) / 10, sy + ((dy - sy) * i) / 10);
        await page.waitForTimeout(20);
    }

    // Record positions of siblings right before mouseup and sample across release
    await page.evaluate(() => {
        const samples = /** @type {Array<{t: number, x: number, y: number}>} */ ([]);
        /** @type {any} */ (window).__releaseSamples = samples;
        const videoEl = document.querySelector('.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item[data-type="video"]');
        if (!videoEl) return;
        const start = performance.now();
        const tick = () => {
            const r = videoEl.getBoundingClientRect();
            samples.push({ t: Math.round(performance.now() - start), x: Math.round(r.x), y: Math.round(r.y) });
            if (performance.now() - start < 240) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    await page.mouse.up();
    await page.waitForTimeout(300);

    const samples = await page.evaluate(() => /** @type {any} */ (window).__releaseSamples);
    console.log('release samples:', JSON.stringify(samples));
    // Ensure the released tile did not jump back to its old bottom slot (sy) on frame 0..3
    for (const s of samples) {
        expect(s.y).toBeLessThan(vBox.y + 10);
    }

    // Video viewer modal must NOT have been opened by releasing the drag
    const modalCount = await page.locator('.ovk-diag-cont').count();
    expect(modalCount).toBe(0);

    const finalOrder = await page.$$eval(
        '.postFeedWrapperMicroblog #write .post-horizontal > a.upload-item',
        els => els.map(e => /** @type {HTMLElement} */ (e).dataset.id)
    );
    expect(finalOrder).toEqual(['1_1', '1_4', '1_2', '1_3']);
});
