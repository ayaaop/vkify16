(function () {
    'use strict';

    const processedDeletions = new WeakSet();
    var placeholderTimer = null;

    function showPlaceholder() {
        var placeholder = document.querySelector('.placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    function decrementCounts(delayPlaceholder) {
        var tabCount = document.querySelector('.ui_tab_sel .ui_tab_count');
        var headerCount = document.querySelector('.page_block_header .page_block_header_count');

        var hitZero = false;

        function dec(el) {
            if (!el) return;
            var val = parseInt(el.textContent.trim(), 10);
            if (Number.isNaN(val)) return;
            var next = val - 1;
            if (next <= 0) {
                el.textContent = '';
                hitZero = true;
            } else {
                el.textContent = String(next);
            }
        }

        dec(tabCount);
        dec(headerCount);

        if (hitZero) {
            if (delayPlaceholder) {
                // Delete animation: 4s "post deleted" display + 300ms slideUp
                clearTimeout(placeholderTimer);
                placeholderTimer = setTimeout(showPlaceholder, 4500);
            } else {
                showPlaceholder();
            }
        }
    }

    // Archive — al_wall.js dispatches archive:changed after slideUp+remove completes.
    window.addEventListener('archive:changed', function () {
        decrementCounts(false);
    });

    // Delete — al_wall.js replaces the post with .post-deleted (old markup keeps data-*
    // on the parent; new markup uses an entirely new .post.post-divider). We use a WeakSet
    // keyed by the .post-deleted node so each physical deletion only decrements once.
    vkify.bindOnce('postDeleteObserver', function () {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) continue;
                    if (!node.classList.contains('post-deleted')) continue;
                    if (processedDeletions.has(node)) continue;

                    processedDeletions.add(node);
                    decrementCounts(true);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
