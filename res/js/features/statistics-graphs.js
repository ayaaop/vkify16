vkify.once('statisticsGraphs', () => {
    const graphs = new Map();
    let generation = 0;
    let periodEvents = new AbortController();

    vkify.onPage(async () => {
        const hosts = [...document.querySelectorAll('[data-group-stats], [data-sticker-stats]')];
        if (!hosts.length) return;
        const current = generation;
        try {
            await vkify.ensureScript('ui/graph.js');
            if (current !== generation) return;
            for (const host of hosts) {
                if (!host.isConnected || graphs.has(host)) continue;
                const isSticker = host.hasAttribute('data-sticker-stats');
                const raw = JSON.parse(isSticker ? host.dataset.stickerStats : host.dataset.groupStats);
                const data = isSticker ? [{
                    name: host.getAttribute('aria-label'),
                    c: 0x597da3,
                    f: true,
                    no_legend: true,
                    d: (raw?.x || []).map((date, i) => {
                        const count = raw.y?.[i] ?? 0;
                        // Date-only buckets must stay on their calendar day in the viewer's timezone.
                        return [new Date(date + 'T00:00:00').getTime() / 1000, count, null, tr('stickers_installs_count', count)];
                    })
                }] : raw;
                const switcher = isSticker ? host.closest('.stickers_stats_wrapper')?.querySelector('.stickers_period_switcher') : null;
                const periodData = days => data.map(line => ({ ...line, d: line.d.slice(-days) }));
                const days = Number(switcher?.querySelector('.active[data-period]')?.dataset.period) || 14;
                const graph = new Graph(host, isSticker ? periodData(days) : data, {
                    int_scale: true,
                    show_all: true,
                    download_csv: true
                }, Math.floor(host.getBoundingClientRect().width), isSticker ? 240 : 320);
                graphs.set(host, graph);
                switcher?.addEventListener('click', event => {
                    const button = event.target.closest('[data-period]');
                    if (!button || !switcher.contains(button)) return;
                    const period = Number(button.dataset.period);
                    if (!Number.isInteger(period) || period <= 0) return;
                    event.preventDefault();
                    graph.setData(periodData(period));
                    switcher.querySelectorAll('[data-period]').forEach(control => {
                        const active = control === button;
                        control.classList.toggle('active', active);
                        control.setAttribute('aria-pressed', String(active));
                    });
                }, { signal: periodEvents.signal });
            }
        } catch (error) {
            console.warn('Statistics graphs could not be initialized:', error);
            if (current === generation) {
                hosts.filter(host => host.isConnected).forEach(host => {
                    host.textContent = tr('error');
                });
            }
        }
    });

    vkify.onPageLifecycle('beforePageLeave', () => {
        generation++;
        periodEvents.abort();
        periodEvents = new AbortController();
        graphs.forEach(graph => graph.destroy());
        graphs.clear();
    });
});
