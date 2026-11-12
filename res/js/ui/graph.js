
(() => {
    'use strict';

    if (window.Graph) {
        return;
    }
    const document = window.document;
    const resolveElement = el => typeof el === 'string' ? document.getElementById(el) : el;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[ch]);
    const replaceEntities = value => {
        const node = document.createElement('textarea');
        node.innerHTML = value;
        return node.value;
    };
    const setStyle = (el, styles) => Object.assign(resolveElement(el).style, styles);
    const measureElement = el => {
        const rect = resolveElement(el).getBoundingClientRect();
        return [rect.width, rect.height];
    };
    const getPagePosition = el => {
        const rect = resolveElement(el).getBoundingClientRect();
        return [rect.left + window.scrollX, rect.top + window.scrollY];
    };
    const isVisible = el => !!resolveElement(el) && getComputedStyle(resolveElement(el)).display !== 'none';
    const show = el => {
        if (resolveElement(el)) {
            resolveElement(el).style.display = 'block';
        }
    };
    const hide = el => {
        if (resolveElement(el)) {
            resolveElement(el).style.display = 'none';
        }
    };
    const detachElement = el => {
        el.remove();
        return el;
    };
    const createElement = (tag, props = {}, styles = {}) => {
        const el = document.createElement(tag);
        Object.assign(el, props);
        setStyle(el, styles);
        return el;
    };
    const cancelEvent = event => {
        if (event?.cancelable) {
            event.preventDefault();
        }
        event?.stopPropagation?.();
        return false;
    };
    const locale = window.openvk?.locale || document.documentElement.lang || navigator.language;
    const translate = (key, fallback) => {
        const value = typeof window.tr === 'function' ? window.tr(key) : null;
        return value && value !== key && value !== '@' + key ? value : fallback;
    };
    const pluralRules = new Intl.PluralRules(locale);
    const dateFormatters = new Map();
    const langNumeric = (value, forms) => escapeHtml(Array.isArray(forms) ? forms[pluralRules.select(value) === 'one' ? 0 : forms.length - 1] : forms).replace('{count}', formatValue(value));
    const theme = {};
    function updateTheme() {
        const style = getComputedStyle(document.body);
        theme.background = style.getPropertyValue('--page-background-color').trim() || '#ffffff';
        theme.plot = style.getPropertyValue('--background-color--secondary').trim() || theme.background;
        theme.grid = style.getPropertyValue('--border-color').trim() || '#e6eaf0';
        theme.text = style.getPropertyValue('--text-color--secondary').trim() || '#36638e';
        theme.border = style.getPropertyValue('--border-color').trim() || '#b8c5d4';
    }
    updateTheme();
    const DRAG_CURSOR = 'pointer',
        DRAG2_CURSOR = 'pointer';
    const MINUTE = 60,
        HOUR = 60 * MINUTE,
        DAY = 24 * HOUR,
        MONTH = 28 * DAY,
        YEAR = 365 * DAY;
    const xscales = [{
        base: HOUR,
        format: ['hour'],
        sub: -1
    }, {
        base: 2 * HOUR,
        format: ['hour'],
        sub: HOUR
    }, {
        base: 3 * HOUR,
        format: ['hour'],
        sub: HOUR
    }, {
        base: 6 * HOUR,
        format: ['dayHour'],
        sub: HOUR
    }, {
        base: 8 * HOUR,
        format: ['dayHour'],
        sub: HOUR
    }, {
        base: 12 * HOUR,
        format: ['dayHour'],
        sub: HOUR
    }, {
        base: DAY,
        format: ['dayFull', 'day'],
        sub: -1
    }, {
        base: 2 * DAY,
        format: ['dayFull', 'day'],
        sub: DAY
    }, {
        base: 3 * DAY,
        format: ['dayFull', 'day'],
        sub: DAY
    }, {
        base: 4 * DAY,
        format: ['dayFull', 'day'],
        sub: DAY
    }, {
        base: MONTH,
        format: ['monthFull', 'month'],
        sub: -1
    }, {
        base: 2 * MONTH,
        format: ['monthFull', 'month'],
        sub: MONTH
    }, {
        base: 3 * MONTH,
        format: ['monthFull', 'month'],
        sub: MONTH
    }, {
        base: 4 * MONTH,
        format: ['monthFull', 'month'],
        sub: MONTH
    }, {
        base: 6 * MONTH,
        format: ['monthFull', 'month'],
        sub: MONTH
    }, {
        base: YEAR,
        format: ['yearFull'],
        sub: -1
    }];
    const DEF_TIME = Math.round(new Date().getTime() / 1000);
    const colors = [0x597da3, 0xb05c91, 0x4d9fab, 0x569567, 0xac4c4c, 0xc9c255, 0xcd9f4d, 0x876db3, 0x6f9fc4, 0xc77bb1, 0x70c5c8, 0x80bb88, 0xce5e5e, 0xe8e282, 0xedb24a, 0xae97d3, 0x6391bc, 0xc77bb1, 0x62b1bc, 0x80bb88, 0xb75454, 0xc9c255, 0xdca94f, 0x997fc4, 0x85afd0, 0xc77bb1, 0x8ecfce, 0x80bb88, 0xe47070, 0xc9c255, 0xf7be5a, 0xbeaadf];
    let pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    function moveTo(ctx, x, y) {
        ctx.moveTo(pixelRatio * x, pixelRatio * y);
    }
    function lineTo(ctx, x, y) {
        ctx.lineTo(pixelRatio * x, pixelRatio * y);
    }
    function lineWidth(ctx, lw) {
        ctx.lineWidth = pixelRatio * lw;
    }
    function clearRect(ctx, x, y, w, h) {
        ctx.clearRect(pixelRatio * x, pixelRatio * y, pixelRatio * w, pixelRatio * h);
    }
    function fillRect(ctx, x, y, w, h) {
        ctx.fillRect(pixelRatio * x, pixelRatio * y, pixelRatio * w, pixelRatio * h);
    }
    function strokeRect(ctx, x, y, w, h) {
        ctx.strokeRect(pixelRatio * x, pixelRatio * y, pixelRatio * w, pixelRatio * h);
    }
    function fillText(ctx, text, x, y, max_w) {
        if (typeof max_w !== 'undefined') {
            ctx.fillText(text, pixelRatio * x, pixelRatio * y, pixelRatio * max_w);
        } else {
            ctx.fillText(text, pixelRatio * x, pixelRatio * y);
        }
    }
    function arc(ctx, x, y, r, sa, ea, ccw) {
        ctx.arc(pixelRatio * x, pixelRatio * y, pixelRatio * r, sa, ea, ccw);
    }
    function bezierCurveTo(ctx, cp1x, cp1y, cp2x, cp2y, x, y) {
        ctx.bezierCurveTo(pixelRatio * cp1x, pixelRatio * cp1y, pixelRatio * cp2x, pixelRatio * cp2y, pixelRatio * x, pixelRatio * y);
    }
    function setCanvasWidth(canvas, w) {
        canvas.width = pixelRatio * w;
        canvas.style.width = w + "px";
    }
    function setCanvasHeight(canvas, h) {
        canvas.height = pixelRatio * h;
        canvas.style.height = h + "px";
    }
    function getCanvasFont(size, orig) {
        if (!orig) {
            size = pixelRatio * size;
        }
        return size + 'px Open Sans, tahoma, arial, verdana, sans-serif, Lucida Sans';
    }
    function fullDate(time, params) {
        let fmt = 'dayFullYear';
        if (params) {
            if (params.show_time) {
                fmt = params.show_minutes ? 'dayHourMin' : 'dayHour';
            } else if (params.only_month) {
                fmt = 'monthFull';
            }
        }
        return formatDate(time, fmt);
    }
    function formatDate(time, format) {
        const options = {
            hour: {
                hour: 'numeric',
                minute: '2-digit'
            },
            day: {
                day: 'numeric',
                month: 'short'
            },
            dayFull: {
                day: 'numeric',
                month: 'long'
            },
            dayFullYear: {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            },
            dayHour: {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric'
            },
            dayHourMin: {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            },
            month: {
                month: 'short',
                year: '2-digit'
            },
            monthFull: {
                month: 'long',
                year: 'numeric'
            },
            year: {
                year: '2-digit'
            },
            yearFull: {
                year: 'numeric'
            }
        };
        if (!dateFormatters.has(format)) {
            dateFormatters.set(format, new Intl.DateTimeFormat(locale, options[format]));
        }
        return dateFormatters.get(format).format(time === -1 ? new Date(2000, 8, 28, 23, 59) : new Date(time * 1000));
    }
    function incDate(time, step, inc) {
        let count;
        let date = new Date(time * 1000);
        if (step >= YEAR) {
            count = step / YEAR;
            date = new Date((Math.floor(date.getFullYear() / count) + inc) * count, 0, 1, 0, 0);
            return Math.floor(date.getTime() / 1000);
        } else if (step < YEAR && step >= MONTH) {
            count = step / MONTH;
            date = new Date(date.getFullYear(), (Math.floor(date.getMonth() / count) + inc) * count, 1, 0, 0);
            return Math.floor(date.getTime() / 1000);
        } else if (step < MONTH) {
            if (step >= DAY) {
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + inc * (step / DAY));
                return Math.floor(date.getTime() / 1000);
            }
            const tz = date.getTimezoneOffset() * 60;
            return Math.floor((time - tz) / step + inc) * step + tz;
        }
    }
    function getContext(e) {
        const ctx = e.getContext("2d");
        if (!ctx) {
            return ctx;
        }
        if (!ctx.measureText) {
            return null;
        }
        return ctx;
    }
    function getFirstControlPoints(rhs) {
        let i;
        let n = rhs.length,
            x = [],
            tmp = [],
            b = 2.0;
        x[0] = rhs[0] / b;
        for (i = 1; i < n; i++) {
            tmp[i] = 1 / b;
            b = (i < n - 1 ? 4.0 : 3.5) - tmp[i];
            x[i] = (rhs[i] - x[i - 1]) / b;
        }
        for (i = 1; i < n; i++) {
            x[n - i - 1] -= tmp[n - i] * x[n - i];
        }
        return x;
    }
    function getYStep(maxValue, intScale) {
        if (!Number.isFinite(maxValue) || maxValue <= 0) {
            return 1;
        }
        let step = Math.pow(10, Math.floor(Math.LOG10E * Math.log(maxValue)));
        if (maxValue / step <= 2) {
            step /= 4.0;
        } else if (maxValue / step <= 4) {
            step /= 2.0;
        }
        if (intScale) {
            step = Math.max(step, 1);
            if (step == 2.5) {
                step = 2;
            }
        }
        return step;
    }
    function formatValue(value) {
        // something like -10 000 000.000001
        if (!Number.isFinite(value)) {
            return '0';
        }
        const sgn = value < 0 ? '-' : '';
        value = Math.abs(value);
        let intv = Math.floor(value),
            fltv = value - intv;
        fltv = Math.round(fltv * 100000.0) / 100000.0;
        let res = '';
        while (intv > 0) {
            const q = (intv % 1000).toString();
            res = (intv > 999 ? '000'.slice(0, 3 - q.length) : '') + q + (res == '' ? '' : ' ') + res;
            intv = Math.floor(intv / 1000);
        }
        if (res == '') {
            res = '0';
        }
        if (fltv > 0) {
            res += fltv.toString().slice(1);
        }
        return sgn + res;
    }
    function drawCheck(e, color, color2, checked, over) {
        const ctx = getContext(e);
        clearRect(ctx, 0, 0, 20, 20);
        if (checked) {
            lineWidth(ctx, 2);
            ctx.strokeStyle = color2;
            ctx.beginPath();
            moveTo(ctx, 6.5, 11);
            lineTo(ctx, 9.5, 14);
            lineTo(ctx, 17.5, 6);
            ctx.stroke();
        }
        if (over) {
            ctx.fillStyle = color2;
            fillRect(ctx, 3, 3, 14, 14);
        }
        lineWidth(ctx, 1);
        ctx.strokeStyle = color;
        strokeRect(ctx, 3.5, 3.5, 13, 13);
        if (checked) {
            lineWidth(ctx, 2);
            ctx.beginPath();
            moveTo(ctx, 6.5, 10);
            lineTo(ctx, 9.5, 13);
            lineTo(ctx, 17.5, 5);
            ctx.stroke();
        }
    }
    function drawLines(ctx, x, y, w, h, lines, stTime, enTime, xfactor, yfactor, yDelta, zoomedOut, active, smooth) {
        let l, stIdx, enIdx, i, xs1, ys1, xs2, ys2, cy, px, cx, ps, py;
        smooth = !zoomedOut && smooth;
        const stIdxs = [],
            enIdxs = [],
            _lines = [];
        for (l = 0; l < lines.length + (active ? 1 : 0); l++) {
            const line = l < lines.length ? active != lines[l] ? lines[l] : null : active;
            if (line && line.shown) {
                stIdx = 0, enIdx = line.d.length - 1;
                while (stIdx < line.d.length - 2 && line.d[stIdx + 2].x < stTime) {
                    stIdx++;
                }
                while (enIdx > 2 && line.d[enIdx - 2].x > enTime) {
                    enIdx--;
                }
                if (enIdx - stIdx > w / 5) {
                    smooth = false;
                }
                if (enIdx >= stIdx && line.d[enIdx].x >= stTime && line.d[stIdx].x <= enTime) {
                    _lines.push(line);
                    stIdxs.push(stIdx);
                    enIdxs.push(enIdx);
                }
            }
        }
        lines = _lines;
        for (l = 0; l < lines.length; l++) {
            stIdx = stIdxs[l], enIdx = enIdxs[l], ps = lines[l].d;
            if (smooth && enIdx - stIdx + 1 > 2) {
                let knots = [],
                    n = 0;
                for (i = stIdx; i <= enIdx; i++) {
                    knots[n] = {
                        X: x + (ps[i].x - stTime) * xfactor,
                        Y: y + h - (ps[i].y + yDelta) * yfactor
                    };
                    n++;
                }
                n--;
                const rhs = [];
                for (i = 1; i < n - 1; ++i) {
                    rhs[i] = 4 * knots[i].X + 2 * knots[i + 1].X;
                }
                rhs[0] = knots[0].X + 2 * knots[1].X;
                rhs[n - 1] = (8 * knots[n - 1].X + knots[n].X) / 2.0;
                xs1 = getFirstControlPoints(rhs);
                for (i = 1; i < n - 1; ++i) {
                    rhs[i] = 4 * knots[i].Y + 2 * knots[i + 1].Y;
                }
                rhs[0] = knots[0].Y + 2 * knots[1].Y;
                rhs[n - 1] = (8 * knots[n - 1].Y + knots[n].Y) / 2.0;
                ys1 = getFirstControlPoints(rhs), xs2 = [], ys2 = [];
                for (i = 0; i < n; ++i) {
                    if (i < n - 1) {
                        xs2[i] = 2 * knots[i + 1].X - xs1[i + 1];
                        ys2[i] = 2 * knots[i + 1].Y - ys1[i + 1];
                    } else {
                        xs2[i] = (knots[n].X + xs1[n - 1]) / 2;
                        ys2[i] = (knots[n].Y + ys1[n - 1]) / 2;
                    }
                }
            }
            if (lines[l].f && stIdx < enIdx) {
                ctx.globalAlpha = active == null || active != lines[l] ? 0.2 : 0.4;
                ctx.fillStyle = lines[l].hexColor;
                ctx.strokeStyle = lines[l].hexColor;
                lineWidth(ctx, zoomedOut ? 1 : 2);
                if (lines[l].b) {
                    for (i = stIdx; i <= enIdx; i++) {
                        const cx1 = Math.floor(x + ((i > stIdx ? (ps[i - 1].x + ps[i].x) / 2 : ps[i].x) - stTime) * xfactor);
                        const cx2 = Math.floor(x + ((i < enIdx ? (ps[i].x + ps[i + 1].x) / 2 : ps[i].x) - stTime) * xfactor);
                        cy = (ps[i].y + yDelta) * yfactor;
                        fillRect(ctx, cx1, y + h - cy, cx2 - cx1, ps[i].y * yfactor);
                    }
                } else {
                    ctx.beginPath();
                    px = x + (ps[stIdx].x - stTime) * xfactor;
                    moveTo(ctx, px, y + h - yDelta * yfactor);
                    for (i = stIdx; i <= enIdx; i++) {
                        cx = x + (ps[i].x - stTime) * xfactor;
                        if (smooth && i > stIdx && enIdx - stIdx + 1 > 2) {
                            bezierCurveTo(ctx, Math.min(Math.max(px, xs1[i - stIdx - 1]), cx), Math.min(y + h, Math.max(ys1[i - stIdx - 1], 0)), Math.min(Math.max(px, xs2[i - stIdx - 1]), cx), Math.min(y + h, Math.max(ys2[i - stIdx - 1], 0)), cx, y + h - (ps[i].y + yDelta) * yfactor);
                        } else {
                            lineTo(ctx, cx, y + h - (ps[i].y + yDelta) * yfactor);
                        }
                        px = cx;
                    }
                    lineTo(ctx, px, y + h - yDelta * yfactor);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = lines[l].hexColor;
            lineWidth(ctx, zoomedOut ? 1 : 2);
            ctx.beginPath();
            px = x + (ps[stIdx].x - stTime) * xfactor, py = y + h - (ps[stIdx].y + yDelta) * yfactor;
            moveTo(ctx, px, py);
            if (lines[l].b) {
                for (i = stIdx; i <= enIdx; i++) {
                    cx = Math.floor(x + ((i < enIdx ? (ps[i].x + ps[i + 1].x) / 2 : ps[i].x) - stTime) * xfactor);
                    cy = y + h - (ps[i].y + yDelta) * yfactor;
                    lineTo(ctx, cx, cy);
                    if (i < enIdx) {
                        if (zoomedOut) {
                            lineTo(ctx, cx, y + h - (ps[i + 1].y + yDelta) * yfactor);
                        } else {
                            ctx.stroke();
                            ctx.beginPath();
                            moveTo(ctx, cx, y + h - (ps[i + 1].y + yDelta) * yfactor);
                        }
                    }
                }
            } else {
                for (i = stIdx + 1; i <= enIdx; i++) {
                    cx = x + (ps[i].x - stTime) * xfactor, cy = y + h - (ps[i].y + yDelta) * yfactor;
                    if (ps[i].s == 'x') {
                        ctx.stroke();
                        ctx.beginPath();
                        moveTo(ctx, cx, cy);
                    } else {
                        if (ps[i].s == '-' || ps[i].s == '--' || ps[i].s == '.') {
                            ctx.stroke();
                            ctx.globalAlpha = 0.3;
                            ctx.beginPath();
                            moveTo(ctx, px, py);
                        }
                        if (smooth && i > stIdx && enIdx - stIdx + 1 > 2) {
                            bezierCurveTo(ctx, Math.min(Math.max(px, xs1[i - stIdx - 1]), cx), Math.min(y + h, Math.max(ys1[i - stIdx - 1], 0)), Math.min(Math.max(px, xs2[i - stIdx - 1]), cx), Math.min(y + h, Math.max(ys2[i - stIdx - 1], 0)), cx, y + h - (ps[i].y + yDelta) * yfactor);
                        } else {
                            lineTo(ctx, cx, y + h - (ps[i].y + yDelta) * yfactor);
                        }
                        if (ctx.globalAlpha != 1) {
                            ctx.stroke();
                            ctx.beginPath();
                            moveTo(ctx, cx, cy);
                        }
                    }
                    ctx.globalAlpha = 1;
                    px = cx;
                    py = cy;
                }
            }
            ctx.stroke();
            if (smooth || enIdx - stIdx < 2 && !zoomedOut) {
                ctx.strokeStyle = lines[l].hexColor;
                ctx.fillStyle = theme.background;
                lineWidth(ctx, 2);
                for (i = stIdx; i <= enIdx; i++) {
                    ctx.beginPath();
                    arc(ctx, x + (ps[i].x - stTime) * xfactor, y + h - (ps[i].y + yDelta) * yfactor, 3.5, 0, Math.PI * 2, true);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
    }
    function drawBars(ctx, x, y, w, h, lines, labels, barW, xfactor, yfactor, yDelta) {
        for (let l = 0; l < lines.length; l++) {
            const ps = lines[l].d;
            for (let i = 0; i < ps.length; i++) {
                if (!labels[ps[i].x]) {
                    continue;
                }
                const cx = Math.floor(getBarXValue(x, xfactor, barW, l, ps[i].x));
                const baseline = y + h - yDelta * yfactor;
                const cy = baseline - ps[i].y * yfactor;
                ctx.fillStyle = lines[l].hexColor;
                fillRect(ctx, cx, Math.floor(Math.min(baseline, cy)), barW, Math.max(2, Math.ceil(Math.abs(ps[i].y * yfactor))));
            }
        }
    }
    function getBarXValue(xOffset, xStep, barsWidth, lineIndex, barIndex) {
        return xOffset + barsWidth / 2 + lineIndex * barsWidth + barIndex * xStep;
    }
    function clearSelection() {
        window.getSelection()?.removeAllRanges();
    }
    function dataObjectToArray(data) {
        return Object.values(data);
    }
    function normalizeData(data) {
        return dataObjectToArray(data || []).map(series => ({
            ...series,
            name: String(series.name ?? ''),
            d: (series.d || []).map(point => ({
                x: Number(point.x ?? point[0]),
                y: Number(point.y ?? point[1] ?? 0),
                s: point.s ?? point[2] ?? null,
                l: point.l ?? point[3] ?? null
            })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).sort((a, b) => a.x - b.x)
        }));
    }
    class Graph {
        constructor(id, data, params = {}, width = 585, height = 385) {
            this.destroyed = false;
            this.listeners = new AbortController();
            this.seriesEvents = new AbortController();
            this.lineByElement = new WeakMap();
            this.pixelRatio = pixelRatio;
            params = {
                ...params
            };
            width = width ? width : 585;
            height = height ? height : 385;
            Object.assign(this, {
                params: params,
                width: width,
                height: height,
                viewWidth: width,
                viewHeight: height - 80
            });
            this.params.yunits = this.params.yunits || '';
            this.graphDiv = resolveElement(id);
            if (!this.graphDiv) {
                throw new TypeError('Graph requires a container element');
            }
            this.createLayout();
            const defaultGraph = this.createMenu(params.multiple);
            if (params.multiple && typeof params.multiple === 'object') {
                params.multiple = true;
            }
            Object.assign(this, {
                colMax: [0, 0],
                lines: [],
                leftTime: -1,
                rightTime: -1,
                ymarks: [],
                ystep: 0,
                minValue: 100,
                maxValue: 0,
                minTime: Infinity,
                maxTime: 0,
                dragTime: [],
                startDrag: -1,
                startDrag2: -1,
                startValue: -1,
                startValue2: -1,
                endValue: -1,
                dragElement: null,
                maskDragging: false,
                viewClick: false,
                smoothLines: false,
                scaleWidth: 0,
                activeLine: null,
                isNegative: false
            });
            if (!getContext(this.zinView)) {
                this.message.textContent = translate('error', 'Canvas rendering is unavailable');
                this.message.style.display = 'block';
                return;
            }
            if (!params.bar_chart) {
                this.listen(this.lHandle, 'pointerdown', this.takeHandle);
                this.listen(this.rHandle, 'pointerdown', this.takeHandle);
                this.listen(this.zoutWindow, 'pointerdown', this.takeWindow);
                this.listen(this.lMask, 'pointerdown', this.takeMask);
                this.listen(this.rMask, 'pointerdown', this.takeMask);
                this.listen(this.zinLayout, 'pointerdown', this.takeView);
                this.listen(this.zinLayout, 'wheel', this.wheelView, {
                    passive: false
                });
                this.listen(this.zoutLayout, 'wheel', this.wheelView, {
                    passive: false
                });
            } else {
                this.listen(this.dotsLayer, 'pointerdown', this.showDots);
            }
            this.listen(this.dotsLayer, 'pointermove', event => {
                if (event.isPrimary) {
                    this.showDots(event);
                }
            });
            this.listen(this.zinLayout, 'pointerleave', event => {
                if (!this.pointerCapture) {
                    this.hideDots(event);
                }
            });
            this.listen(this.dotsLayer, 'pointerup pointercancel', event => {
                if (event.pointerType !== 'touch') {
                    return;
                }
                clearTimeout(this.touchTimer);
                this.touchTimer = setTimeout(() => {
                    if (!this.destroyed) {
                        this.hideDots({
                            pageX: -Infinity,
                            pageY: -Infinity
                        });
                    }
                }, 1500);
            });
            this.listen(window, 'resize', () => {
                const ratio = Math.max(1, window.devicePixelRatio || 1);
                if (ratio === this.pixelRatio) {
                    return;
                }
                this.pixelRatio = pixelRatio = ratio;
                this.resize(this.width);
            });
            this.datasets = data;
            this.loadGraph(defaultGraph);
            this.observeSize();
        }
        createLegend(line, bar) {
            line.legendRow = createElement('div', {
                className: 'vk_graph_legend_row'
            });
            line.legendRow.style.setProperty('--graph-color', line.hexColor);
            const legend = createElement(bar ? 'div' : 'button', {
                className: 'vk_graph_legend_toggle'
            });
            if (!bar) legend.type = 'button';
            const check = createElement('canvas');
            check.setAttribute('aria-hidden', 'true');
            setCanvasWidth(check, 20);
            setCanvasHeight(check, 20);
            const label = createElement('span', {
                textContent: line.name,
                title: line.name
            });
            const value = createElement('span', {
                className: 'vk_graph_legend_value'
            });
            value.style.display = 'none';
            legend.append(check, label, value);
            line.legendRow.append(legend);
            if (!bar && this.params.download_csv) {
                const download = createElement('button', {
                    type: 'button',
                    textContent: '.csv',
                    className: 'vk_graph_csv'
                });
                download.title = window.vkifylang?.graph_download_csv || 'Download CSV';
                download.setAttribute('aria-label', line.name + ': ' + download.title);
                line.legendDownloadCSV = download;
                line.legendRow.append(download);
            }
            return legend;
        }
        listen(element, names, callback, options = {}) {
            for (const name of names.split(' ')) {
                element.addEventListener(name, event => {
                    if (callback.call(this, event) === false) {
                        cancelEvent(event);
                    }
                }, {
                    signal: this.listeners.signal,
                    ...options
                });
            }
        }
        listenSeries(element, names, callback) {
            this.listen(element, names, callback, {
                signal: this.seriesEvents.signal
            });
        }
        beginDrag(event, callback) {
            if (this.disable_zoom || !event.isPrimary || event.button !== 0 || this.pointerCapture) {
                return false;
            }
            this.dragEvents = new AbortController();
            this.pointerCapture = {
                element: event.currentTarget,
                id: event.pointerId
            };
            if (event.currentTarget.isConnected && event.pointerId > 0) {
                try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                } catch {}
            }
            const options = {
                signal: this.dragEvents.signal,
                passive: false
            };
            this.listen(document, 'pointermove', move => {
                if (move.pointerId === event.pointerId) {
                    return callback.call(this, move);
                }
            }, options);
            this.listen(document, 'pointerup pointercancel', end => {
                if (end.pointerId === event.pointerId) {
                    this.endDrag(end);
                }
            }, options);
            this.listen(event.currentTarget, 'lostpointercapture', this.endDrag, options);
            return true;
        }
        createLayout() {
            const parts = {
                vScale: ['div', 'vk_graph_scale'],
                vScaleView: ['canvas', ''],
                mainLayout: ['div', 'vk_graph_main'],
                menu: ['div', 'vk_graph_menu'],
                title: ['div', 'vk_graph_title'],
                zinLayout: ['div', 'vk_graph_view'],
                zinView: ['canvas', ''],
                dotsLayer: ['canvas', 'vk_graph_dots'],
                message: ['div', 'vk_graph_message'],
                zoutLayout: ['div', 'vk_graph_overview'],
                zoutView: ['canvas', ''],
                lMask: ['div', 'vk_graph_mask vk_graph_mask_left'],
                zoutWindow: ['div', 'vk_graph_window'],
                rMask: ['div', 'vk_graph_mask vk_graph_mask_right'],
                select: ['div', 'vk_graph_selection'],
                lHandle: ['div', 'vk_graph_handle vk_graph_handle_left'],
                rHandle: ['div', 'vk_graph_handle vk_graph_handle_right'],
                tooltipAnchor: ['span', 'vk_graph_tooltip_anchor']
            };
            for (const [name, [tag, className]] of Object.entries(parts)) {
                this[name] = createElement(tag, {
                    className
                });
            }
            this.column = [createElement('div', {
                className: 'vk_graph_legend'
            }), createElement('div', {
                className: 'vk_graph_legend'
            })];
            this.vScale.append(this.vScaleView);
            this.zinLayout.append(this.zinView, this.dotsLayer, this.message, this.tooltipAnchor);
            this.zoutLayout.append(this.zoutView, this.lMask, this.zoutWindow, this.rMask, this.select, this.lHandle, this.rHandle);
            this.mainLayout.append(this.menu, this.title, this.zinLayout, this.zoutLayout, ...this.column);
            this.graphDiv.replaceChildren(this.vScale, this.mainLayout);
            this.graphDiv.classList.add('vk_graph');
            this.graphDiv.setAttribute('role', 'group');
            this.message.textContent = translate('no_data', 'No data');
            setCanvasHeight(this.zoutView, 40);
        }
        createMenu(multiple) {
            if (!multiple || typeof multiple !== 'object') {
                return 0;
            }
            const selected = multiple.def ?? 0;
            const add = (label, context, active) => {
                const item = createElement('button', {
                    type: 'button',
                    className: 'graph_menu_item',
                    textContent: label
                });
                item.classList.toggle('graph_menu_item_sel', active);
                this.listen(item, 'click', event => this.onClickMenu(event, {
                    graph: this,
                    ...context
                }));
                this.menu.append(item);
            };
            (multiple.items || []).forEach((label, index) => add(label, {
                clickNode: index
            }, index === selected));
            if (multiple.graph_item) {
                add(multiple.graph_item, {
                    clickNode: multiple.items.length,
                    alt_graph: true
                }, false);
            }
            (multiple.altitems || []).forEach(([label, force_func], index) => add(label, {
                clickNode: index,
                force_func
            }, false));
            return selected;
        }
        loadGraph(index = 0) {
            const data = typeof this.datasets === 'string' || !this.params.multiple ? this.datasets : this.datasets[index] || [];
            this.setData(data, Array.isArray(this.params.adjust) ? this.params.adjust[index] : this.params.adjust);
        }
        observeSize() {
            this.resizeObserver = new ResizeObserver(() => {
                const width = Math.floor(this.graphDiv.getBoundingClientRect().width);
                if (width > 0 && width !== this.width) {
                    cancelAnimationFrame(this.resizeFrame);
                    this.resizeFrame = requestAnimationFrame(() => this.resize(width));
                }
            });
            this.resizeObserver.observe(this.graphDiv);
            this.themeObserver = new MutationObserver(() => {
                updateTheme();
                this.resize(this.width);
            });
            this.themeObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
        resize(width, height = this.height) {
            if (this.destroyed) {
                return;
            }
            this.hideDots({
                pageX: -Infinity,
                pageY: -Infinity
            });
            this.width = Math.max(120, Math.floor(width));
            this.height = height;
            const range = [this.leftTime, this.rightTime];
            const data = this.lines.map(line => ({
                name: line.name,
                c: line.c,
                f: line.f,
                b: line.b,
                a: line.shown,
                l: line.l,
                sum: line.sum,
                no_legend: line.no_legend,
                d: line.d.map(point => ({
                    ...point
                }))
            }));
            this.setData(data, this.adjust);
            if (!this.params.bar_chart && range[0] >= this.minTime && range[1] <= this.maxTime) {
                [this.leftTime, this.rightTime] = range;
                this.updateLines();
            }
        }
        getXValue(pageX, view) {
            return view ? (pageX - getPagePosition(this.zinView)[0]) / this.xfactorIn + this.leftTime : (pageX - getPagePosition(this.zoutView)[0]) / this.xfactorOut + this.minTime;
        }
        allowZoom(zoom_allowed) {
            this.zoutLayout.style.display = zoom_allowed ? 'block' : 'none';
            this.viewHeight = this.height - (zoom_allowed ? 80 : 40);
            this.zinLayout.style.height = this.viewHeight + "px";
            setCanvasHeight(this.zinView, this.viewHeight);
            setCanvasHeight(this.dotsLayer, this.viewHeight - 17);
            this.disable_zoom = !zoom_allowed;
        }
        showEmpty(no_data) {
            if (no_data) {
                this.allowZoom(false);
            }
            setStyle(this.message, {
                display: no_data ? 'block' : 'none',
                left: Math.round((this.viewWidth - measureElement(this.message)[0]) / 2) + 'px',
                top: Math.round((this.viewHeight - measureElement(this.message)[1]) / 2) + 'px'
            });
        }
        overrideCursor(cursor) {
            document.body.style.cursor = cursor || '';
            this.lHandle.style.cursor = cursor ? cursor : 'w-resize';
            this.rHandle.style.cursor = cursor ? cursor : 'e-resize';
            this.zoutWindow.style.cursor = cursor ? cursor : DRAG_CURSOR;
        }
        takeHandle(event) {
            if (!this.beginDrag(event, this.dragHandle)) {
                return;
            }
            this.startDrag = event.pageX;
            this.startValue = event.currentTarget === this.lHandle ? this.leftTime : this.rightTime;
            this.dragElement = event.currentTarget;
            this.hideDots(event);
            this.overrideCursor(getComputedStyle(this.dragElement).cursor);
            return cancelEvent(event);
        }
        takeWindow(event) {
            if (!this.beginDrag(event, this.dragWindow)) {
                return;
            }
            this.startDrag = event.pageX;
            this.startValue = this.leftTime;
            this.hideDots(event);
            this.overrideCursor(DRAG2_CURSOR);
            return cancelEvent(event);
        }
        takeMask(event) {
            if (!this.beginDrag(event, this.dragMask)) {
                return;
            }
            this.dragElement = event.currentTarget;
            this.startValue = (event.pageX - getPagePosition(this.zoutLayout)[0]) / this.xfactorOut + this.minTime;
            this.endValue = this.startValue;
            this.hideDots(event);
            return cancelEvent(event);
        }
        takeView(event) {
            if (!event.isPrimary || event.button !== 0) {
                return;
            }
            if (this.disable_zoom) {
                this.deselectLine(event);
                return;
            }
            if (!this.beginDrag(event, this.dragView)) {
                return;
            }
            this.dragTime[0] = this.getXValue(event.pageX, true);
            this.viewClick = true;
            this.startDrag = event.pageX;
            this.showDots(event);
            if (event.pointerType === 'mouse') {
                this.overrideCursor(DRAG2_CURSOR);
            }
        }
        dragHandle(ev) {
            const g = this;
            const xfactorOut = g.viewWidth / (g.maxTime - g.minTime);
            if (g.dragElement == g.lHandle) {
                g.leftTime = Math.max(g.minTime, Math.min(g.rightTime - g.MAXSCALE, g.startValue - (g.startDrag - ev.pageX) / xfactorOut));
            } else {
                g.rightTime = Math.min(g.maxTime, Math.max(g.leftTime + g.MAXSCALE, g.startValue - (g.startDrag - ev.pageX) / xfactorOut));
            }
            g.redrawWindow();
            return false;
        }
        dragWindow(ev) {
            const g = this;
            let xfactorOut = g.viewWidth / (g.maxTime - g.minTime),
                diff = g.leftTime - (g.startValue - (g.startDrag - ev.pageX) / xfactorOut);
            diff = Math.max(diff, g.rightTime - g.maxTime);
            diff = Math.min(diff, g.leftTime - g.minTime);
            g.leftTime -= diff;
            g.rightTime -= diff;
            g.redrawWindow();
            return false;
        }
        dragMask(ev) {
            const g = this;
            const xfactorOut = g.viewWidth / (g.maxTime - g.minTime);
            g.endValue = (ev.pageX - getPagePosition(g.dragElement.parentNode)[0]) / xfactorOut + g.minTime;
            const lpos = (Math.max(g.minTime, Math.min(g.startValue, g.endValue)) - g.minTime) * xfactorOut,
                rpos = (Math.min(g.maxTime, Math.max(g.startValue, g.endValue)) - g.minTime) * xfactorOut;
            if (!g.maskDragging && rpos - lpos > 4) {
                g.select.style.display = 'block';
                g.maskDragging = true;
            }
            g.select.style.left = lpos + "px";
            g.select.style.width = rpos - lpos - 2 + "px";
            return false;
        }
        dragView(ev) {
            const g = this;
            let diff = (ev.pageX - getPagePosition(g.zoutView)[0]) / g.xfactorIn + g.leftTime - g.dragTime[0];
            diff = Math.max(diff, g.rightTime - g.maxTime);
            diff = Math.min(diff, g.leftTime - g.minTime);
            g.leftTime -= diff;
            g.rightTime -= diff;
            if (Math.abs(ev.pageX - g.startDrag) > 4) {
                g.viewClick = false;
            }
            g.redrawWindow();
            g.showDots(ev);
            return g.viewClick;
        }
        endDrag(event) {
            if (!this.dragEvents) {
                return;
            }
            this.dragEvents.abort();
            this.dragEvents = null;
            const capture = this.pointerCapture;
            this.pointerCapture = null;
            if (capture?.element.hasPointerCapture(capture.id)) {
                capture.element.releasePointerCapture(capture.id);
            }
            this.select.style.display = 'none';
            this.overrideCursor();
            const cancelled = !event || event.type === 'pointercancel' || event.type === 'lostpointercapture';
            if (!cancelled && this.endValue !== -1) {
                if (this.maskDragging) {
                    this.leftTime = Math.min(this.startValue, this.endValue);
                    this.rightTime = Math.min(this.maxTime, Math.max(this.startValue, this.endValue, this.leftTime + this.MAXSCALE));
                    this.leftTime = Math.max(this.minTime, Math.min(this.leftTime, this.rightTime - this.MAXSCALE));
                } else {
                    const span = this.rightTime - this.leftTime;
                    this.leftTime = Math.max(this.minTime, Math.min(this.endValue - span / 2, this.maxTime - span));
                    this.rightTime = this.leftTime + span;
                }
            }
            if (!this.destroyed) {
                if (this.viewClick && !cancelled) {
                    this.deselectLine(event);
                } else {
                    this.redrawWindow();
                }
            }
            this.endValue = -1;
            this.maskDragging = false;
            this.viewClick = false;
            this.dragTime = [];
        }
        wheelView(ev) {
            let g = this,
                delta = -ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? g.viewHeight : 1),
                dist = g.rightTime - g.leftTime,
                diffL = delta * dist / 3500,
                diffR;
            if (g.disable_zoom) {
                return;
            }
            if (g.lines.length == 0) {
                return;
            }
            diffL = Math.min(diffL, (dist - g.MAXSCALE) / 2);
            diffR = Math.max(g.minTime - g.leftTime - diffL, 0);
            g.leftTime = Math.max(g.minTime, g.leftTime + diffL);
            g.rightTime = Math.min(g.maxTime, g.rightTime + diffR);
            g.redrawWindow();
            g.showDots(ev);
            return cancelEvent(ev);
        }
        overLegend(ev) {
            const line = this.lineByElement.get(ev.currentTarget);
            drawCheck(line.legendCheck, line.hexColor, line.hexColor2, line.shown, true);
        }
        outLegend(ev) {
            const line = this.lineByElement.get(ev.currentTarget);
            drawCheck(line.legendCheck, line.hexColor, line.hexColor2, line.shown, false);
        }
        toggleLegendByIndex(graph, line_index, flag) {
            if (graph.lines[line_index] !== void 0) {
                const line = graph.lines[line_index];
                line.shown = flag;
                drawCheck(line.legendCheck, line.hexColor, line.hexColor2, line.shown, true);
                graph.updateLines();
                clearSelection();
            }
        }
        toggleLegend(ev) {
            let g = this,
                line = this.lineByElement.get(ev.currentTarget),
                noneShown = true;
            for (let l = 0; l < g.lines.length; l++) {
                if (g.lines[l] != line && g.lines[l].shown) {
                    noneShown = false;
                }
            }
            line.shown = noneShown || !line.shown;
            drawCheck(line.legendCheck, line.hexColor, line.hexColor2, line.shown, true);
            g.updateLines();
            clearSelection();
            return cancelEvent(ev);
        }
        chooseLegend(ev) {
            let l;
            let g = this,
                line = this.lineByElement.get(ev.currentTarget),
                onlyThis = line.shown;
            if (onlyThis) {
                for (l = 0; l < g.lines.length; l++) {
                    if (g.lines[l] != line && g.lines[l].shown) {
                        onlyThis = false;
                        break;
                    }
                }
            }
            for (l = 0; l < g.lines.length; l++) {
                g.lines[l].shown = onlyThis || g.lines[l] == line;
                drawCheck(g.lines[l].legendCheck, g.lines[l].hexColor, g.lines[l].hexColor2, g.lines[l].shown, g.lines[l] == line);
            }
            g.updateLines();
            clearSelection();
            return cancelEvent(ev);
        }
        downloadCSV(ev) {
            const line = this.lineByElement.get(ev.currentTarget);
            const cell = value => '"' + String(value).replace(/"/g, '""') + '"';
            const rows = [[window.vkifylang?.graph_date || 'Date', line.name]];
            for (const point of line.d) {
                const date = new Date(point.x * 1000);
                rows.push([date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'), point.y]);
            }
            const blob = new Blob(['\ufeff', rows.map(row => row.map(cell).join(';')).join('\r\n')], {
                type: 'text/csv;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const link = createElement('a', {
                href: url,
                download: line.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) + '.csv'
            });
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return cancelEvent(ev);
        }
        showDots(ev) {
            let l;
            const g = this;
            if (g.params.bar_chart) {
                g.highlightBar(ev);
                return;
            }
            if (g.XSTEP >= MONTH) {
                g.params.only_month = true;
            } else {
                g.params.only_month = false;
            }
            let nearTime = -1,
                nnd = 0,
                cx = g.getXValue(ev.pageX, true);
            const ccx = ev.pageX - getPagePosition(g.zinView)[0],
                ccy = ev.pageY - getPagePosition(g.zinView)[1];
            let activeLine = -1;
            const ctx = getContext(g.dotsLayer);
            clearRect(ctx, 0, 0, g.viewWidth, g.viewHeight);
            for (l = 0; l < g.lines.length; l++) {
                let ni = -1,
                    nd = 0;
                if (g.lines[l].shown) {
                    for (let i = g.lines[l].stIdx; i <= g.lines[l].enIdx; i++) {
                        if (g.lines[l].d[i].x >= g.leftTime && g.lines[l].d[i].x <= g.rightTime && (ni == -1 || nd > Math.abs(g.lines[l].d[i].x - cx))) {
                            ni = i;
                            nd = Math.abs(g.lines[l].d[i].x - cx);
                        }
                    }
                }
                if (ni > -1) {
                    const dot = g.lines[l].d[ni],
                        dotX = (dot.x - g.leftTime) * g.xfactorIn,
                        dotY = g.viewHeight - (g.isNegative ? 34 + (dot.y - g.localBottom) * g.yfactorIn : 25 + (dot.y - (g.adjust ? g.localBottom : 0)) * g.yfactorIn);
                    g.lines[l].hover.x = dotX;
                    g.lines[l].hover.y = dotY;
                    if (ccx >= dotX - 7 && ccx <= dotX + 9 && ccy >= dotY - 7 && ccy <= dotY + 9) {
                        activeLine = l;
                    }
                    if (nearTime == -1 || nd < nnd) {
                        nnd = nd;
                        nearTime = g.lines[l].d[ni].x;
                    }
                    ctx.fillStyle = g.lines[l].hexColor;
                    ctx.beginPath();
                    arc(ctx, dotX, dotY, 3, 0, Math.PI * 2, true);
                    ctx.fill();
                    if (!isVisible(g.lines[l].dotLabel) || !g.lines[l].hover.point || g.lines[l].hover.point.x != dot.x || parseInt(g.lines[l].dot.style.left) != Math.floor(dotX)) {
                        g.lines[l].dotLabel.textContent = dot.l ? dot.l : formatValue(dot.y) + g.params.yunits;
                        const labelW = measureElement(g.lines[l].dotLabel)[0];
                        const pos = Math.max(Math.min(-labelW / 2.0, -labelW + g.viewWidth - dotX - 2), 2 - dotX);
                        g.lines[l].hover.point = dot;
                        g.lines[l].hover.labelX = Math.floor(pos);
                        g.lines[l].hover.labelWidth = labelW;
                        setStyle(g.lines[l].dot, {
                            left: Math.floor(dotX) + "px",
                            top: Math.floor(dotY) + "px"
                        });
                        setStyle(g.lines[l].dotLabel, {
                            top: (g.lines[l].hover.y > 26 ? -26 : 6) + "px",
                            left: g.lines[l].hover.labelX + "px"
                        });
                    }
                    g.lines[l].legendBox.textContent = formatValue(dot.y) + g.params.yunits;
                    g.lines[l].legendBox.style.display = 'block';
                } else {
                    g.lines[l].legendBox.style.display = 'none';
                }
            }
            if (!g.smoothLines || !window.tooltips) {
                activeLine = -1;
            }
            for (l = 0; l < g.lines.length; l++) {
                if (!g.lines[l].shown) {
                    hide(g.lines[l].dot);
                    continue;
                }
                if (activeLine == l) {
                    g.showDotTT(l);
                } else if (activeLine == -1) {
                    if (g.activeLine == null || g.activeLine == g.lines[l]) {
                        show(g.lines[l].dot);
                    } else {
                        hide(g.lines[l].dot);
                    }
                } else {
                    hide(g.lines[l].dot);
                }
            }
            if (activeLine == -1 && window.tooltips) {
                tooltips.hide(g.tooltipAnchor, {
                    fasthide: 1
                });
            }
            if (nearTime > -1 && isVisible(g.title)) {
                g.title.textContent = fullDate(nearTime, g.params);
            }
        }
        hideDots(ev) {
            const g = this,
                vwPos = getPagePosition(g.zinView);
            if (ev.pageX >= vwPos[0] && ev.pageX < vwPos[0] + g.viewWidth && ev.pageY >= vwPos[1] && ev.pageY < vwPos[1] + g.viewHeight) {
                return;
            }
            for (let l = 0; l < g.lines.length; l++) {
                hide(g.lines[l].dot);
                if (g.lines[l].sum) {
                    g.lines[l].legendBox.textContent = formatValue(g.lines[l].sum) + g.params.yunits;
                } else {
                    hide(g.lines[l].legendBox);
                }
            }
            const ctx = getContext(g.dotsLayer);
            clearRect(ctx, 0, 0, g.viewWidth, g.viewHeight);
            const params = {};
            if (g.XSTEP >= MONTH) {
                params.only_month = true;
            }
            g.title.textContent = fullDate(g.localLeft, params) + (g.localRight > g.localLeft ? ' \u2013 ' + fullDate(g.localRight, params) : '');
            if (window.tooltips) {
                tooltips.hide(g.tooltipAnchor, {
                    fasthide: 1
                });
            }
        }
        highlightBar(ev) {
            let l, baseline;
            const g = this;
            const cx = ev.pageX - getPagePosition(g.zinView)[0];
            const cy = ev.pageY - getPagePosition(g.zinView)[1];
            const ctx = getContext(g.dotsLayer);
            clearRect(ctx, 0, 0, g.viewWidth, g.viewHeight);
            let activeLine = -1,
                activeBar = -1;
            for (l = 0; l < g.lines.length; l++) {
                for (let i = 0; i < g.lines[l].d.length; i++) {
                    const nx = getBarXValue(0, g.xstep, g.barsWidth, l, g.lines[l].d[i].x);
                    const ny = g.viewHeight - (g.isNegative ? 34 + (g.lines[l].d[i].y - g.localBottom) * g.yfactorIn : 25 + (g.lines[l].d[i].y - (g.adjust ? g.localBottom : 0)) * g.yfactorIn);
                    baseline = g.viewHeight - (g.isNegative ? 34 : 25) + g.localBottom * g.yfactorIn;
                    if (cx > nx && cx <= nx + g.barsWidth && cy >= Math.min(ny, baseline) && cy <= Math.max(ny, baseline)) {
                        activeLine = l;
                        activeBar = i;
                        break;
                    }
                }
            }
            for (l = 0; l < g.lines.length; l++) {
                if (activeBar > -1) {
                    const dot = g.lines[l].d.find(point => point.x === g.lines[activeLine].d[activeBar].x);
                    if (!dot) {
                        hide(g.lines[l].legendBox);
                        continue;
                    }
                    const dotX = getBarXValue(0, g.xstep, g.barsWidth, l, dot.x),
                        dotY = g.viewHeight - (g.isNegative ? 34 + (dot.y - g.localBottom) * g.yfactorIn : 25 + (dot.y - (g.adjust ? g.localBottom : 0)) * g.yfactorIn),
                        val = formatValue(dot.y) + g.params.yunits;
                    if (activeLine == l) {
                        ctx.fillStyle = g.lines[l].hexColor3;
                        baseline = g.viewHeight - (g.isNegative ? 34 : 25) + g.localBottom * g.yfactorIn;
                        fillRect(ctx, dotX, Math.min(dotY, baseline), g.barsWidth, Math.abs(baseline - dotY));
                        g.showTT(dotX, dotY, dot.l ? escapeHtml(dot.l) : val + '<br>' + escapeHtml(g.lines[l].name) + ', ' + escapeHtml(g.params.bar_chart[activeBar]));
                        g.lines[l].legendBox.style.display = 'block';
                        g.lines[l].legendBox.textContent = val;
                    } else {
                        g.lines[l].legendBox.style.display = 'block';
                        g.lines[l].legendBox.textContent = val;
                    }
                } else if (g.lines[l].sum) {
                    g.lines[l].legendBox.textContent = formatValue(g.lines[l].sum) + g.params.yunits;
                } else {
                    g.lines[l].legendBox.style.display = 'none';
                }
            }
            if (activeBar == -1 && window.tooltips) {
                tooltips.hide(g.tooltipAnchor, {
                    fasthide: 1
                });
            }
        }
        expandLabel(ev) {
            const g = this,
                line = this.lineByElement.get(ev.currentTarget),
                dot = line.hover.point,
                pos = line.hover.labelX;
            if (!g.smoothLines) {
                let text = '';
                if (line.l) {
                    text += langNumeric(dot.y, line.l, true);
                } else {
                    text += escapeHtml((dot.l ? dot.l : formatValue(dot.y)) + ' ' + line.name);
                }
                line.dotLabel.innerHTML = text;
                const sz = measureElement(line.dotLabel)[0];
                if (pos + sz + line.hover.x > g.viewWidth) {
                    line.dotLabel.textContent = line.name + ' ' + (dot.l ? dot.l : formatValue(dot.y));
                    line.dotLabel.style.left = pos - (sz - line.hover.labelWidth) + "px";
                } else {
                    line.dotLabel.style.left = pos + "px";
                }
                for (let l = 0; l < g.lines.length; l++) {
                    g.lines[l].dotLabel.style.zIndex = g.lines[l] == line ? 1000 : 100;
                }
            }
            return cancelEvent(ev);
        }
        chideLabel(ev) {
            const g = this,
                line = this.lineByElement.get(ev.currentTarget),
                locX = ev.pageX - (getPagePosition(line.dot)[0] + line.hover.labelX);
            if (locX < 0 || locX > line.hover.labelWidth) {
                g.hideLabel(ev);
            }
        }
        hideLabel(ev) {
            const g = this,
                line = this.lineByElement.get(ev.currentTarget),
                dot = line.hover.point,
                pos = line.hover.labelX;
            line.dotLabel.textContent = dot.l ? dot.l : formatValue(dot.y) + g.params.yunits;
            line.dotLabel.style.left = pos + "px";
        }
        selectLine(ev) {
            const g = this,
                line = this.lineByElement.get(ev.currentTarget);
            g.activeLine = line;
            g.redrawWindow();
            g.showDots(ev);
            return cancelEvent(ev);
        }
        deselectLine(ev) {
            this.activeLine = null;
            this.redrawWindow();
            this.showDots(ev);
            return cancelEvent(ev);
        }
        showDotTT(lineIndex) {
            if (!this.smoothLines) {
                return;
            }
            if (this.ttLine != lineIndex && window.tooltips) {
                tooltips.hide(this.tooltipAnchor, {
                    fasthide: 1
                });
            }
            const line = this.lines[lineIndex],
                dot = line.hover.point;
            let text = '';
            if (line.l) {
                text += langNumeric(dot.y, line.l, true);
            } else {
                text += (dot.l ? escapeHtml(dot.l) : formatValue(dot.y)) + escapeHtml(this.params.yunits) + ' \u2013 ' + escapeHtml(line.name);
            }
            text += '<br/><span style="font-weight: normal; font-size: 0.9em;">' + fullDate(dot.x, this.params) + '</span>';
            for (let l = 0; l < this.lines.length; l++) {
                hide(this.lines[l].dot);
            }
            this.showTT(line.hover.x + 1, line.hover.y - 5, text);
            this.ttLine = lineIndex;
            const ctx = getContext(this.dotsLayer);
            ctx.strokeStyle = line.hexColor;
            ctx.globalAlpha = 0.3;
            lineWidth(ctx, 4);
            ctx.beginPath();
            arc(ctx, line.hover.x, line.hover.y, 6.5, 0, Math.PI * 2, true);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        showTT(dotX, dotY, text) {
            setStyle(this.tooltipAnchor, {
                left: dotX + (this.params.bar_chart ? this.barsWidth / 2 : 0) + 'px',
                top: dotY + 'px'
            });
            window.showTooltip?.(this.tooltipAnchor, {
                text,
                black: true,
                html: true,
                center: true,
                nohide: true,
                nohideover: true,
                shift: [0, 8, 8],
                showsp: 0
            });
        }
        onClickMenu(event, context) {
            if (context.force_func) {
                context.force_func.call(this, event);
                return cancelEvent(event);
            }
            for (const item of this.menu.children) {
                item.classList.toggle('graph_menu_item_sel', item === event.currentTarget);
            }
            const alternative = resolveElement(this.graphDiv.id.replace(/_graph$/, '') + '_alt_graph');
            if (context.alt_graph) {
                this.hiddenLayouts = [...this.mainLayout.children].filter(element => element !== this.menu && isVisible(element));
                this.hiddenLayouts.forEach(hide);
                hide(this.vScale);
                this.mainLayout.style.width = this.viewWidth + this.scaleWidth + 'px';
                show(alternative);
            } else {
                hide(alternative);
                this.hiddenLayouts?.forEach(show);
                this.hiddenLayouts = [];
                this.loadGraph(context.clickNode);
                this.mainLayout.style.width = this.viewWidth + 'px';
            }
            return cancelEvent(event);
        }
        updateLines() {
            this.lines.forEach(line => {
                if (line.legend) {
                    line.legend.setAttribute('aria-pressed', String(line.shown));
                }
            });
            this.redrawWindow();
            const ctx = getContext(this.zoutView);
            clearRect(ctx, 0, 0, this.viewWidth, 40);
            if (this.isNegative) {
                drawLines(ctx, 0, 4, this.viewWidth, 32, this.lines, this.minTime, this.maxTime, this.xfactorOut, this.yfactorOut, -this.localBottom, true, null, false);
            } else {
                drawLines(ctx, 0, 4, this.viewWidth, 36, this.lines, this.minTime, this.maxTime, this.xfactorOut, this.yfactorOut, 0, true, null, false);
            }
        }
        redrawWindow() {
            let i, sc, tm, ax;
            this.xfactorOut = this.viewWidth / (this.maxTime - this.minTime);
            this.xfactorIn = this.viewWidth / (this.rightTime - this.leftTime);
            let leftOut = Math.round((this.leftTime - this.minTime) * this.xfactorOut),
                rightOut = Math.round((this.rightTime - this.minTime) * this.xfactorOut) - 1;
            leftOut = Math.min(leftOut, this.viewWidth - 4);
            rightOut = Math.max(leftOut + 1, rightOut);
            setStyle(this.lMask, {
                width: leftOut + "px",
                display: leftOut > 0 ? "block" : "none"
            });
            setStyle(this.zoutWindow, {
                left: leftOut + "px",
                width: rightOut - leftOut - 1 + "px"
            });
            setStyle(this.rMask, {
                left: rightOut + 1 + "px",
                width: this.viewWidth - rightOut - 2 + "px",
                display: this.viewWidth - rightOut - 2 > 0 ? "block" : "none"
            });
            this.lHandle.style.left = Math.max(0, leftOut - 4) + "px";
            this.rHandle.style.left = Math.min(this.viewWidth - 8, rightOut - 4) + "px";
            let localMax = this.adjust ? -1e9 : 0,
                localMin = this.adjust ? 1e9 : 0,
                outMax = 0,
                outMin = 0,
                dotsVisible = 0;
            this.localLeft = this.rightTime;
            this.localRight = this.leftTime;
            for (let l = 0; l < this.lines.length; l++) {
                const line = this.lines[l];
                if (line.shown) {
                    let stIdx = 0,
                        enIdx = line.d.length - 1,
                        ps = line.d;
                    while (stIdx < ps.length - 1 && ps[stIdx + 1].x < this.leftTime) {
                        stIdx++;
                    }
                    while (enIdx > 1 && ps[enIdx - 1].x > this.rightTime) {
                        enIdx--;
                    }
                    line.stIdx = stIdx;
                    line.enIdx = enIdx;
                    if (enIdx >= stIdx && ps[enIdx].x >= this.leftTime && ps[stIdx].x <= this.rightTime) {
                        for (i = stIdx; i <= enIdx; i++) {
                            localMax = Math.max(localMax, ps[i].y);
                            localMin = Math.min(localMin, ps[i].y);
                            this.localLeft = Math.min(this.localLeft, ps[i].x);
                            this.localRight = Math.max(this.localRight, ps[i].x);
                        }
                        dotsVisible = Math.max(dotsVisible, enIdx - stIdx);
                    }
                    outMax = Math.max(outMax, line.maxValue);
                    outMin = Math.min(outMin, line.minValue);
                }
            }
            if (this.lines.length == 0 || localMax - localMin < 1e-6) {
                this.isNegative = false;
                this.ystep = 1;
                this.localTop = 5;
                this.localBottom = 0;
            } else {
                this.isNegative = localMin < -1e-6;
                this.ystep = Math.max(getYStep(localMax - (this.adjust ? localMin : 0), this.params.int_scale), this.isNegative ? getYStep(-localMin, this.params.int_scale) : 1e-6);
                this.localTop = Math.ceil(localMax / this.ystep) * this.ystep;
                this.localBottom = -Math.ceil(-localMin / this.ystep) * this.ystep;
            }
            this.yfactorIn = (this.viewHeight - (this.isNegative ? 43 : 34)) / (this.localTop - this.localBottom);
            this.yfactorOut = this.minValue < -1e-6 ? 32 / Math.max(1, outMax - outMin) : 36 / Math.max(1, outMax);
            this.smoothLines = dotsVisible < 30 ? true : false;
            const params = {};
            if (this.XSTEP >= MONTH) {
                params.only_month = true;
            }
            this.title.textContent = fullDate(this.localLeft, params) + (this.localRight > this.localLeft ? ' \u2013 ' + fullDate(this.localRight, params) : '');
            const ctx = getContext(this.zinView);
            const ctxS = getContext(this.vScaleView);
            clearRect(ctx, 0, 0, this.viewWidth, this.viewHeight);
            ctx.fillStyle = theme.plot;
            fillRect(ctx, 0, 9, this.viewWidth, this.viewHeight - 9);
            clearRect(ctxS, 0, 0, this.scaleWidth, this.viewHeight);
            lineWidth(ctx, 1);
            ctx.strokeStyle = theme.grid;
            ctxS.font = getCanvasFont(11);
            ctxS.fillStyle = theme.text;
            ctxS.textAlign = 'right';
            ctxS.textBaseline = 'middle';
            for (let gridY = this.localBottom; gridY < this.localTop + this.ystep; gridY += this.ystep) {
                const cy = this.viewHeight - 24.5 - Math.round((gridY - this.localBottom) * this.yfactorIn) - (this.isNegative ? 9 : 0);
                if (gridY < this.localTop) {
                    ctx.strokeStyle = this.isNegative && Math.abs(gridY) < 1e-8 ? theme.border : theme.grid;
                    ctx.beginPath();
                    moveTo(ctx, 0, cy);
                    lineTo(ctx, this.viewWidth, cy);
                    ctx.stroke();
                }
                fillText(ctxS, formatValue(gridY) + this.params.yunits, this.scaleWidth - 6, cy);
            }
            ctx.fillStyle = theme.background;
            fillRect(ctx, 0, this.viewHeight - 25, this.viewWidth, 25);
            ctx.fillStyle = theme.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            let fin = false;
            const i_start = this.params.show_time || this.params.show_minutes ? 0 : 6;
            for (i = i_start; i < 100 && !fin; i++) {
                if (i < xscales.length) {
                    sc = xscales[i];
                } else {
                    const yearCnt = [2, 5, 10][(i - xscales.length + 1) % 3] * Math.pow(10, Math.floor((i - xscales.length + 1) / 3));
                    sc = {
                        base: yearCnt * YEAR,
                        format: ['yearFull'],
                        sub: Math.max(1, yearCnt / 10) * YEAR
                    };
                }
                const baseWidth = sc.base * this.xfactorIn;
                for (let j = 0; j < sc.format.length; j++) {
                    ctx.font = getCanvasFont(11, true);
                    const formatWidth = ctx.measureText(formatDate(-1, sc.format[j])).width;
                    if (formatWidth < baseWidth) {
                        const sTm = incDate(this.leftTime, sc.base, -2);
                        const eTm = incDate(this.rightTime, sc.base, 2);
                        ctx.strokeStyle = theme.grid;
                        if (sc.sub != -1) {
                            for (tm = sTm; tm <= eTm; tm = incDate(tm, sc.sub, 1)) {
                                ax = Math.floor((tm - this.leftTime) * this.xfactorIn) + 0.5;
                                ctx.beginPath();
                                moveTo(ctx, ax, this.viewHeight - 24);
                                lineTo(ctx, ax, this.viewHeight - 22);
                                ctx.stroke();
                            }
                        }
                        for (tm = sTm; tm <= eTm; tm = incDate(tm, sc.base, 1)) {
                            if (incDate(tm, sc.base, 1) < tm + HOUR) {
                                throw new Error('Date axis failed to advance');
                            }
                            ax = Math.floor((tm - this.leftTime) * this.xfactorIn) + 0.5;
                            ctx.beginPath();
                            moveTo(ctx, ax, 9);
                            lineTo(ctx, ax, this.viewHeight - 24);
                            ctx.stroke();
                            ctx.beginPath();
                            moveTo(ctx, ax, this.viewHeight - 24);
                            if (sc.sub == -1) {
                                lineTo(ctx, ax, this.viewHeight);
                            } else {
                                lineTo(ctx, ax, this.viewHeight - 20);
                            }
                            ctx.stroke();
                            let textpos = ax;
                            if (sc.sub == -1) {
                                textpos += baseWidth / 2.0;
                            }
                            if (textpos - formatWidth / 2.0 > 0 && textpos + formatWidth / 2.0 < this.viewWidth) {
                                ctx.font = getCanvasFont(11);
                                fillText(ctx, replaceEntities(formatDate(tm, sc.format[j])), textpos, this.viewHeight - 19);
                            }
                        }
                        fin = true;
                        break;
                    }
                }
                if (fin) {
                    break;
                }
            }
            ctx.strokeStyle = theme.grid;
            lineWidth(ctx, 1);
            strokeRect(ctx, 0, this.viewHeight - 24.5, this.viewWidth - 1, 26);
            ctx.strokeStyle = theme.grid;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            moveTo(ctx, 1, this.viewHeight - 25.5);
            lineTo(ctx, this.viewWidth, this.viewHeight - 25.5);
            ctx.stroke();
            ctx.globalAlpha = 1;
            if (this.isNegative) {
                drawLines(ctx, 0, 9, this.viewWidth, this.viewHeight - 43, this.lines, this.leftTime, this.rightTime, this.xfactorIn, this.yfactorIn, -this.localBottom, false, this.activeLine, this.smoothLines);
            } else {
                drawLines(ctx, 0, 9, this.viewWidth, this.viewHeight - 34, this.lines, this.leftTime, this.rightTime, this.xfactorIn, this.yfactorIn, this.adjust ? -this.localBottom : 0, false, this.activeLine, this.smoothLines);
            }
            ctx.strokeStyle = theme.border;
            ctx.beginPath();
            moveTo(ctx, 0, 9);
            lineTo(ctx, 0, this.viewHeight + 0.5);
            if (!isVisible(this.zoutLayout)) {
                lineTo(ctx, this.viewWidth, this.viewHeight + 0.5);
            }
            ctx.stroke();
        }
        destroyDots() {
            this.seriesEvents.abort();
            this.seriesEvents = new AbortController();
            this.lineByElement = new WeakMap();
            for (const line of this.lines) {
                line.dot?.remove();
                line.legendRow?.remove();
            }
        }
        initLoadedData(data) {
            if (this.destroyed) {
                return;
            }
            this.message.textContent = translate('no_data', 'No data');
            this.message.removeAttribute('style');
            try {
                const result = typeof data === 'string' ? JSON.parse(data) : data;
                if (!Array.isArray(result)) {
                    throw new TypeError('Graph data must be an array');
                }
                this.datasets = result;
                this.noData = result.length === 0 || result.length === 1 && result[0].length === 0;
                this.loadGraph();
            } catch {
                this.setData([], false);
            }
        }
        setData(data, adjust) {
            let showOverride, l, line, i;
            if (this.destroyed) {
                return;
            }
            window.tooltips?.hide(this.tooltipAnchor, {
                fasthide: true
            });
            if (typeof data == 'string') {
                this.zoutLayout.style.display = 'none';
                this.vScale.style.display = 'none';
                this.title.style.display = 'none';
                this.message.textContent = translate('loading', 'Loading...');
                setStyle(this.message, {
                    display: 'block',
                    backgroundColor: 'transparent',
                    border: 'none',
                    left: Math.round((this.viewWidth - 149) / 2) + 'px',
                    top: Math.round((this.viewHeight - 8) / 2) + 'px'
                });
                this.dataRequest?.abort();
                const request = this.dataRequest = new AbortController();
                return fetch(data, {
                    credentials: 'same-origin',
                    signal: request.signal
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Graph data: HTTP ' + response.status);
                    }
                    return response.json();
                }).then(result => {
                    if (!request.signal.aborted && !this.destroyed) this.initLoadedData(result);
                }).catch(error => {
                    if (request.signal.aborted || this.destroyed) {
                        return;
                    }
                    this.setData([], false);
                    this.message.textContent = translate('error', 'Error');
                    console.warn('Graph data could not be loaded:', error);
                });
            }
            this.dataRequest?.abort();
            this.dataRequest = null;
            this.endDrag();
            data = normalizeData(data);
            if (this.params.bar_chart) {
                this.setBarChartData(data, adjust);
                return;
            }
            if (this.lines.length == data.length) {
                showOverride = [];
                for (l = 0; l < this.lines.length; l++) {
                    if (this.lines[l].name.toLowerCase() != data[l].name.toLowerCase()) {
                        showOverride = null;
                        break;
                    } else {
                        showOverride[l] = this.lines[l].shown;
                    }
                }
            }
            this.destroyDots();
            this.adjust = adjust;
            this.minValue = Infinity;
            this.maxValue = 1;
            this.minAbsValue = 1.0;
            this.minTime = Infinity;
            this.maxTime = 0;
            this.lines = [];
            let maxDotsCount = 0;
            let dotsVisible = 0;
            this.MAXSCALE = 2 * DAY + HOUR;
            this.XSTEP = DAY;
            for (l = 0; l < data.length; l++) {
                line = Object.assign({
                    a: true
                }, data[l]);
                if (!line.d || !line.d.length) {
                    continue;
                }
                if (line.c == null) {
                    line.c = colors[l % colors.length];
                }
                let r = (line.c & 0xFF0000) >> 16;
                let g = (line.c & 0x00FF00) >> 8;
                let b = line.c & 0x0000FF;
                r = Math.min(255, (r >> 2) + 192);
                g = Math.min(255, (g >> 2) + 192);
                b = Math.min(255, (b >> 2) + 192);
                line.c2 = r << 16 | g << 8 | b;
                line.hexColor = '#' + line.c.toString(16).padStart(6, '0');
                line.hexColor2 = '#' + line.c2.toString(16).padStart(6, '0');
                line.minValue = Infinity;
                line.maxValue = 1;
                line.hover = {};
                line.dot = createElement('div', {
                    className: 'vk_graph_dot'
                });
                line.dot.style.setProperty('--graph-color', line.hexColor);
                line.dotLabel = createElement('div', {
                    className: 'vk_graph_dot_label'
                });
                line.dot.append(line.dotLabel);
                this.zinLayout.appendChild(line.dot);
                this.listenSeries(line.dotLabel, 'pointerenter', this.expandLabel);
                this.listenSeries(line.dotLabel, 'pointermove', this.chideLabel);
                this.listenSeries(line.dotLabel, 'pointerleave', this.hideLabel);
                this.listenSeries(line.dotLabel, 'pointerdown', cancelEvent);
                this.lineByElement.set(line.dotLabel, line);
                this.lineByElement.set(line.dot, line);
                line.legend = this.createLegend(line, false);
                if (line.no_legend) {
                    line.legendRow.style.display = 'none';
                }
                line.shown = showOverride ? showOverride[l] : line.a;
                line.legendCheck = line.legend.children[0];
                drawCheck(line.legendCheck, line.hexColor, line.hexColor2, line.shown, false);
                line.legendBox = line.legend.children[2];
                this.listenSeries(line.legend, 'pointerenter', this.overLegend);
                this.listenSeries(line.legend, 'pointerleave', this.outLegend);
                this.listenSeries(line.legend, 'click', this.toggleLegend);
                this.listenSeries(line.legend, 'dblclick', this.chooseLegend);
                if (this.params.download_csv) {
                    this.listenSeries(line.legendDownloadCSV, 'click', this.downloadCSV);
                    this.lineByElement.set(line.legendDownloadCSV, line);
                }
                this.lineByElement.set(line.legend, line);
                line.legend.setAttribute('role', 'button');
                line.legend.tabIndex = 0;
                line.legend.setAttribute('aria-pressed', String(line.shown));
                for (i = 0; i < line.d.length; i++) {
                    line.maxValue = Math.max(line.maxValue, line.d[i].y);
                    line.minValue = Math.min(line.minValue, line.d[i].y);
                    this.maxValue = Math.max(this.maxValue, line.d[i].y);
                    this.minValue = Math.min(this.minValue, line.d[i].y);
                    this.minAbsValue = Math.min(this.minAbsValue, Math.abs(line.d[i].y));
                    this.maxTime = Math.max(this.maxTime, line.d[i].x);
                    this.minTime = Math.min(this.minTime, line.d[i].x);
                    if (i > 0 && i < 10 && Math.abs(line.d[i].x - line.d[i - 1].x) > 1) {
                        this.MAXSCALE = Math.min(this.MAXSCALE, 2.5 * Math.abs(line.d[i].x - line.d[i - 1].x));
                        this.XSTEP = (this.XSTEP + Math.abs(line.d[i].x - line.d[i - 1].x)) / 2;
                    }
                    if (this.leftTime != -1 && line.d[i].x >= this.leftTime && line.d[i].x <= this.rightTime) {
                        dotsVisible++;
                    }
                }
                maxDotsCount = Math.max(maxDotsCount, line.d.length);
                this.lines.push(line);
            }
            for (i = 0; i < this.lines.length; i++) {
                line = this.lines[i];
                if (i < this.lines.length / 2) {
                    this.column[0].appendChild(line.legendRow);
                } else {
                    this.column[1].appendChild(line.legendRow);
                }
            }
            const noData = this.lines.length == 0;
            this.zoutLayout.style.display = noData ? 'none' : 'block';
            this.vScale.style.display = noData ? 'none' : 'block';
            if (noData || this.params.no_title) {
                this.title.style.opacity = 0;
            } else {
                this.title.style.display = 'block';
            }
            if (this.lines.length == 0) {
                this.maxTime = incDate(DEF_TIME, DAY, 0);
                this.minTime = this.maxTime - 7 * DAY;
            } else {
                this.minTime -= this.XSTEP / 5;
                this.maxTime += this.XSTEP / 5;
            }
            if (this.params.no_zoom) {
                this.leftTime = this.minTime;
                this.rightTime = this.maxTime;
                this.allowZoom(false);
                this.showEmpty(noData);
            } else {
                if (this.maxTime - this.minTime < 4 * DAY && maxDotsCount < 10) {
                    this.minTime -= 2 * DAY;
                    this.maxTime += 2 * DAY;
                    this.allowZoom(false);
                } else {
                    this.allowZoom(true);
                }
                this.showEmpty(noData);
                if (this.leftTime == -1 || dotsVisible < 10) {
                    let st = 10 * DAY;
                    if (this.XSTEP > 3 * MONTH) {
                        st = 2 * YEAR;
                    } else if (this.XSTEP > 10 * DAY) {
                        st = 3 * MONTH;
                    }
                    this.leftTime = this.params.show_all || maxDotsCount < 10 ? this.minTime : Math.max(this.minTime, this.maxTime - st);
                    this.rightTime = this.maxTime;
                } else {
                    this.leftTime = Math.max(this.minTime, Math.min(this.maxTime, this.leftTime));
                    this.rightTime = Math.max(this.minTime, Math.min(this.maxTime, this.rightTime));
                }
            }
            const ctx = getContext(this.vScaleView);
            ctx.font = getCanvasFont(11, true);
            const maxWidth = Math.max(ctx.measureText(formatValue(this.maxValue + getYStep(this.maxValue, this.params.int_scale))).width, Math.max(ctx.measureText(formatValue(getYStep(this.minAbsValue, this.params.int_scale))).width, ctx.measureText(formatValue(this.minValue)).width));
            this.scaleWidth = this.lines.length == 0 ? 0 : maxWidth + 25;
            this.scaleWidth = Math.floor(this.scaleWidth);
            this.vScale.style.width = this.scaleWidth + "px";
            this.vScale.style.height = this.height + "px";
            setCanvasWidth(this.vScaleView, this.scaleWidth);
            setCanvasHeight(this.vScaleView, this.height);
            this.vScaleView.style.width = this.scaleWidth + "px";
            this.vScaleView.style.height = this.height + "px";
            this.viewWidth = this.width - this.scaleWidth;
            this.mainLayout.style.width = this.viewWidth + "px";
            setCanvasWidth(this.zinView, this.viewWidth);
            setCanvasWidth(this.dotsLayer, this.viewWidth);
            setCanvasWidth(this.zoutView, this.viewWidth);
            this.activeLine = null;
            this.updateLines();
        }
        setBarChartData(data, adjust) {
            let line, ctx, i;
            this.destroyDots();
            this.adjust = adjust;
            this.minValue = Infinity;
            this.maxValue = 1;
            this.minAbsValue = 1.0;
            this.lines = [];
            for (let l = 0; l < data.length; l++) {
                line = Object.assign({
                    a: true
                }, data[l]);
                if (!line.d || !line.d.length) {
                    continue;
                }
                if (!line.c) {
                    let colors_row = l % 4;
                    colors_row = colors_row == 1 ? 3 : colors_row;
                    line.c = colors[(colors_row * 8 + Math.floor(l / 4)) % colors.length];
                }
                const r = (line.c & 0xFF0000) >> 16;
                const g = (line.c & 0x00FF00) >> 8;
                const b = line.c & 0x0000FF;
                const r2 = Math.min(255, (r >> 2) + 192);
                const g2 = Math.min(255, (g >> 2) + 192);
                const b2 = Math.min(255, (b >> 2) + 192);
                line.c2 = r2 << 16 | g2 << 8 | b2;
                const r3 = Math.max(0, r - 16);
                const g3 = Math.max(0, g - 16);
                const b3 = Math.max(0, b - 16);
                line.c3 = r3 << 16 | g3 << 8 | b3;
                line.hexColor = line.c.toString(16);
                line.hexColor = '#' + line.c.toString(16).padStart(6, '0');
                line.hexColor2 = line.c2.toString(16);
                line.hexColor2 = '#' + line.c2.toString(16).padStart(6, '0');
                line.hexColor3 = '#' + line.c3.toString(16).padStart(6, '0');
                line.minValue = Infinity;
                line.maxValue = 1;
                line.legend = this.createLegend(line, true);
                if (line.no_legend) {
                    line.legendRow.style.display = 'none';
                }
                line.shown = true;
                line.legendCheck = line.legend.children[0];
                line.legendBox = line.legend.children[2];
                ctx = getContext(line.legendCheck);
                ctx.fillStyle = ctx.strokeStyle = line.hexColor;
                lineWidth(ctx, 4);
                ctx.lineJoin = 'round';
                strokeRect(ctx, 4, 5, 9, 9);
                fillRect(ctx, 4, 5, 9, 9);
                if (line.sum) {
                    line.legendBox.textContent = formatValue(line.sum) + this.params.yunits;
                    show(line.legendBox);
                }
                for (i = 0; i < line.d.length; i++) {
                    line.maxValue = Math.max(line.maxValue, line.d[i].y);
                    line.minValue = Math.min(line.minValue, line.d[i].y);
                    this.maxValue = Math.max(this.maxValue, line.d[i].y);
                    this.minValue = Math.min(this.minValue, line.d[i].y);
                    this.minAbsValue = Math.min(this.minAbsValue, Math.abs(line.d[i].y));
                }
                line.stInd = 0;
                line.enIdx = line.d.length;
                this.lines.push(line);
            }
            for (i = 0; i < this.lines.length; i++) {
                line = this.lines[i];
                if (i < this.lines.length / 2) {
                    this.column[0].appendChild(line.legendRow);
                } else {
                    this.column[1].appendChild(line.legendRow);
                }
            }
            const noData = this.lines.length == 0;
            this.zoutLayout.style.display = noData ? 'none' : 'block';
            this.vScale.style.display = noData ? 'none' : 'block';
            this.showEmpty(noData);
            this.zoutLayout.style.display = 'none';
            this.title.style.display = 'none';
            this.vScaleView.style.paddingTop = 0;
            this.viewHeight = this.height - 24;
            this.zinLayout.style.height = this.viewHeight + "px";
            setCanvasHeight(this.zinView, this.viewHeight);
            setCanvasHeight(this.dotsLayer, this.viewHeight - 25);
            this.disable_zoom = true;
            if (this.params.multiple && this.menu.parentNode == this.mainLayout) {
                const menu = detachElement(this.menu);
                setStyle(menu, {
                    position: 'absolute',
                    right: '10px',
                    top: '20px',
                    zIndex: 100
                });
                this.zinLayout.insertBefore(menu, this.zinView);
            }
            ctx = getContext(this.vScaleView);
            ctx.font = getCanvasFont(11, true);
            const yUnits = this.params.yunits ? this.params.yunits : '';
            const maxWidth = Math.max(ctx.measureText(formatValue(this.maxValue + getYStep(this.maxValue, this.params.int_scale)) + yUnits).width, ctx.measureText(formatValue(getYStep(this.minAbsValue, this.params.int_scale)) + yUnits).width);
            this.scaleWidth = this.lines.length == 0 ? 0 : maxWidth + 32;
            this.scaleWidth = Math.floor(this.scaleWidth);
            this.vScale.style.width = this.scaleWidth + "px";
            this.vScale.style.height = this.height + "px";
            setCanvasWidth(this.vScaleView, this.scaleWidth);
            setCanvasHeight(this.vScaleView, this.height);
            this.vScaleView.style.width = this.scaleWidth + "px";
            this.vScaleView.style.height = this.height + "px";
            this.viewWidth = this.width - this.scaleWidth;
            this.mainLayout.style.width = this.viewWidth + "px";
            setCanvasWidth(this.zinView, this.viewWidth);
            setCanvasWidth(this.dotsLayer, this.viewWidth);
            this.xstep = Math.floor(this.viewWidth / this.params.bar_chart.length);
            this.barsWidth = Math.floor(this.xstep / (this.lines.length + 1));
            this.barsWidth = Math.min(this.barsWidth, 25);
            if (this.lines.length == 0 || this.maxValue - this.minValue < 1e-6) {
                this.isNegative = false;
                this.ystep = 1;
                this.localTop = 5;
                this.localBottom = 0;
            } else {
                this.isNegative = this.minValue < -1e-6;
                this.ystep = Math.max(getYStep(this.maxValue - (adjust ? this.minValue : 0), this.params.int_scale), this.isNegative ? getYStep(-this.minValue, this.params.int_scale) : 1e-6);
                this.localTop = Math.ceil(this.maxValue / this.ystep) * this.ystep;
                this.localBottom = this.isNegative ? -Math.ceil(-this.minValue / this.ystep) * this.ystep : 0;
            }
            this.yfactorIn = (this.viewHeight - (this.isNegative ? 43 : 34)) / (this.localTop - this.localBottom);
            this.xfactorIn = 1;
            ctx = getContext(this.zinView);
            const ctxS = getContext(this.vScaleView);
            clearRect(ctx, 0, 0, this.viewWidth, this.viewHeight);
            ctx.fillStyle = theme.plot;
            fillRect(ctx, 0, 9, this.viewWidth, this.viewHeight - 9);
            clearRect(ctxS, 0, 0, this.scaleWidth, this.viewHeight);
            lineWidth(ctx, 1);
            ctx.strokeStyle = theme.grid;
            ctxS.font = getCanvasFont(11);
            ctxS.fillStyle = theme.text;
            ctxS.textAlign = 'right';
            ctxS.textBaseline = 'middle';
            for (let gridY = this.localBottom; gridY < this.localTop + this.ystep; gridY += this.ystep) {
                const cy = this.viewHeight - 24.5 - Math.round((gridY - this.localBottom) * this.yfactorIn) - (this.isNegative ? 9 : 0);
                if (gridY < this.localTop) {
                    ctx.strokeStyle = this.isNegative && Math.abs(gridY) < 1e-8 ? theme.border : theme.grid;
                    ctx.beginPath();
                    moveTo(ctx, 0, cy);
                    lineTo(ctx, this.viewWidth, cy);
                    ctx.stroke();
                }
            }
            (() => {
                for (let gridY = this.localBottom; gridY < this.localTop + this.ystep; gridY += this.ystep) {
                    const cy = this.viewHeight - 24.5 - Math.round((gridY - this.localBottom) * this.yfactorIn) - (this.isNegative ? 9 : 0);
                    fillText(ctxS, formatValue(gridY) + yUnits, this.scaleWidth - 6, cy);
                }
            })();
            ctx.fillStyle = theme.grid;
            fillRect(ctx, 0, this.viewHeight - 25, this.viewWidth, 25);
            ctx.fillStyle = theme.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            let fontSize = 11;
            ctx.font = getCanvasFont(fontSize, true);
            for (i = 0; i < this.params.bar_chart.length; i++) {
                while (ctx.measureText(this.params.bar_chart[i]).width > this.xstep && fontSize >= 8) {
                    fontSize--;
                    ctx.font = getCanvasFont(fontSize, true);
                }
            }
            ctx.font = getCanvasFont(fontSize);
            for (i = 0; i < this.params.bar_chart.length; i++) {
                const text = this.params.bar_chart[i];
                const textpos = this.xstep * (i + 0.5);
                fillText(ctx, replaceEntities(text), textpos, this.viewHeight - 19);
            }
            if (this.isNegative) {
                drawBars(ctx, 0, 9, this.viewWidth, this.viewHeight - 43, this.lines, this.params.bar_chart, this.barsWidth, this.xstep, this.yfactorIn, -this.localBottom);
            } else {
                drawBars(ctx, 0, 9, this.viewWidth, this.viewHeight - 34, this.lines, this.params.bar_chart, this.barsWidth, this.xstep, this.yfactorIn, this.adjust ? -this.localBottom : 0);
            }
            ctx.strokeStyle = theme.border;
            lineWidth(ctx, 1);
            ctx.beginPath();
            moveTo(ctx, 0.5, 9);
            lineTo(ctx, 0.5, this.viewHeight);
            lineTo(ctx, this.viewWidth, this.viewHeight);
            ctx.stroke();
            ctx.strokeStyle = theme.border;
            lineWidth(ctx, 2);
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            moveTo(ctx, 1, this.viewHeight - 26);
            lineTo(ctx, this.viewWidth, this.viewHeight - 26);
            ctx.stroke();
        }
        destroy() {
            if (this.destroyed) {
                return;
            }
            this.destroyed = true;
            this.endDrag();
            this.listeners.abort();
            this.seriesEvents.abort();
            this.resizeObserver?.disconnect();
            this.themeObserver?.disconnect();
            this.dataRequest?.abort();
            cancelAnimationFrame(this.resizeFrame);
            clearTimeout(this.touchTimer);
            window.tooltips?.destroy(this.tooltipAnchor);
            this.lines = [];
            this.graphDiv.replaceChildren();
        }
    }
    window.Graph = Graph;
})();
