(function () {
'use strict';

vkify.paginator = vkify.paginator || {};
let paginatorAutoScrollInit = false;
let paginatorScrollBound = false;

const setButtonLoadingState = (btn, isLoading) => {
    if (!btn || btn.length < 1) return;

    const isUmbrella = typeof btn.addClass === 'function';

    if (isLoading) {
        if (isUmbrella) {
            btn.addClass('lagged');
            if (!btn.attr('data-paginator-original-class')) {
                btn.attr('data-paginator-original-class', btn.attr('class') || '');
            }
            btn.removeClass('button_gray').addClass('button_light');
            if (!btn.find('.pr').length) {
                LoaderUtils.showInButton(btn);
            }
        } else {
            btn.classList?.add('lagged');
            if (!btn.dataset?.vkifyPaginatorOriginalClass) {
                btn.dataset.vkifyPaginatorOriginalClass = btn.className || '';
            }
        }
    } else {
        const orig = isUmbrella ? btn.attr('data-paginator-original-class') : btn?.dataset?.vkifyPaginatorOriginalClass;
        LoaderUtils.restoreButton(isUmbrella ? btn : u(btn));
        if (typeof orig === 'string') {
            if (isUmbrella) {
                btn.attr('class', orig);
                if (typeof btn.removeAttr === 'function') {
                    btn.removeAttr('data-paginator-original-class');
                }
            } else {
                btn.className = orig;
                delete btn.dataset.vkifyPaginatorOriginalClass;
            }
        }
        if (isUmbrella) {
            btn.removeClass('lagged');
        } else {
            btn.classList?.remove('lagged');
        }
    }
};

const getNextPageNumber = (paginatorEl) => {
    const paginator = u(paginatorEl);
    const activeTab = paginator.find('.active');
    const nextAnchor = u(activeTab.nodes[0] ? activeTab.nodes[0].nextElementSibling : null);

    if (nextAnchor.length > 0) {
        const num = Number(nextAnchor.html());
        if (!Number.isNaN(num)) {
            return num;
        }
    }

    if (paginatorEl && paginatorEl.dataset) {
        const current = Number(paginatorEl.dataset.currentPage || 0);
        const total = Number(paginatorEl.dataset.totalPages || 0);
        if (current > 0 && total > 0 && current < total) {
            return current + 1;
        }
    }

    return null;
};

const scrollNodeUid = (node) => node?.dataset?.uniqueid || node?.dataset?.id || null;

const scrollNodeExists = (containerEl, uid) => {
    if (!uid) return false;
    if (containerEl) {
        try {
            if (containerEl.querySelector(`[data-uniqueid='${CSS.escape(uid)}'], [data-id='${CSS.escape(uid)}']`)) {
                return true;
            }
        } catch (e) { }
    }
    return u(`.scroll_node[data-uniqueid='${uid}']`).length > 0
        || u(`.scroll_node[data-id='${uid}']`).length > 0;
};

const checkExhaustion = (paginatorEl, pageToCheck) => {
    if (!paginatorEl) return false;

    const current = Number(paginatorEl.dataset?.currentPage || 0);
    const total = Number(paginatorEl.dataset?.totalPages || 0);
    if ((total && pageToCheck > total) || (total && current >= total)) {
        const containerEl = getScrollContainer(paginatorEl);
        if (containerEl) containerEl.dataset.paginatorExhausted = 'true';
        return true;
    }
    return false;
};

// State is now tracked per container to allow multiple paginators
window.__resetPaginatorState = function(containerEl = null) {
    if (!containerEl) {
        document.querySelectorAll('.scroll_container').forEach(el => {
            delete el.dataset.paginatorLoading;
            delete el.dataset.paginatorLastLoaded;
            delete el.dataset.paginatorExhausted;
        });
    } else {
        delete containerEl.dataset.paginatorLoading;
        delete containerEl.dataset.paginatorLastLoaded;
        delete containerEl.dataset.paginatorExhausted;
    }
};

const PAGINATOR_ROOT_MARGIN = 200;

const isPaginatorNearViewport = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const inWindow = rect.top < window.innerHeight + PAGINATOR_ROOT_MARGIN && rect.bottom > -PAGINATOR_ROOT_MARGIN;
    if (!inWindow) return false;

    const scrollParent = el.closest('.scroll_container');
    if (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
        const pStyle = window.getComputedStyle(scrollParent);
        if (/(auto|scroll)/.test((pStyle.overflowY || '') + (pStyle.overflow || ''))) {
            const pRect = scrollParent.getBoundingClientRect();
            return rect.top < pRect.bottom + PAGINATOR_ROOT_MARGIN && rect.bottom > pRect.top - PAGINATOR_ROOT_MARGIN;
        }
    }
    return true;
};

const getPaginatorElement = () => {
    const modal = document.querySelector('.ovk-msg-all:not(.msgbox-hidden), .ovk-photo-view-dimmer:not(.msgbox-hidden)');
    if (modal) {
        // Post popup comments are driven by their own CF.infiniteScroll instance
        const modalPaginators = [...modal.querySelectorAll('.vkify-paginator:not(.vkify-paginator-at-top)')]
            .filter(el => !el.closest('.post_popup_modal'));
        return modalPaginators[0] || null;
    }
    return document.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)');
};

