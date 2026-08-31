// Wrap bsdnInitElement to track the currently hydrating element
let currentlyHydratingBsdnElement = null;

if (window.bsdnInitElement) {
    var originalBsdnInitElement = window.bsdnInitElement;
    window.bsdnInitElement = function(el) {
        if (el.querySelector(".bdsn-hydrated")) {
            return;
        }
        currentlyHydratingBsdnElement = el;
        try {
            originalBsdnInitElement(el);
        } finally {
            currentlyHydratingBsdnElement = null;
        }
    };
}

vkify.hook(window, '_bsdnTpl', function(name, author) {
    name   = escapeHtml(name);
    author = escapeHtml(author);
    var vkifyTip = function(k, fallback) {
        return (window.vkifylang && window.vkifylang[k]) || fallback || k;
    };

    var currentEl = currentlyHydratingBsdnElement;
    var duration = currentEl ? currentEl.dataset.duration : '';

    return `
        <div class="bsdn_contextMenu" style="display: none;">
            <span class="bsdn_contextMenuElement bsdn_copyVideoUrl">Copy direct video link</span>
            <hr/>
            <span class="bsdn_contextMenuElement bsdn_copyVkVideoUrl">Copy video link</span>
            <span class="bsdn_contextMenuElement bsdn_copyVideoUrlTime">Copy video link at current time</span>
            <hr/>
            <span class="bsdn_contextMenuElement">OpenVK BSDN///Player 0.1</span>
            <hr/>
            <span class="bsdn_contextMenuElement">Developers:</span>
            <span class="bsdn_contextMenuElement" onclick="window.open('https://github.com/celestora');">
                - celestora
            </span>
            <span class="bsdn_contextMenuElement" onclick="window.open('https://github.com/ayaaop/vkify16/issues/new');">
                - ayato (vkify16 addon)
            </span>
            <hr/>
            <span class="bsdn_contextMenuElement" onclick="window.open('https://github.com/ayaaop/vkify16/issues/new');">
                Report a problem...
            </span>
            <span class="bsdn_contextMenuElement" onclick="window.open('https://youtu.be/VvVThrMhnuE?t=16');">About Adobe Flash Player...</span>
        </div>

        <div class="bsdn_titleBar">
            <span class="bsdn_titleName">${name}</span>
        </div>

        <div class="bsdn_controls">
            <button class="bsdn_playButton" data-tip="simple-black" data-tiptitle="${tr('play_tip')}" data-delay="1" data-align="top-start" data-tiptheme="vkify-player" data-tipoffset="0,0">
                <svg class="bsdn_playIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fill-rule="evenodd">
                        <g fill-rule="nonzero">
                            <path class="_pause" d="m0 0h24v24h-24z"></path>
                            <path class="_pause" d="m7.14520205 5h1.7095959c.39821169 0 .54261289.04664487.68819313.13423418.14558024.08758932.25983248.21612308.33768965.37990085.07785716.16377778.11931927.32622912.11931927.77421728v11.42329539c0 .4479882-.04146211.6104395-.11931927.7742173-.07785717.1637777-.19210941.2923115-.33768965.3799008s-.28998144.1342342-.68819313.1342342h-1.7095959c-.39821169 0-.54261289-.0466449-.68819313-.1342342s-.25983248-.2161231-.33768965-.3799008c-.07785716-.1637778-.11931927-.3262291-.11931927-.7742173v-11.42329539c0-.44798816.04146211-.6104395.11931927-.77421728.07785717-.16377777.19210941-.29231153.33768965-.37990085.14558024-.08758931.28998144-.13423418.68819313-.13423418zm7.99999995 0h1.709596c.3982117 0 .5426128.04664487.6881931.13423418.1455802.08758932.2598325.21612308.3376896.37990085.0778572.16377778.1193193.32622912.1193193.77421728v11.42329539c0 .4479882-.0414621.6104395-.1193193.7742173-.0778571.1637777-.1921094.2923115-.3376896.3799008-.1455803.0875893-.2899814.1342342-.6881931.1342342h-1.709596c-.3982117 0-.5426128-.0466449-.6881931-.1342342-.1455802-.0875893-.2598325-.2161231-.3376896-.3799008-.0778572-.1637778-.1193193-.3262291-.1193193-.7742173v-11.42329539c0-.44798816.0414621-.6104395.1193193-.77421728.0778571-.16377777.1921094-.29231153.3376896-.37990085.1455803-.08758931.2899814-.13423418.6881931-.13423418z" fill="#fff"></path>
                            <path class="_play" d="m8.13340613 5.10548415 10.49681277 6.24354325c.3559987.2117494.472936.6720001.2611866 1.0279989-.0638111.1072809-.1533894.1969388-.2606135.2608453l-10.4968128 6.256187c-.35581027.2120659-.81616483.095538-1.02823068-.2602722-.06921066-.1161237-.10574852-.2487949-.10574852-.3839792v-12.49973035c0-.41421357.33578644-.75.75-.75.13495801 0 .26741554.03641567.38340613.1054073z" fill="#fff"></path>
                        </g>
                        <path class="_replay" d="m12 4.5000003c4.418278 0 8 3.581722 8 8s-3.581722 8-8 8-8-3.581722-8-8c0-.5522847.44771525-1 1-1s1 .4477153 1 1c0 3.3137085 2.6862915 6 6 6s6-2.6862915 6-6-2.6862915-6-6-6v3.09577928c0 .09950642-.0370887.19544034-.104024.26906913-.1486028.16346309-.4015821.17550969-.5650451.02690691l-4.28830818-3.89846194c-.01565124-.0142284-.03061645-.02919361-.04484485-.04484485-.24767129-.27243841-.22759356-.69407063.04484485-.94174191l4.28830818-3.89846194c.0736287-.06693527.1695627-.10402398.2690691-.10402398.2209139 0 .4.17908611.4.40000002z" fill="#fff"></path>
                    </g>
                </svg>
            </button>

            <div class="bsdn_terebilkaWrap">
                <div class="bsdn_terebilkaLowerWrap">
                    <div class="bsdn_terebilkaPlayed"></div>
                    <div class="bsdn_terebilkaBrick"></div>
                </div>
            </div>

            <div class="bsdn_timeWrap">
                <time class="bsdn_timeReal">--:--</time>
                <span class="bsdn_timeSeparator">/</span>
                <time class="bsdn_timeFull">--:--</time>
            </div>

            <div class="bsdn_soundIcon" data-tip="simple-black" data-tiptitle="${tr('mute_tip')}" data-delay="1" data-align="top-center" data-tiptheme="vkify-player" data-tipoffset="0,0">
                <svg class="bsdn_volumeIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <g fill="#fff" fill-rule="evenodd">
                        <path class="_speaker" d="M12.980843 18.8227621c-.032051 1.2070086-.6704932 1.608931-1.8287519.6202507-1.7185995-1.4687545-3.60887471-3.1942931-4.24215929-3.7215065-.63217937-.528454-1.64491897-.6202511-3.07284859-.6202511-1.42682441 0-1.81505873-.6202511-1.81505873-1.2405016s-.01369327-1.8288162-.01369327-2.001246c0-.0549443.00464608-.085056.01369327-.1291845.01954957-.0953551-.05817756-.9728525 0-1.591076.08510106-.90556663.38823432-1.24050252 1.81505873-1.24050252 1.42792962 0 2.44066922-.09179716 3.07284859-.62025109.63328458-.52845393 2.52355979-2.25275186 4.24215929-3.72150644 1.1582587-.98868024 1.7967003-.58675756 1.8287514.62025106.0431031 1.60645033 5e-7 3.85020301 5e-7 6.68226949 0 2.8295855.0431032 5.3568042 0 6.9632545z"></path>
                        <path class="_wave1" d="M15.8812816 10.1187184c-.3417088-.34170872-.3417088-.89572808 0-1.23743683.3417087-.34170876.8957281-.34170876 1.2374368 0 .1762598.17625972.4111566.46988072.6409943.87209686C18.1429358 10.4240187 18.375 11.1782274 18.375 12s-.2320642 1.5759813-.6152873 2.2466216c-.2298377.4022161-.4647345.6958371-.6409943.8720968-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368.0737402-.0737403.2138434-.2488693.3590057-.5029032C16.4820642 12.9552687 16.625 12.4907274 16.625 12s-.1429358-.9552687-.3847127-1.3783784c-.1451623-.2540339-.2852655-.4291629-.3590057-.5029032z"></path>
                        <path class="_wave2" d="M18.8812816 8.11871843c-.3417088-.34170875-.3417088-.89572811 0-1.23743686.3417087-.34170876.8957281-.34170876 1.2374368 0 .2637116.26371158.6207023.73969919.9665078 1.43131016.5167785 1.03355701.842501 2.25503497.8892639 3.71655167-.0467629 1.4032299-.3724854 2.6247079-.8892639 3.6582649-.3458055.6916109-.7027962 1.1675985-.9665078 1.4313101-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368.1375896-.1375897.3825507-.4642045.638697-.9764971.4071252-.8142505.6673665-1.7901701.7054825-2.8756411-.038116-1.1437578-.2983573-2.11967743-.7054825-2.93392787-.2561463-.51229266-.5011074-.83890747-.638697-.9764971z"></path>
                        <path class="_cross" d="M20 10.7625631l2.3812816-2.38128153c.3417087-.34170876.8957281-.34170876 1.2374368 0 .3417088.34170875.3417088.89572811 0 1.23743686L21.2374369 12l2.3812815 2.3812816c.3417088.3417087.3417088.8957281 0 1.2374368-.3417087.3417088-.8957281.3417088-1.2374368 0L20 13.2374369l-2.3812816 2.3812815c-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368L18.7625631 12l-2.3812815-2.38128157c-.3417088-.34170875-.3417088-.89572811 0-1.23743686.3417087-.34170876.8957281-.34170876 1.2374368 0z"></path>
                    </g>
                </svg>
            </div>

            <div class="bsdn_soundControl" data-tip="simple-black" data-tiptitle="${vkifyTip('player_volume_tip', 'Volume')}" data-delay="1" data-align="top-center" data-tiptheme="vkify-player" data-tipoffset="0,0">
                <div class="bsdn_soundControlPadding"></div>
                <div class="bsdn_soundControlSubWrap">
                    <div class="bsdn_soundControlPlayed" style="width: 100%;"></div>
                    <div class="bsdn_soundControlBrick" style="left: calc(100% - 6.5px);"></div>
                </div>
            </div>

            <div class="bsdn_repeatButton" data-tip="simple-black" data-tiptitle="${vkifyTip('player_repeat_enable_tip', 'Enable auto-repeat')}" data-delay="1" data-align="top-center" data-tiptheme="vkify-player" data-tipoffset="0,0">
                <svg class="bsdn_repeatIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path class="_replay" d="m12 4.5000003c4.418278 0 8 3.581722 8 8s-3.581722 8-8 8-8-3.581722-8-8c0-.5522847.44771525-1 1-1s1 .4477153 1 1c0 3.3137085 2.6862915 6 6 6s6-2.6862915 6-6-2.6862915-6-6-6v3.09577928c0 .09950642-.0370887.19544034-.104024.26906913-.1486028.16346309-.4015821.17550969-.5650451.02690691l-4.28830818-3.89846194c-.01565124-.0142284-.03061645-.02919361-.04484485-.04484485-.24767129-.27243841-.22759356-.69407063.04484485-.94174191l4.28830818-3.89846194c.0736287-.06693527.1695627-.10402398.2690691-.10402398.2209139 0 .4.17908611.4.40000002z" fill="#fff"></path>
                </svg>
            </div>

            <div class="bsdn_fullScreenButton" data-tip="simple-black" data-tiptitle="${vkifyTip('player_fullscreen_tip', 'Fullscreen')}" data-delay="1" data-align="top-end" data-tiptheme="vkify-player" data-tipoffset="0,0">
                <svg class="bsdn_fullscreenIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <g fill="#fff" fill-rule="evenodd">
                        <path class="_enter" d="M10.5 19c0 .5522847-.4477153 1-1 1H5c-.55228475 0-1-.4477153-1-1v-4.5c0-.5522847.44771525-1 1-1s1 .4477153 1 1v2.0715l3.36290054-3.3643932.00012963-.0001296c.39052429-.3905243 1.02368923-.3905243 1.41421353 0l.0157791.0157791.0001297.0001296c.3904527.3905959.3903366 1.0237609-.0002593 1.4142136L7.4285 18H9.5c.5522847 0 1 .4477153 1 1zM18 7.4285l-3.3629005 3.3643932c-.0000432.0000432-.0000865.0000864-.0001297.0001296-.3905243.3905243-1.0236892.3905243-1.4142135 0l-.0157791-.0157791c-.0000433-.0000432-.0000865-.0000864-.0001297-.0001296-.3904527-.3905959-.3903366-1.02376087.0002593-1.41421356L16.5715 6H14.5c-.5522847 0-1-.44771525-1-1s.4477153-1 1-1H19c.5522847 0 1 .44771525 1 1v4.5c0 .5522847-.4477153 1-1 1s-1-.4477153-1-1z"></path>
                        <path class="_exit" d="M4.57969048 13.9787492c0-.5464165.44295809-.9893746.9893746-.9893746h4.45218572c.5464165 0 .9893746.4429581.9893746.9893746v4.4521857c0 .5464165-.4429581.9893746-.9893746.9893746-.54641651 0-.98937461-.4429581-.98937461-.9893746v-2.0494895l-3.3196551 3.3211319-.00012963.0001297c-.39052429.3905243-1.02368927.3905243-1.41421356 0l-.00058487-.0005849-.00012964-.0001297c-.39045268-.3905958-.3903366-1.0237608.00025929-1.4142135l3.32113189-3.3196551H5.56906508c-.54641651 0-.9893746-.4429581-.9893746-.9893746zM14.9681238 7.61855457l3.3196551-3.32113189.0001296-.00012966c.3905243-.39052429 1.0236893-.39052429 1.4142136 0l.0005849.00058488.0001296.00012965c.3904527.39059589.3903366 1.02376086-.0002593 1.41421354l-3.3211319 3.3196551h2.0494895c.5464165 0 .9893746.4429581.9893746.98937461 0 .5464165-.4429581.9893746-.9893746.9893746h-4.4415603c-.5522847 0-1-.4477153-1-1V5.56906508c0-.54641651.4429581-.9893746.9893746-.9893746s.9893746.44295809.9893746.9893746z"></path>
                    </g>
                </svg>
            </div>
        </div>

        <div class="bsdn_loader">
            <div class="pr pr_baw pr_medium">
                <div class="pr_bt"></div>
                <div class="pr_bt"></div>
                <div class="pr_bt"></div>
            </div>
        </div>

        <div class="bsdn_teaserWrap">
            <div class="bsdn_teaser">
                <div class="video_thumb_play"></div>
                ${duration ? `<div class="video_thumb_label">${escapeHtml(duration)}</div>` : ''}
            </div>
        </div>
    `;
}, 'replace');

