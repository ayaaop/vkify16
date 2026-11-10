(function () {
'use strict';

const STATES = {
    EMPTY: 'empty',
    UNSTARTED: 'unstarted',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended',
    ERROR: 'error',
};

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const INACTIVITY_HIDE_MS = 3000;
const SEEK_STEP_SECONDS = 5;
const FRAME_STEP_SECONDS = 1 / 24;
const VOLUME_STEP = 0.05;

const Prefs = {
    get(key) {
        try {
            const all = JSON.parse(localStorage.getItem('videoplayer_prefs')) || {};
            return key ? all[key] : all;
        } catch {
            return key ? undefined : {};
        }
    },
    set(key, val) {
        try {
            const all = this.get();
            all[key] = val;
            localStorage.setItem('videoplayer_prefs', JSON.stringify(all));
        } catch { }
    },
};

function pad2(n) {
    return n < 10 ? ('0' + n) : String(n);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

function parseTimeParam(tStr) {
    if (!tStr) return 0;
    const parts = String(tStr).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (parts && (parts[1] || parts[2] || parts[3])) {
        return (parseInt(parts[1] || 0, 10) * 3600)
            + (parseInt(parts[2] || 0, 10) * 60)
            + parseInt(parts[3] || 0, 10);
    }
    return parseInt(tStr, 10) || 0;
}

function formatTimeParam(seconds) {
    let s = Math.max(0, Math.floor(seconds || 0));
    let out = '';
    if (s >= 3600) {
        out += Math.floor(s / 3600) + 'h';
        s %= 3600;
    }
    if (s >= 60) {
        out += Math.floor(s / 60) + 'm';
        s %= 60;
    }
    if (s > 0 || !out) {
        out += s + 's';
    }
    return out;
}

function getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

function requestFullscreen(el) {
    const fn = el.requestFullscreen
        || el.webkitRequestFullscreen
        || el.mozRequestFullScreen
        || el.msRequestFullscreen;
    return fn ? fn.call(el) : undefined;
}

function exitFullscreen() {
    const fn = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;
    return fn ? fn.call(document) : undefined;
}

function isFullscreenEnabled() {
    return Boolean(
        document.fullscreenEnabled
        || document.webkitFullscreenEnabled
        || document.mozFullScreenEnabled
        || document.msFullscreenEnabled
    );
}

function vkifyText(key, fallback) {
    return (window.vkifylang && window.vkifylang[key]) || fallback || key;
}

function isProcessingUrl(url) {
    return Boolean(url && String(url).includes('/video/rendering.'));
}

function videoPageUrl(videoId, timecode = null) {
    const id = String(videoId || '');
    const path = '/video' + (id.includes('_') && typeof idUrlFromArray === 'function' ? idUrlFromArray(id) : id);
    if (!timecode) return path;
    return path + (path.includes('?') ? '&' : '?') + 't=' + timecode;
}

function syncNotificationsHost() {
    const wrap = document.querySelector('.notifications_global_wrap');
    if (!wrap) return;
    const target = getFullscreenElement() || document.body;
    if (wrap.parentElement !== target) {
        target.appendChild(wrap);
    }
}

document.addEventListener('fullscreenchange', syncNotificationsHost);
document.addEventListener('webkitfullscreenchange', syncNotificationsHost);
if (typeof window.NewNotification === 'function') {
    vkify.hook(window, 'NewNotification', () => syncNotificationsHost(), 'before');
}

function playIconSvg(cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">`
        + `<g fill="none" fill-rule="evenodd">`
        + `<g fill-rule="nonzero">`
        + `<path class="_pause" d="m0 0h24v24h-24z"/>`
        + `<path class="_pause" d="m7.14520205 5h1.7095959c.39821169 0 .54261289.04664487.68819313.13423418.14558024.08758932.25983248.21612308.33768965.37990085.07785716.16377778.11931927.32622912.11931927.77421728v11.42329539c0 .4479882-.04146211.6104395-.11931927.7742173-.07785717.1637777-.19210941.2923115-.33768965.3799008s-.28998144.1342342-.68819313.1342342h-1.7095959c-.39821169 0-.54261289-.0466449-.68819313-.1342342s-.25983248-.2161231-.33768965-.3799008c-.07785716-.1637778-.11931927-.3262291-.11931927-.7742173v-11.42329539c0-.44798816.04146211-.6104395.11931927-.77421728.07785717-.16377777.19210941-.29231153.33768965-.37990085.14558024-.08758931.28998144-.13423418.68819313-.13423418zm7.99999995 0h1.709596c.3982117 0 .5426128.04664487.6881931.13423418.1455802.08758932.2598325.21612308.3376896.37990085.0778572.16377778.1193193.32622912.1193193.77421728v11.42329539c0 .4479882-.0414621.6104395-.1193193.7742173-.0778571.1637777-.1921094.2923115-.3376896.3799008-.1455803.0875893-.2899814.1342342-.6881931.1342342h-1.709596c-.3982117 0-.5426128-.0466449-.6881931-.1342342-.1455802-.0875893-.2598325-.2161231-.3376896-.3799008-.0778572-.1637778-.1193193-.3262291-.1193193-.7742173v-11.42329539c0-.44798816.0414621-.6104395.1193193-.77421728.0778571-.16377777.1921094-.29231153.3376896-.37990085.1455803-.08758931.2899814-.13423418.6881931-.13423418z" fill="#fff"/>`
        + `<path class="_play" d="m8.13340613 5.10548415 10.49681277 6.24354325c.3559987.2117494.472936.6720001.2611866 1.0279989-.0638111.1072809-.1533894.1969388-.2606135.2608453l-10.4968128 6.256187c-.35581027.2120659-.81616483.095538-1.02823068-.2602722-.06921066-.1161237-.10574852-.2487949-.10574852-.3839792v-12.49973035c0-.41421357.33578644-.75.75-.75.13495801 0 .26741554.03641567.38340613.1054073z" fill="#fff"/>`
        + `</g>`
        + `<path class="_replay" d="m12 4.5000003c4.418278 0 8 3.581722 8 8s-3.581722 8-8 8-8-3.581722-8-8c0-.5522847.44771525-1 1-1s1 .4477153 1 1c0 3.3137085 2.6862915 6 6 6s6-2.6862915 6-6-2.6862915-6-6-6v3.09577928c0 .09950642-.0370887.19544034-.104024.26906913-.1486028.16346309-.4015821.17550969-.5650451.02690691l-4.28830818-3.89846194c-.01565124-.0142284-.03061645-.02919361-.04484485-.04484485-.24767129-.27243841-.22759356-.69407063.04484485-.94174191l4.28830818-3.89846194c.0736287-.06693527.1695627-.10402398.2690691-.10402398.2209139 0 .4.17908611.4.40000002z" fill="#fff"/>`
        + `</g>`
        + `</svg>`;
}

function volumeIconSvg(cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">`
        + `<g fill="#fff" fill-rule="evenodd">`
        + `<path class="_wave2" d="M12.980843 18.8227621c-.032051 1.2070086-.6704932 1.608931-1.8287519.6202507-1.7185995-1.4687545-3.60887471-3.1942931-4.24215929-3.7215065-.63217937-.528454-1.64491897-.6202511-3.07284859-.6202511-1.42682441 0-1.81505873-.6202511-1.81505873-1.2405016s-.01369327-1.8288162-.01369327-2.001246c0-.0549443.00464608-.085056.01369327-.1291845.01954957-.0953551-.05817756-.9728525 0-1.591076.08510106-.90556663.38823432-1.24050252 1.81505873-1.24050252 1.42792962 0 2.44066922-.09179716 3.07284859-.62025109.63328458-.52845393 2.52355979-2.25275186 4.24215929-3.72150644 1.1582587-.98868024 1.7967003-.58675756 1.8287514.62025106.0431031 1.60645033 5e-7 3.85020301 5e-7 6.68226949 0 2.8295855.0431032 5.3568042 0 6.9632545zm2.9004386-8.7040437c-.3417088-.34170872-.3417088-.89572808 0-1.23743683.3417087-.34170876.8957281-.34170876 1.2374368 0 .1762598.17625972.4111566.46988072.6409943.87209686C18.1429358 10.4240187 18.375 11.1782274 18.375 12s-.2320642 1.5759813-.6152873 2.2466216c-.2298377.4022161-.4647345.6958371-.6409943.8720968-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368.0737402-.0737403.2138434-.2488693.3590057-.5029032C16.4820642 12.9552687 16.625 12.4907274 16.625 12s-.1429358-.9552687-.3847127-1.3783784c-.1451623-.2540339-.2852655-.4291629-.3590057-.5029032zm3-1.99999997c-.3417088-.34170875-.3417088-.89572811 0-1.23743686.3417087-.34170876.8957281-.34170876 1.2374368 0 .2637116.26371158.6207023.73969919.9665078 1.43131016.5167785 1.03355701.842501 2.25503497.8892639 3.71655167-.0467629 1.4032299-.3724854 2.6247079-.8892639 3.6582649-.3458055.6916109-.7027962 1.1675985-.9665078 1.4313101-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368.1375896-.1375897.3825507-.4642045.638697-.9764971.4071252-.8142505.6673665-1.7901701.7054825-2.8756411-.038116-1.1437578-.2983573-2.11967743-.7054825-2.93392787-.2561463-.51229266-.5011074-.83890747-.638697-.9764971z"/>`
        + `<path class="_wave1" d="M12.980843 18.8227621c-.032051 1.2070086-.6704932 1.608931-1.8287519.6202507-1.7185995-1.4687545-3.60887471-3.1942931-4.24215929-3.7215065-.63217937-.528454-1.64491897-.6202511-3.07284859-.6202511-1.42682441 0-1.81505873-.6202511-1.81505873-1.2405016s-.01369327-1.8288162-.01369327-2.001246c0-.0549443.00464608-.085056.01369327-.1291845.01954957-.0953551-.05817756-.9728525 0-1.591076.08510106-.90556663.38823432-1.24050252 1.81505873-1.24050252 1.42792962 0 2.44066922-.09179716 3.07284859-.62025109.63328458-.52845393 2.52355979-2.25275186 4.24215929-3.72150644 1.1582587-.98868024 1.7967003-.58675756 1.8287514.62025106.0431031 1.60645033 5e-7 3.85020301 5e-7 6.68226949 0 2.8295855.0431032 5.3568042 0 6.9632545zm2.9004386-8.7040437c-.3417088-.34170872-.3417088-.89572808 0-1.23743683.3417087-.34170876.8957281-.34170876 1.2374368 0 .1762598.17625972.4111566.46988072.6409943.87209686C18.1429358 10.4240187 18.375 11.1782274 18.375 12s-.2320642 1.5759813-.6152873 2.2466216c-.2298377.4022161-.4647345.6958371-.6409943.8720968-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368.0737402-.0737403.2138434-.2488693.3590057-.5029032C16.4820642 12.9552687 16.625 12.4907274 16.625 12s-.1429358-.9552687-.3847127-1.3783784c-.1451623-.2540339-.2852655-.4291629-.3590057-.5029032z"/>`
        + `<path class="_cross" d="M20 10.7625631l2.3812816-2.38128153c.3417087-.34170876.8957281-.34170876 1.2374368 0 .3417088.34170875.3417088.89572811 0 1.23743686L21.2374369 12l2.3812815 2.3812816c.3417088.3417087.3417088.8957281 0 1.2374368-.3417087.3417088-.8957281.3417088-1.2374368 0L20 13.2374369l-2.3812816 2.3812815c-.3417087.3417088-.8957281.3417088-1.2374368 0-.3417088-.3417087-.3417088-.8957281 0-1.2374368L18.7625631 12l-2.3812815-2.38128157c-.3417088-.34170875-.3417088-.89572811 0-1.23743686.3417087-.34170876.8957281-.34170876 1.2374368 0zm-7.019157 8.060199c-.032051 1.2070086-.6704932 1.608931-1.8287519.6202507-1.7185995-1.4687545-3.60887471-3.1942931-4.24215929-3.7215065-.63217937-.528454-1.64491897-.6202511-3.07284859-.6202511-1.42682441 0-1.81505873-.6202511-1.81505873-1.2405016s-.01369327-1.8288162-.01369327-2.001246c0-.0549443.00464608-.085056.01369327-.1291845.01954957-.0953551-.05817756-.9728525 0-1.591076.08510106-.90556663.38823432-1.24050252 1.81505873-1.24050252 1.42792962 0 2.44066922-.09179716 3.07284859-.62025109.63328458-.52845393 2.52355979-2.25275186 4.24215929-3.72150644 1.1582587-.98868024 1.7967003-.58675756 1.8287514.62025106.0431031 1.60645033 5e-7 3.85020301 5e-7 6.68226949 0 2.8295855.0431032 5.3568042 0 6.9632545z"/>`
        + `</g>`
        + `</svg>`;
}

function expandIconSvg(cls = '') {
    return `<svg class="${cls}" viewBox="729 480 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false">`
        + `<path d="M729 481.994c0-1.1.895-1.994 1.994-1.994h12.012c1.1 0 1.994.895 1.994 1.994v12.012c0 1.1-.895 1.994-1.994 1.994h-12.012c-1.1 0-1.994-.895-1.994-1.994v-12.012zm2 4.004c0-.55.456-.998 1.002-.998h9.996c.553 0 1.002.446 1.002.998v7.004c0 .55-.456.998-1.002.998h-9.996c-.553 0-1.002-.446-1.002-.998v-7.004z" fill="#FFF" fill-rule="evenodd"/>`
        + `</svg>`;
}

function fullscreenIconSvg(cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">`
        + `<g fill="#fff" fill-rule="evenodd">`
        + `<path class="_enter" d="M10.5 19c0 .5522847-.4477153 1-1 1H5c-.55228475 0-1-.4477153-1-1v-4.5c0-.5522847.44771525-1 1-1s1 .4477153 1 1v2.0715l3.36290054-3.3643932.00012963-.0001296c.39052429-.3905243 1.02368923-.3905243 1.41421353 0l.0157791.0157791.0001297.0001296c.3904527.3905959.3903366 1.0237609-.0002593 1.4142136L7.4285 18H9.5c.5522847 0 1 .4477153 1 1zM18 7.4285l-3.3629005 3.3643932c-.0000432.0000432-.0000865.0000864-.0001297.0001296-.3905243.3905243-1.0236892.3905243-1.4142135 0l-.0157791-.0157791c-.0000433-.0000432-.0000865-.0000864-.0001297-.0001296-.3904527-.3905959-.3903366-1.02376087.0002593-1.41421356L16.5715 6H14.5c-.5522847 0-1-.44771525-1-1s.4477153-1 1-1H19c.5522847 0 1 .44771525 1 1v4.5c0 .5522847-.4477153 1-1 1s-1-.4477153-1-1z"/>`
        + `<path class="_exit" d="M4.57969048 13.9787492c0-.5464165.44295809-.9893746.9893746-.9893746h4.45218572c.5464165 0 .9893746.4429581.9893746.9893746v4.4521857c0 .5464165-.4429581.9893746-.9893746.9893746-.54641651 0-.98937461-.4429581-.98937461-.9893746v-2.0494895l-3.3196551 3.3211319-.00012963.0001297c-.39052429.3905243-1.02368927.3905243-1.41421356 0l-.00058487-.0005849-.00012964-.0001297c-.39045268-.3905958-.3903366-1.0237608.00025929-1.4142135l3.32113189-3.3196551H5.56906508c-.54641651 0-.9893746-.4429581-.9893746-.9893746zM14.9681238 7.61855457l3.3196551-3.32113189.0001296-.00012966c.3905243-.39052429 1.0236893-.39052429 1.4142136 0l.0005849.00058488.0001296.00012965c.3904527.39059589.3903366 1.02376086-.0002593 1.41421354l-3.3211319 3.3196551h2.0494895c.5464165 0 .9893746.4429581.9893746.98937461 0 .5464165-.4429581.9893746-.9893746.9893746h-4.4415603c-.5522847 0-1-.4477153-1-1V5.56906508c0-.54641651.4429581-.9893746.9893746-.9893746s.9893746.44295809.9893746.9893746z"/>`
        + `</g>`
        + `</svg>`;
}

class PlayerTooltip {
    constructor(player) {
        this.player = player;
        this.el = document.createElement('div');
        this.el.className = 'videoplayer_tooltip';
        this.el.innerHTML = '<div class="_text"></div><div class="_arrow"></div>';
        this._text = this.el.querySelector('._text');
        this._arrow = this.el.querySelector('._arrow');
        this._shown = false;
        this.lastShown = 0;
        this._hideTimeout = null;
        this._hideDelayedTimeout = null;
    }

    show({ el, text, toDown = false, offsetXpercent = 0.5, offsetY = 9 }) {
        const str = typeof text === 'function' ? text() : text;
        if (!str || !el) return;
        clearTimeout(this._hideDelayedTimeout);
        clearTimeout(this._hideTimeout);

        this.el.style.display = 'block';
        this._text.textContent = str;

        const playerRect = this.player.el.getBoundingClientRect();
        const targetRect = el.getBoundingClientRect();
        const tipRect = this.el.getBoundingClientRect();

        const pad = 10;
        const arrowHalf = 6;
        let left = targetRect.left - playerRect.left + Math.round(targetRect.width * offsetXpercent) - Math.round(tipRect.width / 2);
        const top = (toDown ? targetRect.bottom : targetRect.top) - playerRect.top - (toDown ? 0 : tipRect.height) + offsetY * (toDown ? 1 : -1);

        let arrowOffset = 0;
        if (left < pad) {
            arrowOffset = left - pad - arrowHalf;
            left = pad;
        } else if (left + tipRect.width > playerRect.width - pad) {
            arrowOffset = left + tipRect.width - (playerRect.width - pad) - arrowHalf;
            left = playerRect.width - tipRect.width - pad;
        }

        this.el.style.left = `${left}px`;
        this.el.style.top = `${top}px`;
        this._arrow.style.marginLeft = arrowOffset ? `${arrowOffset}px` : '';
        this._arrow.classList.toggle('_arrow_up', !!toDown);

        this._hideTimeout = setTimeout(() => this.hide(), 3000);
        this._shown = true;
    }

    hide() {
        clearTimeout(this._hideDelayedTimeout);
        clearTimeout(this._hideTimeout);
        if (this._shown) {
            this._shown = false;
            this.el.style.display = 'none';
            this.lastShown = Date.now();
        }
    }

    hideWithDelay(ms = 0) {
        if (!this._shown) return;
        clearTimeout(this._hideDelayedTimeout);
        this._hideDelayedTimeout = setTimeout(() => this.hide(), ms);
    }

    isVisible() {
        return this._shown;
    }

    attach(opts) {
        let timer = null;
        const target = opts.el;
        if (!target) return;
        target.addEventListener('mouseenter', () => {
            if (this.isVisible() || Date.now() - this.lastShown < 100) {
                this.show(opts);
            } else {
                timer = setTimeout(() => this.show(opts), 1000);
            }
        });
        target.addEventListener('mouseleave', () => {
            clearTimeout(timer);
            if (opts.hideDelay) this.hideWithDelay(opts.hideDelay);
            else this.hide();
        });
        target.addEventListener('click', () => {
            clearTimeout(timer);
            if (opts.hideOnClick) this.hide();
            else setTimeout(() => this.show(opts), 0);
        });
    }
}

class PlayerSlider {
    constructor(player, extraClass, callbacks = {}) {
        this.player = player;
        this.callbacks = callbacks;
        this.dragging = false;
        this.vertical = false;
        this._disabled = false;
        this._filledPercent = 0;

        this.el = document.createElement('div');
        this.el.className = `videoplayer_slider ${extraClass || ''}`.trim();
        this.el.tabIndex = 0;
        this.el.setAttribute('role', 'slider');
        this.el.innerHTML = `<div class="_bars_wrap"><div class="_loaded"></div><div class="_filled"></div></div><div class="_handle_wrap"><div class="_handle"></div></div>`;

        this._loaded = this.el.querySelector('._loaded');
        this._filled = this.el.querySelector('._filled');
        this._handleWrap = this.el.querySelector('._handle_wrap');
        this._handle = this.el.querySelector('._handle');

        this._onWindowMove = (e) => this.onMouseMove(e);
        this._onWindowUp = (e) => this.onMouseUp(e);
        this._onSelectStart = (e) => e.preventDefault();

        this.el.addEventListener('mousemove', (e) => {
            if (this._disabled) return;
            this.callbacks.mousemove?.(this._getMouseProgress(e));
        });
        this.el.addEventListener('mouseleave', () => {
            if (this._disabled) return;
            this.callbacks.mouseout?.();
        });
        this.el.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.el.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    }

    setLoaded(p) {
        const clamped = Math.min(1, Math.max(0, Number(p) || 0));
        this._loaded.style.transform = `translateX(${clamped * 100}%)`;
    }

    setFilled(p) {
        const clamped = Math.min(1, Math.max(0, Number(p) || 0));
        const tx = `translateX(${clamped * 100}%)`;
        this._filled.style.transform = tx;
        this._handleWrap.style.transform = tx;
        this._filledPercent = clamped;
    }

    setVertical(v) {
        this.vertical = !!v;
        this.el.classList.toggle('_vertical', this.vertical);
    }

    toggleVisibility(vis) {
        this.hidden = !vis;
        if (!this.dragging) {
            this.el.classList.toggle('hidden', !vis);
        }
    }

    _getMouseProgress(e) {
        const rect = this.el.getBoundingClientRect();
        const clientX = e.touches ? (e.touches[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) : e.clientX;
        const clientY = e.touches ? (e.touches[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0) : e.clientY;
        let ratio;
        if (this.vertical) {
            ratio = (rect.height - (clientY - rect.top)) / (rect.height || 1);
        } else {
            ratio = (clientX - rect.left) / (rect.width || 1);
        }
        return Math.max(0, Math.min(1, ratio));
    }

    onMouseDown(e) {
        if (this._disabled || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.dragging = true;
        this.el.classList.add('_dragging');
        window.addEventListener('mousemove', this._onWindowMove);
        window.addEventListener('mouseup', this._onWindowUp, { once: true });
        document.addEventListener('selectstart', this._onSelectStart);
        const p = this._getMouseProgress(e);
        this.setFilled(p);
        this.callbacks.dragStart?.(p, e.target === this._handle);
    }

    onMouseMove(e) {
        if (this._disabled || !this.dragging) return;
        const p = this._getMouseProgress(e);
        this.setFilled(p);
        this.callbacks.drag?.(p);
        e.preventDefault();
    }

    onMouseUp(e) {
        if (!this.dragging) return;
        this.dragging = false;
        this.el.classList.remove('_dragging');
        window.removeEventListener('mousemove', this._onWindowMove);
        document.removeEventListener('selectstart', this._onSelectStart);
        const p = this._getMouseProgress(e);
        this.setFilled(p);
        if (this.hidden) this.toggleVisibility(false);
        this.callbacks.dragEnd?.(p);
    }

    onTouchStart(e) {
        if (this._disabled) return;
        e.stopPropagation();
        this.dragging = true;
        this.el.classList.add('_dragging');
        const p = this._getMouseProgress(e);
        this.setFilled(p);
        this.callbacks.dragStart?.(p, e.target === this._handle);

        const onTouchMove = (ev) => {
            if (!this.dragging) return;
            ev.preventDefault();
            const prog = this._getMouseProgress(ev);
            this.setFilled(prog);
            this.callbacks.drag?.(prog);
        };
        const onTouchEnd = (ev) => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
            if (!this.dragging) return;
            this.dragging = false;
            this.el.classList.remove('_dragging');
            const prog = this._getMouseProgress(ev);
            this.setFilled(prog);
            if (this.hidden) this.toggleVisibility(false);
            this.callbacks.dragEnd?.(prog);
        };
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);
    }

    destroy() {
        window.removeEventListener('mousemove', this._onWindowMove);
        window.removeEventListener('mouseup', this._onWindowUp);
        document.removeEventListener('selectstart', this._onSelectStart);
    }
}

class VKVideoPlayer {
    constructor(hostEl) {
        this.hostEl = hostEl;
        const origVideo = hostEl.querySelector('video');
        this.src = origVideo?.getAttribute('src') || origVideo?.dataset?.src || hostEl.dataset.src || '';
        if (this.src) hostEl.dataset.src = this.src;
        const viewerItem = this._resolveModalViewerItem();
        this.videoId = hostEl.dataset.id
            || viewerItem?.id
            || hostEl.closest('[data-id]')?.dataset?.id
            || '';
        this.titleText = hostEl.dataset.name || viewerItem?.title || '';
        this.authorText = hostEl.dataset.author || '';
        this.durationText = hostEl.dataset.duration
            || (viewerItem?.duration > 0 ? formatTime(viewerItem.duration) : '');
        this._viewerThumbUrl = viewerItem?.image?.[0]?.url || '';
        this.isInline = Boolean(hostEl.closest('.attachment, .video_item'));
        this.isProcessing = hostEl.dataset.processing === '1'
            || viewerItem?.is_processed === false
            || isProcessingUrl(this.src)
            || isProcessingUrl(this._viewerThumbUrl)
            || isProcessingUrl(hostEl.style?.getPropertyValue('--post-image'));

        this.state = STATES.UNSTARTED;
        const savedVol = Prefs.get('volume');
        this._volume = typeof savedVol === 'number' ? Math.min(1, Math.max(0, savedVol)) : 0.75;
        this._muted = this._volume === 0;
        this._isTimeReversed = Boolean(Prefs.get('time_reversed'));
        this._minSize = false;
        this._rotateAlpha = 0;
        this._mouseInside = false;
        this._controlsHidden = false;
        this._lastUserActivity = Date.now();
        this._rafId = null;
        this._clickTimeout = null;
        this._wasPlayingBeforeSeek = false;
        this._uiSeeking = false;

        this._buildDOM();
        this._initMediaListeners();
        this._initUIListeners();
        if (this.isProcessing) {
            this.showProcessingState();
        } else {
            if (!this.isInline && this.src) {
                this.video.src = this.src;
                this.video.load();
            }
            this._applyInitialTimeFromUrl();
        }
        this.setVolume(this._muted ? 0 : this._volume, false);
        this.resize();

        this._activityInterval = setInterval(() => this.checkUserActivity(), 100);
        this._onWindowResize = () => this.resize();
        this._onFullscreenChange = () => this.onFullscreenChange();
        window.addEventListener('resize', this._onWindowResize);
        document.addEventListener('fullscreenchange', this._onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);

        if (typeof ResizeObserver === 'function') {
            this._ro = new ResizeObserver(() => this.resize());
            this._ro.observe(this.el);
        }

        VKVideoPlayer._instances.add(this);
    }

    _resolveModalViewer() {
        if (!this.hostEl.closest('#playerHtml')) return null;
        const stack = window.messagebox_stack || [];
        for (let i = stack.length - 1; i >= 0; i--) {
            const viewer = stack[i]?._viewer;
            if (viewer && viewer.currentItem) {
                return viewer;
            }
        }
        return null;
    }

    _resolveModalViewerItem() {
        return this._resolveModalViewer()?.currentItem || null;
    }

    _hasPlaylistQueue() {
        const viewer = this._resolveModalViewer();
        if (!viewer) return false;
        return Boolean((viewer.itemsOrder && viewer.itemsOrder.length > 1) || viewer.totalItemsCount > 1);
    }

    _buildDOM() {
        this.el = document.createElement('div');
        this.el.className = 'videoplayer bdsn-hydrated';
        this.el.tabIndex = -1;
        this.el.setAttribute('role', 'complementary');

        this.mediaWrap = document.createElement('div');
        this.mediaWrap.className = 'videoplayer_media';

        this.video = document.createElement('video');
        this.video.className = 'videoplayer_media_provider';
        this.video.preload = this.isInline ? 'none' : 'metadata';
        this.video.tabIndex = -1;
        this.video.setAttribute('aria-hidden', 'true');
        this.video.setAttribute('playsinline', '');
        if (this.src) this.video.dataset.src = this.src;
        this.mediaWrap.appendChild(this.video);
        this.el.appendChild(this.mediaWrap);

        this.uiEl = document.createElement('div');
        this.uiEl.className = 'videoplayer_ui';
        this.uiEl.dataset.state = STATES.UNSTARTED;

        this.waitingEl = document.createElement('div');
        this.waitingEl.className = 'videoplayer_waiting pr pr_baw pr_big';
        this.waitingEl.style.display = 'none';
        this.waitingEl.innerHTML = '<div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div>';
        this.uiEl.appendChild(this.waitingEl);

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'videoplayer_title';
        this.titleEl.style.display = 'none';
        this.titleLink = document.createElement('a');
        this.titleLink.className = 'videoplayer_title_link' + (this.videoId ? ' _clickable' : '');
        if (this.videoId) this.titleLink.href = videoPageUrl(this.videoId);
        this.titleLink.textContent = this.titleText;
        this.titleEl.appendChild(this.titleLink);
        this.uiEl.appendChild(this.titleEl);

        this.errorEl = document.createElement('div');
        this.errorEl.className = 'videoplayer_error hidden';
        this.errorEl.setAttribute('role', 'alert');
        this.uiEl.appendChild(this.errorEl);

        this.thumbEl = document.createElement('div');
        this.thumbEl.className = 'videoplayer_thumb';
        const thumbBg = this._resolveThumbBackground();
        if (thumbBg) this.thumbEl.style.backgroundImage = thumbBg;
        this.thumbEl.innerHTML = `<div class="videoplayer_big_play_btn"><div class="videoplayer_big_play_btn_bg"></div>${playIconSvg('videoplayer_big_play_icon')}</div>`
            + (this.durationText ? `<div class="video_thumb_label">${escapeHtml(this.durationText)}</div>` : '');
        this.uiEl.appendChild(this.thumbEl);

        this.controlsEl = document.createElement('div');
        this.controlsEl.className = 'videoplayer_controls' + (isFullscreenEnabled() ? ' _has_fullscreen' : '');
        if (this.isInline) {
            this.controlsEl.classList.add('hidden');
            this._controlsHidden = true;
        }
        const hasPlaylist = this._hasPlaylistQueue();
        this.controlsEl.innerHTML = `
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_play" role="button" tabindex="0">
                ${playIconSvg('videoplayer_btn_icon videoplayer_play_icon')}
            </div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_prev" style="${hasPlaylist ? '' : 'display:none;'}" role="button" tabindex="0">
                <div class="videoplayer_btn_icon videoplayer_prev_icon"></div>
            </div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_next" style="${hasPlaylist ? '' : 'display:none;'}" role="button" tabindex="0">
                <div class="videoplayer_btn_icon videoplayer_next_icon"></div>
            </div>
            <div class="videoplayer_controls_item videoplayer_timeline"></div>
            <div class="videoplayer_controls_item videoplayer_time">
                <span class="_time_current">0:00</span><span class="_time_duration">${escapeHtml(this.durationText || '0:00')}</span>
            </div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_mute" role="button" tabindex="0">
                ${volumeIconSvg('videoplayer_btn_icon videoplayer_volume_icon')}
            </div>
            <div class="videoplayer_controls_item videoplayer_volume"></div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_expand" style="${this.isInline && this.videoId ? '' : 'display:none;'}" role="button" tabindex="0">
                ${expandIconSvg('videoplayer_btn_icon videoplayer_expand_icon')}
            </div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_settings" role="button" tabindex="0" aria-haspopup="true">
                <div class="videoplayer_btn_icon videoplayer_settings_icon"></div>
            </div>
            <div class="videoplayer_controls_item videoplayer_btn videoplayer_btn_fullscreen" style="${isFullscreenEnabled() ? '' : 'display:none;'}" role="button" tabindex="0">
                ${fullscreenIconSvg('videoplayer_btn_icon videoplayer_fullscreen_icon')}
            </div>
        `;

        this.btnPlay = this.controlsEl.querySelector('.videoplayer_btn_play');
        this.btnPrev = this.controlsEl.querySelector('.videoplayer_btn_prev');
        this.btnNext = this.controlsEl.querySelector('.videoplayer_btn_next');
        this.timelineContainer = this.controlsEl.querySelector('.videoplayer_timeline');
        this.timeLabel = this.controlsEl.querySelector('.videoplayer_time');
        this.timeCurrent = this.controlsEl.querySelector('._time_current');
        this.timeDuration = this.controlsEl.querySelector('._time_duration');
        this.btnMute = this.controlsEl.querySelector('.videoplayer_btn_mute');
        this.btnMuteIcon = this.controlsEl.querySelector('.videoplayer_volume_icon');
        this.volumeContainer = this.controlsEl.querySelector('.videoplayer_volume');
        this.btnExpand = this.controlsEl.querySelector('.videoplayer_btn_expand');
        this.btnSettings = this.controlsEl.querySelector('.videoplayer_btn_settings');
        this.btnFullscreen = this.controlsEl.querySelector('.videoplayer_btn_fullscreen');

        this.tooltip = new PlayerTooltip(this);

        this.timelineSlider = new PlayerSlider(this, 'videoplayer_timeline_slider', {
            mousemove: (p) => this._showTimelineTooltip(p),
            mouseout: () => this.tooltip.hide(),
            dragStart: (p) => {
                this._uiSeeking = true;
                this._wasPlayingBeforeSeek = !this.video.paused && !this.video.ended;
                if (this._wasPlayingBeforeSeek) this.video.pause();
                this.seekToPercent(p, false);
                this._showTimelineTooltip(p);
            },
            drag: (p) => {
                const d = this.getDuration();
                if (d > 0) this.updateTimeDisplay(p * d);
                this._showTimelineTooltip(p);
            },
            dragEnd: (p) => {
                this._uiSeeking = false;
                this.seekToPercent(p, true);
                if (this._wasPlayingBeforeSeek) this.play();
                this.tooltip.hide();
            },
        });
        this.timelineContainer.appendChild(this.timelineSlider.el);

        const onVolumeSlide = (p) => {
            this.setVolume(p, true);
            this.tooltip.show({
                el: this.volumeSlider.el,
                text: `${Math.round(p * 100)}%`,
                offsetXpercent: p,
                offsetY: 16,
            });
        };
        this.volumeSlider = new PlayerSlider(this, 'videoplayer_volume_slider', {
            dragStart: onVolumeSlide,
            drag: onVolumeSlide,
            dragEnd: () => this.tooltip.hide(),
        });
        this.volumeContainer.appendChild(this.volumeSlider.el);

        this._buildSettingsMenu();
        this.uiEl.appendChild(this.controlsEl);

        this._buildContextMenu();
        this.uiEl.appendChild(this.tooltip.el);

        this.el.appendChild(this.uiEl);
        this.hostEl.replaceChildren(this.el);
    }

    _resolveThumbBackground() {
        for (let node = this.hostEl; node && node !== document.body; node = node.parentElement) {
            const inlineVar = node.style?.getPropertyValue('--post-image')?.trim();
            if (inlineVar) return inlineVar;
        }
        const computed = getComputedStyle(this.hostEl).getPropertyValue('--post-image')?.trim();
        if (computed) return computed;
        if (this._viewerThumbUrl) return `url("${this._viewerThumbUrl}")`;
        return '';
    }

    _buildSettingsMenu() {
        this.settingsWrap = document.createElement('div');
        this.settingsWrap.className = 'videoplayer_settings';
        this.settingsMenu = document.createElement('div');
        this.settingsMenu.className = 'videoplayer_settings_menu_list hidden';
        this.settingsMenu.setAttribute('role', 'menu');
        this.settingsWrap.appendChild(this.settingsMenu);
        this.controlsEl.appendChild(this.settingsWrap);
        this._settingsSublist = null;
        this._renderSettingsMainList();

        let hideSettingsTimer = null;
        const clearHide = () => clearTimeout(hideSettingsTimer);
        const scheduleHide = () => {
            clearTimeout(hideSettingsTimer);
            hideSettingsTimer = setTimeout(() => this.toggleSettings(false), 1000);
        };
        this.settingsWrap.addEventListener('mouseenter', clearHide);
        this.settingsWrap.addEventListener('mouseleave', scheduleHide);
        this.btnSettings.addEventListener('mouseenter', clearHide);
        this.btnSettings.addEventListener('mouseleave', scheduleHide);
    }

    _getPlaybackRateLabel(rate) {
        return rate === 1 ? vkifyText('player_speed_normal', 'Normal') : `${rate}x`;
    }

    _renderSettingsMainList() {
        const speedLabel = this._getPlaybackRateLabel(this.video?.playbackRate || 1);
        const looped = Boolean(this.video?.loop);
        this.settingsMenu.innerHTML = `
            <div class="videoplayer_settings_menu_list_item videoplayer_settings_menu_list_item_playback_speed" data-setting="playback_speed" role="menuitem" tabindex="0">
                <div class="videoplayer_settings_menu_list_icon videoplayer_settings_menu_list_icon_playback_speed"></div>
                <div class="videoplayer_settings_menu_list_title">${escapeHtml(vkifyText('player_speed', 'Speed'))}</div>
                <div class="videoplayer_settings_menu_list_value _speed_val">${escapeHtml(speedLabel)}</div>
            </div>
            <div class="videoplayer_settings_menu_list_item videoplayer_settings_menu_list_item_loop${looped ? ' active' : ''}" data-setting="loop" role="menuitemcheckbox" tabindex="0">
                <div class="videoplayer_settings_menu_list_icon videoplayer_settings_menu_list_icon_loop"></div>
                <div class="videoplayer_settings_menu_list_title">${escapeHtml(vkifyText('player_repeat_enable_tip', 'Repeat video'))}</div>
            </div>
            <div class="videoplayer_settings_menu_list_item videoplayer_settings_menu_list_item_download" data-setting="download" role="menuitem" tabindex="0">
                <div class="videoplayer_settings_menu_list_icon videoplayer_settings_menu_list_icon_download"></div>
                <div class="videoplayer_settings_menu_list_title">${escapeHtml(vkifyText('player_download', 'Download video'))}</div>
            </div>
        `;
    }

    _constrainSettingsMenuBounds() {
        const rect = this.el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const maxW = `${Math.max(80, rect.width - 34)}px`;
        const maxH = `${Math.max(60, rect.height - 52)}px`;
        this.settingsMenu.style.maxWidth = maxW;
        this.settingsMenu.style.maxHeight = maxH;
        if (this._settingsSublist) {
            this._settingsSublist.style.maxWidth = maxW;
            this._settingsSublist.style.maxHeight = maxH;
        }
    }

    _openSpeedSublist() {
        this._closeSpeedSublist();
        this.settingsMenu.classList.add('hidden');
        const currentRate = this.video?.playbackRate || 1;
        const sublist = document.createElement('div');
        sublist.className = 'videoplayer_settings_menu_sublist';
        sublist.innerHTML = `
            <div class="videoplayer_settings_menu_sublist_header">${escapeHtml(vkifyText('player_speed', 'Speed'))}</div>
            <div class="videoplayer_settings_menu_sublist_divider"></div>
            <div class="videoplayer_settings_menu_sublist_items">
                ${PLAYBACK_RATES.map(r => `
                    <div class="videoplayer_settings_menu_sublist_item${r === currentRate ? ' active' : ''}" data-rate="${r}" role="menuitemradio" tabindex="0">
                        ${escapeHtml(this._getPlaybackRateLabel(r))}
                    </div>
                `).join('')}
            </div>
        `;
        sublist.querySelector('.videoplayer_settings_menu_sublist_header').addEventListener('click', (e) => {
            e.stopPropagation();
            this._closeSpeedSublist();
            this.settingsMenu.classList.remove('hidden');
            this._constrainSettingsMenuBounds();
        });
        sublist.querySelectorAll('.videoplayer_settings_menu_sublist_item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const rate = parseFloat(item.dataset.rate) || 1;
                this.setPlaybackRate(rate);
                this._closeSpeedSublist();
                this.toggleSettings(false);
            });
        });
        this.settingsWrap.appendChild(sublist);
        this._settingsSublist = sublist;
        this._constrainSettingsMenuBounds();
    }

    _closeSpeedSublist() {
        if (this._settingsSublist) {
            this._settingsSublist.remove();
            this._settingsSublist = null;
        }
    }

    toggleSettings(open) {
        const isOpen = !this.settingsMenu.classList.contains('hidden') || Boolean(this._settingsSublist);
        const next = open !== undefined ? Boolean(open) : !isOpen;
        this._closeSpeedSublist();
        if (next) {
            this._renderSettingsMainList();
            this._constrainSettingsMenuBounds();
            this.settingsMenu.classList.remove('hidden');
            this.tooltip.hide();
        } else {
            this.settingsMenu.classList.add('hidden');
        }
    }

    _buildContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'videoplayer_context_menu hidden';
        const hasPip = Boolean(document.pictureInPictureEnabled || typeof HTMLVideoElement.prototype.webkitSetPresentationMode === 'function');
        this.contextMenu.innerHTML = `
            ${this.videoId ? `<div class="_item" data-action="copy_link">${escapeHtml(vkifyText('player_copy_video_link', 'Copy video link'))}</div>` : ''}
            ${this.videoId ? `<div class="_item" data-action="copy_timecoded_link">${escapeHtml(vkifyText('copy_video_link_at_time', 'Copy video link at current time'))}</div>` : ''}
            <div class="_item" data-action="copy_direct_link">${escapeHtml(vkifyText('player_copy_direct_link', 'Copy direct video link'))}</div>
            ${hasPip ? `<div class="_item" data-action="toggle_pip">${escapeHtml(vkifyText('player_pip', 'Picture-in-Picture'))}</div>` : ''}
            <div class="_item" data-action="toggle_loop">${escapeHtml(vkifyText('player_repeat_enable_tip', 'Enable auto-repeat'))}</div>
            <div class="_item" data-action="rotate_video">${escapeHtml(vkifyText('player_rotate', 'Rotate'))}</div>
        `;
        this.uiEl.appendChild(this.contextMenu);
    }

    _syncLoopContextMenu() {
        const item = this.contextMenu.querySelector('[data-action="toggle_loop"]');
        if (item) {
            item.textContent = this.video.loop
                ? vkifyText('player_repeat_disable_tip', 'Disable auto-repeat')
                : vkifyText('player_repeat_enable_tip', 'Enable auto-repeat');
        }
        const settingItem = this.settingsMenu?.querySelector('.videoplayer_settings_menu_list_item_loop');
        if (settingItem) {
            settingItem.classList.toggle('active', Boolean(this.video.loop));
        }
    }

    _ensureVideoSrc() {
        if (!this.video.getAttribute('src') && this.src) {
            this.video.src = this.src;
            this.video.load();
        }
    }

    _applyInitialTimeFromUrl() {
        const expanded = window.__vkifyExpandedVideoState;
        if (!this.isInline && expanded && Date.now() - expanded.ts < 10000
            && (!this.videoId || !expanded.videoId || this.videoId === expanded.videoId)) {
            window.__vkifyExpandedVideoState = null;
            this._ensureVideoSrc();
            const applyExpanded = () => {
                if (expanded.time > 0) {
                    this.video.currentTime = expanded.time;
                    this.updateTimeDisplay(expanded.time);
                }
                if (expanded.autoplay) {
                    this.play();
                }
            };
            if (this.video.readyState >= 1) applyExpanded();
            else this.video.addEventListener('loadedmetadata', applyExpanded, { once: true });
            return;
        }

        if (!this.videoId) return;
        const expectedPath = videoPageUrl(this.videoId).split('?')[0];
        if (window.location.pathname !== expectedPath) return;
        const tMatch = window.location.search.match(/[?&]t=([^&]+)/);
        if (!tMatch) return;
        const seconds = parseTimeParam(tMatch[1]);
        if (seconds <= 0) return;
        this._ensureVideoSrc();
        const apply = () => {
            this.video.currentTime = seconds;
            this.updateTimeDisplay(seconds);
        };
        if (this.video.readyState >= 1) apply();
        else this.video.addEventListener('loadedmetadata', apply, { once: true });
    }

    _initMediaListeners() {
        const v = this.video;

        v.addEventListener('play', () => {
            this.changeState(STATES.PLAYING);
            this.startTimelineAnimation();
        });

        v.addEventListener('playing', () => {
            this.setWaiting(false);
            this.changeState(STATES.PLAYING);
            this.thumbEl.classList.add('hidden');
            this.showUI();
        });

        v.addEventListener('pause', () => {
            if (this._uiSeeking || v.ended) return;
            this.setWaiting(false);
            this.changeState(STATES.PAUSED);
            this.showUI();
        });

        v.addEventListener('ended', () => {
            this.setWaiting(false);
            this.changeState(STATES.ENDED);
            this.thumbEl.classList.remove('hidden');
            this.showUI();
        });

        v.addEventListener('waiting', () => this.setWaiting(true));
        v.addEventListener('seeking', () => this.setWaiting(true));
        v.addEventListener('seeked', () => this.setWaiting(false));
        v.addEventListener('canplay', () => this.setWaiting(false));

        v.addEventListener('loadedmetadata', () => {
            if (this._pendingSeekPercent !== undefined && Number.isFinite(v.duration) && v.duration > 0) {
                v.currentTime = v.duration * this._pendingSeekPercent;
                this._pendingSeekPercent = undefined;
            }
            this.updateDurationDisplay();
            this.resize();
        });

        v.addEventListener('durationchange', () => {
            this.updateDurationDisplay();
            this.resize();
        });

        v.addEventListener('timeupdate', () => {
            if (!this.timelineSlider.dragging) {
                this.updateTimeDisplay(v.currentTime);
            }
        });

        v.addEventListener('progress', () => {
            this.updateBuffered();
        });

        v.addEventListener('volumechange', () => {
            this.updateVolumeUI(v.muted ? 0 : v.volume);
        });

        v.addEventListener('error', () => {
            if (!v.getAttribute('src') || this.isProcessing) return;
            const code = v.error?.code;
            if (code === 1) return;
            if (isProcessingUrl(v.currentSrc || v.src || this.src)) {
                this.showProcessingState();
                return;
            }
            this.setWaiting(false);
            this.changeState(STATES.ERROR);
        });
    }

    _initUIListeners() {
        this.btnPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });

        this.btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            this._resolveModalViewer()?.slide(-1);
        });

        this.btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            this._resolveModalViewer()?.slide(1);
        });

        this.thumbEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.play();
            this.el.focus({ preventScroll: true });
        });

        this.btnMute.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute();
        });

        let hideVolTimer = null;
        const onVolEnter = () => {
            if (!this._minSize) return;
            clearTimeout(hideVolTimer);
            this.volumeSlider.toggleVisibility(true);
        };
        const onVolLeave = () => {
            if (!this._minSize) return;
            hideVolTimer = setTimeout(() => this.volumeSlider.toggleVisibility(false), 100);
        };
        this.btnMute.addEventListener('mouseenter', onVolEnter);
        this.btnMute.addEventListener('mouseleave', onVolLeave);
        this.volumeContainer.addEventListener('mouseenter', onVolEnter);
        this.volumeContainer.addEventListener('mouseleave', onVolLeave);

        this.timeLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this._minSize) return;
            this._isTimeReversed = !this._isTimeReversed;
            Prefs.set('time_reversed', this._isTimeReversed ? 1 : 0);
            this.timeCurrent.classList.toggle('_reversed', this._isTimeReversed && this._minSize);
            this.updateTimeDisplay(this.video.currentTime);
        });

        this.btnExpand.addEventListener('click', (e) => {
            e.stopPropagation();
            this.expand();
        });

        this.btnSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._settingsSublist) {
                this._closeSpeedSublist();
                this.toggleSettings(false);
            } else {
                this.toggleSettings();
            }
        });

        this.settingsMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.videoplayer_settings_menu_list_item');
            if (!item) return;
            const setting = item.dataset.setting;
            if (setting === 'playback_speed') {
                this._openSpeedSublist();
            } else if (setting === 'loop') {
                this.toggleLoop();
            } else if (setting === 'download') {
                this.toggleSettings(false);
                this._downloadVideo();
            }
        });

        this.btnFullscreen.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFullscreen();
        });

        this.tooltip.attach({
            el: this.btnPlay,
            text: () => (this.state === STATES.PLAYING ? vkifyText('player_pause_tip', 'Pause') : vkifyText('player_play_tip', 'Play')),
            offsetY: 9,
        });
        this.tooltip.attach({
            el: this.btnPrev,
            text: () => vkifyText('player_prev_tip', 'Previous'),
            offsetY: 9,
            hideOnClick: true,
        });
        this.tooltip.attach({
            el: this.btnNext,
            text: () => vkifyText('player_next_tip', 'Next'),
            offsetY: 9,
            hideOnClick: true,
        });
        this.tooltip.attach({
            el: this.btnMute,
            text: () => (this._minSize ? '' : (this.isMuted() ? vkifyText('player_unmute_tip', 'Unmute') : vkifyText('player_mute_tip', 'Mute'))),
            offsetY: 9,
        });
        this.tooltip.attach({
            el: this.btnExpand,
            text: () => vkifyText('player_open_popup_tip', 'Open in popup'),
            offsetY: 9,
            hideOnClick: true,
        });
        this.tooltip.attach({
            el: this.btnSettings,
            text: () => (!this.isSettingsOpen() ? vkifyText('player_settings_tip', 'Settings') : ''),
            offsetY: 9,
            hideOnClick: true,
        });
        this.tooltip.attach({
            el: this.btnFullscreen,
            text: () => (this.isFullscreen() ? vkifyText('player_exit_fullscreen_tip', 'Exit fullscreen') : vkifyText('player_fullscreen_tip', 'Fullscreen')),
            offsetY: 9,
            hideOnClick: true,
        });

        this.el.addEventListener('click', (e) => {
            this._lastUserActivity = Date.now();
            if (this.isProcessing) return;
            if (!this.contextMenu.classList.contains('hidden') && !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
                return;
            }
            if (this.isSettingsOpen() && !this.settingsWrap.contains(e.target) && !this.btnSettings.contains(e.target)) {
                this.toggleSettings(false);
            }
            if (this.controlsEl.contains(e.target) || this.contextMenu.contains(e.target) || this.titleLink.contains(e.target)) {
                return;
            }
            if (this._clickTimeout) {
                clearTimeout(this._clickTimeout);
                this._clickTimeout = null;
                return;
            }
            this._clickTimeout = setTimeout(() => {
                this._clickTimeout = null;
                this.togglePlay();
                this.el.focus({ preventScroll: true });
            }, 220);
        });

        this.el.addEventListener('dblclick', (e) => {
            if (this.isProcessing) return;
            if (this.controlsEl.contains(e.target) || this.contextMenu.contains(e.target)) return;
            if (this._clickTimeout) {
                clearTimeout(this._clickTimeout);
                this._clickTimeout = null;
            }
            this.toggleFullscreen();
        });

        this.el.addEventListener('contextmenu', (e) => {
            if (e.target.closest('a')) return;
            if (!this.contextMenu.classList.contains('hidden')) {
                this.hideContextMenu();
                return;
            }
            e.preventDefault();
            this._syncLoopContextMenu();
            const rect = this.el.getBoundingClientRect();
            this.contextMenu.style.maxWidth = `${Math.max(80, rect.width - 16)}px`;
            this.contextMenu.style.maxHeight = `${Math.max(60, rect.height - 16)}px`;
            this.contextMenu.classList.remove('hidden');
            const menuRect = this.contextMenu.getBoundingClientRect();
            let left = e.clientX - rect.left + 1;
            let top = e.clientY - rect.top + 1;
            if (left + menuRect.width > rect.width - 8) left = Math.max(8, rect.width - menuRect.width - 8);
            if (top + menuRect.height > rect.height - 8) top = Math.max(8, rect.height - menuRect.height - 8);
            this.contextMenu.style.left = `${left}px`;
            this.contextMenu.style.top = `${top}px`;
        });

        this.contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('._item');
            if (!item) return;
            const action = item.dataset.action;
            this.hideContextMenu();
            if (action === 'copy_link' && this.videoId) {
                this._copyUrl(`${window.location.origin}${videoPageUrl(this.videoId)}`, vkifyText('link_copied_vk', 'Video link copied'));
            } else if (action === 'copy_timecoded_link' && this.videoId) {
                const t = formatTimeParam(this.video.currentTime);
                this._copyUrl(`${window.location.origin}${videoPageUrl(this.videoId, t)}`, vkifyText('link_copied_time', 'Video link at current time copied'));
            } else if (action === 'copy_direct_link') {
                this._ensureVideoSrc();
                this._copyUrl(this.video.currentSrc || this.video.src || this.src, vkifyText('link_copied_direct', 'Direct video link copied'));
            } else if (action === 'toggle_pip') {
                this.togglePiP();
            } else if (action === 'toggle_loop') {
                this.toggleLoop();
            } else if (action === 'rotate_video') {
                this.rotateVideo(-90);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.el.contains(e.target)) {
                this.hideContextMenu();
                if (this.isSettingsOpen()) this.toggleSettings(false);
            }
        });

        this.el.addEventListener('mouseenter', () => {
            this._mouseInside = true;
            this.showUI();
        });
        this.el.addEventListener('mousemove', () => {
            this._lastUserActivity = Date.now();
            this.showUI();
        });
        this.el.addEventListener('mouseleave', () => {
            this._mouseInside = false;
            if (this.state === STATES.PLAYING && !this.isControlsActive()) {
                this.hideUI();
            }
        });

        this.el.addEventListener('wheel', (e) => {
            if (!this.isFullscreen()) return;
            e.preventDefault();
            const dir = e.deltaY > 0 ? -1 : 1;
            this.setVolume((this.isMuted() ? 0 : this._volume) + dir * VOLUME_STEP, true);
            this._lastUserActivity = Date.now();
            this.showUI();
        }, { passive: false });

        this.el.addEventListener('keydown', (e) => this.onKeyDown(e));
        this.el.addEventListener('keyup', (e) => {
            if (e.keyCode === 32 || e.keyCode === 37 || e.keyCode === 39) {
                e.stopPropagation();
            }
        });
    }

    _downloadVideo() {
        const url = this.video.currentSrc || this.video.src || this.src;
        if (!url || isProcessingUrl(url)) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async _copyUrl(url, msg) {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            syncNotificationsHost();
            window.NewNotification?.('', msg, null, () => {}, 3000, false);
        } catch {
            prompt('URL:', url);
        }
    }

    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
    }

    isSettingsOpen() {
        return !this.settingsMenu.classList.contains('hidden') || Boolean(this._settingsSublist);
    }

    isControlsActive() {
        return this.timelineSlider.dragging || this.volumeSlider.dragging || this.isSettingsOpen();
    }

    _showTimelineTooltip(p) {
        const d = this.getDuration();
        const text = d > 0 ? formatTime(d * p) : (this.durationText || '0:00');
        this.tooltip.show({
            el: this.timelineSlider.el,
            text,
            offsetXpercent: p,
            offsetY: 16,
        });
    }

    setWaiting(waiting) {
        this.waitingEl.style.display = waiting && this.state !== STATES.ERROR ? '' : 'none';
    }

    showProcessingState() {
        this.isProcessing = true;
        this.state = STATES.ERROR;
        this.uiEl.dataset.state = STATES.ERROR;
        this.setWaiting(false);
        this.errorEl.innerHTML = `<div class="_error_msg">`
            + `<div class="pr pr_baw pr_big _error_progress_icon"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>`
            + `<div class="_text">${escapeHtml(vkifyText('player_video_processing', 'This video is being processed and will be available soon.'))}</div>`
            + `</div>`;
        this.errorEl.classList.remove('hidden');
        this.thumbEl.classList.add('hidden');
        this.controlsEl.style.display = 'none';
        this.updateTitleVisibility();
    }

    changeState(nextState) {
        if (this.isProcessing) return;
        if (this.state === nextState && nextState !== STATES.ERROR) return;
        this.state = nextState;
        this.uiEl.dataset.state = nextState;
        if (nextState === STATES.ERROR) {
            this.errorEl.innerHTML = `<div class="_error_msg"><div class="_error_icon"></div><div class="_text">${escapeHtml(vkifyText('player_load_error', 'An error occurred while loading the video.'))}</div></div>`;
            this.errorEl.classList.remove('hidden');
            this.thumbEl.classList.add('hidden');
            this.showUI();
        } else {
            this.errorEl.classList.add('hidden');
        }
        this.updateTitleVisibility();
    }

    getDuration() {
        return Number.isFinite(this.video.duration) && this.video.duration > 0 ? this.video.duration : 0;
    }

    play() {
        this._ensureVideoSrc();
        if (!this._muted) this.video.muted = false;
        if (this.video.ended) this.video.currentTime = 0;
        const p = this.video.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {});
        }
    }

    pause() {
        this.video.pause();
    }

    togglePlay() {
        if (this.video.paused || this.video.ended) {
            this.play();
        } else {
            this.pause();
        }
    }

    seekTo(time, startIfUnstarted = true) {
        this._ensureVideoSrc();
        const d = this.getDuration();
        if (d > 0) {
            const clamped = Math.max(0, Math.min(d, time));
            this.video.currentTime = clamped;
            this.updateTimeDisplay(clamped);
            this.timelineSlider.setFilled(clamped / d);
        }
        if (startIfUnstarted && this.state === STATES.UNSTARTED) {
            this.play();
        }
    }

    seekToPercent(p, startIfUnstarted = true) {
        this._ensureVideoSrc();
        const d = this.getDuration();
        if (d > 0) {
            this.seekTo(d * p, startIfUnstarted);
        } else {
            this._pendingSeekPercent = p;
            this.timelineSlider.setFilled(p);
            if (startIfUnstarted && this.state === STATES.UNSTARTED) {
                this.play();
            }
        }
    }

    seekBy(delta) {
        const d = this.getDuration();
        if (d <= 0) return;
        this.seekTo((this.video.currentTime || 0) + delta, false);
    }

    setVolume(vol, save = true) {
        const v = Math.max(0, Math.min(1, Number(vol) || 0));
        this.video.muted = v === 0;
        if (!document.documentElement.classList.contains('platform-ios')) {
            this.video.volume = v;
        }
        if (v > 0) this._volume = v;
        this._muted = v === 0;
        if (save) Prefs.set('volume', v);
        this.updateVolumeUI(v);
    }

    toggleMute() {
        if (this.isMuted()) {
            const restore = this._volume > 0 ? this._volume : 0.75;
            this.setVolume(restore, true);
        } else {
            const prev = this._volume;
            this.setVolume(0, true);
            this._volume = prev > 0 ? prev : 0.75;
        }
    }

    isMuted() {
        return Boolean(this._muted || this.video.muted || this.video.volume === 0);
    }

    updateVolumeUI(vol) {
        if (!this.volumeSlider.dragging) {
            this.volumeSlider.setFilled(vol);
        }
        const level = vol > 0.5 ? 'max' : vol > 0.2 ? 'mid' : vol > 0 ? 'min' : 'off';
        this.btnMuteIcon.setAttribute('data-value', level);
    }

    toggleLoop(force) {
        const next = force !== undefined ? Boolean(force) : !this.video.loop;
        this.video.loop = next;
        this._syncLoopContextMenu();
        if (next && this.video.ended) {
            this.video.currentTime = 0;
            this.play();
        }
        return next;
    }

    setPlaybackRate(rate) {
        this.video.playbackRate = rate;
        const valNode = this.settingsMenu?.querySelector('._speed_val');
        if (valNode) valNode.textContent = this._getPlaybackRateLabel(rate);
    }

    rotateVideo(deg = -90) {
        this._rotateAlpha = (this._rotateAlpha + deg) % 360;
        const ratio = (this.video.videoWidth && this.video.videoHeight)
            ? (this.video.videoWidth / this.video.videoHeight)
            : (16 / 9);
        const scale = this._rotateAlpha % 180 ? (1 / ratio) : 1;
        this.mediaWrap.style.transform = this._rotateAlpha
            ? `rotate(${this._rotateAlpha}deg) scale(${scale})`
            : '';
    }

    togglePiP() {
        const v = this.video;
        if (document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {});
            else v.requestPictureInPicture().catch(() => {});
        } else if (typeof v.webkitSetPresentationMode === 'function') {
            v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        }
    }

    expand() {
        if (!this.videoId) return;
        const curTime = this.video.currentTime || 0;
        const wasPlaying = !this.video.paused && !this.video.ended;
        this.pause();
        window.__vkifyExpandedVideoState = {
            videoId: this.videoId,
            time: curTime,
            autoplay: wasPlaying,
            ts: Date.now(),
        };
        const openLink = this.hostEl.closest('.attachment')?.querySelector('#videoOpen');
        if (openLink) {
            openLink.click();
        } else {
            const url = videoPageUrl(this.videoId, curTime > 0 ? formatTimeParam(curTime) : null);
            if (window.router?.route) {
                window.router.route(url);
            } else {
                window.location.href = url;
            }
        }
    }

    isFullscreen() {
        return getFullscreenElement() === this.el;
    }

    toggleFullscreen() {
        if (!isFullscreenEnabled()) return;
        if (this.isFullscreen()) {
            exitFullscreen();
        } else {
            requestFullscreen(this.el);
        }
    }

    onFullscreenChange() {
        const fs = this.isFullscreen();
        this.uiEl.classList.toggle('_fullscreen', fs);
        if (!fs) this.el.style.cursor = '';
        this.updateTitleVisibility();
        this.resize();
    }

    updateTitleVisibility() {
        const show = Boolean(this.titleText) && this.isFullscreen() && this.state !== STATES.ERROR;
        this.titleEl.style.display = show ? '' : 'none';
    }

    updateDurationDisplay() {
        const d = this.getDuration();
        if (d > 0) {
            this.timeDuration.textContent = formatTime(d);
            this.updateTimeWidth();
        }
    }

    updateTimeDisplay(cur) {
        const d = this.getDuration();
        if (d > 0 && !this.timelineSlider.dragging) {
            this.timelineSlider.setFilled(cur / d);
        }
        const displaySec = (this._minSize && this._isTimeReversed && d > 0) ? Math.max(0, d - cur) : cur;
        this.timeCurrent.textContent = formatTime(displaySec);
    }

    updateTimeWidth() {
        const d = this.getDuration();
        if (d <= 0) return;
        const curText = this.timeCurrent.textContent;
        const mask = formatTime(d).replace(/\d/g, '8');
        this.timeLabel.style.minWidth = '';
        this.timeCurrent.textContent = mask;
        const w = this.timeLabel.offsetWidth;
        if (w > 0) this.timeLabel.style.minWidth = `${w}px`;
        this.timeCurrent.textContent = curText;
    }

    updateBuffered() {
        const d = this.getDuration();
        const buf = this.video.buffered;
        if (!d || !buf || !buf.length) return;
        const cur = this.video.currentTime || 0;
        let end = cur;
        for (let i = 0; i < buf.length; i++) {
            if (buf.end(i) <= cur) continue;
            if (buf.start(i) - cur > 30) break;
            end = buf.end(i);
        }
        this.timelineSlider.setLoaded(end / d);
    }

    startTimelineAnimation() {
        if (this._rafId) return;
        const tick = () => {
            if (!this.el.isConnected) {
                this.destroy();
                return;
            }
            if (!this._controlsHidden && this.state === STATES.PLAYING && !this.timelineSlider.dragging) {
                const d = this.getDuration();
                if (d > 0) {
                    this.timelineSlider.setFilled((this.video.currentTime || 0) / d);
                }
            }
            if (this.state === STATES.PLAYING) {
                this._rafId = requestAnimationFrame(tick);
            } else {
                this._rafId = null;
            }
        };
        this._rafId = requestAnimationFrame(tick);
    }

    stopTimelineAnimation() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    hideUI({ hideCursor = true, noTransition = false } = {}) {
        if (this._controlsHidden) return;
        if (noTransition) {
            this.uiEl.classList.add('no_transition');
            requestAnimationFrame(() => this.uiEl.classList.remove('no_transition'));
        }
        this.controlsEl.classList.add('hidden');
        this.titleEl.classList.add('hidden');
        this.el.style.cursor = (hideCursor && this.isFullscreen()) ? 'none' : '';
        this._controlsHidden = true;
    }

    showUI() {
        if (!this._controlsHidden) return;
        this.controlsEl.classList.remove('hidden');
        this.titleEl.classList.remove('hidden');
        this.el.style.cursor = '';
        this._controlsHidden = false;
        if (this.state === STATES.PLAYING) {
            this.startTimelineAnimation();
        }
    }

    checkUserActivity() {
        if (!this.el.isConnected) {
            this.destroy();
            return;
        }
        if (this._controlsHidden || this.state !== STATES.PLAYING) return;
        if (this._mouseInside && !this.isFullscreen()) return;
        if (Date.now() - this._lastUserActivity <= INACTIVITY_HIDE_MS) return;
        if (this.isControlsActive() || this.controlsEl.matches(':hover')) return;
        this.hideUI({ hideCursor: this.isFullscreen() });
    }

    resize() {
        const rect = this.el.getBoundingClientRect();
        const w = rect.width;
        if (!w) return;
        const isMin = Boolean(this.el.closest('.ovk-msg-minimized'));
        this.uiEl.classList.toggle('_minimized', isMin);

        const hasPlaylist = this._hasPlaylistQueue();
        if (this.btnPrev) this.btnPrev.style.display = hasPlaylist ? '' : 'none';
        if (this.btnNext) this.btnNext.style.display = hasPlaylist ? '' : 'none';

        this._minSize = w < 550;
        this.timeLabel.style.cursor = this._minSize ? 'pointer' : '';
        this.timeDuration.style.display = this._minSize ? 'none' : '';
        this.timeCurrent.classList.toggle('_reversed', this._isTimeReversed && this._minSize);
        this.updateTimeDisplay(this.video.currentTime || 0);
        this.updateTimeWidth();

        this.volumeContainer.style.padding = this._minSize ? '0' : '';
        this.volumeSlider.setVertical(this._minSize);
        this.volumeSlider.toggleVisibility(!this._minSize);
        this._constrainSettingsMenuBounds();
        if (!this.contextMenu.classList.contains('hidden')) {
            this.contextMenu.style.maxWidth = `${Math.max(80, rect.width - 16)}px`;
            this.contextMenu.style.maxHeight = `${Math.max(60, rect.height - 16)}px`;
        }
    }

    onKeyDown(e) {
        if (e.ctrlKey || e.metaKey) return;
        const code = e.keyCode;
        if (code === 9) {
            this.uiEl.classList.add('_keyboard_focus');
        } else if (code === 32 || code === 13) {
            e.preventDefault();
            e.stopPropagation();
            this.togglePlay();
        } else if (code === 37 || code === 39) {
            e.preventDefault();
            e.stopPropagation();
            const dir = code === 39 ? 1 : -1;
            const step = e.altKey ? FRAME_STEP_SECONDS : SEEK_STEP_SECONDS;
            if (e.altKey && !this.video.paused) this.pause();
            this.seekBy(dir * step);
        } else if (code === 38 || code === 40) {
            e.preventDefault();
            e.stopPropagation();
            const dir = code === 38 ? 1 : -1;
            this.setVolume((this.isMuted() ? 0 : this._volume) + dir * VOLUME_STEP, true);
        } else if (code === 70 && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFullscreen();
        } else if (code === 77 && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMute();
        } else {
            return;
        }
        this._lastUserActivity = Date.now();
        this.tooltip.hide();
        this.showUI();
    }

    destroy() {
        clearInterval(this._activityInterval);
        this.stopTimelineAnimation();
        this.timelineSlider?.destroy();
        this.volumeSlider?.destroy();
        this._ro?.disconnect();
        window.removeEventListener('resize', this._onWindowResize);
        document.removeEventListener('fullscreenchange', this._onFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
        VKVideoPlayer._instances.delete(this);
    }
}

