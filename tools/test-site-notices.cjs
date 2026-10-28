const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const router = fs.readFileSync(path.join(__dirname, '../res/js/core/router.js'), 'utf8');
const setup = router.slice(router.indexOf('vkify.ready(() => {'), router.indexOf('window.router = new class Router'));

test('sidebar header offset follows responsive header and notice height', () => {
    const source = fs.readFileSync(path.join(__dirname, '../res/js/ui/sidebar-affix.js'), 'utf8');
    const helper = source.slice(source.indexOf('function getHeaderOffset()'), source.indexOf('vkify.once("updateNarrow"'));
    const body = {};
    const root = {};
    let headerHeight = '42px';
    let noticeHeight = '';
    const context = {
        document: { body, documentElement: root },
        getComputedStyle: (element) => ({
            getPropertyValue: () => element === body ? headerHeight : noticeHeight,
        }),
    };
    vm.runInNewContext(helper, context);
    assert.equal(context.getHeaderOffset(), 57);
    headerHeight = '56px';
    noticeHeight = '24px';
    assert.equal(context.getHeaderOffset(), 95);
});

test('notice height survives dialog style resets, resize, and container replacement', () => {
    const values = new Map();
    let notice = { height: 24, getBoundingClientRect() { return { height: this.height }; } };
    const layout = {};
    const observers = [];
    let resizeObserver;
    const calls = [];
    const root = {
        style: {
            getPropertyValue: (name) => values.get(name) || '',
            setProperty: (name, value) => values.set(name, value),
        },
    };
    const context = {
        vkify: { ready: (callback) => callback() },
        document: {
            documentElement: root,
            querySelector: (selector) => selector === '.layout' ? layout : notice,
        },
        window: {
            updateLeftMenuInit: () => calls.push('sidebar'),
            updateNarrow: () => calls.push('narrow'),
        },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; resizeObserver = this; }
            observe(target) { this.target = target; }
            disconnect() { this.target = null; }
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe(target) { this.target = target; }
        },
        requestAnimationFrame: (callback) => callback(),
    };
    vm.runInNewContext(setup, context);
    assert.equal(values.get('--top-popups-height'), '24px');
    assert.deepEqual(calls, ['sidebar', 'narrow']);

    values.clear();
    observers.find((observer) => observer.target === root).callback();
    assert.equal(values.get('--top-popups-height'), '24px');

    notice.height = 0;
    resizeObserver.callback();
    assert.equal(values.get('--top-popups-height'), '0px');

    notice = { height: 32, getBoundingClientRect() { return { height: this.height }; } };
    observers.find((observer) => observer.target === layout).callback();
    assert.equal(resizeObserver.target, notice);
    assert.equal(values.get('--top-popups-height'), '32px');

    notice = null;
    observers.find((observer) => observer.target === layout).callback();
    assert.equal(values.get('--top-popups-height'), '0px');
});
