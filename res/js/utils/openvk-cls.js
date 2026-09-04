const _loader_link = '/assets/packages/static/openvk/img/loading_mini.gif';

window.parseAjaxResponse = function (responseString) {
    try {
        const response = JSON.parse(responseString);
        if (response.flash)
            NewNotification(response.flash.title, response.flash.message || "", null);

        return response.success || false;
    } catch (error) {
        if (responseString === "Хакеры? Интересно...") {
            location.reload();
            return false;
        } else {
            throw error;
        }
    }
};

window.autoTab = function (original, next, previous) {
    if (original.getAttribute && original.value.length == original.getAttribute("maxlength") && next !== undefined)
        next.focus();
    else if (original.value.length == 0 && previous !== undefined)
        previous.focus();
};

window.setClubAdminComment = function (clubId, adminId, hash) {
    MessageBox("Изменить комментарий к администратору", `
        <form action="/club${clubId}/setAdmin" method="post" id="uClubAdminCommentForm_${clubId}_${adminId}">
            <input type="hidden" name="user" value="${adminId}">
            <input type="hidden" name="hash" value="${hash}">
            <input type="hidden" name="removeComment" id="uClubAdminCommentRemoveCommentInput_${clubId}_${adminId}" value="0">
            <textarea name="comment" id="uClubAdminCommentTextArea_${clubId}_${adminId}"></textarea><br><br>
        </form>
    `, [tr('edit_action'), tr('cancel')], [
        () => {
            if (document.querySelector(`#uClubAdminCommentTextArea_${clubId}_${adminId}`).value === "") {
                document.querySelector(`#uClubAdminCommentRemoveCommentInput_${clubId}_${adminId}`).value = "1";
            }

            document.querySelector(`#uClubAdminCommentForm_${clubId}_${adminId}`).submit();
        },
        Function.noop
    ]);
};

window.showSupportFastAnswerDialog = function (answers) {
    let html = "";
    for (const [index, answer] of Object.entries(answers)) {
        html += `
            <div class="hover-box" onclick="supportFastAnswerDialogOnClick(fastAnswers[${index}])">
                ${answer.replace(/\n/g, "<br />")}
            </div>
        `;
    }

    MessageBox(tr("fast_answers"), html, [tr("close")], [
        Function.noop
    ]);
};

window.supportFastAnswerDialogOnClick = function (answer) {
    u("body").removeClass("dimmed");
    u(".ovk-diag-cont").remove();

    const answerInput = document.querySelector("#answer_text");
    answerInput.value = answer;
    answerInput.focus();
};

window.saveTimezoneSettings = function () {
    let tz = u('select#timezone').last().value;

    let xhr = new XMLHttpRequest();
    xhr.open("POST", "/iapi/timezone", true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.onload = (response) => {
        if (JSON.parse(response.currentTarget.responseText).success != 0) {
            const msg = new CMessageBox({
                title: tr('success'),
                body: tr('timezone_change_success'),
                buttons: [tr('ok')],
                callbacks: [() => { }]
            });
        }
    };
    xhr.send('timezone=' + tz);
};

window.showCoinsTransferDialog = function (coinsCount, hash) {
    MessageBox(tr("transfer_poins"), `
        <div class="messagebox-content-header">
            ${tr("points_transfer_dialog_header_1")}
            ${tr("points_transfer_dialog_header_2")} <b>${tr("points_amount", coinsCount)}</b>
        </div>
        <form action="/coins_transfer" method="post" id="coins_transfer_form" style="margin-top: 30px">
            <table class="flexible_table" cellspacing="7" cellpadding="0" border="0" align="center">
                <tbody>
                    <tr>
                        <td width="120" valign="top">
                            <span class="nobold">${tr("receiver_address")}:</span>
                        </td>
                        <td>
                            <input type="text" name="receiver" style="width: 100%;" />
                        </td>
                    </tr>
                    <tr>
                        <td width="120" valign="top">
                            <span class="nobold">${tr("coins_count")}:</span>
                        </td>
                        <td>
                            <input type="text" name="value" style="width: 100%;" />
                        </td>
                    </tr>
                    <tr>
                        <td width="120" valign="top">
                            <span class="nobold">${tr("message")}:</span>
                        </td>
                        <td>
                            <textarea name="message" style="width: 100%;"></textarea>
                        </td>
                    </tr>
                </tbody>
            </table>
            <input type="hidden" name="hash" value="${hash}" />
        </form>
    `, [tr("transfer_poins_button"), tr("cancel")], [
        () => {
            document.querySelector("#coins_transfer_form").submit();
        },
        Function.noop
    ]);
};