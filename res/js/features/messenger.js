import { installMessengerRenderer } from '../messenger/messenger-page.js';
import { forceClassicModeOnMobile, watchModernModeTweak } from '../messenger/mobile-mode.js';
import { installAudioNormalizer } from '../messenger/audio-normalizer.js';
import { patchMonthDayString } from '../messenger/shared.js';

installAudioNormalizer();
patchMonthDayString();

if (forceClassicModeOnMobile()) {
    watchModernModeTweak();
}

let wasImPage = typeof document !== 'undefined' && (Boolean(document.querySelector('#im_container')) || /^\/im(?:\/|$)/.test(window.location.pathname));

window.vkify?.onPageLifecycle?.('beforePageLeave', () => {
    wasImPage = Boolean(document.querySelector('#im_container')) || /^\/im(?:\/|$)/.test(window.location.pathname);
});

function resetScrollIfEnteredIm() {
    const isImPage = Boolean(document.querySelector('#im_container')) || /^\/im(?:\/|$)/.test(window.location.pathname);
    if (!wasImPage && isImPage) {
        window.scrollTo(0, 0);
        if (document.documentElement) {
            document.documentElement.scrollTop = 0;
        }
        if (document.body) {
            document.body.scrollTop = 0;
        }
    }
    wasImPage = isImPage;
}

window.vkify?.onPageLifecycle?.('afterPageReady', resetScrollIfEnteredIm);

vkify.once('imHeader', async function () {
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
