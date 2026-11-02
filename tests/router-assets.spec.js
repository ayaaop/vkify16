const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const routerScript = fs.readFileSync(path.join(__dirname, '../res/js/core/router.js'), 'utf8');
const origin = 'http://router.test';

function pageHtml(body, assets = '') {
    return `<!doctype html><html><head><title>Test</title>
        <meta name="vkify-router" content="vkify16"><meta name="csrf" value="token">${assets}
        </head><body><div class="page_header"></div><div class="appbar"></div>
        <div class="page_body">${body}</div><div class="upLeftErrors"></div></body></html>`;
}

function headerHtml(userId, name = '', count = 0) {
    return `<div class="page_header"><div class="page_header_inner">
        <a class="home_button" href="/">Home</a>
        <div class="home_search" id="search_box"><input type="search"></div>
        <div class="home_navigation">${userId ? `
            <div id="top_notify_btn_div"><span class="top_notify_count">${count}</span></div>
            <div class="top_nav_audio" id="headerMusicLinkDiv">
                <a id="headerMusicBtn"></a>
                <div id="top_audio_player"><button class="top_audio_player_play"></button><span class="top_audio_player_title"></span></div>
            </div>` : ''}</div>
        <div class="end_navigation">${userId ? `<span id="userMenuName">${name}</span>` : '<a href="/login">Log in</a>'}</div>
    </div></div>`;
}

function pageWithHeader(body, userId, name = '', count = 0) {
    return pageHtml(body)
        .replace('<div class="page_header"></div>', headerHtml(userId, name, count))
        .replace('</body>', `<script id="_js_ep_script">window.openvk = { current_id: ${userId} };</script></body>`);
}

test.beforeEach(async ({ page }) => {
    await page.route(`${origin}/start`, route => route.fulfill({ contentType: 'text/html', body: pageHtml('old page') }));
    await page.goto(`${origin}/start`);
    await page.evaluate(() => {
        window.vkify = { ready: () => {}, onPageLifecycle: () => {}, runPageLifecycle: async () => {} };
        window.setBaseTitle = title => { document.title = title; };
        window.makeError = message => {
            const error = document.createElement('div');
            error.textContent = message;
            document.querySelector('.upLeftErrors').appendChild(error);
        };
        window.u = target => {
            const nodes = typeof target === 'string' ? Array.from(document.querySelectorAll(target)) : (target ? [target] : []);
            return {
                nodes, length: nodes.length,
                on: () => {},
                html(value) {
                    if (value === undefined) return nodes[0]?.innerHTML;
                    nodes.forEach(node => { node.innerHTML = value; });
                },
                attr(name, value) {
                    if (value === undefined) return nodes[0]?.getAttribute(name);
                    nodes.forEach(node => node.setAttribute(name, value));
                },
                addClass: name => nodes.forEach(node => node.classList.add(name)),
                removeClass: name => nodes.forEach(node => node.classList.remove(name)),
                remove: () => nodes.forEach(node => node.remove()),
                append: html => nodes.forEach(node => node.insertAdjacentHTML('beforeend', html)),
            };
        };
    });
    await page.addScriptTag({ content: routerScript });
});

test('waits for styles and scripts before swapping and executes scripts against the new page', async ({ page }) => {
    let releaseScript;
    let releaseStyle;
    const scriptGate = new Promise(resolve => { releaseScript = resolve; });
    const styleGate = new Promise(resolve => { releaseStyle = resolve; });
    await page.route(`${origin}/next`, route => route.fulfill({
        contentType: 'text/html',
        body: pageHtml('new page<script src="/next.js"></script>', '<link rel="stylesheet" data-vkify-route-style="next" href="/next.css">'),
    }));
    await page.route(`${origin}/next.js`, async route => {
        await scriptGate;
        await route.fulfill({ contentType: 'application/javascript', body: 'window.scriptPage = document.querySelector(".page_body").textContent;' });
    });
    await page.route(`${origin}/next.css`, async route => {
        await styleGate;
        await route.fulfill({ contentType: 'text/css', body: '.page_body { color: red; }' });
    });

    await page.evaluate(() => { window.routeResult = router.route({ url: '/next' }); });
    await expect.poll(() => page.locator('link[rel="preload"]').count()).toBe(2);
    await expect(page.locator('.page_body')).toHaveText('old page');
    expect(page.url()).toBe(`${origin}/start`);
    releaseScript();
    await expect.poll(() => page.locator('link[rel="preload"]').count()).toBe(1);
    await expect(page.locator('.page_body')).toHaveText('old page');
    releaseStyle();
    expect(await page.evaluate(() => window.routeResult)).toMatchObject({ committed: true });
    await expect(page.locator('.page_body')).toContainText('new page');
    expect(await page.evaluate(() => window.scriptPage)).toContain('new page');
});

