(function () {
'use strict';

// Port of VK's tooltips.js API surface adapted to OpenVK: elements opt in via
// inline onmouseover="showTitle(this)" / "showTooltip(this, {...})", matching
// VK markup. tooltips.create binds 'mouseout' on the element for hiding, like
// addEvent(el, 'mouseout', el.tthide) upstream.
vkify.once('simpleTooltips', () => {
    const instances = new Set();
    const EASE_SINE_IN_OUT = 'cubic-bezier(0.37, 0, 0.63, 1)';

    function setContent(tt, options) {
        const wrapped = tt.container.querySelector('.wrapped');
        if (options.content != null) {
            wrapped.innerHTML = options.content;
        } else {
            const text = typeof options.text === 'function' ? options.text() : options.text;
            if (!text) return false;
            wrapped.replaceChildren();
            const label = document.createElement('div');
            label.className = 'tt_text';
            if (!options.black || options.html) {
                label.innerHTML = text;
            } else {
                label.textContent = text;
            }
            wrapped.appendChild(label);
        }
        return true;
    }

    function getAppendParent(el, opts = {}) {
        if (document.fullscreenElement) return document.fullscreenElement;
        if (opts.appendEl) {
            return (typeof opts.appendEl === 'string' ? document.getElementById(opts.appendEl) : opts.appendEl) || document.body;
        }
        if (opts.appendParentCls) {
            return el.closest?.('.' + opts.appendParentCls) || document.body;
        }
        if (el.closest?.('.fc_tab, #fastchats_container, .ovk-msg-all')) {
            return document.body;
        }
        if (typeof getComputedStyle === 'function') {
            let positioned = null;
            for (let parent = el.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
                const style = getComputedStyle(parent);
                if (/(hidden|auto|scroll|clip)/.test(style.overflow + style.overflowX + style.overflowY)) {
                    return document.body;
                }
                if (!positioned && (style.position === 'relative' || style.position === 'absolute' || style.position === 'fixed')) {
                    positioned = parent;
                }
            }
            if (positioned) return positioned;
        }
        return document.body;
    }

    function position(tt) {
        const { el, container, opts } = tt;
        if (!el.isConnected) return tooltips.destroy(el);
        const anchor = el.getBoundingClientRect();
        const size = container.getBoundingClientRect();
        const rawShift = typeof opts.shift === 'function' ? opts.shift() : opts.shift;
        const shift = rawShift || (opts.black ? [11, 8, 8] : [2, 8, 8]);
        const side = opts.dir === 'left' || opts.dir === 'right';
        const gapAbove = Number(shift[1]) || 0;
        const gapBelow = Number(shift[2] ?? shift[1]) || 0;
        let above = false;
        let needLeft = false;
        let vTop, vLeft;

        if (side) {
            const sideGap = Number(shift[0]) || 8;
            vTop = anchor.top + (anchor.height - size.height) / 2 - gapAbove;
            vLeft = opts.dir === 'right' ? anchor.right + sideGap : anchor.left - size.width - sideGap;
        } else {
            if (opts.dir === 'down' || opts.forcetoup) {
                above = true;
            } else if (opts.dir === 'up' || opts.forcetodown) {
                above = false;
            } else {
                const fitsAbove = anchor.top >= size.height + gapAbove + 8;
                const fitsBelow = window.innerHeight - anchor.bottom >= size.height + gapBelow + 8;
                above = opts.toup === false ? (!fitsBelow && fitsAbove) : (fitsAbove || !fitsBelow);
            }
            const gap = above ? gapAbove : gapBelow;
            const shiftX = Number(above ? shift[0] : (shift[3] ?? shift[0])) || 0;
            vTop = above ? anchor.top - size.height - gap : anchor.bottom + gap;
            vLeft = anchor.left - shiftX;

            needLeft = !opts.forceright && !opts.center && Boolean(
                opts.needLeft
                || opts.align === 'end'
                || ((opts.black || opts.checkLeft || opts.typeClass === 'like_tt')
                    && window.innerWidth
                    && (vLeft + size.width > window.innerWidth - 4))
            );
            if (needLeft) {
                vLeft -= size.width - (opts.reverseOffset || (opts.typeClass === 'like_tt' ? 80 : 39));
            } else if (opts.center) {
                vLeft = anchor.left + (anchor.width - size.width) / 2;
            }
        }

        if (window.innerHeight) {
            vTop = Math.max(4, Math.min(window.innerHeight - size.height - 4, vTop));
        }
        if (window.innerWidth) {
            vLeft = Math.max(4, Math.min(window.innerWidth - size.width - 4, vLeft));
        }

        const host = container.parentElement;
        let top, left;
        if (!host || host === document.body || host === document.documentElement) {
            top = vTop + (window.scrollY || window.pageYOffset || 0);
            left = vLeft + (window.scrollX || window.pageXOffset || 0);
        } else {
            const hostRect = host.getBoundingClientRect ? host.getBoundingClientRect() : { top: 0, left: 0 };
            top = vTop - hostRect.top + (host.scrollTop || 0);
            left = vLeft - hostRect.left + (host.scrollLeft || 0);
        }

        container.classList.toggle('tt_down', above && !side);
        container.classList.toggle('tt_up', !above && !side);
        container.classList.toggle('tt_right', opts.dir === 'left');
        container.classList.toggle('tt_left', opts.dir === 'right');
        container.classList.toggle('toleft', !side && needLeft);
        container.classList.toggle('tocenter', !!opts.center);
        container.style.top = `${top}px`;
        container.style.left = `${left}px`;
        return { top, left, above, side };
    }

    const tooltips = {
        create(el, options = {}) {
            if (el.tt && el.tt.el) return el.tt;
            if (!el.tthide) {
                el.tthide = () => { el.showing = false; tooltips.hide(el); };
                if (!options.nohide) el.addEventListener('mouseout', el.tthide);
            }
            const container = document.createElement('div');
            container.className = 'tt_w';
            container.innerHTML = '<div class="wrapped"></div>';
            container.hidden = true;
            getAppendParent(el, options).appendChild(container);
            const tt = {
                el, container, opts: options, shown: false,
                show: (opts) => tooltips.show(el, opts),
                hide: (opts) => tooltips.hide(el, opts),
                destroy: () => tooltips.destroy(el),
                setContent: (html) => {
                    tt.opts = { ...tt.opts, content: html, text: undefined };
                    setContent(tt, tt.opts);
                    if (tt.shown) position(tt);
                },
            };
            if (!options.nohideover && (!options.text || options.hasover)) {
                container.addEventListener('mouseover', () => tooltips.show(el));
                container.addEventListener('mouseleave', () => tooltips.hide(el));
            } else {
                container.addEventListener('mouseover', () => tooltips.show(el));
                container.addEventListener('mouseleave', () => tooltips.hide(el));
            }
            el.tt = tt;
            instances.add(tt);
            options.init?.(tt);
            options.onCreate?.(tt);
            return tt;
        },
        show(el, options = {}) {
            if (!el || el._vkNoTooltip || el.tt === 'loadingstat') return;
            el.showing = true;
            const tt = (el.tt && el.tt.el) ? el.tt : tooltips.create(el, options);
            tt.opts = { ...tt.opts, ...options };
            const host = getAppendParent(el, tt.opts);
            if (tt.container.parentElement !== host) host.appendChild(tt.container);
            clearTimeout(el.ttimer);
            clearTimeout(el.hidetimer);
            el.hidetimer = null;
            if (tt.shown) {
                if (tt._hideAnim) {
                    tt._hideAnim.cancel();
                    tt._hideAnim = null;
                    tt.container.style.pointerEvents = '';
                }
                if (tt.opts.text) setContent(tt, tt.opts);
                position(tt);
                return tt;
            }
            el.ttimer = setTimeout(() => {
                if (!el.isConnected || el.showing === false || !setContent(tt, tt.opts)) return;
                const opts = tt.opts;
                if (opts.width) tt.container.style.width = `${opts.width}px`;
                if (opts.maxWidth) tt.container.style.maxWidth = `${opts.maxWidth}px`;
                tt.container.className = `tt_w ${opts.typeClass || (opts.black ? 'tt_black' : 'tt_default')} ${opts.className || ''}`;
                if (!opts.noZIndex) tt.container.style.zIndex = el.closest('#fastchats_container') ? 10050 : (el.closest('.ovk-msg-all') ? 9999 : (opts.zIndex || 1501));
                tt.container.hidden = false;
                tt.shown = true;
                const pos = position(tt);
                const sp = opts.showsp !== undefined ? opts.showsp : 200;
                if (sp && pos && tt.container.animate) {
                    tt._showAnim?.cancel();
                    const from = { opacity: 0 };
                    const to = { opacity: 1 };
                    const slide = Number(opts.slide) || 0;
                    const slideX = Number(opts.slideX) || 0;
                    if (slide) {
                        from.top = `${pos.top + (pos.above ? -slide : slide)}px`;
                        to.top = `${pos.top}px`;
                    }
                    if (slideX) {
                        from.left = `${pos.left + slideX}px`;
                        to.left = `${pos.left}px`;
                    }
                    const anim = tt.container.animate([from, to], { duration: sp, easing: EASE_SINE_IN_OUT });
                    tt._showAnim = anim;
                    anim.onfinish = () => {
                        if (tt._showAnim === anim) tt._showAnim = null;
                        opts.onShowEnd?.(tt);
                    };
                } else {
                    opts.onShowEnd?.(tt);
                }
                opts.onShowStart?.(tt);
            }, tt.opts.showdt || 0);
            return tt;
        },
        hide(el, options = {}) {
            if (!el || el.tt === 'loadingstat') return;
            const tt = el.tt;
            clearTimeout(el.ttimer);
            clearTimeout(el.hidetimer);
            el.hidetimer = setTimeout(() => {
                if (!tt || !tt.container) return;
                const opts = tt.opts || {};
                const sp = opts.showsp !== undefined ? opts.showsp : 200;
                const finish = () => {
                    if (!tt.container) return;
                    tt._hideAnim = null;
                    tt.container.hidden = true;
                    tt.container.style.pointerEvents = '';
                    tt.shown = false;
                    tt.opts.onHide?.(tt);
                };
                if (sp && !options.fasthide && tt.shown && tt.container.animate) {
                    tt._showAnim?.cancel();
                    tt._showAnim = null;
                    if (!opts.hasover) tt.container.style.pointerEvents = 'none';
                    const anim = tt.container.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sp, easing: EASE_SINE_IN_OUT });
                    tt._hideAnim = anim;
                    anim.onfinish = finish;
                } else {
                    finish();
                }
            }, options.fasthide ? 0 : ((tt && tt.opts.hidedt) || 0));
        },
        hideAll(ancestor) {
            for (const tt of instances) {
                if (ancestor && !ancestor.contains(tt.el)) continue;
                tooltips.hide(tt.el, { fasthide: true });
            }
        },
        destroy(el) {
            if (!el || !el.tt || !el.tt.el) return;
            clearTimeout(el.ttimer);
            clearTimeout(el.hidetimer);
            if (el.tthide) el.removeEventListener('mouseout', el.tthide);
            el.tt.container.remove();
            instances.delete(el.tt);
            delete el.tt;
        },
        destroyAll(ancestor) {
            for (const tt of [...instances]) {
                if (ancestor && !ancestor.contains(tt.el)) continue;
                tooltips.destroy(tt.el);
            }
        },
        rePositionTT(tt) {
            if (tt?.shown) position(tt);
        },
        rePositionAll() {
            for (const tt of instances) if (tt.shown) position(tt);
        },
    };

    function showTooltip(el, opts) {
        if (!el || !opts || el._vkNoTooltip) return;
        el.showing = true;
        if (!el.tt || !el.tt.el || opts.force) tooltips.create(el, opts);
        tooltips.show(el, opts);
        return el.tt;
    }

    function showTitle(el, text, shift, options = {}) {
        const tf = () => text || el.getAttribute('data-title');
        if (!tf()) return;
        if (!shift) {
            const w = el.offsetWidth || el.getBoundingClientRect().width || 0;
            shift = [Math.round(20 - w / 2), 8];
        }
        return showTooltip(el, { text: tf, shift, black: true, ...options });
    }

    window.tooltips = tooltips;
    window.showTooltip = showTooltip;
    window.showTitle = showTitle;

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') tooltips.hideAll();
    });
    window.addEventListener('scroll', () => tooltips.rePositionAll(), true);
    window.addEventListener('resize', () => tooltips.rePositionAll());
    document.addEventListener('fullscreenchange', () => {
        for (const tt of instances) {
            const host = getAppendParent(tt.el, tt.opts);
            if (tt.container.parentElement !== host) host.appendChild(tt.container);
        }
        tooltips.rePositionAll();
    });
    vkify.onPageLifecycle('beforePageLeave', () => {
        tooltips.destroyAll();
    });
    vkify.onPageLifecycle('afterPageReady', () => {
        for (const tt of instances) if (!tt.el.isConnected) tooltips.destroy(tt.el);
    }, 'after');
});

})();
