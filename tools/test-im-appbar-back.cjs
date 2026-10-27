const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(tabId, pathname = '/im', hasChat = false) {
    const source = fs.readFileSync(path.join(__dirname, '../res/js/messenger/messenger-page.js'), 'utf8')
        .replace(/^import .*;\r?$/gm, '')
        .replace(/^export /gm, '');
    const menu = { hidden: false };
    let back = null;
    const title = { innerHTML: 'Messages', textContent: 'Messages' };
    const appbar = {
        querySelector: (selector) => selector === '.appbar-title' ? title : back,
        insertBefore: (button) => { back = button; },
    };
    const calls = [];
    let selectedTabId = tabId;
    const page = {
        togglePeerInfo: () => { calls.push('contact'); },
    };
    if (tabId === 'search') page.onCancel = () => { calls.push('cancel'); };
    const im = {
        getSelectedTabId: () => selectedTabId,
        getSelectedTab: () => ({ getPageId: () => selectedTabId, getName: () => selectedTabId === 'search' ? 'Search results' : selectedTabId === 'conversations' ? 'Messages' : 'Contact', render_class: page }),
        messenger: { getCurrentChat: () => hasChat ? { peer: { getName: () => 'Ada' } } : null, view: page },
        openTabByName: (name) => { calls.push(name); },
    };
    const context = {
        window: { im, tr: () => 'Back' },
        document: {
            getElementById: (id) => id === 'appbar' ? appbar : menu,
            querySelector: (selector) => selector === '#im_container' ? {} : null,
            createElement: () => ({ hidden: false, setAttribute() {} }),
        },
        location: { pathname },
        isMobileViewport: () => true,
    };
    vm.runInNewContext(source, context);
    return { context, menu, title, page, im, calls, getBack: () => back, selectTab: (id) => { selectedTabId = id; } };
}

test('IM appbar back follows the selected Preact tab, not the URL history', async () => {
    const state = setup('search');
    state.context.syncImAppbarBack();
    assert.equal(state.getBack().hidden, false);
    assert.equal(state.menu.hidden, true);
    assert.equal(state.title.textContent, 'Search results');
    await state.context.onImAppbarBack({ target: { closest: () => state.getBack() }, preventDefault() {} });
    assert.deepEqual(state.calls, ['cancel']);
    state.selectTab('conversations');
    state.context.syncImAppbarBack();
    assert.equal(state.title.textContent, 'Messages');
    assert.equal(state.getBack().hidden, true);
    assert.equal(state.menu.hidden, false);
});

test('conversation list keeps the menu; chat uses its own header back button', () => {
    const list = setup('conversations');
    list.context.syncImAppbarBack();
    assert.equal(list.getBack(), null);
    assert.equal(list.menu.hidden, false);

    const chat = setup('messenger', '/im', true);
    chat.context.syncImAppbarBack();
    assert.equal(chat.getBack(), null);
    assert.equal(chat.menu.hidden, true);
    assert.equal(chat.title.textContent, 'Ada');
    assert.equal(chat.title.hidden, true);
});

test('contact returns to chat and leaving IM restores the menu', async () => {
    const state = setup('contact', '/im', true);
    state.context.syncImAppbarBack();
    assert.equal(state.title.textContent, 'Contact');
    await state.context.onImAppbarBack({ target: { closest: () => state.getBack() }, preventDefault() {} });
    assert.deepEqual(state.calls, ['contact']);
    state.context.location.pathname = '/feed';
    state.context.syncImAppbarBack();
    assert.equal(state.getBack().hidden, true);
    assert.equal(state.menu.hidden, false);
    assert.equal(state.title.innerHTML, 'Messages');
});
