const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../res/js/ui/tooltips-simple.js'), 'utf8');

test.beforeEach(async ({ page }) => {
    await page.setContent(`
        <style>
            #trigger { position: absolute; left: 100px; top: 100px; width: 80px; height: 40px; }
            #child { display: block; width: 30px; height: 30px; }
            .tt_w { position: absolute; width: 80px; height: 30px; }
            .tt_w[hidden] { display: none; }
        </style>
        <div id="trigger" data-title="Title" onmouseover="showTitle(this, null, null, {showsp: 0})"><span id="child"></span></div>
    `);
    await page.evaluate(() => {
        window.vkify = {
            once: (_, fn) => fn(),
            onPageLifecycle: () => {},
            observeDOM: (callback, options) => {
                new MutationObserver((mutations) => {
                    const filtered = mutations.filter(options.filter);
                    if (filtered.length) callback(filtered);
                }).observe(document.body, { childList: true, subtree: true });
            },
        };
    });
    await page.addScriptTag({ content: script });
});

test('hides after leaving a trigger and still works after destruction', async ({ page }) => {
    for (let i = 0; i < 2; i++) {
        await page.mouse.move(110, 110);
        await expect(page.locator('.tt_w')).toBeVisible();
        await page.mouse.move(300, 300);
        await expect(page.locator('.tt_w')).toBeHidden();
        if (i === 0) await page.evaluate(() => tooltips.destroy(document.querySelector('#trigger')));
    }
});

test('keeps the tooltip visible while moving between trigger descendants', async ({ page }) => {
    await page.mouse.move(110, 110);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.mouse.move(160, 110);
    await expect(page.locator('.tt_w')).toBeVisible();
});

test('destroys visible and delayed tooltips when their triggers are removed', async ({ page }) => {
    await page.mouse.move(110, 110);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.evaluate(() => document.querySelector('#trigger').remove());
    await expect(page.locator('.tt_w')).toHaveCount(0);

    await page.evaluate(() => {
        const trigger = document.createElement('div');
        document.body.appendChild(trigger);
        showTooltip(trigger, { text: 'Delayed', showdt: 100 });
        trigger.remove();
    });
    await expect(page.locator('.tt_w')).toHaveCount(0);
    await page.waitForTimeout(150);
    await expect(page.locator('.tt_w')).toHaveCount(0);
});

test('does not create a tooltip for an already detached trigger', async ({ page }) => {
    await page.evaluate(() => {
        const trigger = document.querySelector('#trigger');
        trigger.remove();
        showTitle(trigger);
    });
    await expect(page.locator('.tt_w')).toHaveCount(0);
});

test('retains tooltips for triggers moved within the document', async ({ page }) => {
    await page.mouse.move(110, 110);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.evaluate(() => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        parent.appendChild(document.querySelector('#trigger'));
    });
    await expect(page.locator('.tt_w')).toBeVisible();
});

test('recovers when the trigger did not receive mouseout', async ({ page }) => {
    await page.mouse.move(300, 300);
    await page.evaluate(() => showTitle(document.querySelector('#trigger'), null, null, { showsp: 0 }));
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.mouse.move(310, 310);
    await expect(page.locator('.tt_w')).toBeHidden();
});

test('does not auto-hide explicitly controlled tooltips', async ({ page }) => {
    await page.mouse.move(300, 300);
    await page.evaluate(() => showTooltip(document.querySelector('#trigger'), {
        text: 'Focused', nohide: true, showsp: 0,
    }));
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.mouse.move(310, 310);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.evaluate(() => tooltips.hide(document.querySelector('#trigger')));
    await expect(page.locator('.tt_w')).toBeHidden();
});

test('keeps interactive content visible when moving from trigger to tooltip', async ({ page }) => {
    await page.evaluate(() => {
        const trigger = document.querySelector('#trigger');
        trigger.onmouseover = () => showTooltip(trigger, {
            content: '<a href="#">Likes</a>', dir: 'up', hidedt: 200, showsp: 0,
        });
    });
    await page.mouse.move(110, 110);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.locator('.tt_w').hover();
    await page.waitForTimeout(250);
    await expect(page.locator('.tt_w')).toBeVisible();
    await page.mouse.move(300, 300);
    await expect(page.locator('.tt_w')).toBeHidden();
});
