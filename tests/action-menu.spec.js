const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../res/js/ui/action-menu.js'), 'utf8');

test.beforeEach(async ({ page }) => {
    await page.setContent(`
        <style>
            .ui_actions_menu { display: none; }
            .ui_actions_menu_wrap { width: 100px; height: 40px; }
        </style>
        <div id="portal" class="ui_actions_menu_wrap">
            <button>Portal</button><div class="ui_actions_menu">Menu</div>
        </div>
        <div id="local" class="ui_actions_menu_wrap">
            <button>Local</button><div class="ui_actions_menu">Menu</div>
        </div>
    `);
    await page.evaluate(() => {
        window.vkify = { once: (_, fn) => fn(), onPageLifecycle: () => {} };
        window.isMobile = () => false;
    });
    await page.addScriptTag({ content: script });
});

test('blocks portaled hover and toggle while dimmed, but permits local menus', async ({ page }) => {
    await page.evaluate(() => {
        document.body.classList.add('dimmed');
        const portal = document.querySelector('#portal');
        uiActionsMenu.show(portal, null, { appendParentCls: 'body' });
        uiActionsMenu.toggle(portal, true, { appendParentCls: 'body' });
        uiActionsMenu.show(document.querySelector('#local'));
    });
    await expect(page.locator('.ui_actions_menu_dummy_wrap')).toHaveCount(0);
    await expect(page.locator('#portal')).not.toHaveClass(/shown/);
    await expect(page.locator('#local')).toHaveClass(/shown/);
});

test('does not open a delayed portal if a message box becomes active', async ({ page }) => {
    await page.evaluate(() => {
        uiActionsMenu.show(document.querySelector('#portal'), null, { appendParentCls: 'body', delay: 100 });
        document.body.classList.add('dimmed');
    });
    await page.waitForTimeout(150);
    await expect(page.locator('.ui_actions_menu_dummy_wrap')).toHaveCount(0);
    await expect(page.locator('#portal')).not.toHaveClass(/shown/);
});

test('blocks reopening an existing portal and permits closing and reopening after dimming', async ({ page }) => {
    await page.evaluate(() => {
        const portal = document.querySelector('#portal');
        uiActionsMenu.show(portal, null, { appendParentCls: 'body' });
        document.body.classList.add('dimmed');
        uiActionsMenu.toggle(portal, false, { immediate: true });
    });
    const dummy = page.locator('.ui_actions_menu_dummy_wrap');
    await expect(dummy).not.toHaveClass(/shown/);

    await page.evaluate(() => {
        uiActionsMenu.show(document.querySelector('#portal'));
        uiActionsMenu.show(document.querySelector('.ui_actions_menu_dummy_wrap'));
        uiActionsMenu.toggle(document.querySelector('#portal'), true);
        uiActionsMenu.toggle(document.querySelector('.ui_actions_menu_dummy_wrap'), true);
    });
    await expect(dummy).not.toHaveClass(/shown/);
    await expect(page.locator('#portal')).not.toHaveClass(/shown/);

    await page.evaluate(() => {
        document.body.classList.remove('dimmed');
        uiActionsMenu.show(document.querySelector('#portal'));
    });
    await expect(dummy).toHaveClass(/shown/);
});

test('blocks mobile click-to-open for a portaled menu while dimmed', async ({ page }) => {
    await page.evaluate(() => {
        window.isMobile = () => true;
        document.body.classList.add('dimmed');
        document.querySelector('#portal').dataset.appendParentCls = 'body';
    });
    await page.locator('#portal button').dispatchEvent('click');
    await expect(page.locator('.ui_actions_menu_dummy_wrap')).toHaveCount(0);
    await expect(page.locator('#portal')).not.toHaveClass(/shown/);
});
