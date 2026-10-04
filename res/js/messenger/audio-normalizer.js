// Normalizes upstream IM audio-track markup to the site player structure so
// music-popup.js/stylesheet.css work on it (see .devin/adapting_messages.md).
// The MutationObserver re-applies after Preact re-renders; normalizeTrack
// early-outs on a healthy track so the observer can't loop on itself.

function normalizeTrack(track) {
    let rail = track.querySelector(':scope > .selectableTrackRail');
    let played = track.querySelector(':scope > .selectableTrackPlayed');
    let slider = track.querySelector(':scope > .slider');
    let loadProgress = track.querySelector(':scope > .selectableTrackLoadProgress');
    const wrap = track.querySelector(':scope > .selectableTrackSlider');

    const expected = [rail, loadProgress, played, slider].filter(Boolean);
    const children = [...track.children];
    if (
        !wrap
        && rail && played && slider
        && children.length === expected.length
        && children.every((el, i) => el === expected[i])
        && !rail.firstChild && !played.firstChild
        && (!loadProgress || loadProgress.querySelector(':scope > .load_bar'))
    ) {
        return;
    }

    // Repair path: gather the pieces wherever a Preact diff left them.
    if (!rail) {
        rail = document.createElement('div');
        rail.className = 'selectableTrackRail';
    }
    rail.replaceChildren();

    slider = slider || track.querySelector('.slider');
    if (!played) {
        played = document.createElement('div');
        played.className = 'selectableTrackPlayed';
        const percent = slider && /([\d.]+)%/.exec(slider.style.left || '');
        if (percent) {
            played.style.width = `${percent[1]}%`;
        }
    }
    played.replaceChildren();

    loadProgress = loadProgress || track.querySelector('.selectableTrackLoadProgress');
    if (loadProgress && !loadProgress.querySelector('.load_bar')) {
        const bar = track.querySelector('.load_bar');
        if (bar) {
            loadProgress.appendChild(bar);
        }
    }

    track.replaceChildren(...[rail, loadProgress, played, slider].filter(Boolean));
}

export function installAudioNormalizer() {
    if (typeof MutationObserver === 'undefined' || !document.body) {
        return;
    }

    const collect = mutations => {
        const players = new Set();
        for (const mutation of mutations) {
            const player = mutation.target.nodeType === Node.ELEMENT_NODE
                ? mutation.target.closest('.msg-attach-audio-player')
                : null;
            if (player) {
                players.add(player);
            }
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
                if (node.matches('.msg-attach-audio-player')) {
                    players.add(node);
                }
                node.querySelectorAll('.msg-attach-audio-player').forEach(el => players.add(el));
            });
        }
        players.forEach(player => {
            player.querySelectorAll('.selectableTrack').forEach(normalizeTrack);
        });
    };

    new MutationObserver(collect).observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.msg-attach-audio-player .selectableTrack').forEach(normalizeTrack);
}