const MODAL_SCOPE_SELECTOR = '.ovk-msg-all, .ovk-photo-view-dimmer, .post_popup_modal';

const getScrollContainer = (paginatorEl) => {
    if (!paginatorEl) return document.querySelector('.page_body .scroll_container');

    const host = paginatorEl.closest('.scroll_container');
    if (host) return host;

    const modal = paginatorEl.closest(MODAL_SCOPE_SELECTOR);
    if (modal) {
        return modal.querySelector('.scroll_container') || null;
    }

    const scope = paginatorEl.closest('.page_padding, .page_block, .wide_column, #content, main');
    const scoped = scope?.querySelectorAll('.scroll_container');
    if (scoped && scoped.length > 0) {
        if (scoped.length === 1) return scoped[0];

        const preceding = [...scoped].filter(c =>
            !!(paginatorEl.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING));
        return preceding.length > 0 ? preceding[preceding.length - 1] : scoped[0];
    }

    return document.querySelector('.page_body .scroll_container') || null;
};

const getPaginatorInsertAnchor = (containerEl, paginatorEl) => {
    return paginatorEl?.closest('.clear_fix') || paginatorEl;
};

const appendScrollNode = (containerEl, paginatorEl, node) => {
    const uid = scrollNodeUid(node);
    if (uid && scrollNodeExists(containerEl, uid)) return;

    const imported = document.importNode(node, true);
    const anchor = getPaginatorInsertAnchor(containerEl, paginatorEl);

    if (anchor && anchor.parentElement === containerEl) {
        containerEl.insertBefore(imported, anchor);
    } else {
        containerEl.appendChild(imported);
    }
};

const getLastLoadedPage = (paginatorEl, containerEl) => {
    if (containerEl?.dataset?.paginatorLastLoaded) {
        const p = Number(containerEl.dataset.paginatorLastLoaded);
        if (!Number.isNaN(p)) return p;
    }
    if (paginatorEl?.dataset?.currentPage) {
        const p = Number(paginatorEl.dataset.currentPage);
        if (!Number.isNaN(p)) return p;
    }
    return 0;
};

const refreshAlbumMasonry = (containerEl) => {
    if (!containerEl || !containerEl.classList.contains('album_photos')) return;
    if (typeof window.applyVkifyAlbumMosaic === 'function') {
        window.applyVkifyAlbumMosaic();
        return;
    }
    if (typeof window.repositionAlbumCards === 'function') {
        window.repositionAlbumCards();
    }
};

const isPaginatorTriggerZone = (paginatorEl) => {
    if (!paginatorEl) return false;
    const triggerBtn = paginatorEl.querySelector('.vkify-paginator-loader');
    if (!triggerBtn) return false;
    return isPaginatorNearViewport(paginatorEl);
};

const canLoadNextPage = (paginatorEl) => {
    if (!paginatorEl) return false;
    const containerEl = getScrollContainer(paginatorEl);
    if (!containerEl) return false;
    if (containerEl.dataset.paginatorLoading) return false;
    if (containerEl.dataset.paginatorExhausted) return false;
    const nextNum = getNextPageNumber(paginatorEl);
    if (!nextNum || Number.isNaN(nextNum)) return false;
    const lastLoaded = getLastLoadedPage(paginatorEl, containerEl);
    if (nextNum <= lastLoaded) return false;
    if (checkExhaustion(paginatorEl, nextNum)) return false;
    const triggerBtn = paginatorEl.querySelector('.vkify-paginator-loader');
    if (!triggerBtn) return false;
    return !triggerBtn.classList.contains('lagged');
};

const shouldAllowAutoScroll = () => {
    if (document.body.classList.contains('no-scroll')) return false;
    if (Number(localStorage.getItem('ux.disable_ajax_routing') ?? 0) === 1) return false;
    if (window.openvk?.current_id === 0 || window.openvk?.disable_ajax === 1) return false;
    if (window.isPaginatorDisabled) return false;
    return true;
};

