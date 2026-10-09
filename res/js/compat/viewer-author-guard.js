(function () {
'use strict';

// Upstream bug workaround (cannot edit Web/static/js):
// Viewer.loadCustomContext (messagebox.js) always passes null
// profiles/groups into _appendApiItem, and the messenger's showAttachment
// hits that path for video attachments. VideoViewer._appendItemToList then
// dereferences them in find_author (utils.js) -> TypeError, leaving
// item.author unset so _updFrame logs a second TypeError.

try {
    if (typeof window.find_author === 'function') {
        const origFindAuthor = window.find_author;
        window.find_author = function (id, profiles, groups) {
            return origFindAuthor(id, profiles ?? [], groups ?? []);
        };
    }

    if (typeof VideoViewer !== 'undefined') {
        const origAppendItem = VideoViewer.prototype._appendItemToList;
        VideoViewer.prototype._appendItemToList = function (pid, item, profiles, groups) {
            origAppendItem.call(this, pid, item, profiles, groups);
            if (item && item.author == null) {
                item.author = { name: 'someone' };
            }
        };
    }
} catch (e) {
}

})();
