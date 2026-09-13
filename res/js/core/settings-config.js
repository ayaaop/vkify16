(function () {
    if (!window.vkify) return;

    const body = document.body;

    function setThemeSwitching() {
        body.classList.add('theme-switching');
        setTimeout(() => body.classList.remove('theme-switching'), 500);
    }

    function toggleTheme(enabled, bodyClass, styleId, styleName) {
        setThemeSwitching();
        body.classList.toggle(bodyClass, enabled);
        if (enabled) vkify.loadStyle(null, styleId, `${vkify.resourceUrl('css')}/${styleName}`);
        else vkify.unloadStyle(styleId);
    }

    function syncOvkHat(enabled) {
        const homeButton = document.querySelector('.home_button');
        if (!homeButton) return;

        u(body).toggleClass('ovkhat', enabled);

        if (window.Favicon && typeof window.Favicon.set === 'function') {
            window.Favicon.set(enabled ? 'ovk' : 'default');
        } else {
            const favicon = document.querySelector('link[rel="shortcut icon"]');
            if (favicon) {
                const icoName = enabled ? 'ovk.ico' : 'default.ico';
                favicon.href = vkify.resourceUrl('icons') + '/' + icoName;
            }
        }

        if (enabled) {
            const instanceName = homeButton.querySelector('.instance_name');
            if (instanceName) instanceName.remove();
            return;
        }

        const title = homeButton.getAttribute('title');
        if (title && title !== 'OpenVK' && !homeButton.querySelector('.instance_name')) {
            const span = document.createElement('span');
            span.className = 'instance_name';
            span.textContent = title;
            homeButton.appendChild(span);
        }
    }

    vkify.registerSetting('darkMode', false, 'vkify16_darkmode');
    vkify.registerSetting('mode2018', false, 'vkify16_2018mode');
    vkify.registerSetting('vkGraffiti', false, 'vkify16_graffiti');
    vkify.registerSetting('ovkHat', true, 'ovkhat');

    window.toggleDarkMode = function (enabled) {
        toggleTheme(enabled, 'dark-mode', 'dark-mode-css', 'dark-mode.css');
    };

    window.toggle2018Mode = function (enabled) {
        toggleTheme(enabled, 'mode-2018', '2018-mode-css', '2018.css');
    };

    if (vkify.getSetting('darkMode')) {
        window.toggleDarkMode(true);
    }
    if (vkify.getSetting('mode2018')) {
        window.toggle2018Mode(true);
    }
    window.toggleOvkHat = (enabled) => {
        syncOvkHat(enabled);
    };
    if (vkify.getSetting('ovkHat')) window.toggleOvkHat(true);
    else window.toggleOvkHat(false);

    function bindSettingsToggles() {
        const bindToggle = (name, settingKey, applyFn) => {
            const cb = document.querySelector(`#vkifySettings input[name="${name}"]`);
            if (!cb || cb.dataset.vkifyBound) return;
            cb.dataset.vkifyBound = '1';
            cb.checked = !!vkify.getSetting(settingKey);
            cb.onchange = function() {
                vkify.setSetting(settingKey, this.checked);
                if (applyFn) applyFn(this.checked);
                window.vkifyShowSavedLabel?.(this);
            };
        };
        bindToggle('theme_mode', 'darkMode', window.toggleDarkMode);
        bindToggle('mode_2018', 'mode2018', window.toggle2018Mode);
        bindToggle('vkgraffiti', 'vkGraffiti', null);
        bindToggle('ovkhat', 'ovkHat', window.toggleOvkHat);
    }

    vkify.onPageLifecycle('afterPageReady', bindSettingsToggles, 'after');
})();