VKVideoPlayer._instances = new Set();

function initVideoPlayerElement(el) {
    if (!el || el._vkVideoPlayer) return;
    const bsdnHydrated = el.querySelector('.bdsn-hydrated');
    if (bsdnHydrated) {
        const innerVideo = bsdnHydrated.querySelector('video');
        if (innerVideo) el.replaceChildren(innerVideo);
    }
    const video = el.querySelector('video');
    if (!video) return;
    el._vkVideoPlayer = new VKVideoPlayer(el);
}

function hydrateAllVideoPlayers() {
    document.querySelectorAll('#playerHtml .video_processing_error').forEach(span => {
        const holder = span.parentElement;
        if (!holder) return;
        const wrap = document.createElement('div');
        wrap.className = 'bsdn media';
        wrap.dataset.processing = '1';
        wrap.innerHTML = '<video class="media"></video>';
        holder.replaceChildren(wrap);
    });
    document.querySelectorAll('.bsdn').forEach(initVideoPlayerElement);
}

window.VKVideoPlayer = VKVideoPlayer;
window.bsdnInitElement = initVideoPlayerElement;
window.bsdnHydrate = hydrateAllVideoPlayers;

hydrateAllVideoPlayers();
vkify.onPage(hydrateAllVideoPlayers);

if (typeof MutationObserver === 'function') {
    let hydrateScheduled = false;
    const scheduleHydrate = () => {
        if (hydrateScheduled) return;
        hydrateScheduled = true;
        requestAnimationFrame(() => {
            hydrateScheduled = false;
            hydrateAllVideoPlayers();
        });
    };
    const mo = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
            const added = mutations[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
                const node = added[j];
                if (node.nodeType !== 1) continue;
                if (node.classList?.contains('bsdn') || node.classList?.contains('video_processing_error') || node.querySelector?.('.bsdn, .video_processing_error')) {
                    scheduleHydrate();
                    return;
                }
            }
        }
    });
    if (document.body) {
        mo.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) mo.observe(document.body, { childList: true, subtree: true });
        });
    }
}

})();
