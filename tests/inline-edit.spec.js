const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../res/js/ui/form-modal.js'), 'utf8');

test.beforeEach(async ({ page }) => {
    await page.route('http://vkify.test/**', (route) => {
        if (route.request().url() === 'http://vkify.test/') {
            return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
        }
        return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://vkify.test/');
    await page.evaluate(() => {
        window.vkify = {
            once: (_, fn) => fn(),
            ready: () => {},
            bindOnce: (_, fn) => { fn(); return true; },
            getCsrf: () => 'test-csrf',
        };
        window.tr = (key) => key;
        window.NewNotification = () => {};
    });
    await page.addScriptTag({ content: script });
    expect(await page.evaluate(() => typeof window.showFormModal)).toBe('function');
});

test('edits photo description inline and keeps unrelated form fields', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/photo1_23/edit', async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><textarea name="desc">Old caption</textarea><input name="hash" value="old-token"></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({
            contentType: 'text/html',
            body: '<div class="pv_desc"><div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditPhotoModal(\'1_23\')" role="button" tabindex="0"><span class="really_text">New caption</span></div></div>',
        });
    });
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="pv_desc"><div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditPhotoModal(\'1_23\')" role="button" tabindex="0"><span class="really_text">Old caption</span></div></div>';
    });
    await page.locator('.pv_can_edit').click();
    const field = page.locator('.vkify_inline_edit_field');
    await field.fill('New caption');
    await field.press('Control+Enter');
    await expect(page.locator('.pv_desc .really_text')).toHaveText('New caption');
    expect(posted).toContain('name="desc"');
    expect(posted).toContain('New caption');
    expect(posted).toContain('name="hash"');
    expect(posted).toContain('test-csrf');
});

test('keeps multiline Enter and cancels without saving on Escape', async ({ page }) => {
    let posts = 0;
    await page.route('http://vkify.test/video1_24/edit', (route) => {
        if (route.request().method() !== 'GET') posts++;
        return route.fulfill({
            contentType: 'text/html',
            body: '<div class="form_group"><form><input name="name" value="Video"><textarea name="desc">Old</textarea></form></div>',
        });
    });
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="video_info_description"><div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditVideoModal(\'1_24\')" role="button" tabindex="0"><span class="really_text">Old</span></div></div>';
    });
    await page.locator('.pv_can_edit').click();
    const field = page.locator('.vkify_inline_edit_field');
    await field.fill('Line one');
    await field.press('Enter');
    await expect(field).toHaveValue('Line one\n');
    await field.press('Escape');
    await expect(page.locator('.video_info_description .really_text')).toHaveText('Old');
    expect(posts).toBe(0);
});

test('updates group website inline without losing its other edit fields', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/club1/edit', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><input name="name" value="The club"><textarea name="about">Bio</textarea><input name="website" value="https://old.test"></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({
            contentType: 'text/html',
            body: '<div class="form_group"><form><input name="website" value="https://new.test"></form></div>',
        });
    });
    await page.route('http://vkify.test/club1', (route) => {
        return route.fulfill({
            contentType: 'text/html',
            body: '<div id="group_info_content"><div class="group_info_rows"><div class="group_info_row site"><div class="line_value"><a href="https://new.test">https://new.test</a></div></div></div></div>',
        });
    });
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div id="group_info_content"><div class="group_info_rows"><div class="group_info_row site vkify_can_inline_edit" data-edit-url="/club1/edit"><div class="line_value"><a href="https://old.test">https://old.test</a><span class="line_div_icon edit" role="button" style="display:inline-block;width:18px;height:18px"></span></div></div></div></div>';
    });
    await page.locator('.line_div_icon.edit').click();
    const field = page.locator('.vkify_inline_edit_field');
    await field.fill('https://new.test');
    await field.press('Enter');
    await expect(page.locator('.group_info_row.site .line_value a')).toHaveText('https://new.test');
    expect(posted).toContain('name="name"');
    expect(posted).toContain('The club');
    expect(posted).toContain('name="about"');
    expect(posted).toContain('Bio');
    expect(posted).toContain('https://new.test');
});

