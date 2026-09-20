(function () {
'use strict';

vkify.bindOnce('pinGroupHandler', () => {

    document.addEventListener('click', async function (e) {
        const target = e.target.closest('#_pinGroup');
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const thisButton = u(target);
        const link = thisButton.attr('href');
        const groupName = thisButton.attr('data-group-name');
        const groupUrl = thisButton.attr('data-group-url');
        const list = u('#_groupListPinnedGroups');

        thisButton.addClass('loading').addClass('disable');

        try {
            const req = await ky(link);
            if (!req.ok) {
                NewNotification(tr('error'), tr('error_1'), null);
                thisButton.removeClass('loading').removeClass('disable');
                return false;
            }

            if (!parseAjaxResponse(await req.text())) {
                thisButton.removeClass('loading').removeClass('disable');
                return false;
            }

            const listNode = list.nodes[0];
            if (listNode.children.length === 0) {
                listNode.append(u('<div class="menu_divider"></div>').first());
            }

            if (thisButton.html().trim() === tr('remove_from_left_menu')) {
                thisButton.html(tr('add_to_left_menu'));
                for (let i = 0; i < listNode.children.length; i++) {
                    const element = listNode.children[i];
                    if (element.pathname === groupUrl) {
                        element.remove();
                    }
                }
            } else {
                thisButton.html(tr('remove_from_left_menu'));
                const newLink = u(`
                    <a href="${groupUrl}" class="link group_link">
                        <svg class="link_icon" viewBox="0 0 24 24"><use href="#menu-my-groups"/></svg>
                        <span>${groupName}</span>
                    </a>
                `).first();
                listNode.append(newLink);
            }

            if (listNode.children[0]?.className !== 'menu_divider' || listNode.children.length === 1) {
                listNode.children[0]?.remove();
            }
        } catch (err) {
            NewNotification(tr('error'), tr('error_1'), null);
        }

        thisButton.removeClass('loading').removeClass('disable');
        return false;
    }, true);
});

})();
