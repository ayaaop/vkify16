(function () {
'use strict';

const Hb = window.Handlebars;

const DEFAULT_AVATAR_PATH = '/assets/packages/static/openvk/img/camera_200.png';

const peopleModuleTpl = Hb.compile(
    '<div class="module clear people_module">' +
        '<a href="{{headerUrl}}" class="module_header">' +
            '<h3 class="header_top clear_fix">' +
                '<span class="header_label fl_l">{{{label}}}</span>' +
                '<span class="header_count fl_l">{{count}}</span>' +
            '</h3>' +
        '</a>' +
        '<div class="module_body clear_fix">' +
            '<div class="search_row">' +
                '{{#each items}}' +
                    '<div class="people_cell">' +
                        '<a class="people_cell_ava" href="{{url}}">' +
                            '<img src="{{{photo_50}}}" class="avatar people_cell_img" width="50" height="50" alt="{{name}}">' +
                        '</a>' +
                        '<div class="people_cell_name"><a href="{{url}}">{{name}}</a></div>' +
                    '</div>' +
                '{{/each}}' +
            '</div>' +
        '</div>' +
    '</div>'
);

function renderPeopleModule(items, limit, headerUrl, label, count, urlPrefix, placeholder, nameFn) {
    const mapped = items.slice(0, limit).map(item => ({
        url: urlPrefix + item.id,
        photo_50: item.photo_50 && item.photo_50.indexOf(DEFAULT_AVATAR_PATH) === -1 ? item.photo_50 : vkify.resourceUrl(placeholder),
        name: nameFn(item)
    }));
    return peopleModuleTpl({ headerUrl, label, count, items: mapped });
}

const audioModuleTpl = Hb.compile(
    '<div class="module clear audio_module">' +
        '<a href="{{headerUrl}}" class="module_header">' +
            '<h3 class="header_top clear_fix">' +
                '<span class="header_label fl_l">{{{label}}}</span>' +
                '<span class="header_count fl_l">{{count}}</span>' +
            '</h3>' +
        '</a>' +
        '<div class="module_body clear_fix">' +
            '<div class="content_list long">' +
                '{{#each items}}' +
                    '<div id="audioEmbed-fasttip-{{id}}" data-realid="{{id}}" data-name="{{name}}" data-genre="{{genre}}" class="audioEmbed ctx_place{{#if isWithdrawn}} withdrawn{{/if}}" data-length="{{length}}" data-keys="{{{keysJson}}}" data-url="{{url}}">' +
                        '<audio class="audio"></audio>' +
                        '<div id="miniplayer" class="audioEntry">' +
                            '<div class="audioEntryWrapper" draggable="true">' +
                                '<div class="playerButton">' +
                                    '<div class="playIcon"></div>' +
                                '</div>' +
                                '<div class="status">' +
                                    '<div class="mediaInfo noOverflow">' +
                                        '<div class="info">' +
                                            '<strong class="performer">{{performer}}</strong>' +
                                            ' — ' +
                                            '<span class="title">{{title}}</span>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="mini_timer">' +
                                    '<span class="nobold" data-unformatted="{{length}}">{{formattedLength}}</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="subTracks" draggable="false">' +
                                '<div class="lengthTrackWrapper">' +
                                    '<div class="track lengthTrack">' +
                                        '<div class="selectableTrack">' +
                                            '<div class="selectableTrackRail"></div>' +
                                            '<div class="selectableTrackLoadProgress"><div class="load_bar"></div></div>' +
                                            '<div class="selectableTrackPlayed"></div>' +
                                            '<div class="slider"></div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="volumeTrackWrapper">' +
                                    '<div class="track volumeTrack">' +
                                        '<div class="selectableTrack">' +
                                            '<div class="selectableTrackRail"></div>' +
                                            '<div class="selectableTrackPlayed"></div>' +
                                            '<div class="slider"></div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '{{/each}}' +
            '</div>' +
        '</div>' +
    '</div>'
);

const docsModuleTpl = Hb.compile(
    '<div class="module clear">' +
        '<a href="{{headerUrl}}" class="module_header">' +
            '<h3 class="header_top clear_fix">' +
                '<span class="header_label fl_l">{{{label}}}</span>' +
                '<span class="header_count fl_l">{{count}}</span>' +
            '</h3>' +
        '</a>' +
        '<div class="module_body clear_fix">' +
            '{{#each items}}' +
                '<div class="search_row docMainItem docListViewItem">' +
                    '<a class="viewerOpener" href="{{url}}">' +
                        '<div class="doc_icon page_doc_icon{{#if ext}} page_doc_icon_{{ext}}{{/if}}"></div>' +
                    '</a>' +
                    '<div class="doc_content noOverflow">' +
                        '<a class="viewerOpener noOverflow" href="{{url}}"><b class="noOverflow doc_name">{{title}}</b></a>' +
                        '{{#if owner}}<div class="doc_content_info">{{owner}}</div>{{/if}}' +
                    '</div>' +
                '</div>' +
            '{{/each}}' +
        '</div>' +
    '</div>'
);



const videoModuleTpl = Hb.compile(
    '<div class="module clear video_module">' +
        '<a href="{{headerUrl}}" class="module_header">' +
            '<h3 class="header_top clear_fix">' +
                '<span class="header_label fl_l">{{{label}}}</span>' +
                '<span class="header_count fl_l">{{count}}</span>' +
            '</h3>' +
        '</a>' +
        '<div class="module_body clear_fix">' +
            '{{#each items}}' +
                '<a href="/video{{id}}" id="videoOpen" data-id="{{id}}">' +
                    '<div class="fastresult">' +
                        '<div class="fastresult_text">' +
                            '<div class="fastresult_title">{{title}}</div>' +
                            '<div class="fastresult_subtitle">{{owner}}<span class="divider"></span>{{date}}</div>' +
                        '</div>' +
                    '</div>' +
                '</a>' +
            '{{/each}}' +
        '</div>' +
    '</div>'
);

const resultsTpl = Hb.compile(
    '{{#if has_results}}' +
        '{{#if users_count}}{{{users_html}}}{{/if}}' +
        '{{#if groups_count}}{{{groups_html}}}{{/if}}' +
        '{{#if events_count}}{{{events_html}}}{{/if}}' +
        '{{#if audios_count}}{{{audios_html}}}{{/if}}' +
        '{{#if videos_count}}{{{videos_html}}}{{/if}}' +
        '<div>' +
            '<a href="/search?q={{q_enc}}">' +
                '<div class="fastresult"><div class="fastresult_text"><vkifyloc name="other_results">Other results...</vkifyloc></div><div class="arrow"></div></div>' +
            '</a>' +
        '</div>' +
    '{{else}}' +
        '<div class="fasttipswrap fastnoresults">' + tr('no_results') + '</div>' +
    '{{/if}}'
);

vkify.once("initializeSearchFastTips", () => {
    vkify.initializeSearchFastTipsSafe = function () {
        const searchInput = u('#search_box input[type="search"]');
        const fastTipsContainer = u('#searchBoxFastTips');

        if (!searchInput.length || !fastTipsContainer.length) return;

        if (searchInput.first().dataset.vkifyFastTipsInit === '1') {
            return;
        }
        searchInput.first().dataset.vkifyFastTipsInit = '1';

        let searchTimeout;
        let currentSearchId = 0;

        function hideFastTips() {
            fastTipsContainer.first().style.display = 'none';
        }

        searchInput.on('input', async function (e) {
            const query = u(e.target).first().value.trim();

            if (query.length >= 3) {
                fastTipsContainer.first().style.display = 'block';
                clearTimeout(searchTimeout);

                currentSearchId++;
                const thisSearchId = currentSearchId;

                searchTimeout = setTimeout(async () => {
                    const currentQuery = u(e.target).first().value.trim();
                    if (currentQuery !== query || currentQuery.length < 3 || thisSearchId !== currentSearchId) return;

                    fastTipsContainer.html('<div class="fasttipswrap" id="fastTipsLoader"></div>');
                    window.LoaderUtils.show('#fastTipsLoader', { size: 'small' });

                    try {
                        const audioQ = currentQuery.replace(/[+\-<>()~*"\\]/g, ' ').trim();

                        const code = [
                            'var q = Args.q;',
                            'var audioQ = Args.audio_q;',
                            'var users = API.users.search({ q: q, fields: "photo_50", count: 5 });',
                            'var groups = API.groups.search({ q: q, count: 8 });',
                            'var audios = API.audio.search({ q: audioQ, count: 300 });',
                            'var videos = API.video.search({ q: q, count: 3, extended: 1 });',

                            'return { users: users, groups: groups, audios: audios, videos: videos };'
                        ].join('\n');

                        const res = await window.OVKAPI.call('execute', { code: code, q: currentQuery, audio_q: audioQ });

                        if (!res || !res.users || !res.groups || !res.audios || !res.videos) {
                            throw new Error('execute search returned incomplete results');
                        }

                        const usersd = res.users;
                        const groupsd = res.groups;
                        const audiosd = res.audios;
                        const videosd = res.videos;

                        if (thisSearchId !== currentSearchId) return;

                        const groups_items = (groupsd.items || []).filter(item => item.type !== 'event').slice(0, 3);
                        const events_items = (groupsd.items || []).filter(item => item.type === 'event').slice(0, 3);

                        const users_html = renderPeopleModule(usersd.items, 5, '/search?section=users&q=' + encodeURIComponent(currentQuery), tr('users'), usersd.count, '/id', 'camera_200.png', item =>
                            (item.first_name || '') + (item.last_name ? ' ' + item.last_name : '')
                        );

                        const groups_html = renderPeopleModule(groups_items, 3, '/search?section=groups&q=' + encodeURIComponent(currentQuery), tr('groups'), groups_items.length, '/club', 'community_200.png', item =>
                            item.name
                        );

                        const events_html = renderPeopleModule(events_items, 3, '/search?section=events&q=' + encodeURIComponent(currentQuery), tr('s_events'), events_items.length, '/event', 'community_200.png', item =>
                            item.name
                        );

                        const audios_html = audioModuleTpl({
                            headerUrl: '/search?section=audios&q=' + encodeURIComponent(currentQuery),
                            label: tr('audios'),
                            count: audiosd.count,
                            items: (audiosd.items || []).slice(0, 3).map(item => ({
                                id: item.id,
                                name: Hb.escapeExpression(item.artist + ' — ' + item.title),
                                performer: item.artist,
                                title: item.title,
                                length: item.duration,
                                formattedLength: (() => {
                                    const s = Math.floor(item.duration || 0);
                                    const m = Math.floor(s / 60);
                                    const sec = s % 60;
                                    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
                                })(),
                                genre: '',
                                keysJson: JSON.stringify(item.keys),
                                url: item.manifest || item.url,
                                isWithdrawn: item.withdrawn
                            }))
                        });

                        const profileMap = new Map((videosd.profiles || []).map(p => [p.id, p]));
                        const groupMap = new Map((videosd.groups || []).map(g => [g.id, g]));

                        const videos_html = videoModuleTpl({
                            headerUrl: '/search?section=videos&q=' + encodeURIComponent(currentQuery),
                            label: tr('videos'),
                            count: videosd.count,
                            items: (videosd.items || []).slice(0, 3).map(item => {
                                const date = new Date((item.date || 0) * 1000).toLocaleDateString();
                                let owner = '';
                                if (item.owner_id > 0) {
                                    const p = profileMap.get(item.owner_id);
                                    if (p) {
                                        owner = (p.first_name || '') + (p.last_name ? ' ' + p.last_name : '');
                                    }
                                } else {
                                    const g = groupMap.get(Math.abs(item.owner_id));
                                    if (g) {
                                        owner = g.name;
                                    }
                                }
                                return {
                                    id: item.owner_id + '_' + item.id,
                                    title: item.title,
                                    owner: owner,
                                    date: date
                                };
                            })
                        });

                        const has_results = usersd.count > 0 || groups_items.length > 0 || events_items.length > 0 || audiosd.count > 0 || videosd.count > 0;

                        window.LoaderUtils.hide(fastTipsContainer);
                        fastTipsContainer.html(resultsTpl({
                            q: currentQuery,
                            q_enc: encodeURIComponent(currentQuery),
                            users_html,
                            users_count: usersd.count,
                            groups_html,
                            groups_count: groups_items.length,
                            events_html,
                            events_count: events_items.length,
                            audios_html,
                            audios_count: audiosd.count,
                            videos_html,
                            videos_count: videosd.count,
                            has_results
                        }));

                        setTimeout(() => {
                            if (window.player && audiosd.count > 0) {
                                window.player.tracks = audiosd.items.map(item => ({
                                    id: item.id,
                                    name: item.title,
                                    performer: item.artist,
                                    length: item.duration,
                                    url: item.manifest || item.url,
                                    keys: item.keys
                                }));
                                window.player.context.object = {
                                    url: location.pathname + location.search
                                };
                                window.player.context.pagesCount = 1;
                                window.player.context.count = audiosd.count;
                                window.player.context.playedPages = [1];
                            }

                            u('#searchBoxFastTips a').on('click', function () {
                                hideFastTips();
                            });

                            if (typeof window.processVkifyLocTags === 'function') {
                                window.processVkifyLocTags();
                            }
                        }, 50);
                    } catch (error) {
                        console.error('Failed to load search tip results:', error);
                        if (thisSearchId !== currentSearchId) return;
                        window.LoaderUtils.hide(fastTipsContainer);
                    }
                }, 1000);
            } else {
                fastTipsContainer.first().style.display = 'none';
            }
        });

        searchInput.on('focus', function (e) {
            const inputValue = u(e.target).first().value;
            fastTipsContainer.first().style.display = inputValue.length >= 3 ? 'block' : 'none';
        });

        searchInput.on('blur', function (e) {
            if (!e.relatedTarget) {
                return;
            }
            setTimeout(() => {
                if (!u(e.relatedTarget).closest('#search_box').length) {
                    fastTipsContainer.first().style.display = 'none';
                }
            }, 250);
        });

        u(document).on('click', function (e) {
            const searchBox = u('#search_box').first();
            const fastTips = fastTipsContainer.first();

            if (fastTips.style.display === 'block' &&
                !searchBox.contains(e.target) &&
                !fastTips.contains(e.target)) {
                hideFastTips();
            }
        });
    };
});

if (window.initializeSearchFastTips !== vkify.initializeSearchFastTipsSafe) {
    window.initializeSearchFastTips = vkify.initializeSearchFastTipsSafe;
}

window.hideSearchFastTips = window.hideSearchFastTips || function () {
    const fastTipsContainer = u('#searchBoxFastTips');
    if (fastTipsContainer.length) {
        fastTipsContainer.first().style.display = 'none';
    }
};

})();