test('updates an owned profile information row without changing other interests', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/edit?act=interests', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><textarea name="interests">Drawing</textarea><textarea name="fav_games">Chess</textarea><textarea name="about">Bio</textarea></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({ contentType: 'text/html', body: '<div class="form_group"><form><textarea name="fav_games">Go</textarea></form></div>' });
    });
    await page.route('http://vkify.test/id2', (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div class="profile_info_block"><table><tbody><tr data-inline-field="fav_games" data-edit-url="/edit?act=interests" data-refresh-url="/id2"><td class="label">Games</td><td class="data vkify_can_inline_edit">Go<span class="line_div_icon edit"></span></td></tr></tbody></table></div>',
    }));
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="profile_info_block"><table><tbody><tr data-inline-field="fav_games" data-edit-url="/edit?act=interests" data-refresh-url="/id2"><td class="label">Games</td><td class="data vkify_can_inline_edit">Chess<span class="line_div_icon edit"></span></td></tr></tbody></table></div>';
    });
    await page.locator('td.data').click();
    const field = page.locator('.vkify_inline_edit_field');
    await expect(page.locator('.vkify_inline_original')).toBeHidden();
    await expect(field).toHaveValue('Chess');
    await field.fill('Go');
    await field.press('Control+Enter');
    await expect(page.locator('td.data')).toContainText('Go');
    expect(posted).toContain('name="interests"');
    expect(posted).toContain('Drawing');
    expect(posted).toContain('name="about"');
    expect(posted).toContain('Bio');
    expect(posted).toContain('Go');
});

test('hides the original about-me text while editing and restores it on cancel', async ({ page }) => {
    await page.route('http://vkify.test/edit?act=interests', (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div class="form_group"><form><textarea name="about">asdasd</textarea></form></div>',
    }));
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="profile_info_block"><table><tr data-inline-field="about" data-inline-value="asdasd" data-edit-url="/edit?act=interests" data-refresh-url="/sysop"><td class="label">About me</td><td class="data vkify_can_inline_edit">asdasd<span class="line_div_icon edit"></span></td></tr></table></div>';
    });
    await page.locator('td.data').click();
    await expect(page.locator('.vkify_inline_original')).toBeHidden();
    await expect(page.locator('.vkify_inline_edit_field')).toHaveValue('asdasd');
    await page.locator('.vkify_inline_edit_field').press('Escape');
    await expect(page.locator('td.data')).toContainText('asdasd');
    await expect(page.locator('.vkify_inline_original')).toHaveCount(0);
});

test('edits profile contact email and keeps other contact fields', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/edit?act=contacts', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><input name="email_contact" value="old@example.com"><input name="telegram" value="oldhandle"><input name="website" value="https://site.test"><input name="city" value="Kyiv"><input name="address" value="Street 1"></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({ contentType: 'text/html', body: '<div class="form_group"><form><input name="email_contact" value="new@example.com"></form></div>' });
    });
    await page.route('http://vkify.test/sysop', (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div class="profile_info_block"><table><tr data-inline-field="email_contact" data-inline-value="new@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><td class="label">Email</td><td class="data vkify_can_inline_edit"><a href="mailto:new@example.com">new@example.com</a><span class="line_div_icon edit"></span></td></tr></table></div>',
    }));
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="profile_info_block"><table><tr data-inline-field="email_contact" data-inline-value="old@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><td class="label">Email</td><td class="data vkify_can_inline_edit"><a href="mailto:old@example.com">old@example.com</a><span class="line_div_icon edit" style="display:inline-block;width:18px;height:18px"></span></td></tr></table></div>';
    });
    await page.locator('td.data .line_div_icon.edit').click();
    const field = page.locator('input.vkify_inline_edit_field');
    await expect(field).toHaveValue('old@example.com');
    await expect(page.locator('.vkify_inline_original')).toBeHidden();
    await field.fill('new@example.com');
    await field.press('Enter');
    await expect(page.locator('td.data a')).toHaveAttribute('href', 'mailto:new@example.com');
    expect(posted).toContain('name="telegram"');
    expect(posted).toContain('oldhandle');
    expect(posted).toContain('name="website"');
    expect(posted).toContain('https://site.test');
    expect(posted).toContain('new@example.com');
});

test('saves video description inline while retaining its title', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/video1_24/edit', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><input name="name" value="The video"><textarea name="desc">Old</textarea></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({
            contentType: 'text/html',
            body: '<div class="video_info_description"><div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditVideoModal(\'1_24\')" role="button" tabindex="0"><span class="really_text">Updated</span></div></div>',
        });
    });
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div class="video_info_description"><div class="pv_can_edit pv_desc_cont" data-edit-url="javascript:showEditVideoModal(\'1_24\')" role="button" tabindex="0"><span class="really_text">Old</span></div></div>';
    });
    await page.locator('.pv_can_edit').click();
    const field = page.locator('.vkify_inline_edit_field');
    await field.fill('Updated');
    await field.press('Control+Enter');
    await expect(page.locator('.video_info_description .really_text')).toHaveText('Updated');
    expect(posted).toContain('name="name"');
    expect(posted).toContain('The video');
    expect(posted).toContain('Updated');
});