test('reports failed assets and loads new versions on a later visit', async ({ page }) => {
    let fail = true;
    await page.route(`${origin}/next`, route => route.fulfill({
        contentType: 'text/html',
        body: pageHtml(`new page<script src="/next.js${fail ? '' : '?v=2'}"></script>`, `<link rel="stylesheet" data-vkify-route-style="next" href="/next.css${fail ? '' : '?v=2'}">`),
    }));
    await page.route(`${origin}/next.js**`, route => fail ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: 'window.scriptLoaded = true;' }));
    await page.route(`${origin}/next.css**`, route => fail ? route.abort() : route.fulfill({ contentType: 'text/css', body: '.page_body { color: red; }' }));
    await page.route(`${origin}/other`, route => route.fulfill({ contentType: 'text/html', body: pageHtml('other page') }));

    expect(await page.evaluate(() => router.route({ url: '/next' }))).toMatchObject({ committed: true });
    await expect(page.locator('.upLeftErrors div')).toHaveCount(2);
    await expect(page.locator('.upLeftErrors')).toContainText('Failed to load script:');
    await expect(page.locator('.upLeftErrors')).toContainText('Failed to load style:');
    expect(await page.evaluate(() => router.managedStyleLinks.has('next'))).toBe(false);
    expect(await page.evaluate(() => router._loadedScriptPaths.has(`${location.origin}/next.js`))).toBe(false);
    fail = false;
    await page.evaluate(() => router.route({ url: '/other' }));
    await page.evaluate(() => router.route({ url: '/next' }));
    expect(await page.evaluate(() => window.scriptLoaded)).toBe(true);
    await expect(page.locator('link[data-vkify-route-style="next"]')).toHaveCount(1);
});

test('waits for assets when restoring a cached page', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(`${origin}/cached.css`, async route => {
        await gate;
        await route.fulfill({ contentType: 'text/css', body: '.page_body { color: red; }' });
    });
    await page.evaluate(html => {
        router._pageCacheSet(`${location.origin}/cached`, html);
        window.routeResult = router.route({ url: '/cached', history: 'none' });
    }, pageHtml('cached page', '<link rel="stylesheet" data-vkify-route-style="cached" href="/cached.css">'));
    await expect(page.locator('link[rel="preload"]')).toHaveCount(1);
    await expect(page.locator('.page_body')).toHaveText('old page');
    release();
    expect(await page.evaluate(() => window.routeResult)).toMatchObject({ committed: true });
    await expect(page.locator('.page_body')).toHaveText('cached page');
});

test('waits for module scripts and executes them after the swap', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(`${origin}/next`, route => route.fulfill({
        contentType: 'text/html', body: pageHtml('module page<script type="module" src="/module.js"></script>'),
    }));
    await page.route(`${origin}/module.js`, async route => {
        await gate;
        await route.fulfill({ contentType: 'application/javascript', body: 'window.modulePage = document.querySelector(".page_body").textContent;' });
    });
    await page.evaluate(() => { window.routeResult = router.route({ url: '/next' }); });
    await expect(page.locator('link[rel="modulepreload"]')).toHaveCount(1);
    await expect(page.locator('.page_body')).toHaveText('old page');
    release();
    expect(await page.evaluate(() => window.routeResult)).toMatchObject({ committed: true });
    expect(await page.evaluate(() => window.modulePage)).toContain('module page');
});

test('replaces a managed stylesheet when its URL changes', async ({ page }) => {
    await page.route(`${origin}/first`, route => route.fulfill({
        contentType: 'text/html', body: pageHtml('first', '<link rel="stylesheet" data-vkify-route-style="shared" href="/first.css">'),
    }));
    await page.route(`${origin}/second`, route => route.fulfill({
        contentType: 'text/html', body: pageHtml('second', '<link rel="stylesheet" data-vkify-route-style="shared" href="/second.css">'),
    }));
    await page.route(`${origin}/*.css`, route => route.fulfill({ contentType: 'text/css', body: '.page_body { color: red; }' }));
    await page.evaluate(() => router.route({ url: '/first' }));
    await page.evaluate(() => router.route({ url: '/second' }));
    await expect(page.locator('link[data-vkify-route-style="shared"]')).toHaveAttribute('href', '/second.css');
});

