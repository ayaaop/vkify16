const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('themed tooltip call sites use VK-style inline showTitle/showTooltip', () => {
    const files = [
        '../tpl/About/Language.latte',
        '../tpl/Audio/bigplayer.latte',
        '../tpl/Audio/player.latte',
        '../tpl/Documents/components/doc.latte',
        '../tpl/Support/AnswerTicket.latte',
        '../tpl/Support/View.latte',
        '../tpl/components/comment.latte',
        '../tpl/components/textArea.latte',
        '../res/js/ui/music-popup.js',
        '../res/js/features/wall.js',
        '../res/js/features/player.js',
        '../res/js/features/photo-editor.js',
        '../res/js/features/attachment-picker.js',
        '../res/js/messenger/components/fastchats.js',
        '../res/js/messenger/components/attachment-menu.js',
    ];
    for (const file of files) {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        assert.doesNotMatch(source, /data-tip(?:=|title|offset|theme)/, file);
        assert.doesNotMatch(source, /data-vk-tooltip|data-tt-/, file);
        assert.match(source, /showTitle|showTooltip/, file);
    }
});

test('likes use VK like_tt markup and showTooltip instead of Tippy', () => {
    const source = fs.readFileSync(path.join(__dirname, '../res/js/features/likes.js'), 'utf8');
    assert.match(source, /class="like_tt_wrap"/);
    assert.match(source, /class="like_tt_owners"/);
    assert.match(source, /window\.vkifyLikesShow/);
    assert.match(source, /typeClass: 'like_tt'/);
    assert.match(source, /slide: 15/);
    assert.doesNotMatch(source, /tippy\.delegate|like_tooltip_wrapper/);
    for (const file of ['../tpl/components/post.latte', '../tpl/components/comment.latte', '../tpl/Photos/Photo.latte', '../tpl/Videos/View.latte']) {
        assert.match(fs.readFileSync(path.join(__dirname, file), 'utf8'), /onmouseover="vkifyLikesShow\(this\)"/, file);
    }
});

test('VK title tooltips use live text, direction, and hover-aware hiding', async () => {
    const wrapped = {
        replaceChildren() { this.innerHTML = ''; },
        appendChild(node) { this.label = node; },
    };
    const listeners = {};
    const container = {
        parentElement: null,
        style: { setProperty() {}, width: '', maxWidth: '', zIndex: '' },
        classList: { toggle() {} },
        querySelector: () => wrapped,
        getBoundingClientRect: () => ({ width: 120, height: 32 }),
        addEventListener(type, handler) { listeners[type] = handler; },
        remove() { this.removed = true; },
    };
    const elListeners = {};
    const attrs = new Map([['data-title', 'Edit']]);
    const el = {
        isConnected: true,
        getAttribute: (key) => attrs.get(key) || null,
        hasAttribute: (key) => attrs.has(key),
        offsetWidth: 25,
        getBoundingClientRect: () => ({ left: 100, right: 125, top: 500, bottom: 525, width: 25, height: 25 }),
        closest: () => null,
        addEventListener(type, handler) { elListeners[type] = handler; },
        removeEventListener(type) { delete elListeners[type]; },
    };
    const body = { appendChild(node) { node.parentElement = this; } };
    const fullscreen = { appendChild(node) { node.parentElement = this; } };
    const context = {
        window: { innerHeight: 700, innerWidth: 1000, addEventListener() {} },
        document: {
            body,
            createElement: () => container,
            addEventListener() {},
        },
        vkify: {
            once: (key, callback) => callback(),
            onPageLifecycle() {},
        },
        setTimeout,
        clearTimeout,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../res/js/ui/tooltips-simple.js'), 'utf8'), context);

    context.window.showTitle(el, null, null, { dir: 'down' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(wrapped.label.textContent, 'Edit');
    assert.equal(el.tt.shown, true);
    assert.match(container.className, /tt_w tt_black/);

    attrs.set('data-title', 'Remove');
    context.window.showTitle(el);
    assert.equal(wrapped.label.textContent, 'Remove');

    context.document.fullscreenElement = fullscreen;
    assert.equal(container.parentElement, body);
    context.window.showTitle(el);
    assert.equal(container.parentElement, fullscreen);

    elListeners.mouseout();
    listeners.mouseover();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(el.tt.shown, true);
    listeners.mouseleave();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(el.tt.shown, false);
    context.window.tooltips.destroy(el);
    assert.equal(container.removed, true);
    assert.equal(el.tt, undefined);
});
