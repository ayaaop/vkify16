// Theme-owned document edit dialog. Stock al_docs.js ships a broken
// onEditIconButtonClick (references undefined `e`), so the theme wires
// #edit_icon controls to this implementation instead.

window.vkifyDocEdit = async function (e) {
    e.preventDefault()
    if (u("#ajloader").hasClass("shown")) {
        return
    }

    const target = u(e.target).closest("#edit_icon")
    const item = target.closest('.docMainItem')
    const id = item.nodes[0].dataset.id

    CMessageBox.toggleLoader()

    const docs = await window.OVKAPI.call('docs.getById', { docs: id, return_tags: 1 })
    const doc = docs[0]
    if (!doc) {
        fastError("(")
        CMessageBox.toggleLoader()
        return
    }

    const cmsg = new CMessageBox({
        unique_name: "document_edit_modal",
        title: tr("document_editing_in_general"),
        body: `
            <p><b>${tr("info_name")}</b></p>
            <input maxlength="128" type="text" name="doc_name" value="${escapeHtml(doc.title)}" placeholder="...">

            <label>
                <input value="0" type="radio" name="doc_access" ${doc.folder_id != 3 ? "checked" : ''}>
                ${tr("private_document")}
            </label>
            <br>
            <label>
                <input value="3" type="radio" name="doc_access" ${doc.folder_id == 3 ? "checked" : ''}>
                ${tr("public_document")}
            </label>

            <p><b>${tr("tags")}</b></p>
            <input maxlength="256" type="text" name="doc_tags" value="${escapeHtml(doc.tags.join(','))}" placeholder="...">
            <br>
            <label>
                <input type="checkbox" name="doc_owner" ${doc.is_hidden ? "checked" : ''}>
                ${tr("owner_is_hidden")}
            </label>
        `,
        buttons: [tr('save'), tr('cancel')],
        callbacks: [async () => {
            const params = {
                owner_id: id.split('_')[0],
                doc_id: id.split('_')[1],
                title: u(`input[name='doc_name']`).nodes[0].value,
                tags: u(`input[name='doc_tags']`).nodes[0].value,
                folder_id: u(`input[name="doc_access"]:checked`).nodes[0].value,
                owner_hidden: u(`input[name="doc_owner"]`).nodes[0].checked ? 1 : 0,
            }

            const edit = await window.OVKAPI.call('docs.edit', params)
            if (edit == 1) {
                item.find('.doc_content .doc_name').html(escapeHtml(params.title))
                item.find('.doc_content .doc_tags').html(escapeHtml(params.tags))
            }
        }, Function.noop],
    })
    cmsg.getNode().find('.ovk-diag-body').attr('style', "padding:15px;")
    cmsg.getNode().attr('style', "width: 400px;")

    CMessageBox.toggleLoader()
}
