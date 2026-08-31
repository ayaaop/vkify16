(function () {
'use strict';

let cachedNotificationsContent = null;

function formatNotifyCount(count) {
    return count > 99 ? '99+' : String(count);
}

function parseNotifyCount(text) {
    const t = (text || '').trim();
    if (t === '99+') return 99;
    return parseInt(t, 10) || 0;
}

vkify.ready(() => {
    const customSoundId = "vkify_notification";
    createjs.Sound.registerSound(vkify.resourceUrl("bb1.mp3"), customSoundId);

    vkify.actualPlayNotifSound = function() {
        createjs.Sound.play(customSoundId);
    };

    if (window.playNotifSound && window.playNotifSound !== Function.noop) {
        window.playNotifSound = vkify.actualPlayNotifSound;
    }


    vkify.hook(window, 'incrementNotificationsCounter', function () {
        cachedNotificationsContent = null;

        const btn = document.querySelector('#top_notify_btn');
        if (!btn) return;

        btn.querySelectorAll('object').forEach(el => el.remove());

        let countEl = btn.querySelector('.top_notify_count');
        const nextCount = (countEl ? parseNotifyCount(countEl.textContent) : 0) + 1;

        if (!countEl) {
            countEl = document.createElement('div');
            countEl.className = 'top_notify_count';
            btn.appendChild(countEl);
        }

        countEl.textContent = formatNotifyCount(nextCount);
        btn.classList.add('has_notify');

        const mobileLink = document.querySelector('a.my_feedback.mobileonly');
        if (mobileLink) {
            let obj = mobileLink.querySelector('object');
            const mobileCount = (obj ? parseNotifyCount(obj.querySelector('b')?.textContent) : 0) + 1;
            if (!obj) {
                obj = document.createElement('object');
                obj.type = 'internal/link';
                const b = document.createElement('b');
                obj.appendChild(b);
                mobileLink.appendChild(obj);
            }
            mobileLink.querySelector('object b').textContent = formatNotifyCount(mobileCount);
        }
    }, 'replace');

    const topNotifyBtn = document.querySelector('#top_notify_btn');
    if (topNotifyBtn) {
        const notifyObserver = new MutationObserver(() => {
            cachedNotificationsContent = null;
        });
        notifyObserver.observe(topNotifyBtn, { childList: true, subtree: true, characterData: true });
    }
});

vkify.once("initNotificationsPopup", () => {
    async function fetchNotificationsContent() {
        const notificationsContainer = await window.ContentFetcher.fetchPageContent('/notifications', '.notifications', { ajaxQuery: false });

        if (notificationsContainer) {
            const paginator = notificationsContainer.querySelector('.vkify-paginator');
            if (paginator) {
                const wrap = paginator.closest('.clear_fix');
                if (wrap && wrap.children.length === 1) {
                    wrap.remove();
                } else {
                    paginator.remove();
                }
            }
            return notificationsContainer.innerHTML + `<a href="/notifications" class="top_notify_show_all">${tr('show_more')}</a>`;
        }

        return `<div class="no_notifications">${tr('no_data_description')}</div>`;
    }

    function isNotificationsCacheValid() {
        return cachedNotificationsContent !== null;
    }

    async function getNotificationsContent() {
        if (isNotificationsCacheValid()) {
            return cachedNotificationsContent;
        }

        try {
            cachedNotificationsContent = await fetchNotificationsContent();
            return cachedNotificationsContent;
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            return `<div class="notifications_error">${tr('error')}</div>`;
        }
    }

    vkify.uiOwnsInitNotificationsPopup = true;

    window.initNotificationsPopup = async function () {
        const targetElement = document.querySelector('#top_notify_btn_div');
        if (!targetElement || targetElement.dataset.vkifyNotifsInit === '1') {
            return;
        }
        targetElement.dataset.vkifyNotifsInit = '1';

        const loadingContent = '<div class="notifications_loading"><div class="pr"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div></div>';

        targetElement.addEventListener('click', function (e) { e.preventDefault(); });

        tippy(targetElement, {
            content: loadingContent,
            allowHTML: true,
            trigger: 'click',
            interactive: true,
            animation: 'up_down',
            placement: 'bottom-start',
            theme: 'light vk notifications',
            maxWidth: 470,
            arrow: false,
            zIndex: 99,
            appendTo: 'parent',
            popperOptions: {
                modifiers: [{
                    name: 'offset',
                    options: {
                        offset: [0, 0]
                    }
                }]
            },
            onHidden() {
                document.querySelector('#top_notify_btn')?.classList.remove('top_nav_btn_active');
            },
            async onShow(instance) {
                document.querySelector('#top_notify_btn')?.classList.add('top_nav_btn_active');
                document.querySelector('#top_notify_btn')?.classList.remove('has_notify');
                document.querySelector('a.my_feedback.mobileonly object')?.remove();

                if (!isNotificationsCacheValid()) {
                    instance.setContent(loadingContent);
                }

                instance.setContent(await getNotificationsContent());
            }
        });
    };

    vkify.onPageLifecycle('afterPageReady', () => window.initNotificationsPopup(), 'after');

    vkify.ready(() => window.initNotificationsPopup());
});

})();