test('keeps the music control attached while refreshing the rest of the header', async ({ page }) => {
    await page.evaluate(header => {
        document.querySelector('.page_header').outerHTML = header;
        window.openvk = { current_id: 1 };
        document.querySelector('#search_box input').value = 'current search';
        const music = document.querySelector('#headerMusicLinkDiv');
        const player = document.querySelector('#top_audio_player');
        player.dataset.currentTrackId = '42';
        player.querySelector('.top_audio_player_title').textContent = 'Playing';
        player.querySelector('button').addEventListener('click', () => { window.playerClicks = (window.playerClicks || 0) + 1; });
        window.originalMusic = music;
        window.originalPlayer = player;
        window.headerRemovals = [];
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.removedNodes) {
                    if (node === music || node.contains(music)) window.headerRemovals.push(node);
                }
            }
        }).observe(document.querySelector('.page_header'), { childList: true, subtree: true });
    }, headerHtml(1, 'Old name', 1));
    await page.route(`${origin}/next`, route => route.fulfill({
        contentType: 'text/html', body: pageWithHeader('new page', 1, 'New name', 5),
    }));

    expect(await page.evaluate(() => router.route({ url: '/next' }))).toMatchObject({ committed: true });
    expect(await page.evaluate(() => document.querySelector('#headerMusicLinkDiv') === window.originalMusic)).toBe(true);
    expect(await page.evaluate(() => document.querySelector('#top_audio_player') === window.originalPlayer)).toBe(true);
    expect(await page.evaluate(() => window.headerRemovals.length)).toBe(0);
    await expect(page.locator('.top_audio_player_title')).toHaveText('Playing');
    await expect(page.locator('#userMenuName')).toHaveText('New name');
    await expect(page.locator('.top_notify_count')).toHaveText('5');
    await expect(page.locator('#search_box input')).toHaveValue('current search');
    await page.locator('.top_audio_player_play').dispatchEvent('click');
    expect(await page.evaluate(() => window.playerClicks)).toBe(1);

    expect(await page.evaluate(() => router.route({ url: '/start', history: 'none' }))).toMatchObject({ committed: true });
    expect(await page.evaluate(() => document.querySelector('#top_audio_player') === window.originalPlayer)).toBe(true);
    expect(await page.evaluate(() => window.headerRemovals.length)).toBe(0);
});

test('replaces the header when the account or available controls change', async ({ page }) => {
    await page.evaluate(header => {
        document.querySelector('.page_header').outerHTML = header;
        window.openvk = { current_id: 1 };
        window.originalPlayer = document.querySelector('#top_audio_player');
    }, headerHtml(1, 'First account'));
    await page.route(`${origin}/second`, route => route.fulfill({
        contentType: 'text/html', body: pageWithHeader('second account', 2, 'Second account'),
    }));
    await page.route(`${origin}/logged-out`, route => route.fulfill({
        contentType: 'text/html', body: pageWithHeader('logged out', 0),
    }));
    await page.route(`${origin}/logged-in`, route => route.fulfill({
        contentType: 'text/html', body: pageWithHeader('logged in', 1, 'First account'),
    }));
    await page.route(`${origin}/restricted`, route => route.fulfill({
        contentType: 'text/html',
        body: pageWithHeader('restricted', 1).replace(headerHtml(1), headerHtml(0)),
    }));

    await page.evaluate(() => router.route({ url: '/second' }));
    await expect(page.locator('#userMenuName')).toHaveText('Second account');
    expect(await page.evaluate(() => document.querySelector('#top_audio_player') === window.originalPlayer)).toBe(false);
    await page.evaluate(() => router.route({ url: '/logged-out' }));
    await expect(page.locator('#top_audio_player')).toHaveCount(0);
    await expect(page.locator('.end_navigation')).toContainText('Log in');
    await page.evaluate(() => router.route({ url: '/logged-in' }));
    await expect(page.locator('#top_audio_player')).toHaveCount(1);
    await expect(page.locator('#userMenuName')).toHaveText('First account');
    await page.evaluate(() => router.route({ url: '/restricted' }));
    await expect(page.locator('#top_audio_player')).toHaveCount(0);
});

test('a superseded navigation cannot swap the page after its assets load', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(`${origin}/slow`, route => route.fulfill({
        contentType: 'text/html', body: pageHtml('slow page<script src="/slow.js"></script>'),
    }));
    await page.route(`${origin}/slow.js`, async route => {
        await gate;
        await route.fulfill({ contentType: 'application/javascript', body: 'window.slowScript = true;' }).catch(() => {});
    });
    await page.route(`${origin}/fast`, route => route.fulfill({ contentType: 'text/html', body: pageHtml('fast page') }));

    await page.evaluate(() => { window.slowResult = router.route({ url: '/slow' }); });
    await expect(page.locator('link[rel="preload"]')).toHaveCount(1);
    expect(await page.evaluate(() => router.route({ url: '/fast' }))).toMatchObject({ committed: true });
    release();
    expect(await page.evaluate(() => window.slowResult)).toMatchObject({ aborted: true });
    await expect(page.locator('.page_body')).toHaveText('fast page');
    expect(page.url()).toBe(`${origin}/fast`);
    expect(await page.evaluate(() => window.slowScript)).toBeUndefined();
});
