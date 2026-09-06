(function () {
'use strict';

class LoaderUtils {
    static show(container, options = {}) {
        const { size = 'medium', className = '', theme = null } = options;
        const root = LoaderUtils._asUmbrella(container);
        const node = root.nodes && root.nodes[0] ? root.nodes[0] : null;
        if (node && node.children) {
            for (const child of node.children) {
                if (child && child.classList && typeof child.classList.contains === 'function' && child.classList.contains('pr')) {
                    return root.find('.pr').last();
                }
            }
        }
        const sizeClass = size === 'small' ? 'pr_small' : size === 'large' ? 'pr_large' : 'pr_medium';
        const themeClass = theme === 'baw' ? 'pr_baw' : '';
        const html = `<div class="pr ${sizeClass} ${themeClass} ${className}"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>`;
        root.append(html);
        return root.find('.pr').last();
    }

    static showInButton(button, options = {}) {
        const btn = LoaderUtils._asUmbrella(button);
        const node = btn.nodes && btn.nodes[0] ? btn.nodes[0] : null;
        const { theme = null } = options;
        const themeClass = theme === 'baw' ? 'pr_baw' : '';
        const loaderHTML = `<div class="pr ${themeClass}"><div class="pr_bt"></div><div class="pr_bt"></div><div class="pr_bt"></div></div>`;
        if (!btn.attr('data-loaderutils-original')) {
            btn.attr('data-loaderutils-original', btn.html());
            if (node) {
                btn.attr('data-loaderutils-original-width', node.style.width || '');
                btn.attr('data-loaderutils-original-min-width', node.style.minWidth || '');
                const width = Math.ceil(node.getBoundingClientRect().width);
                if (width > 0) {
                    node.style.minWidth = width + 'px';
                }
            }
        }
        const span = btn.find('span');
        if (span.length > 0) span.html(loaderHTML); else btn.html(loaderHTML);
        btn.addClass('lagged');
        return btn;
    }

    static restoreButton(button) {
        const btn = LoaderUtils._asUmbrella(button);
        const node = btn.nodes && btn.nodes[0] ? btn.nodes[0] : null;
        const original = btn.attr('data-loaderutils-original');
        if (typeof original === 'string') {
            btn.html(original);
            btn.attr('data-loaderutils-original', null);
        }
        if (node) {
            const originalWidth = btn.attr('data-loaderutils-original-width');
            const originalMinWidth = btn.attr('data-loaderutils-original-min-width');
            node.style.width = typeof originalWidth === 'string' ? originalWidth : '';
            node.style.minWidth = typeof originalMinWidth === 'string' ? originalMinWidth : '';
            btn.attr('data-loaderutils-original-width', null);
            btn.attr('data-loaderutils-original-min-width', null);
        }
        btn.removeClass('lagged');
        return btn;
    }

    static hide(scope = null) {
        const root = scope ? LoaderUtils._asUmbrella(scope) : u(document);
        root.find('.pr').remove();
    }

    static hideGeneral(scope = null) {
        const root = scope ? LoaderUtils._asUmbrella(scope) : u(document);
        root.find('.pr').each(function (node) {
            const element = u(node);
            if (element.closest('#ajloader').length) return;
            if (!element.closest('.button').length) element.remove();
        });
    }

    static block(target, { className = 'ui_blocker' } = {}) {
        const el = LoaderUtils._asUmbrella(target);
        const overlay = u(`<div class="${className}"></div>`);
        el.append(overlay);
        return () => overlay.remove();
    }

    static async withAsyncButton(button, fn) {
        LoaderUtils.showInButton(button);
        try {
            return await fn();
        } finally {
            LoaderUtils.restoreButton(button);
        }
    }

    static startKeyed(key, scope = null) {
        if (!LoaderUtils._keyed) LoaderUtils._keyed = new Map();
        const handle = { scope };
        LoaderUtils._keyed.set(key, handle);
        LoaderUtils.show(scope || u('body'));
        return handle;
    }

    static stopKeyed(key) {
        if (!LoaderUtils._keyed) return;
        const handle = LoaderUtils._keyed.get(key);
        if (handle) {
            LoaderUtils.hide(handle.scope || u('body'));
            LoaderUtils._keyed.delete(key);
        }
    }

    static isVisible(scope = null) {
        const root = scope ? LoaderUtils._asUmbrella(scope) : u(document);
        return root.find('.pr').length > 0;
    }

    static _asUmbrella(obj) {
        if (!obj) return u(document.body);
        if (typeof obj === 'string') return u(obj);
        if (obj.nodes || typeof obj.find === 'function') return obj;
        return u(obj);
    }
}

window.LoaderUtils = LoaderUtils;

})();
