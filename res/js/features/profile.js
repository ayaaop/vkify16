window.Profile = {
    hideWarning: function(warningType, event) {
        event?.stopPropagation();
        event?.preventDefault();
        
        let hidden = vkify.getCookie('vkify_hidden_warnings');
        let hiddenArr = hidden ? hidden.split(',') : [];
        if (!hiddenArr.includes(warningType)) {
            hiddenArr.push(warningType);
            vkify.setCookie('vkify_hidden_warnings', hiddenArr.join(','), 365);
        }
        
        const rowToHide = document.querySelector(`.profile_warning_row[data-warning="${warningType}"]`);
        if (rowToHide) {
            $(rowToHide).slideUp(200, () => {
                Profile.updateWarnings(true);
            });
        } else {
            Profile.updateWarnings(true);
        }
    },
    
    updateWarnings: function(animate = false) {
        const rows = document.querySelectorAll('.profile_warning_row');
        let shownOne = false;
        
        let hidden = vkify.getCookie('vkify_hidden_warnings');
        let hiddenArr = hidden ? hidden.split(',') : [];
        
        rows.forEach(row => {
            const warningType = row.getAttribute('data-warning');
            if (!warningType) return;
            
            let isHidden = hiddenArr.includes(warningType);
            
            if (isHidden) {
                if (!animate) $(row).hide();
                // if animating, it was already hidden by slideUp in hideWarning
            } else if (!shownOne) {
                if (animate && $(row).is(':hidden')) {
                    $(row).slideDown(200);
                } else {
                    $(row).show();
                }
                shownOne = true;
            } else {
                $(row).hide();
            }
        });
        
        const container = document.querySelector('.completeness_block');
        if (container) {
            if (shownOne) {
                $(container).show();
            } else {
                if (animate) {
                    $(container).slideUp(200);
                } else {
                    $(container).hide();
                }
            }
        }
    },

    // Profile "more actions" (#profile_more_btn / #profileAppbarMoreBtn /
    // #groupAppbarMoreBtn) and "subscribe" (#profile_sub_btn /
    // #mobile_profile_sub_btn) menus are wired declaratively via
    // data-menu-content-id in their templates now, discovered by
    // action-menu.js like everything else - nothing to do here anymore.

    initEventStatus: function() {
        if (Profile._eventStatusInited) return;
        Profile._eventStatusInited = true;
        document.addEventListener('click', function(event) {
            const link = event.target.closest('a[data-event-action]');
            if (!link) return;
            const tooltip = link.closest('.ui_actions_menu');
            if (!tooltip) return;
            event.preventDefault();
            Profile.setEventStatus(link, tooltip);
        });
    },

    setEventStatus: async function(link, tooltip) {
        const action = link.getAttribute('data-event-action');
        const clubId = tooltip.getAttribute('data-club-id');
        const currentFlag = parseInt(tooltip.getAttribute('data-current-flag') || '-1', 10);
        const desiredFlags = { going: 0, maybe: 1 };
        const desiredFlag = desiredFlags[action];

        const posts = [];
        if (action === 'notgoing') {
            if (currentFlag !== -1) posts.push(currentFlag);
        } else {
            if (currentFlag !== -1 && currentFlag !== desiredFlag) posts.push(currentFlag);
            if (currentFlag !== desiredFlag) posts.push(desiredFlag);
        }
        if (posts.length === 0) return;

        try {
            for (const flag of posts) {
                const formData = new FormData();
                formData.set('id', clubId);
                formData.set('flag', String(flag));
                formData.set('hash', vkify.getCsrf());
                await ky.post('/setSub/club', {
                    body: formData,
                    redirect: 'manual',
                    throwHttpErrors: false
                });
            }

            if (window.router) {
                await window.router.route({ url: location.href, push_state: false });
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error('[Profile] setEventStatus error:', error);
        }
    }

};

vkify.onPageLifecycle('afterPageReady', () => {
    Profile.initEventStatus();
    Profile.updateWarnings();
}, 'after');
