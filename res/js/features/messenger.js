import { installMessengerRenderer } from '../messenger/messenger-page.js';
import { installCompactPlaceholder } from '../messenger/components/compact-placeholder.js';
import { forceClassicModeOnMobile, watchModernModeTweak } from '../messenger/mobile-mode.js';

if (forceClassicModeOnMobile()) {
    watchModernModeTweak();
}

vkify.once('imHeader', async function () {
    try {
        installCompactPlaceholder();
    } catch (e) {
        console.error('vkify16 | compact placeholder install failed:', e);
    }

    await installMessengerRenderer();

    let attempts = 0;
    const reRenderIfNeeded = () => {
        const im = window.im;
        if (im && im.isReady && Array.isArray(im.tabs)) {
            const tab = im.tabs.find(t => t.getPageId && t.getPageId() === 'messenger');
            if (tab && tab.render_class && tab.render_class.container) {
                const container = tab.render_class.container;
                if (container.querySelector('#chat-page') && !container.querySelector('.messenger-app--header')) {
                    tab.render().catch(e => console.error('vkify16 | re-render failed:', e));
                }
            }
            return;
        }
        if (++attempts < 50) {
            setTimeout(reRenderIfNeeded, 100);
        }
    };
    reRenderIfNeeded();
});