const resolveFetchUrl = (paginatorEl, containerEl, page) => {
    let fetchUrlStr = null;

    if (paginatorEl?.dataset?.fetchUrl) {
        fetchUrlStr = paginatorEl.dataset.fetchUrl;
    } else if (containerEl?.dataset?.fetchUrl) {
        fetchUrlStr = containerEl.dataset.fetchUrl;
    } else {
        const fetchUrlNode = paginatorEl?.closest('[data-fetch-url]');
        if (fetchUrlNode?.dataset?.fetchUrl) {
            fetchUrlStr = fetchUrlNode.dataset.fetchUrl;
        }
    }

    if (!fetchUrlStr) {
        const form = paginatorEl?.querySelector('form[action]');
        const action = form?.getAttribute('action');
        if (action && !action.startsWith('javascript:')) {
            if (action.startsWith('/') || action.startsWith('http')) {
                fetchUrlStr = action;
            } else if (action.startsWith('?')) {
                const isModal = paginatorEl?.closest(MODAL_SCOPE_SELECTOR);
                if (isModal) {
                    const zParam = new URLSearchParams(window.location.search).get('z');
                    const wParam = new URLSearchParams(window.location.search).get('w');
                    if (zParam) {
                        fetchUrlStr = '/' + zParam.split('/')[0] + action;
                    } else if (wParam && wParam.startsWith('wall')) {
                        fetchUrlStr = '/' + wParam + action;
                    }
                }
            }
        }
    }

    if (!fetchUrlStr) {
        const isModal = paginatorEl && paginatorEl.closest(MODAL_SCOPE_SELECTOR);
        if (isModal) {
            const zParam = new URLSearchParams(window.location.search).get('z');
            const wParam = new URLSearchParams(window.location.search).get('w');
            if (zParam) {
                const cleanZ = zParam.split('/')[0];
                fetchUrlStr = '/' + cleanZ;
            } else if (wParam && wParam.startsWith('wall')) {
                fetchUrlStr = '/' + wParam;
            }
        }
    }

    if (!fetchUrlStr) {
        const cleanLoc = new URL(location.href);
        cleanLoc.searchParams.delete('z');
        cleanLoc.searchParams.delete('w');
        fetchUrlStr = cleanLoc.pathname + cleanLoc.search;
    }

    const replaceUrl = new URL(fetchUrlStr, location.origin);
    replaceUrl.searchParams.set('p', page);
    return replaceUrl;
};

