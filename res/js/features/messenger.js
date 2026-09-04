import { installMessengerPatches } from '../messenger/install.js';
import { imImport } from '../messenger/shared.js';

vkify.once('imHeader', async function () {
    let renderMod, commonMod, preactMod;
    try {
        [renderMod, commonMod, preactMod] = await Promise.all([
            imImport('./components/render.js'),
            imImport('./components/common.js'),
            imImport('../node_modules/preact/dist/preact.mjs'),
        ]);
    } catch (e) {
        console.error('vkify16 | Failed to load messenger modules:', e);
        return;
    }

    const { html, render } = renderMod || {};
    const { options, Fragment } = preactMod || {};
    const { getReplySnippet } = commonMod || {};

    if (!html || !render || !options || !Fragment || !getReplySnippet) {
        console.error('vkify16 | messenger patches aborted: module exports missing', { renderMod, commonMod, preactMod });
        return;
    }

    console.info('vkify16 | installing messenger vnode hooks');
    installMessengerPatches({ html, tr, render, options, Fragment, getReplySnippet });

    // Only force a re-render if the tab already painted stock — otherwise the
    // hook patches the natural first render.
    let attempts = 0;
    const check = () => {
        const im = window.im;
        if (im && im.isReady && Array.isArray(im.tabs)) {
            const tab = im.tabs.find(t => t.getPageId && t.getPageId() === 'messenger');
            const container = tab && tab.render_class && tab.render_class.container;
            if (container && container.querySelector('#chat-page') && !container.querySelector('.messenger-app--header')) {
                tab.render().catch(e => console.error(e));
            }
            return;
        }
        if (++attempts < 100) setTimeout(check, 100);
    };
    check();
});