(function() {
    var originalFactory = window._bsdnEventListenerFactory;

    var pad2 = function(n) {
        return n < 10 ? ('0' + n) : String(n);
    };

    var formatTime = function(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
        var total = Math.ceil(seconds);
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        return h > 0 ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
    };

    var getFullscreenElement = function() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    };

    var exitFullscreen = function() {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
        if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    };

    var requestFullscreen = function(el) {
        if (el.requestFullscreen) return el.requestFullscreen();
        if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
        if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    };

    var KEY_MAP = {
        'ArrowRight': 'seekForward',
        'ArrowLeft':  'seekBackward',
        'ArrowUp':    'volumeUp',
        'ArrowDown':  'volumeDown',
        'Space':      'togglePlay',
        'KeyF':       'toggleFullscreen',
        'KeyM':       'toggleMute'
    };

    var KEY_ALIASES = {
        'right': 'ArrowRight', 'left': 'ArrowLeft',
        'up': 'ArrowUp', 'down': 'ArrowDown',
        ' ': 'Space', 'spacebar': 'Space',
        'f': 'KeyF', 'm': 'KeyM'
    };

    var KEYCODE_MAP = { 39: 'ArrowRight', 37: 'ArrowLeft', 38: 'ArrowUp', 40: 'ArrowDown', 32: 'Space', 70: 'KeyF', 77: 'KeyM' };

    var resolveKeyAction = function(e) {
        var code = e.code || KEYCODE_MAP[e.keyCode] || KEY_ALIASES[(e.key || '').toLowerCase()] || KEY_ALIASES[e.key];
        return code ? KEY_MAP[code] : null;
    };

    vkify.hook(window, '_bsdnEventListenerFactory', function(el, v) {
        var listeners = originalFactory(el, v);

        var player = el.querySelector('.bsdn-player');
        if (player) player.tabIndex = 0;

        if (player) {
            player.addEventListener('keydown', function(e) {
                if (e.target !== e.currentTarget) return;
                if (e.ctrlKey || e.altKey || e.metaKey) return;

                var action = resolveKeyAction(e);
                if (!action) return;
                e.preventDefault();

                switch (action) {
                    case 'seekForward':
                    case 'seekBackward':
                        var step = action === 'seekForward' ? 5 : -5;
                        if (Number.isFinite(v.duration) && v.duration > 0 && Number.isFinite(v.currentTime)) {
                            v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + step));
                        }
                        break;
                    case 'volumeUp':
                        v.volume = Math.min(1, v.volume + 0.05);
                        break;
                    case 'volumeDown':
                        v.volume = Math.max(0, v.volume - 0.05);
                        break;
                    case 'togglePlay':
                        if (clickTimeout) return;
                        if (v.paused) v.play();
                        else v.pause();
                        break;
                    case 'toggleFullscreen':
                        var fsBtn = el.querySelector('.bsdn_fullScreenButton');
                        if (fsBtn) fsBtn.click();
                        break;
                    case 'toggleMute':
                        var muteBtn = el.querySelector('.bsdn_soundIcon');
                        if (muteBtn) muteBtn.click();
                        break;
                }
            }, { passive: false });
        }

        if (!v.__playWrapped) {
            v.__playWrapped = true;
            var originalPlay = v.play;
            v.play = function() {
                if (!v.src && v.dataset.src) {
                    v.src = v.dataset.src;
                    v.load();
                }
                return originalPlay.apply(this, arguments);
            };
        }
        if (!v.__timeChecked) {
            v.__timeChecked = true;
            var container = el.closest('[data-id]');
            if (container && container.dataset.id) {
                var expectedPath = '/video' + container.dataset.id;
                if (window.location.pathname === expectedPath) {
                    var tMatch = window.location.search.match(/[?&]t=([^&]+)/);
                    if (tMatch) {
                        var tStr = tMatch[1];
                        var seconds = 0;
                        var parts = tStr.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
                        if (parts && (parts[1] || parts[2] || parts[3])) {
                            seconds += parseInt(parts[1] || 0, 10) * 3600;
                            seconds += parseInt(parts[2] || 0, 10) * 60;
                            seconds += parseInt(parts[3] || 0, 10);
                        } else {
                            seconds = parseInt(tStr, 10) || 0;
                        }
                        if (seconds > 0) {
                            if (!v.src && v.dataset.src) {
                                v.src = v.dataset.src;
                                v.load();
                            }
                            v.addEventListener('loadedmetadata', function() {
                                v.currentTime = seconds;
                            }, { once: true });
                            if (v.readyState >= 1) {
                                v.currentTime = seconds;
                            }
                        }
                    }
                }
            }
        }

        var dragState = { mode: null };
        var dragTip = null;
        var dragTipHideTimer = null;
        var vkifyText = function(k, fallback) {
            return (window.vkifylang && window.vkifylang[k]) || fallback || k;
        };

        var ensureDragTip = function() {
            if (!dragTip) {
                dragTip = document.createElement('div');
                dragTip.className = 'vkifySliderValueTip';
                dragTip.style.display = 'none';
            }

            var parent = getFullscreenElement() || document.body;
            if (dragTip.parentNode !== parent) parent.appendChild(dragTip);
            return dragTip;
        };

        var showDragTip = function(value, x, y) {
            var tip = ensureDragTip();
            if (dragTipHideTimer) {
                clearTimeout(dragTipHideTimer);
                dragTipHideTimer = null;
            }
            tip.textContent = value;
            tip.style.left = x + 'px';
            tip.style.top = y + 'px';
            if (tip.style.display === 'none') {
                tip.style.display = 'block';
                void tip.offsetHeight;
            }
            tip.classList.add('is-visible');
        };

        var finalizeHideDragTip = function() {
            if (!dragTip || dragTip.classList.contains('is-visible')) return;
            dragTip.style.display = 'none';
        };

        var hideDragTip = function() {
            if (!dragTip) return;
            dragTip.classList.remove('is-visible');
            if (dragTipHideTimer) clearTimeout(dragTipHideTimer);
            dragTipHideTimer = setTimeout(finalizeHideDragTip, 180);
        };

        var volumeSlider = el.querySelector('.bsdn_soundControl');
        var repeatButton = el.querySelector('.bsdn_repeatButton');
        var setVolumeHoverTipEnabled = function(enabled) {
            if (!volumeSlider || !volumeSlider._tippy) return;
            if (enabled) volumeSlider._tippy.enable();
            else {
                volumeSlider._tippy.hide();
                volumeSlider._tippy.disable();
            }
        };

        var getRepeatTipText = function(enabled) {
            return enabled
                ? vkifyText('player_repeat_disable_tip', 'Disable auto-repeat')
                : vkifyText('player_repeat_enable_tip', 'Enable auto-repeat');
        };

        var syncRepeatUi = function() {
            if (!repeatButton) return;
            var enabled = !!v.loop;
            repeatButton.classList.toggle('is-on', enabled);
            var tipText = getRepeatTipText(enabled);
            repeatButton.setAttribute('data-tiptitle', tipText);
            if (repeatButton._tippy) repeatButton._tippy.setContent(tipText);
        };

        // Clean up conflicting original listeners
        delete listeners[".bsdn_terebilkaLowerWrap"];
        delete listeners[".bsdn_soundControlSubWrap"];

        if (listeners[".bsdn-player"]) {
            var clickTimeout = null;

            listeners[".bsdn-player"].click = [
                function(e) {
                    if (el.querySelector(".bsdn_controls").contains(e.target) || 
                        el.querySelector(".bsdn_teaser").contains(e.target) || 
                        el.querySelector(".bsdn_contextMenu").contains(e.target)) {
                        return;
                    }

                    if (el.querySelector(".bsdn_contextMenu").style.display !== "none") {
                        el.querySelector(".bsdn_contextMenu").style.display = "none";
                        return;
                    }

                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                        return;
                    }

                    clickTimeout = setTimeout(function() {
                        clickTimeout = null;
                        if (v.paused) v.play();
                        else v.pause();
                        if (player) player.focus({ preventScroll: true });
                    }, 250);
                }
            ];

            listeners[".bsdn-player"].dblclick = [
                function(e) {
                    if (el.querySelector(".bsdn_controls").contains(e.target) || 
                        el.querySelector(".bsdn_teaser").contains(e.target) || 
                        el.querySelector(".bsdn_contextMenu").contains(e.target)) {
                        return;
                    }

                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                    }

                    if (getFullscreenElement()) {
                        exitFullscreen();
                    } else {
                        var player = el.querySelector(".bsdn-player");
                        requestFullscreen(player);
                    }
                }
            ];

            var handleFullscreenChange = function() {
                var player = el.querySelector(".bsdn-player");
                if (player) {
                    player.classList.toggle("bsdn-fullscreen", !!getFullscreenElement());
                }
            };
            listeners[".bsdn-player"].fullscreenchange = [handleFullscreenChange];
            listeners[".bsdn-player"].webkitfullscreenchange = [handleFullscreenChange];
            listeners[".bsdn-player"].mozfullscreenchange = [handleFullscreenChange];

            if (listeners[".bsdn-player"].contextmenu) {
                listeners[".bsdn-player"].contextmenu = [
                    function(e) {
                        var videoEl = el.querySelector(".bsdn_video > video");
                        var teaserWrap = el.querySelector(".bsdn_teaserWrap");
                        var target = e.target;
                        
                        var isVideoClick = (videoEl && (videoEl === target || videoEl.contains(target))) ||
                                           (teaserWrap && (teaserWrap === target || teaserWrap.contains(target)));
                        
                        if (!isVideoClick) {
                            return;
                        }
                        
                        e.preventDefault();
                        
                        var rect = el.querySelector(".bsdn-player").getBoundingClientRect();
                        var h = rect.height, w = rect.width;
                        var x, y;
                        if (getFullscreenElement()) {
                            x = e.screenX;
                            y = e.screenY;
                        } else {
                            var rx = rect.x + window.scrollX, ry = rect.y + window.scrollY;
                            x = e.pageX - rx;
                            y = e.pageY - ry;
                        }

                        if (h - y < 169)
                            y = Math.max(0, y - 169);

                        if (w - x < 238)
                            x = Math.max(0, x - 238);

                        var menu = el.querySelector(".bsdn_contextMenu");
                        menu.style.top     = y + "px";
                        menu.style.left    = x + "px";
                        menu.style.display = "unset";
                    }
                ];
            }
        }

        if (listeners[".bsdn_video > video"]) {
            listeners[".bsdn_video > video"].volumechange = [
                function() {
                    var player = el.querySelector(".bsdn-player");
                    player.dataset.muted = v.volume === 0 ? "true" : "false";
                    player.dataset.volume = v.volume > 0.5 ? "high" : "low";

                    var percents = v.volume * 100;
                    el.querySelector(".bsdn_soundControlPlayed").style.width = percents + "%";
                    el.querySelector(".bsdn_soundControlBrick").style.left = "calc(" + percents + "% - 6.5px)";
                }
            ];
            listeners[".bsdn_video > video"].timeupdate = [
                function() {
                    el.querySelector(".bsdn_timeReal").textContent = formatTime(v.currentTime);
                    if (v._pendingSeekPercent === undefined) {
                        var percents = (v.duration && Number.isFinite(v.duration)) ? Math.ceil(v.currentTime / (v.duration / 100)) : 0;
                        el.querySelector(".bsdn_terebilkaPlayed").style.width = percents + "%";
                        el.querySelector(".bsdn_terebilkaBrick").style.left = "calc(" + percents + "% - 6.5px)";
                    }
                }
            ];
            listeners[".bsdn_video > video"].loadedmetadata = [
                function() {
                    el.querySelector(".bsdn_timeFull").textContent = formatTime(v.duration);
                    if (v._pendingSeekPercent !== undefined) {
                        v.currentTime = (v.duration / 100) * v._pendingSeekPercent;
                        v._pendingSeekPercent = undefined;
                    }
                }
            ];
        }

        listeners[".bsdn_video > video"].play = [
            function() {
                if (!el.querySelector(".bsdn-player").classList.contains("bsdn-dirty"))
                    el.querySelector(".bsdn-player").classList.add("bsdn-dirty");
                el.querySelector(".bsdn-player").classList.add("_bsdn_playing");
                el.querySelector(".bsdn-player").dataset.ended = "false";
            }
        ];

        listeners[".bsdn_video > video"].pause = [
            function() {
                el.querySelector(".bsdn-player").classList.remove("_bsdn_playing");
                el.querySelector(".bsdn-player").classList.remove("bsdn_loading");
                el.querySelector(".bsdn_teaserWrap").style.display = "flex";
            }
        ];

        // Loading state management
        listeners[".bsdn_video > video"].waiting = [function() {
            el.querySelector(".bsdn-player").classList.add("bsdn_loading");
        }];
        listeners[".bsdn_video > video"].seeking = [function() {
            el.querySelector(".bsdn-player").classList.add("bsdn_loading");
        }];
        listeners[".bsdn_video > video"].loadstart = [function() {
            el.querySelector(".bsdn-player").classList.add("bsdn_loading");
        }];
        listeners[".bsdn_video > video"].playing = [function() {
            el.querySelector(".bsdn-player").classList.remove("bsdn_loading");
            el.querySelector(".bsdn_teaserWrap").style.display = "none";
        }];
        listeners[".bsdn_video > video"].seeked = [function() {
            el.querySelector(".bsdn-player").classList.remove("bsdn_loading");
        }];
        listeners[".bsdn_video > video"].canplay = [function() {
            el.querySelector(".bsdn-player").classList.remove("bsdn_loading");
        }];
        listeners[".bsdn_video > video"].error = [function() {
            el.querySelector(".bsdn-player").classList.remove("bsdn_loading");
        }];

        // Teaser overlay click → play
        listeners[".bsdn_teaser"] = {
            click: [function() {
                if (v.paused) v.play();
                else v.pause();
                if (player) player.focus({ preventScroll: true });
            }]
        };

        // Cross-browser fullscreen toggle
        listeners[".bsdn_fullScreenButton"] = {
            click: [function() {
                if (getFullscreenElement()) {
                    exitFullscreen();
                } else {
                    var player = el.querySelector(".bsdn-player");
                    requestFullscreen(player);
                }
            }]
        };

        listeners[".bsdn_video > video"].ended = [function() {
            el.querySelector(".bsdn-player").dataset.ended = "true";
        }];

        var getPointerProgress = function(clientX, rect) {
            var usable = Math.max(1, rect.width - 1);
            var offset = Math.max(0, Math.min(usable, clientX - rect.left));
            var percents = (offset / usable) * 100;
            return { offset: offset, percents: percents };
        };

        var seekFromOuter = function(e) {
            if (!v.src && v.dataset.src) {
                v.src = v.dataset.src;
                v.load();
            }
            
            var inner = el.querySelector(".bsdn_terebilkaLowerWrap");
            var rect = inner.getBoundingClientRect();
            var progress = getPointerProgress(e.clientX, rect);
            var percents = progress.percents;

            var duration = v.duration;
            if (!Number.isFinite(duration) || duration <= 0) {
                v._pendingSeekPercent = percents;
                el.querySelector(".bsdn_terebilkaPlayed").style.width = percents + "%";
                el.querySelector(".bsdn_terebilkaBrick").style.left = "calc(" + percents + "% - 6.5px)";
                
                if (dragState.mode === 'seek') {
                    var x = rect.left + progress.offset;
                    showDragTip("--:--", x, rect.top - 6);
                }
                return;
            }
            
            v.currentTime = (duration / 100) * percents;

            if (dragState.mode === 'seek') {
                var x = rect.left + progress.offset;
                showDragTip(formatTime(v.currentTime), x, rect.top - 6);
            }
        };

        var volumeFromOuter = function(e) {
            var inner = el.querySelector(".bsdn_soundControlSubWrap");
            var rect = inner.getBoundingClientRect();
            var progress = getPointerProgress(e.clientX, rect);
            var percents = progress.percents;
            v.volume = percents / 100;

            if (dragState.mode === 'volume') {
                var x = rect.left + progress.offset;
                showDragTip(Math.round(percents) + '%', x, rect.top - 6);
            }
        };

        var DRAG_HANDLERS = { seek: seekFromOuter, volume: volumeFromOuter };

        var handleDocumentMouseMove = function(e) {
            var handler = DRAG_HANDLERS[dragState.mode];
            if (handler) handler(e);
        };

        var handleDocumentMouseUp = function() {
            if (!dragState.mode) return;
            dragState.mode = null;
            setVolumeHoverTipEnabled(true);
            hideDragTip();
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
        };

        listeners[".bsdn_terebilkaWrap"] = {
            mousedown: [function(e) {
                dragState.mode = 'seek';
                setVolumeHoverTipEnabled(false);
                seekFromOuter(e);
                document.addEventListener('mousemove', handleDocumentMouseMove);
                document.addEventListener('mouseup', handleDocumentMouseUp);
            }]
        };

        listeners[".bsdn_soundControl"] = {
            mousedown: [function(e) {
                dragState.mode = 'volume';
                setVolumeHoverTipEnabled(false);
                volumeFromOuter(e);
                document.addEventListener('mousemove', handleDocumentMouseMove);
                document.addEventListener('mouseup', handleDocumentMouseUp);
            }]
        };

        if (listeners[".bsdn_repeatButton"] && listeners[".bsdn_repeatButton"].click) {
            listeners[".bsdn_repeatButton"].click.push(function() {
                syncRepeatUi();
            });
        }
        var copyToClipboard = async function(url) {
            if (!navigator.clipboard) { prompt("URL:", url); return false; }
            try {
                await navigator.clipboard.writeText(url);
                return true;
            } catch(e) {
                prompt("URL:", url);
                return false;
            }
        };

        var copyUrlWithNotification = async function(url, defaultSuccessMsg) {
            var ok = await copyToClipboard(url);
            if (ok && window.NewNotification) {
                window.NewNotification('', defaultSuccessMsg, null, () => {}, 3000, false);
            }
        };

        if (listeners[".bsdn_copyVideoUrl"]) {
            listeners[".bsdn_copyVideoUrl"].click = [
                async function() {
                    el.querySelector(".bsdn_contextMenu").style.display = "none";
                    var txt = (window.vkifylang && window.vkifylang['link_copied_direct']);
                    copyUrlWithNotification(v.src, txt);
                }
            ];
        }

        listeners[".bsdn_copyVkVideoUrl"] = {
            click: [
                async function() {
                    el.querySelector(".bsdn_contextMenu").style.display = "none";
                    var container = el.closest('[data-id]');
                    if (!container || !container.dataset.id) return;
                    var videoUrl = window.location.origin + '/video' + container.dataset.id;
                    var txt = (window.vkifylang && window.vkifylang['link_copied_vk']);
                    copyUrlWithNotification(videoUrl, txt);
                }
            ]
        };

        listeners[".bsdn_copyVideoUrlTime"] = {
            click: [
                async function() {
                    el.querySelector(".bsdn_contextMenu").style.display = "none";
                    var container = el.closest('[data-id]');
                    if (!container || !container.dataset.id) return;
                    var t = Math.floor(v.currentTime || 0);
                    var videoUrl = window.location.origin + '/video' + container.dataset.id + '?t=' + t;
                    var txt = (window.vkifylang && window.vkifylang['link_copied_time']);
                    copyUrlWithNotification(videoUrl, txt);
                }
            ]
        };

        syncRepeatUi();

        return listeners;
    }, 'replace');
})();

// Re-hydrate any players that were hydrated before this script loaded
if (window.bsdnInitElement) {
    document.querySelectorAll(".bsdn").forEach(function(el) {
        var hydratedDiv = el.querySelector(".bdsn-hydrated");
        if (hydratedDiv) {
            var video = hydratedDiv.querySelector("video");
            if (video) {
                el.innerHTML = '';
                el.appendChild(video);
            }
        }
        bsdnInitElement(el);
    });
}
