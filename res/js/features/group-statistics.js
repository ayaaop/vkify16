vkify.once('groupStatistics', () => {
    const graphs = new Map();
    let generation = 0;

    vkify.onPage(async () => {
        const hosts = [...document.querySelectorAll('[data-group-stats]')];
        if (!hosts.length) return;
        const current = generation;
        try {
            await vkify.ensureScript('ui/graph.js');
            if (current !== generation) return;
            for (const host of hosts) {
                if (!host.isConnected || graphs.has(host)) continue;
                graphs.set(host, new Graph(host, JSON.parse(host.dataset.groupStats), {
                    int_scale: true,
                    show_all: true,
                    download_csv: true
                }, Math.floor(host.getBoundingClientRect().width), 320));
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
        graphs.forEach(graph => graph.destroy());
        graphs.clear();
    });
});
