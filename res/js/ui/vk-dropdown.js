(() => {
    let nextId = 0;
    let openDropdown = null;

    class Select {
        constructor(container, options) {
            this.container = container;
            this.options = options;
            this.maxHeight = this.options.height || 250;
            this.list = document.createElement('ul');
            this.list.id = `list_options_container_${++nextId}`;
            this.list.setAttribute('role', 'listbox');
            container.appendChild(this.list);
            this.active = -1;
        }

        content(items) {
            this.list.replaceChildren();
            items.forEach(([value, text, disabled], index) => {
                const item = document.createElement('li');
                item.dataset.value = String(value);
                item.textContent = String(text);
                item.title = String(text);
                item.id = `${this.list.id}_${index}`;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', 'false');
                if (disabled) item.classList.add('disabled');
                if (index === 0) item.classList.add('first');
                if (index === items.length - 1) item.classList.add('last');
                this.list.appendChild(item);
            });
        }

        highlight(index) {
            this.list.children[this.active]?.classList.remove('active');
            this.active = index;
            const item = this.list.children[index];
            if (!item) return;
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
            this.options.onItemActive?.(item);
        }

        show(value) {
            this.container.hidden = false;
            this.list.style.position = 'absolute';
            this.list.style.visibility = 'hidden';
            if (this.list.offsetHeight > this.maxHeight) {
                this.container.style.height = this.maxHeight + 'px';
                this.container.classList.add('result_list_scrollable');
            } else {
                this.container.style.height = 'auto';
                this.container.classList.remove('result_list_scrollable');
            }
            this.list.style.position = 'relative';
            this.list.style.visibility = 'visible';
            const index = [...this.list.children].findIndex(item => item.dataset.value === value && !item.classList.contains('disabled'));
            const first = [...this.list.children].findIndex(item => !item.classList.contains('disabled'));
            this.highlight(index >= 0 ? index : first);
        }

        hide() {
            this.container.hidden = true;
            this.highlight(-1);
        }

        move(step) {
            for (let i = this.active + step; i >= 0 && i < this.list.children.length; i += step) {
                if (!this.list.children[i].classList.contains('disabled')) {
                    this.highlight(i);
                    return;
                }
            }
        }

        search(text) {
            const found = [...this.list.children].findIndex(item => !item.classList.contains('disabled')
                && item.textContent.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()));
            if (found >= 0) this.highlight(found);
        }
    }

    class Dropdown {
        constructor(input, data, options = {}) {
            this.options = options;
            this.data = data || [];
            this.input = input;
            this.input.classList.add('selector_input');
            this.input.setAttribute('role', 'combobox');
            this.input.setAttribute('aria-haspopup', 'listbox');
            this.input.setAttribute('aria-expanded', 'false');
            this.container = document.createElement('div');
            this.container.className = 'selector_container big';
            this.container.style.width = options.width ? `${options.width}px` : '100%';
            this.container.innerHTML = '<table cellspacing="0" cellpadding="0" class="selector_table"><tbody><tr><td class="selector"></td><td class="selector_dropdown" aria-hidden="true"></td></tr></tbody></table><div class="results_container"><div class="result_list" hidden></div></div>';
            input.replaceWith(this.container);
            this.container.querySelector('.selector').appendChild(input);
            this.resultField = document.createElement('input');
            this.resultField.type = 'hidden';
            this.resultField.className = 'resultField';
            this.container.querySelector('.selector').appendChild(this.resultField);
            this.select = new Select(this.container.querySelector('.result_list'), {
                onItemActive: item => this.input.setAttribute('aria-activedescendant', item.id)
            });
            this.input.setAttribute('aria-controls', this.select.list.id);
            this.input.style.width = '100%';
            this.setAutocomplete(!!options.autocomplete);
            this.setData(this.data);
            this.val(options.selectedItem ?? options.selectedItems ?? this.data[0]?.[0] ?? '', false);
            this.onMouseDown = e => {
                if (this.disabled || e.button !== 0) return;
                e.preventDefault();
                this.input.focus();
                if (this.autocomplete && e.target.closest('.selector') && !this.select.container.hidden) return;
                this.toggle();
                if (this.autocomplete && !this.select.container.hidden) this.input.select();
            };
            this.onKeyDown = e => {
                if (this.disabled) return;
                if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
                    e.preventDefault();
                    if (this.select.container.hidden) this.show();
                    else this.select.move(e.key === 'ArrowDown' ? 1 : -1);
                } else if (e.key === 'Enter' || e.key === ' ') {
                    if (this.autocomplete && e.key === ' ') return;
                    e.preventDefault();
                    if (this.select.container.hidden) this.show();
                    else if (this.select.active >= 0) this.val(this.select.list.children[this.select.active].dataset.value, true);
                } else if (e.key === 'Escape') {
                    if (!this.select.container.hidden) e.preventDefault();
                    this.hide();
                } else if (e.key === 'Tab') {
                    this.hide();
                } else if (!this.autocomplete && e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
                    this.show();
                    clearTimeout(this.searchTimer);
                    this.searchText = (this.searchText || '') + e.key;
                    this.select.search(this.searchText);
                    this.searchTimer = setTimeout(() => { this.searchText = ''; }, 1000);
                }
            };
            this.onInput = () => {
                if (!this.autocomplete) return;
                const query = this.input.value;
                if (this.select.container.hidden) this.show();
                this.input.value = query;
                this.filter(query);
            };
            this.onOptionDown = e => {
                const item = e.target.closest('li');
                if (!item || item.classList.contains('disabled')) return;
                e.preventDefault();
                this.val(item.dataset.value, true);
                this.input.focus();
            };
            this.onOutsideDown = e => {
                if (!this.container.contains(e.target)) this.hide();
            };
            this.onFocus = () => {
                if (this.autocomplete) this.input.select();
            };
            this.container.querySelector('.selector_table').addEventListener('mousedown', this.onMouseDown);
            this.input.addEventListener('keydown', this.onKeyDown);
            this.input.addEventListener('input', this.onInput);
            this.input.addEventListener('focus', this.onFocus);
            this.select.list.addEventListener('mousedown', this.onOptionDown);
            this.select.list.addEventListener('mousemove', e => {
                const item = e.target.closest('li');
                if (item && !item.classList.contains('disabled')) {
                    this.select.highlight([...this.select.list.children].indexOf(item));
                }
            });
        }

        setAutocomplete(enabled) {
            this.autocomplete = enabled;
            this.input.readOnly = !enabled;
            this.container.classList.toggle('dropdown_container', !enabled);
            if (enabled) {
                this.input.setAttribute('aria-autocomplete', 'list');
                this.input.removeAttribute('aria-readonly');
            } else {
                this.input.removeAttribute('aria-autocomplete');
                this.input.setAttribute('aria-readonly', 'true');
            }
        }

        filter(query) {
            const words = query.toLocaleLowerCase().trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
            const items = words.length ? this.data.filter(([, label]) => {
                const parts = String(label).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u);
                return words.every(word => parts.some(part => part.startsWith(word)));
            }) : this.data;
            this.select.content(items.length ? items : [['', window.tr?.('no_results'), true]]);
            this.select.show(words.length ? '' : this.val());
        }

        setData(items) {
            this.data = items;
            this.select.content(items);
            this.val(this.resultField.value || items[0]?.[0] || '', false);
        }

        val(value, fireEvent = false) {
            if (value === undefined) return this.resultField.value;
            const previous = this.resultField.value;
            const item = this.data.find(entry => String(entry[0]) === String(value));
            this.resultField.value = item ? String(item[0]) : '';
            this.input.value = item ? String(item[1]) : '';
            this.input.classList.toggle('selected', !!item);
            this.select.list.querySelectorAll('li').forEach(el => {
                el.setAttribute('aria-selected', String(el.dataset.value === this.resultField.value));
            });
            this.hide();
            if (fireEvent && this.resultField.value !== previous) this.options.onChange?.(this.resultField.value, item);
            return this.resultField.value;
        }

        show() {
            this.options.onBeforeShow?.();
            if (this.disabled || this.container.style.display === 'none') return;
            if (openDropdown && openDropdown !== this) openDropdown.hide();
            openDropdown = this;
            this.container.classList.add('selector_focused');
            this.select.container.style.width = this.container.offsetWidth + 'px';
            this.container.classList.toggle('reverse',
                window.innerHeight - this.container.getBoundingClientRect().bottom < 250
                && this.container.getBoundingClientRect().top > 250);
            this.select.show(this.val());
            this.input.setAttribute('aria-expanded', 'true');
            document.addEventListener('mousedown', this.onOutsideDown, true);
        }

        hide() {
            if (openDropdown === this) openDropdown = null;
            this.container.classList.remove('selector_focused');
            this.select.hide();
            this.input.setAttribute('aria-expanded', 'false');
            this.input.removeAttribute('aria-activedescendant');
            if (this.autocomplete) {
                const selected = this.data.find(item => String(item[0]) === this.resultField.value);
                this.input.value = selected ? String(selected[1]) : '';
                this.select.content(this.data);
            }
            document.removeEventListener('mousedown', this.onOutsideDown, true);
        }

        toggle() {
            if (this.select.container.hidden) this.show();
            else this.hide();
        }

        setDisabled(disabled) {
            this.disabled = disabled;
            this.container.classList.toggle('disabled', disabled);
            this.input.disabled = disabled;
            if (disabled) this.hide();
        }

        destroy() {
            this.hide();
            clearTimeout(this.searchTimer);
            this.container.remove();
        }
    }

    const IDD_HEADER_CORRECTION_LEFT = -10;
    const IDD_HEADER_CORRECTION_TOP = -8;
    let activeIdd = null;

    class InlineDropdown {
        constructor(el, opts = {}) {
            if (!el || !el.nodeType) return;
            if (el.classList.contains('idd_wrap')) return;
            this._opts = opts;
            this._items = opts.items ? [...opts.items] : JSON.parse(el.dataset.items || 'null');
            if (!this._items) throw new Error('No items provided');
            this._title = opts.keepTitle ? (opts.title || el.innerHTML) : '';
            this._selectable = opts.keepTitle ? opts.keepSelected : true;
            this._iddEl = document.createElement('div');
            this._iddEl.className = 'idd_wrap';
            this._iddEl.id = el.id;
            this._iddEl.innerHTML = '<div class="idd_selected_value ' + (opts.withArrow ? 'idd_arrow' : '') + '" tabindex="0" role="link">'
                + el.innerHTML + '</div><input type="hidden" id="' + el.id + '_input" name="' + (el.getAttribute('name') || el.id) + '">';
            for (const cls of el.className.split(' ')) {
                if (cls) this._iddEl.classList.add(cls);
            }
            for (const attr of el.attributes) {
                if (attr.name.startsWith('data-')) this._iddEl.setAttribute(attr.name, attr.value);
            }
            el.parentNode.replaceChild(this._iddEl, el);
            this._els = {
                valueEl: this._iddEl.querySelector('.idd_selected_value'),
                hiddenInputEl: this._iddEl.querySelector('input')
            };
            if (opts.autoShow) {
                let onDD = false;
                this._iddEl.addEventListener('mouseenter', () => {
                    onDD = true;
                    clearTimeout(this._autoShowTimeout);
                    this._autoShowTimeout = setTimeout(() => { if (onDD) this._onClick(); }, 100);
                });
                this._iddEl.addEventListener('mouseleave', () => {
                    onDD = false;
                    clearTimeout(this._autoShowTimeout);
                });
            }
            this._iddEl.addEventListener('click', () => this._onClick());
            this._rebuildDropdown();
            const selected = opts.selected !== undefined ? opts.selected
                : (el.hasAttribute('data-value') ? el.getAttribute('data-value') : false);
            if (selected !== false) this.select(selected, true);
        }

        _rebuildDropdown() {
            const opts = this._opts;
            const iconCls = opts.withIcon ? 'idd_with_icon' : '';
            const arrowCls = opts.withArrow ? 'idd_arrow' : '';
            const idPrefix = opts.idPrefix || '';
            const idItemPrefix = opts.idItemPrefix || '';
            const headerWrap = document.createElement('div');
            headerWrap.innerHTML = '<div class="idd_header_wrap ' + iconCls + '"><div class="idd_header ' + arrowCls + '" id="' + idPrefix + this._items[0][0] + '"></div></div>';
            this._els.popupHeader = headerWrap.firstElementChild;
            const items = document.createElement('div');
            items.className = 'idd_items_wrap';
            const content = document.createElement('div');
            content.className = 'idd_items_content';
            for (const item of this._items) {
                if (item === 'separator') {
                    const sep = document.createElement('div');
                    sep.className = 'idd_separator';
                    content.appendChild(sep);
                    continue;
                }
                const itemEl = document.createElement('div');
                itemEl.className = 'idd_item ' + iconCls + ((opts.sublists?.[item[0]]) ? ' idd_sublist' : '');
                itemEl.id = idItemPrefix + 'idd_item_' + item[0];
                itemEl.dataset.id = item[0];
                itemEl.tabIndex = 0;
                itemEl.setAttribute('role', 'button');
                itemEl.innerHTML = (opts.withIcon ? '<div class="idd_item_icon" id="' + item[0] + '"></div>' : '')
                    + '<div class="idd_item_name">' + (opts.html ? opts.html(item) : item[1]) + '</div>';
                itemEl.addEventListener('mouseenter', () => this._hoverItem(itemEl));
                itemEl.addEventListener('mouseleave', () => this._unhoverItem());
                content.appendChild(itemEl);
            }
            items.appendChild(content);
            this._els.popupItems = items;
            items.addEventListener('click', e => {
                if (e.target.tagName.toLowerCase() === 'a') {
                    setTimeout(() => this._hide());
                    return;
                }
                const item = e.target.closest?.('.idd_item');
                if (item && this.select(item.dataset.id)) this._hide();
                e.preventDefault();
            });
            items.addEventListener('wheel', e => {
                const wrap = this._els.popupItems;
                const inner = wrap.firstElementChild;
                if (inner && inner.offsetHeight > wrap.offsetHeight
                    && ((wrap.scrollTop <= 0 && e.deltaY < 0)
                        || (wrap.scrollTop + wrap.offsetHeight >= inner.offsetHeight && e.deltaY > 0))) {
                    e.preventDefault();
                }
            }, { passive: false });
        }

        _onClick(event) {
            if (this._els.popupEl?.isConnected) {
                this._hide();
                return;
            }
            if (activeIdd && activeIdd !== this) activeIdd._hide();
            activeIdd = this;
            window.tooltips?.hideAll?.();
            const popupEl = document.createElement('div');
            popupEl.className = 'idd_popup';
            popupEl.id = 'idd_' + this._iddEl.id;
            if (this._opts.alignLeft) popupEl.classList.add('idd_align_left');
            const rect = this._iddEl.getBoundingClientRect();
            this.openToUp = this._opts.forceDir === 1 || this._opts.forceDir === 'up'
                || (this._opts.forceDir !== -1 && this._opts.forceDir !== 'down' && (rect.bottom + 200) > window.innerHeight);
            if (this.openToUp) {
                popupEl.append(this._els.popupItems, this._els.popupHeader);
            } else {
                popupEl.append(this._els.popupHeader, this._els.popupItems);
            }
            const headerTitleEl = this._els.popupHeader.querySelector('.idd_header');
            headerTitleEl.innerHTML = this._opts.keepTitle ? this._title : (this._selected ? this._selected[1] : '');
            this._els.popupEl = popupEl;
            (this._opts.portal ? this._iddEl.closest('.ovk-diag-cont') || document.body : this._iddEl).appendChild(popupEl);
            if (this._opts.portal) {
                popupEl.style.maxWidth = `${(window.visualViewport?.width || window.innerWidth) - 8}px`;
                popupEl.style.width = (popupEl.offsetWidth + 8) + 'px';
                this._positionPopup();
                this._boundReposition ??= () => this._positionPopup();
                window.addEventListener('resize', this._boundReposition);
                window.visualViewport?.addEventListener('resize', this._boundReposition);
                window.visualViewport?.addEventListener('scroll', this._boundReposition);
                document.addEventListener('scroll', this._boundReposition, true);
                this._popupResizeObserver = new ResizeObserver(this._boundReposition);
                this._popupResizeObserver.observe(this._iddEl.closest('.ovk-diag') || this._iddEl);
                this._popupDisconnectObserver = new MutationObserver(() => {
                    if (!this._iddEl.isConnected) this._hide();
                });
                this._popupDisconnectObserver.observe(document.body, { childList: true });
            } else {
                const itemsHeight = this._els.popupItems.firstElementChild?.offsetHeight || 0;
                const addTop = this.openToUp ? -(itemsHeight + this._els.popupHeader.offsetHeight) : 0;
                popupEl.style.marginTop = ((this._opts.headerTop ?? IDD_HEADER_CORRECTION_TOP) - rect.height + addTop) + 'px';
                popupEl.style.width = (popupEl.offsetWidth + 8) + 'px';
                if (this._opts.alignLeft) {
                    popupEl.style.marginLeft = (rect.width - IDD_HEADER_CORRECTION_LEFT) + 'px';
                } else {
                    popupEl.style.marginLeft = ((this._opts.headerLeft ?? IDD_HEADER_CORRECTION_LEFT) - (this._opts.withIcon ? 20 : 0)) + 'px';
                }
            }
            popupEl.style.opacity = 1;
            this._unhoverItem();
            this._highlightItem();
            this._initEvents();
            this._opts.onShow?.(popupEl);
            if (!this._opts.disableCancelClickEvent) event?.preventDefault();
        }

        _positionPopup() {
            const popup = this._els.popupEl;
            if (!popup?.isConnected) return;
            if (!this._iddEl.isConnected) {
                this._hide();
                return;
            }
            const rect = this._iddEl.getBoundingClientRect();
            const hostRect = popup.parentElement.getBoundingClientRect();
            const viewport = window.visualViewport;
            const top = viewport?.offsetTop || 0;
            const left = viewport?.offsetLeft || 0;
            const bottom = top + (viewport?.height || window.innerHeight);
            const right = left + (viewport?.width || window.innerWidth);
            const headerHeight = this._els.popupHeader.offsetHeight;
            const upSpace = rect.top - top;
            const downSpace = bottom - rect.bottom;
            const fullHeight = this._els.popupItems.firstElementChild?.offsetHeight + headerHeight || popup.offsetHeight;
            const up = this._opts.forceDir === 1 || this._opts.forceDir === 'up'
                || (this._opts.forceDir !== -1 && this._opts.forceDir !== 'down' && downSpace < fullHeight && upSpace > downSpace);
            if (up !== this.openToUp) {
                this.openToUp = up;
                popup.replaceChildren(...(up
                    ? [this._els.popupItems, this._els.popupHeader]
                    : [this._els.popupHeader, this._els.popupItems]));
            }
            this._els.popupItems.style.maxHeight = `${Math.max(40, Math.min(290, (up ? upSpace : downSpace) - headerHeight - 8))}px`;
            const popupTop = up ? rect.top - popup.offsetHeight : rect.bottom;
            const popupLeft = this._opts.alignLeft
                ? rect.right - popup.offsetWidth
                : rect.left + (this._opts.headerLeft ?? IDD_HEADER_CORRECTION_LEFT);
            popup.style.top = `${Math.max(top + 4, Math.min(bottom - popup.offsetHeight - 4, popupTop)) - hostRect.top}px`;
            popup.style.left = `${Math.max(left + 4, Math.min(right - popup.offsetWidth - 4, popupLeft)) - hostRect.left}px`;
        }

        _hide() {
            if (activeIdd === this) activeIdd = null;
            if (this._opts.portal) {
                window.removeEventListener('resize', this._boundReposition);
                window.visualViewport?.removeEventListener('resize', this._boundReposition);
                window.visualViewport?.removeEventListener('scroll', this._boundReposition);
                document.removeEventListener('scroll', this._boundReposition, true);
                this._popupResizeObserver?.disconnect();
                this._popupDisconnectObserver?.disconnect();
            }
            this._els.popupEl?.remove();
            this._els.popupEl = null;
            this._hoveredItem?.classList.remove('idd_hover');
            this._hoveredItem = null;
            this._deinitEvents();
            clearTimeout(this._leaveTimeout);
            this._opts.onHide?.();
        }

        _highlightItem(itemId) {
            if (!this._selectable || !this._els.popupEl) return;
            if (itemId === undefined) {
                if (!this._selected) return;
                itemId = this._selected[0];
            }
            this._els.popupEl.querySelector('.idd_hl')?.classList.remove('idd_hl');
            const items = [...this._els.popupItems.querySelectorAll('.idd_item')];
            const idx = items.findIndex(el => el.dataset.id == itemId);
            if (idx < 0) return;
            items[idx].classList.add('idd_hl');
            this._els.popupItems.scrollTop = (idx + 1) * items[idx].offsetHeight - this._els.popupItems.offsetHeight / 2;
        }

        _hoverItem(itemEl, andScroll) {
            this._unhoverItem();
            if (!itemEl) return;
            itemEl.classList.add('idd_hover');
            this._hoveredItem = itemEl;
            if (andScroll) {
                const items = [...this._els.popupItems.querySelectorAll('.idd_item')];
                const idx = items.indexOf(itemEl);
                if (idx >= 0) {
                    this._els.popupItems.scrollTop = itemEl.offsetHeight * (idx + 1) - this._els.popupItems.offsetHeight / 2;
                }
            }
        }

        _unhoverItem() {
            this._hoveredItem?.classList.remove('idd_hover');
            this._hoveredItem = null;
        }

        _onKey(event) {
            const items = [...this._els.popupItems.querySelectorAll('.idd_item')];
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                const cur = this._hoveredItem || this._els.popupItems.querySelector('.idd_hl') || items[0];
                const idx = items.indexOf(cur);
                this._hoverItem(items[idx + (event.key === 'ArrowDown' ? 1 : -1)] || cur, true);
                event.preventDefault();
            } else if (event.key === 'Enter') {
                if (this._hoveredItem && this.select(this._hoveredItem.dataset.id)) this._hide();
            } else if (event.key === 'Escape') {
                this._hide();
            }
        }

        _onKeyPress(event) {
            if (event.key.length !== 1) return;
            const ch = event.key.toLowerCase();
            clearTimeout(this._searchTimeout);
            this._searchTimeout = setTimeout(() => { this._currSearchStr = ''; }, 600);
            if (!(this._currSearchStr?.length === 1 && this._currSearchStr[0] === ch)) {
                this._currSearchStr = (this._currSearchStr || '') + ch;
            }
            const items = this._items;
            for (let i = this._currQuickSearchIndex || 0; i < items.length; i++) {
                const inner = String(items[i][1]).toLowerCase();
                if ((this._currSearchStr.length === 1 && inner.startsWith(this._currSearchStr))
                    || (this._currSearchStr.length > 1 && inner.includes(this._currSearchStr))) {
                    this._currQuickSearchIndex = i + 1;
                    this._hoverItem(this._els.popupItems.querySelector('#idd_item_' + items[i][0]), true);
                    if (i === items.length - 1) this._currQuickSearchIndex = 0;
                    break;
                }
                if (i === items.length - 1) this._currQuickSearchIndex = 0;
            }
        }

        _onOuterClick(event) {
            if (!event.target.closest?.('.idd_popup')) this._hide();
        }

        _initEvents() {
            this._boundOuterClick ??= e => this._onOuterClick(e);
            this._boundKeyDown ??= e => this._onKey(e);
            this._boundKeyPress ??= e => this._onKeyPress(e);
            setTimeout(() => window.addEventListener('click', this._boundOuterClick));
            window.addEventListener('keydown', this._boundKeyDown);
            window.addEventListener('keypress', this._boundKeyPress);
            if (this._opts.autoHide > 0) {
                this._iddEl.addEventListener('mouseleave', () => {
                    clearTimeout(this._leaveTimeout);
                    this._leaveTimeout = setTimeout(() => this._hide(), this._opts.autoHide);
                });
                this._iddEl.addEventListener('mouseenter', () => clearTimeout(this._leaveTimeout));
            }
        }

        _deinitEvents() {
            window.removeEventListener('click', this._boundOuterClick);
            window.removeEventListener('keydown', this._boundKeyDown);
            window.removeEventListener('keypress', this._boundKeyPress);
        }

        deinit() {
            this._deinitEvents();
        }

        destroy() {
            this._hide();
            this._iddEl.remove();
        }

        setItems(items) {
            this._items = [...items];
            this.select(items[0][0], true);
            this._rebuildDropdown();
        }

        getElement() {
            return this._iddEl;
        }

        getSelected() {
            return this._selected;
        }

        val() {
            return this._els.hiddenInputEl.value;
        }

        select(id, silent) {
            if (this._opts.sublists?.[id]) return false;
            const selected = this._items.find(item => item[0] == id);
            if (!selected) return false;
            this._selected = selected;
            if (!this._opts.keepTitle) this._els.valueEl.innerHTML = selected[1];
            this._els.hiddenInputEl.value = id;
            let needClose = true;
            if (!silent && this._opts.onSelect) {
                needClose = this._opts.onSelect(selected[0], selected) !== false;
            }
            return needClose;
        }
    }

    const selectBridge = 'select[data-vkify-dropdown], .ovk-msg-all select[name="selected_repost_club"], .ovk-msg-all select[name="selected_repost_chat"]';
    const searchableThreshold = 12;
    const selectInstances = new Map();

    function syncNativeSelect(select, state) {
        if (!select.isConnected) return;
        const items = [...select.options].map(option => [
            option.value, option.textContent.trim(), option.disabled || option.parentElement?.disabled
        ]);
        state.dropdown.setData(items);
        state.dropdown.setAutocomplete(items.length >= searchableThreshold);
        state.dropdown.val(select.value, false);
        state.dropdown.setDisabled(select.disabled);
        state.dropdown.container.style.display = select.style.display === 'none' || select.hidden ? 'none' : '';
    }

    function teardownNativeSelect(select) {
        const state = selectInstances.get(select);
        if (!state) return;
        state.observer.disconnect();
        select.removeEventListener('change', state.onChange);
        state.form?.removeEventListener('reset', state.onReset);
        select.removeEventListener('focus', state.onFocus);
        state.dropdown.destroy();
        select.classList.remove('vk-select-native');
        selectInstances.delete(select);
    }

    function mountNativeSelect(select) {
        if (selectInstances.has(select) || !select.parentNode || select.multiple || select.size > 1) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', select.getAttribute('aria-label')
            || (select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent.trim())
            || select.closest('label')?.textContent.trim()
            || select.closest('.form_field, .search_option')?.querySelector('.form_label, .search_option_name')?.textContent.trim()
            || select.name || '');
        input.className = 'vk-select-input';
        select.after(input);
        const rect = select.getBoundingClientRect();
        let state;
        const dropdown = new Dropdown(input, [...select.options].map(option => [
            option.value, option.textContent.trim(), option.disabled || option.parentElement?.disabled
        ]), {
            width: rect.width || undefined,
            selectedItem: select.value,
            autocomplete: select.options.length >= searchableThreshold,
            onBeforeShow: () => syncNativeSelect(select, state),
            onChange: value => {
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        state = {
            dropdown,
            form: select.form,
            onChange: () => syncNativeSelect(select, state),
            onReset: () => setTimeout(() => {
                if (selectInstances.get(select) === state) syncNativeSelect(select, state);
            }, 0),
            onFocus: () => {
                dropdown.input.focus();
                dropdown.show();
            },
            observer: new MutationObserver(() => syncNativeSelect(select, state))
        };
        select.classList.add('vk-select-native');
        select.addEventListener('change', state.onChange);
        select.addEventListener('focus', state.onFocus);
        state.form?.addEventListener('reset', state.onReset);
        state.observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'selected', 'disabled', 'style', 'hidden'] });
        selectInstances.set(select, state);
        syncNativeSelect(select, state);
    }

    function updateNativeSelects(root = document) {
        for (const select of selectInstances.keys()) {
            if (!select.isConnected || window.isMobile?.()) teardownNativeSelect(select);
        }
        if (window.isMobile?.()) return;
        if (root.matches?.(selectBridge)) mountNativeSelect(root);
        root.querySelectorAll?.(selectBridge).forEach(mountNativeSelect);
    }

    vkify.bindOnce('vkDropdowns', () => {
        vkify.updateDropdowns = updateNativeSelects;
        vkify.destroyDropdowns = () => {
            for (const select of selectInstances.keys()) teardownNativeSelect(select);
        };
        vkify.ready(() => updateNativeSelects());
        vkify.onPageLifecycle('beforePageLeave', vkify.destroyDropdowns);
        vkify.onPageLifecycle('afterPageReady', () => updateNativeSelects());
        document.addEventListener('click', e => {
            const label = e.target.closest?.('label');
            const select = label?.control;
            const state = selectInstances.get(select);
            if (!state || state.dropdown.container.contains(e.target)) return;
            e.preventDefault();
            state.dropdown.input.focus();
            state.dropdown.show();
        }, true);
        vkify.observeDOM(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE
                        && (node.matches(selectBridge) || node.querySelector(selectBridge))) updateNativeSelects(node);
                }
                for (const node of mutation.removedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    for (const select of selectInstances.keys()) {
                        if (node === select || node.contains(select)) teardownNativeSelect(select);
                    }
                }
            }
        });
    });

    vkify.Dropdown = Dropdown;
    vkify.InlineDropdown = InlineDropdown;
})();