window.__processPaginatorNextPage = async function (page, targetPaginator = null) {
        const paginatorEl = targetPaginator || getPaginatorElement();
        if (!paginatorEl) return;
        
        const containerEl = getScrollContainer(paginatorEl);
        if (!containerEl) return;
        if (containerEl.dataset.paginatorExhausted) return;

        const lastLoaded = getLastLoadedPage(paginatorEl, containerEl);
        if (page <= lastLoaded) return;
        if (checkExhaustion(paginatorEl, page)) return;

        try {
            const replaceUrl = resolveFetchUrl(paginatorEl, containerEl, page);

            const res = await ky(replaceUrl.href, { throwHttpErrors: false });
            if (res.redirected || !res.ok) {
                throw new Error(res.redirected ? 'Page redirected' : `HTTP ${res.status}`);
            }
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

            let targetDocContainer = null;
            if (containerEl.id) {
                targetDocContainer = doc.getElementById(containerEl.id);
            }
            if (!targetDocContainer && containerEl.dataset.fetchUrl) {
                try {
                    targetDocContainer = doc.querySelector(`.scroll_container[data-fetch-url="${CSS.escape(containerEl.dataset.fetchUrl)}"]`);
                } catch (e) { }
            }
            if (!targetDocContainer) {
                const isModal = paginatorEl && paginatorEl.closest(MODAL_SCOPE_SELECTOR);
                if (isModal) {
                    targetDocContainer = doc.querySelector('.pv_comments .scroll_container, .video_comments .scroll_container, #replies .scroll_container, .scroll_container');
                } else {
                    const liveContainers = [...document.querySelectorAll('.page_body .scroll_container')];
                    const containerIndex = liveContainers.indexOf(containerEl);
                    const docContainers = doc.querySelectorAll('.page_body .scroll_container');
                    if (containerIndex >= 0 && docContainers[containerIndex]) {
                        targetDocContainer = docContainers[containerIndex];
                    }
                }
                if (!targetDocContainer) {
                    targetDocContainer = doc.querySelector('.page_body .scroll_container, .wide_column .scroll_container') || doc.querySelector('.scroll_container');
                }
            }

            let newNodes = [];
            if (targetDocContainer) {
                newNodes = Array.from(targetDocContainer.querySelectorAll('.scroll_node')).filter(node => {
                    return node.closest('.scroll_container') === targetDocContainer;
                });
            } else {
                newNodes = Array.from(doc.querySelectorAll('.scroll_node')).filter(node => {
                    const parentContainer = node.closest('.scroll_container');
                    return !parentContainer || parentContainer.parentElement === doc.body || !node.parentElement.closest('.scroll_node');
                });
            }

            newNodes.forEach(node => appendScrollNode(containerEl, paginatorEl, node));

            const newPaginator = targetDocContainer?.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)')
                || doc.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)');
            const currentPaginator = paginatorEl;

            if (newPaginator && currentPaginator) {
                currentPaginator.innerHTML = newPaginator.innerHTML;
                currentPaginator.dataset.currentPage = newPaginator.dataset.currentPage || '';
                currentPaginator.dataset.totalPages = newPaginator.dataset.totalPages || '';
            } else if (newPaginator && !currentPaginator && containerEl) {
                containerEl.appendChild(newPaginator.closest('.clear_fix') || newPaginator.parentElement || newPaginator);
            } else if (!newPaginator && currentPaginator) {
                currentPaginator.remove();
                if (containerEl) {
                    containerEl.dataset.paginatorLastLoaded = page;
                    containerEl.dataset.paginatorExhausted = 'true';
                }
                return;
            } else if (!newPaginator && !currentPaginator) {
                if (containerEl) {
                    containerEl.dataset.paginatorLastLoaded = page;
                    containerEl.dataset.paginatorExhausted = 'true';
                }
                return;
            }

            const updatedPaginator = currentPaginator || targetPaginator;
            const paginatorWrap = updatedPaginator?.closest('.clear_fix') || updatedPaginator?.parentElement;
            if (containerEl && paginatorWrap && paginatorWrap.parentElement === containerEl && containerEl.lastElementChild !== paginatorWrap) {
                containerEl.appendChild(paginatorWrap);
            }

            refreshAlbumMasonry(containerEl);

            if (updatedPaginator) {
                const currentFromDom = Number(updatedPaginator.dataset.currentPage || 0);
                const effectiveCurrent = Math.max(currentFromDom || 0, page);
                updatedPaginator.dataset.currentPage = String(effectiveCurrent);

                const totalPagesNum = Number(updatedPaginator.dataset.totalPages || 0);
                if (containerEl) containerEl.dataset.paginatorLastLoaded = effectiveCurrent;

                if (totalPagesNum && effectiveCurrent >= totalPagesNum) {
                    u(updatedPaginator).remove();
                    if (containerEl) containerEl.dataset.paginatorExhausted = 'true';
                    return;
                }

                if (checkExhaustion(updatedPaginator, page)) {
                    return;
                }
            }

            if (window.player?.isAtAudiosPage?.() && window.player?.isAtCurrentContextPage?.()) {
                window.player.loadContext(page);
                window.player.__highlightActiveTrack();
            }

            if (typeof __scrollHook !== 'undefined') {
                __scrollHook(page);
            }
        } catch (e) {
            console.error('Paginator Error:', e);
        }
};

