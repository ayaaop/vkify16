const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('switching away from a chat closes its portaled header menu immediately', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../res/js/messenger/messenger-page.js'), 'utf8')
        .replace(/^import .*;\r?$/gm, '')
        .replace(/^export /gm, '');
    const calls = [];
    const container = { querySelector: () => null };
    class ImClass {
        getSelectedTabId() { return this.selectedTab; }
        getSelectedTab() { return null; }
        getTab() { return { render_class: { container } }; }
        selectTab(tab) { calls.push(['select', tab]); }
    }
    const im = new ImClass();
    im.selectedTab = 'messenger';
    const stubs = {
        MessengerPage: class {},
        MessageListView: () => {},
        ErrorConversation: () => {},
        html: () => {},
        render: () => {},
        h: () => {},
        Fragment: () => {},
    };
    const context = {
        window: {
            im, im_class: ImClass,
            uiActionsMenu: { closeAll: () => calls.push(['close']) },
            addEventListener() {},
        },
        document: { addEventListener() {} },
        waitForStockIm: async () => {},
        imImport: async () => stubs,
        createAttachmentMenu: () => {},
        createInputArea: () => {},
        createStockInputArea: () => {},
        createPeerInfoView: () => {},
        createPinnedMessageBar: () => {},
        createActionsBar: () => {},
        fallbackReplySnippet: () => {},
        fallbackEmojiHex: () => {},
        fallbackRecentSmiles: () => {},
        fallbackRecentSmileClick: () => {},
        fallbackPeerAvatar: () => {},
        installPeerWindow() {},
        installClassicTabBar: async () => {},
        installConversationsRenderer: async () => {},
        installFastChatsRenderer: async () => {},
        isMobileViewport: () => false,
        syncBodyPeerWindow() {},
        syncImAppbarBack() {},
        console,
    };
    vm.runInNewContext(source, context);
    await context.installMessengerRenderer();

    await im.selectTab('contact');
    assert.deepEqual(calls.map(([action]) => action), ['close', 'select']);

    calls.length = 0;
    im.selectedTab = 'friends';
    await im.selectTab('conversations');
    assert.deepEqual(calls.map(([action]) => action), ['select']);
});
