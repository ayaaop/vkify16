(function () {
'use strict';

window.toggle_comment_textarea = window.toggle_comment_textarea || function (id) {
    const el = ge('commentTextArea' + id);
    const wi = ge('wall-post-input' + id);
    if (!el) {
        return;
    }
    if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        if (wi) {
            wi.blur();
        }
    } else {
        el.classList.remove('hidden');
        if (wi) {
            wi.focus();
        }
    }
};

window.setTip = window.setTip || function (obj, text, interactive = false) {
    const zIndex = obj?.closest('.ovk-msg-all') ? 9999 : 99;
    tippy(obj, {
        content: `<text style="font-size: 11px;">${text}</text>`,
        allowHTML: true,
        placement: 'top',
        theme: 'light vk',
        animation: 'up_down',
        interactive: interactive,
        zIndex: zIndex
    });
};

window.expandText = function (item) {
    const element = item.parentElement;
    if (!element) return;
    
    const parentContainer = element.parentElement;
    if (!parentContainer) return;
    
    const truncated = parentContainer.querySelector('.truncated_text');
    const full = parentContainer.querySelector('.full_text');
    if (!truncated || !full) return;
    
    if (element.classList.contains('truncated_text')) {
        truncated.classList.add('hidden');
        full.classList.remove('hidden');
    } else {
        full.classList.add('hidden');
        truncated.classList.remove('hidden');
    }
};

window.showBlueWarning = window.showBlueWarning || function (content) {
    NewNotification(tr('warning'), content, null, () => { }, 10000, false);
};
window.allLangsPopup = window.allLangsPopup || async function () {
    const CF = window.ContentFetcher;

    try {
        const content = await CF.fetchPageContent('/language', '#all_languages_list', { showLoader: true });
        const returnTo = encodeURI(window.location.pathname + window.location.search);
        content.querySelectorAll('a[href^="/language?lg="]').forEach(link => {
            const url = new URL(link.href);
            url.searchParams.set('jReturnTo', returnTo);
            link.href = url.pathname + url.search;
        });

        window.langPopup = new CMessageBox({
            title: tr('select_language'),
            body: content.outerHTML,
            buttons: [tr('close')],
            callbacks: [() => { langPopup.close(); }]
        });

        setTimeout(() => {
            $('.ovk-msg-all[data-id]').css('width', '700px');
            $('.ovk-diag-body')[0].style.setProperty('padding', '20px 0 20px 30px', 'important');
            $('.ovk-diag-action').prepend('<a class="button button_light" style="float: left; margin: 0;" href="https://hosted.weblate.org/projects/openvk/" target="_blank">' + tr('language_add_strings') + '</a>');
        }, 0);
    } catch (e) {
        console.error('Failed to load languages:', e);
    }
};

window.changeLangPopup = window.changeLangPopup || function () {
    const currentLang = window.openvk.current_language;
    const langs = [
        { code: 'ru', name: 'Русский', flag: 'ru.png' },
        { code: 'uk', name: 'Україньска', flag: 'uk.png' },
        { code: 'en', name: 'English', flag: 'en.png' },
        { code: 'ru_sov', name: 'Советский', flag: 'sov.png' },
        { code: 'ru_old', name: 'Дореволюціонный', flag: 'imp.png' }
    ];

    let body = langs.map(lang => `
    <a href="/language?lg=${lang.code}&hash=${encodeURIComponent(window.router.csrf)}&jReturnTo=${encodeURI(window.location.pathname + window.location.search)}">
       <div class="langSelect${currentLang === lang.code ? ' selected' : ''}"><img src="${vkify.resourceUrl('lang_flags/' + lang.flag)}" style="margin-right: 14px;"><b>${lang.name}</b></div>
    </a>`).join('');

    body += `
    <a href="/language" onclick="langPopup.close(); allLangsPopup(); return false;">
       <div class="langSelect"><b style="padding: 2px 2px 2px 48px;">All languages »</b></div>
    </a>`;

    window.langPopup = new CMessageBox({
        title: tr('select_language'),
        body: body,
        buttons: [tr('close')],
        callbacks: [() => { langPopup.close(); }]
    });

    langPopup.getNode().nodes[0]?.style.setProperty('width', '320px');
    langPopup.getNode().find('.ovk-diag-body').nodes[0]?.style.setProperty('padding', '15px 20px', 'important');
};

window.reportNote = window.reportNote || function (noteId) {
    let uReportMsgTxt = '<vkifyloc name="going_to_report_note"></vkifyloc>';
    uReportMsgTxt += '<br/>' + tr('report_question_text');
    uReportMsgTxt += '<br/><br/><b>' + tr('report_reason') + '</b>: <input type=\'text\' id=\'uReportMsgInput\' placeholder=\'' + tr('reason') + '\' />';

    MessageBox(tr('report_question'), uReportMsgTxt, [tr('confirm_m'), tr('cancel')], [
        (function () {
            const res = document.querySelector('#uReportMsgInput')?.value || '';
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/report/' + noteId + '?reason=' + encodeURIComponent(res) + '&type=note', true);
            xhr.onload = (function () {
                if (xhr.responseText.indexOf('reason') === -1) {
                    MessageBox(tr('error'), tr('error_sending_report'), ['OK'], [Function.noop]);
                } else {
                    MessageBox(tr('action_successfully'), tr('will_be_watched'), ['OK'], [Function.noop]);
                }
            });
            xhr.send(null);
        }),
        Function.noop
    ]);
};

window.switchProfileInfo = window.switchProfileInfo || function () {
    const infoblock = document.querySelector('.profileinfoblock');
    const infobtn = document.querySelector('#showFullInfoButton');
    if (!infoblock || !infobtn) return;

    if (infoblock.style.display === 'none') {
        infoblock.style.display = 'block';
        infobtn.text = tr('close_comments');
    } else {
        infoblock.style.display = 'none';
        infobtn.text = tr('additional_information');
    }
};

window.updateToTopArea = function () {
    const layout = document.querySelector('.layout');
    if (!layout) return;

    const leftOffset = layout.getBoundingClientRect().left;
    document.documentElement.style.setProperty(
        '--to-top-width',
        (leftOffset > 114 ? leftOffset : 114) + 'px'
    );
};

let toTopAreaRafPending = false;
window.addEventListener('resize', () => {
    if (toTopAreaRafPending) return;
    toTopAreaRafPending = true;
    requestAnimationFrame(() => {
        toTopAreaRafPending = false;
        window.updateToTopArea();
    });
});

// Defer until after paint so the post-navigation layout (async stylesheets, fonts,
// scrollbar) has settled, then re-check shortly after to catch late shifts.
vkify.onPage(() => {
    requestAnimationFrame(window.updateToTopArea);
    setTimeout(window.updateToTopArea, 300);
});

window.updateToTopOpacity = function () {
    const scrollY = window.scrollY || window.pageYOffset;
    const opacity = Math.min(Math.max((scrollY - 200) / 300, 0), 1);
    document.documentElement.style.setProperty('--to-top-opacity', opacity);
};

let toTopOpacityRafPending = false;
window.addEventListener('scroll', () => {
    if (toTopOpacityRafPending) return;
    toTopOpacityRafPending = true;
    requestAnimationFrame(() => {
        toTopOpacityRafPending = false;
        window.updateToTopOpacity();
    });
}, { passive: true });
vkify.onPage(window.updateToTopOpacity);

function initLocalStorageCheckboxes() {
    document.querySelectorAll('input[data-act="localstorage_item"]').forEach((input) => {
        const stored = localStorage.getItem(input.name);
        if (stored === null) return;
        const val = Number(stored);
        input.checked = input.dataset.inverse ? !val : !!val;
    });
}

vkify.onPage(initLocalStorageCheckboxes);

vkify.onPageLifecycle('beforePageLeave', () => {
    const smallBlock = document.querySelector('div[class$="_small_block"]');
    if (smallBlock && typeof smallBlockObserver !== 'undefined') {
        smallBlockObserver.unobserve(smallBlock);
    }
});

vkify.onPageLifecycle('afterPageSwap', async () => {
    const smallBlock = document.querySelector('div[class$="_small_block"]');
    if (smallBlock && typeof smallBlockObserver !== 'undefined') {
        smallBlockObserver.observe(smallBlock);
    }

    if (window.player) {
        window.player.dump();
        await window.player._handlePageTransition();
    }
});

// Orchestrator: trigger per-page initializers provided by extracted modules.
vkify.onPageLifecycle('afterPageReady', () => {
    window.initializeSearchFastTips?.();
    window.hideSearchFastTips?.();
    window.initTabSlider?.();

    if (ge('photos-section') && !ge('photos-section').dataset?.initialized) {
        setTimeout(window.initAlbumPhotosLoader, 100);
    }

    if (ge('editor') && typeof window.initNotesMonacoEditor === 'function') {
        setTimeout(window.initNotesMonacoEditor, 100);
    }

    if (document.querySelector('.album-flex') && window.Masonry) {
        Masonry.initAll('.album-flex', { itemSelector: '.masonry-item', columns: 3, gap: 10, breakpoints: { 600: 2, 450: 1 } });
    }
}, 'before');

})();