const handlePaginationTrigger = async (paginatorNode, btnNode) => {
    const paginator = u(paginatorNode);
    const containerEl = getScrollContainer(paginatorNode);
    if (containerEl && (containerEl.dataset.paginatorLoading || containerEl.dataset.paginatorExhausted)) return;

    const btn = u(btnNode);
    if (btn.hasClass('lagged')) return;

    if (containerEl) containerEl.dataset.paginatorLoading = 'true';

    setButtonLoadingState(btn, true);

    const pageNumber = getNextPageNumber(paginatorNode);
    if (!pageNumber || Number.isNaN(pageNumber) || checkExhaustion(paginatorNode, pageNumber)) {
        if (containerEl) delete containerEl.dataset.paginatorLoading;
        setButtonLoadingState(btn, false);
        return;
    }

    try {
        await window.__processPaginatorNextPage(pageNumber, paginatorNode);
        try { bsdnHydrate(); } catch (e) { }

        const updatedEl = paginatorNode && document.body.contains(paginatorNode)
            ? paginatorNode
            : (containerEl?.querySelector('.vkify-paginator:not(.vkify-paginator-at-top)') || null);
        if (updatedEl) {
            checkExhaustion(updatedEl, pageNumber);
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (containerEl) delete containerEl.dataset.paginatorLoading;
        if (paginatorNode && document.body.contains(paginatorNode)) {
            const refreshedBtn = u(paginatorNode).find('.vkify-paginator-loader');
            setButtonLoadingState(refreshedBtn, false);
        }
        if (!containerEl || !containerEl.dataset.paginatorExhausted) {
            vkify.paginator.scheduleCheck?.();
        }
    }
};

if (!paginatorAutoScrollInit) {
    paginatorAutoScrollInit = true;

    if (typeof showMoreObserver !== 'undefined' && u('.vkify-paginator').length > 0) {
        try {
            showMoreObserver.disconnect();
        } catch (e) { /* stock al_wall observer */ }
    }

    let scrollCheckScheduled = false;
    let scrollCheckTimer = null;

    const checkPaginatorInView = () => {
        if (!shouldAllowAutoScroll()) return;

        const hasModal = !!document.querySelector('.ovk-msg-all:not(.msgbox-hidden), .ovk-photo-view-dimmer:not(.msgbox-hidden)');

        const paginators = document.querySelectorAll('.vkify-paginator:not(.vkify-paginator-at-top)');
        paginators.forEach(paginatorEl => {
            const inModal = !!paginatorEl.closest(MODAL_SCOPE_SELECTOR);
            if (hasModal && !inModal) return;

            // Post popup comments are driven by their own CF.infiniteScroll instance
            if (paginatorEl.closest('.post_popup_modal')) return;

            if (!getScrollContainer(paginatorEl)) return;
            if (!isPaginatorTriggerZone(paginatorEl)) return;
            if (!canLoadNextPage(paginatorEl)) return;

            const btn = u(paginatorEl).find('.vkify-paginator-loader');
            if (btn.length < 1) return;

            handlePaginationTrigger(paginatorEl, btn.nodes[0]);
        });
    };

    const schedulePaginatorCheck = () => {
        if (scrollCheckTimer) {
            clearTimeout(scrollCheckTimer);
        }
        scrollCheckTimer = setTimeout(() => {
            scrollCheckTimer = null;
            checkPaginatorInView();
        }, 80);
    };

    const schedulePaginatorCheckBurst = () => {
        schedulePaginatorCheck();
        setTimeout(checkPaginatorInView, 250);
        setTimeout(checkPaginatorInView, 600);
    };

    const schedulePaginatorCheckSoon = () => {
        if (scrollCheckScheduled) return;
        if (!getPaginatorElement()) return;
        scrollCheckScheduled = true;
        requestAnimationFrame(() => {
            scrollCheckScheduled = false;
            checkPaginatorInView();
            schedulePaginatorCheck();
        });
    };

    vkify.paginator.check = checkPaginatorInView;
    vkify.paginator.scheduleCheck = schedulePaginatorCheckBurst;

    const initPaginatorAutoScroll = () => {
        const paginatorEl = getPaginatorElement();
        if (paginatorEl) {
            const containerEl = getScrollContainer(paginatorEl);
            if (typeof window.__resetPaginatorState === 'function' && containerEl) {
                window.__resetPaginatorState(containerEl);
            }
        }
        schedulePaginatorCheckSoon();
    };

    if (!paginatorScrollBound) {
        paginatorScrollBound = true;
        window.addEventListener('scroll', schedulePaginatorCheckSoon, { passive: true, capture: true });
        window.addEventListener('resize', schedulePaginatorCheckSoon, { passive: true });
    }

    u(document).on('click', '.vkify-paginator-loader', async (e) => {
        const ajaxRoutingDisabled = Number(localStorage.getItem('ux.disable_ajax_routing') ?? 0) === 1 || window.openvk?.current_id === 0 || window.openvk?.disable_ajax === 1;
        if (ajaxRoutingDisabled) {
            return;
        }

        const btn = u(e.currentTarget);
        const paginatorEl = btn.closest('.vkify-paginator').nodes[0];

        // Post popup comments are driven by their own CF.infiniteScroll instance
        if (paginatorEl && paginatorEl.closest('.post_popup_modal')) return;

        const containerEl = getScrollContainer(paginatorEl);
        if (!containerEl) {
            // No AJAX target container: navigate manually because GET forms
            // drop the action's own query string on submission.
            const action = paginatorEl?.querySelector('form[action]')?.getAttribute('action');
            if (action) {
                e.preventDefault();
                window.location.assign(action);
            }
            return;
        }

        e.preventDefault();
        await handlePaginationTrigger(paginatorEl, btn.nodes[0]);
    });

    vkify.onPage(initPaginatorAutoScroll);
}

})();
