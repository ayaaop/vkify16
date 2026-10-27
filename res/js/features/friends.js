(function () {
'use strict';

vkify.bindOnce('friendActions', () => {
    document.addEventListener('submit', async (event) => {
        const form = event.target;
        if (!form.matches?.('.vk-friend-action')) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const row = form.closest('.search_row[data-uniqueid]');
        const button = form.querySelector('button[type="submit"]');
        if (!row || button?.disabled) return;

        const pageUrl = location.href;
        const controls = row.querySelector('.action_links');
        if (controls?.dataset.pending === '1') return;
        if (button) button.disabled = true;
        if (controls) controls.dataset.pending = '1';
        controls?.classList.add('action_progress');

        try {
            let response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!response.ok) throw new Error('Friend action failed');
            if (new URL(response.url, location.origin).pathname !== location.pathname) {
                if (new URL(form.action, location.origin).pathname !== '/setSub/club') {
                    throw new Error('Friend action failed');
                }
                response = await fetch(pageUrl, {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
                if (!response.ok || new URL(response.url, location.origin).pathname !== location.pathname) {
                    throw new Error('Friend action failed');
                }
            }

            const page = new DOMParser().parseFromString(await response.text(), 'text/html');
            const list = page.querySelector('.wide_column .list_view.scroll_container');
            const currentList = row.closest('.list_view.scroll_container');
            if (location.href !== pageUrl || !currentList?.isConnected) return;
            if (!list) throw new Error('Friend list missing from response');

            const key = row.getAttribute('data-uniqueid');
            const updated = Array.from(list.querySelectorAll('.search_row[data-uniqueid]'))
                .find((candidate) => candidate.getAttribute('data-uniqueid') === key);
            const actions = (node) => Array.from(node?.querySelectorAll('.vk-friend-action') || [])
                .map((action) => `${action.querySelector('[name="act"]')?.value}:${action.querySelector('button')?.getAttribute('aria-label') || ''}`)
                .join(',');
            if (updated && actions(updated) === actions(row)) {
                throw new Error('Friend action did not change');
            }

            if (updated) {
                row.replaceWith(updated);
            } else {
                currentList.replaceWith(list);
            }

            const count = page.querySelector('.wide_column .page_block_header_count');
            const currentCount = document.querySelector('.wide_column .page_block_header_count');
            if (count && currentCount) currentCount.textContent = count.textContent;
            page.querySelectorAll?.('.wide_column .tabs_header [id]').forEach((tab) => {
                const nextTabCount = tab.querySelector?.('.ui_tab_count');
                const currentTabCount = document.getElementById?.(tab.id)?.querySelector?.('.ui_tab_count');
                if (nextTabCount && currentTabCount) currentTabCount.textContent = nextTabCount.textContent;
            });
            window.router?._pageCache?.delete(new URL(location.href).href);
        } catch (error) {
            console.error('[vkify16] Friend action:', error);
            if (typeof showSystemMsg === 'function') showSystemMsg(window.tr?.('error') || 'Error', 'err');
        } finally {
            if (button) button.disabled = false;
            controls?.classList.remove('action_progress');
            if (controls) delete controls.dataset.pending;
        }
    }, true);
});

})();
