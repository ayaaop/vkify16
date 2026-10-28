const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('friend actions post to OpenVK and render only server-confirmed controls', async () => {
    let submit;
    let replaced;
    let posts = 0;
    let notified = 0;
    const count = { textContent: '4' };
    const controls = {
        dataset: {},
        classList: { add() {}, remove() {} },
    };
    const button = { disabled: false };
    const list = { isConnected: true };
    const action = (label) => ({
        querySelector: (selector) => selector === '[name="act"]'
            ? { value: label === 'Add' ? 'add' : 'rem' }
            : { getAttribute: () => label },
    });
    const row = {
        getAttribute: () => 'row-5',
        querySelector: () => controls,
        querySelectorAll: () => [action('Add')],
        closest: () => list,
        replaceWith(next) { replaced = next; },
    };
    const updated = {
        getAttribute: () => 'row-5',
        querySelectorAll: () => [action('Remove')],
    };
    const serverList = { querySelectorAll: () => [updated] };
    const form = {
        action: 'http://localhost/setSub/user',
        matches: () => true,
        closest: () => row,
        querySelector: () => button,
    };
    const page = { querySelector: (selector) => selector.includes('header_count') ? { textContent: '5' } : serverList };
    const deleted = [];
    const context = {
        vkify: { bindOnce: (key, callback) => callback() },
        document: {
            addEventListener(type, callback) { submit = callback; },
            querySelector: () => count,
        },
        window: { router: { _pageCache: { delete: (url) => deleted.push(url) } } },
        location: { href: 'http://localhost/friends', pathname: '/friends' },
        fetch: async () => {
            posts++;
            return { ok: true, url: 'http://localhost/friends', text: async () => '<html></html>' };
        },
        FormData: class {},
        DOMParser: class { parseFromString() { return page; } },
        URL,
        console: { error() {} },
        showSystemMsg: () => { notified++; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../res/js/features/friends.js'), 'utf8'), context);
    const event = { target: form, preventDefault() {}, stopImmediatePropagation() {} };
    await submit(event);
    assert.equal(posts, 1);
    assert.equal(replaced, updated);
    assert.equal(count.textContent, '5');
    assert.deepEqual(deleted, ['http://localhost/friends']);
    assert.equal(button.disabled, false);

    replaced = null;
    page.querySelector = (selector) => selector.includes('header_count') ? count : { querySelectorAll: () => [row] };
    await submit(event);
    assert.equal(replaced, null);
    assert.equal(notified, 1);

    const tabCount = { textContent: '3' };
    const clubForm = {
        action: 'http://localhost/setSub/club',
        matches: () => true,
        closest: () => row,
        querySelector: () => null,
    };
    context.location.href = 'http://localhost/groups1';
    context.location.pathname = '/groups1';
    context.document.getElementById = (id) => id === 'groups_tab_all' ? { querySelector: () => tabCount } : null;
    context.fetch = async (url) => ({
        ok: true,
        url: String(url).includes('/setSub/club') ? 'http://localhost/club5' : 'http://localhost/groups1',
        text: async () => '<html></html>',
    });
    page.querySelector = (selector) => selector.includes('header_count') ? null : serverList;
    page.querySelectorAll = () => [{ id: 'groups_tab_all', querySelector: () => ({ textContent: '2' }) }];
    await submit({ target: clubForm, preventDefault() {}, stopImmediatePropagation() {} });
    assert.equal(replaced, updated);
    assert.equal(tabCount.textContent, '2');
});