test('edits a profile contact inside the mobile information dialog and syncs all copies', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/edit?act=contacts', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><input name="email_contact" value="old@example.com"><input name="telegram" value="oldhandle"><input name="website" value="https://site.test"></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({ contentType: 'text/html', body: '<div class="form_group"><form><input name="email_contact" value="new@example.com"></form></div>' });
    });
    await page.route('http://vkify.test/sysop', (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div id="mobile_more_info_content" style="display:none"><div class="form_field" data-inline-field="email_contact" data-inline-context="mobile" data-inline-value="new@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><div class="form_label">Email</div><div class="form_data vkify_can_inline_edit"><a href="mailto:new@example.com">new@example.com</a><span class="line_div_icon edit"></span></div></div></div>',
    }));
    await page.locator('body').evaluate((body) => {
        body.innerHTML = '<div id="mobile_more_info_content" style="display:none"><div class="form_field" data-inline-field="email_contact" data-inline-context="mobile" data-inline-value="old@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><div class="form_label">Email</div><div class="form_data vkify_can_inline_edit"><a href="mailto:old@example.com">old@example.com</a><span class="line_div_icon edit"></span></div></div></div>'
            + '<div class="profile_info_block"><table><tr data-inline-field="email_contact" data-inline-context="desktop" data-inline-value="old@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><td class="label">Email</td><td class="data vkify_can_inline_edit"><a href="mailto:old@example.com">old@example.com</a></td></tr></table></div>'
            + '<div class="ovk-msg-sheet"><div class="ovk-diag-body"><div class="form_field" data-inline-field="email_contact" data-inline-context="mobile" data-inline-value="old@example.com" data-inline-multiline="false" data-edit-url="/edit?act=contacts" data-refresh-url="/sysop"><div class="form_label">Email</div><div class="form_data vkify_can_inline_edit"><a href="mailto:old@example.com">old@example.com</a><span class="line_div_icon edit" style="display:inline-block;width:18px;height:18px"></span></div></div></div></div>';
    });
    await page.locator('.ovk-msg-sheet .form_data .line_div_icon.edit').click();
    const field = page.locator('.ovk-msg-sheet input.vkify_inline_edit_field');
    await expect(field).toHaveValue('old@example.com');
    await expect(page.locator('.vkify_inline_original')).toBeHidden();
    await field.fill('new@example.com');
    await field.press('Enter');
    await expect(page.locator('.ovk-msg-sheet .form_data a')).toHaveAttribute('href', 'mailto:new@example.com');
    await expect(page.locator('#mobile_more_info_content .form_data a')).toHaveAttribute('href', 'mailto:new@example.com');
    await expect(page.locator('.profile_info_block .data a')).toHaveAttribute('href', 'mailto:new@example.com');
    expect(posted).toContain('name="telegram"');
    expect(posted).toContain('new@example.com');
});

test('edits group information inside the mobile dialog and syncs hidden and desktop rows', async ({ page }) => {
    let posted;
    await page.route('http://vkify.test/club1/edit', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                contentType: 'text/html',
                body: '<div class="form_group"><form method="post"><input name="name" value="Club"><textarea name="about">Bio</textarea><input name="website" value="https://old.test"></form></div>',
            });
        }
        posted = route.request().postData();
        return route.fulfill({ contentType: 'text/html', body: '<div class="form_group"><form><input name="website" value="https://new.test"></form></div>' });
    });
    await page.route('http://vkify.test/club1', (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div id="mobile_group_more_info_content" style="display:none"><div class="group_info_rows"><div class="group_info_row site vkify_can_inline_edit" data-inline-context="mobile" data-edit-url="/club1/edit"><div class="line_value"><a href="https://new.test">https://new.test</a><span class="line_div_icon edit"></span></div></div></div></div>',
    }));
    await page.locator('body').evaluate((body) => {
        const row = (context) => `<div class="group_info_rows"><div class="group_info_row site vkify_can_inline_edit" data-inline-context="${context}" data-edit-url="/club1/edit"><div class="line_value"><a href="https://old.test">https://old.test</a><span class="line_div_icon edit" role="button" style="display:inline-block;width:18px;height:18px"></span></div></div></div>`;
        body.innerHTML = `<div id="mobile_group_more_info_content" style="display:none">${row('mobile')}</div>`
            + `<div id="group_info_content">${row('desktop')}</div>`
            + `<div class="ovk-msg-sheet"><div class="ovk-diag-body">${row('mobile')}</div></div>`;
    });
    await page.locator('.ovk-msg-sheet .group_info_row .line_div_icon.edit').click();
    const field = page.locator('.ovk-msg-sheet input.vkify_inline_edit_field');
    await expect(field).toHaveValue('https://old.test');
    await field.fill('https://new.test');
    await field.press('Enter');
    await expect(page.locator('.ovk-msg-sheet .group_info_row.site .line_value a')).toHaveText('https://new.test');
    await expect(page.locator('#mobile_group_more_info_content .group_info_row.site .line_value a')).toHaveText('https://new.test');
    await expect(page.locator('#group_info_content .group_info_row.site .line_value a')).toHaveText('https://new.test');
    expect(posted).toContain('name="name"');
    expect(posted).toContain('name="about"');
    expect(posted).toContain('https://new.test');
});
