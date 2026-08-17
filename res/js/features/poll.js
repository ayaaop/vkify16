/*
 * Stock initPoll uses event.target.closest('.post-buttons') to find the form,
 * but in vkify16 the poll link lives inside a tippy tooltip whose content is
 * moved to <body>. This version falls back to locating the tippy trigger
 * element and walking up to the form from there.
 */
window.initVkifyPoll = function (event) {
    var postButtons = event.target.closest('.post-buttons');
    var form;

    if (postButtons) {
        form = $(postButtons).parent();
    } else {
        var tippyContent = event.target.closest('.tippy-content-template');
        if (tippyContent && tippyContent.id) {
            var triggerId = tippyContent.id.replace('Tooltip', 'Trigger');
            var trigger = document.getElementById(triggerId);
            form = trigger ? $(trigger.closest('form')) : $();
        } else {
            form = $();
        }
    }

    var id = random_int(0, 100);

    var mBody = ''
        + '<div id="poll_editor' + id + '">'
        + '<input type="text" name="title" placeholder="' + tr('poll_title') + '" />'
        + '<div class="poll-options" style="margin-top: 10px;"></div>'
        + '<input type="text" name="newOption" placeholder="' + tr('poll_add_option') + '" style="margin: 5px 0;" />'
        + '<hr/>'
        + '<label><input type="checkbox" name="anon" /> ' + tr('poll_anonymous') + '</label><br/>'
        + '<label><input type="checkbox" name="multi" /> ' + tr('poll_multiple') + '</label><br/>'
        + '<label><input type="checkbox" name="locked" /> ' + tr('poll_locked') + '</label><br/>'
        + '<label>'
        + '<input type="checkbox" name="expires" />'
        + tr('poll_edit_expires')
        + '<select name="expires_in" style="width: unset;">';

    for (var c = 0; c < 32; c++) {
        mBody += '<option value="' + c + '">' + c + ' ' + tr('poll_edit_expires_days') + '</option>';
    }

    mBody += ''
        + '</select>'
        + '</label>'
        + '<div class="nobold" style="margin: 10px 5px 0">' + tr('poll_editor_tips') + '</div>'
        + '</div>';

    var msg = MessageBox(tr('create_poll'), mBody, [tr('attach'), tr('cancel')], [
        function () {
            var dialog = $(msg.getNode().nodes[0]);
            $('input', dialog).unbind();

            var title   = $('input[name=title]', dialog).val();
            var anon    = $('input[name=anon]', dialog).prop('checked') ? 'yes' : 'no';
            var multi   = $('input[name=multi]', dialog).prop('checked') ? 'yes' : 'no';
            var lock    = $('input[name=locked]', dialog).prop('checked') ? 'yes' : 'no';
            var expires = 'infinite';
            if ($('input[name=expires]', dialog).prop('checked')) {
                expires = $('select[name=expires_in]', dialog).val();
            }

            var options = '';
            $('.poll-option', dialog).each(function () {
                if ($(this).val().length === 0) return;
                options += '<option>' + escapeXML($(this).val()) + '</option>';
            });

            var xml = ''
                + '<Poll title="' + title + '" anonymous="' + anon + '" multiple="' + multi + '" locked="' + lock + '" duration="' + expires + '">'
                + '<options>' + options + '</options>'
                + '</Poll>';

            $('input[name=poll]', form).val(xml);
            $('.post-has-poll', form).show();
        },
        function () {
            $('input', $(msg.getNode())).unbind();
        }
    ], true);

    var editor = $('#poll_editor' + id);
    $('input[name=newOption]', editor).bind('focus', function () {
        var newOption = $('<input type="text" class="poll-option" style="margin: 5px 0;" />');
        newOption.appendTo($('.poll-options', editor));
        newOption.focus();
        newOption.bind('keydown', function (e) {
            if (e.key === 'Enter' && $(this).next().length === 0) {
                $('input[name=newOption]', editor).focus();
                return;
            }

            if ($(this).val().length > 0) return;

            if (e.key !== 'Backspace') return;

            if ($(this).siblings().length === 0) return;

            if ($(this).prev().length === 0) {
                $(this).next().focus();
            } else {
                $(this).prev().focus();
            }

            e.preventDefault();
            $(this).unbind('keydown');
            $(this).remove();
        });
    });
};
