let installed = false;

const HEADER_ROW_IDS = ['dm_files', 'pinned'];
const HIDDEN_ROW_IDS = new Set(['search']);
const MANAGE_ROW_IDS = ['rights', 'ava', 'notify_toggle', 'clean'];
const FOOTER_ROW_IDS = ['return_to_chat'];

function childList(vnode) {
    const children = vnode && vnode.props ? vnode.props.children : null;
    if (children == null) {
        return [];
    }
    return (Array.isArray(children) ? children.flat(Infinity) : [children]).filter((c) => c != null && c !== false && c !== '');
}

function hasClass(vnode, name) {
    const cls = vnode && vnode.props ? (vnode.props.class || vnode.props.className) : null;
    return typeof cls === 'string' && cls.split(/\s+/).includes(name);
}

function findByClass(vnode, name) {
    return childList(vnode).find((c) => hasClass(c, name)) || null;
}

function takeByClass(vnode, name) {
    const found = findByClass(vnode, name);
    if (found) {
        vnode.props.children = childList(vnode).filter((c) => c !== found);
    }
    return found;
}

function textOf(vnode) {
    return childList(vnode).map((c) => (typeof c === 'string' ? c : '')).join('').trim();
}

export function installPeerWindow({ h, preactMod, commonMod }) {
    if (installed) {
        return;
    }
    installed = true;

    const { PeerWindow } = commonMod || {};
    const options = preactMod && preactMod.options;
    if (!PeerWindow || !options) {
        console.error('vkify16 | peer window aborted: missing PeerWindow or preact options');
        return;
    }

    const block = (cls, ...kids) => {
        const content = kids.flat().filter(Boolean);
        return content.length ? h('div', { class: 'peer-block ' + cls }, ...content) : null;
    };

    const rows = (items) => (items.length ? h('ul', { class: 'peer-rows' }, ...items) : null);

    // Upstream hides PeerInviteLinkSection solely on can('see_invite_link'),
    // which a stale stored chat acl can leave false even for the creator.
    const inviteState = (peer) =>
        peer._inviteLinkState || (peer._inviteLinkState = { link: null, isLoading: false });

    const refreshContactTab = () =>
        window.im.getTab('contact')?.render_class?.update?.();

    const fetchInviteLink = async (peer, reset = 0) => {
        const st = inviteState(peer);
        st.isLoading = true;
        st.attempted = true;
        refreshContactTab();
        try {
            // the instance handed to PeerWindow may carry the local chat id
            // rather than the 2e9-offset peer id the API requires
            const rawId = Number(resolvePeer(peer)?.id ?? peer.id);
            const res = await window.OVKAPI.call('messages.getInviteLink', {
                peer_id: rawId > 2000000000 ? rawId : 2000000000 + rawId,
                reset,
            });
            st.link = res?.link ?? res?.response?.link ?? null;
        } catch (e) {
            console.error('Failed to get invite link:', e);
        } finally {
            st.isLoading = false;
            refreshContactTab();
        }
    };

    // PeerWindow can get a lightweight peer with a stale acl and no
    // owner/admin fields, so isAdmin()/isOwner() may fail where the
    // canonical convo peer or the members list succeed.
    const resolvePeer = (peer) => {
        try {
            return window.im.state?.getCurrentConvo?.()?.peer
                || window.im.conversations?._findConv?.(peer?.id)?.peer
                || peer;
        } catch (e) {
            return peer;
        }
    };

    const memberSeesLink = (peer) => {
        const currentUserId = window.openvk?.current_id ?? window.im?.state?.getId?.();
        const items = peer?.members?.items || peer?._members?.items || [];
        const me = items.find((it) =>
            Number(it.member_id ?? it.id ?? it.user_id) === Number(currentUserId));
        return !!(me && (me.is_admin || me.is_owner || me.is_moderator));
    };

    // The broker's getInviteLink ignores the see_invite_link chat permission
    // and hard-requires member.IsAdmin, so gate on admin/owner signals —
    // an acl-passing regular member would only ever get a 925.
    const canSeeInviteLink = (peer) => {
        if (!peer) return false;
        return [peer, resolvePeer(peer)].some((p) =>
            p && p.supposed_type === 'chat'
            && !(typeof p.isILeft === 'function' && p.isILeft())
            && ((typeof p.isAdmin === 'function' && p.isAdmin())
                || (typeof p.isOwner === 'function' && p.isOwner())
                || memberSeesLink(p)));
    };

    // navigator.clipboard is unavailable on insecure contexts (mobile Firefox over HTTP)
    const copyText = async (text) => {
        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            if (!document.execCommand('copy')) {
                throw new Error('copy failed');
            }
        } finally {
            ta.remove();
        }
    };

    // VK renders the invite link as a clickable row in the peer list.
    const buildInviteRow = (peer) => {
        const tr = window.tr || ((k) => k);
        const st = inviteState(peer);
        if (!st.link && !st.isLoading && !st.attempted) {
            fetchInviteLink(peer, 0);
        }
        const onClick = async (e) => {
            e.preventDefault();
            if (!st.link) {
                fetchInviteLink(peer, 0);
                return;
            }
            try {
                await copyText(st.link);
            } catch (err) {
                (window.fastError || console.error)(String(err));
                return;
            }
            st.copied = true;
            refreshContactTab();
            setTimeout(() => {
                st.copied = false;
                refreshContactTab();
            }, 1500);
        };
        const value = st.copied
            ? tr('stickers_link_copied')
            : st.link ? `· ${st.link}` : (st.isLoading ? `· ${tr('loading')}` : '');
        return h('li', { id: 'invite_link' },
            h('a', { onClick },
                h('span', { class: 'peer-invite-row-label' }, tr('convo_invite_link')),
                value ? h('span', { class: 'peer-invite-row-link' }, value) : null));
    };

    const restructure = (root, props) => {
        const side = findByClass(root, 'peer-side');
        const info = side && findByClass(side, 'peer-info');
        const name = info && findByClass(info, 'peer-name');
        const actions = name && findByClass(name, 'peer-actions-1');
        if (!actions) {
            return;
        }

        const container = findByClass(side, 'peer-actions-container');
        const peer = props?.convo?.peer || props?.convo;
        const inviteRow = canSeeInviteLink(peer) ? buildInviteRow(peer) : null;
        const members = container && findByClass(container, 'peer-members-section');

        let addMembers = null;
        let leaveChat = null;
        if (members) {
            const header = findByClass(members, 'chat-tab-2-header');
            const headerActions = header && takeByClass(header, 'chat-header-actions');
            const tr = typeof window.tr === 'function' ? window.tr : (k) => k;
            const links = childList(headerActions).filter((c) => c.type === 'a');
            addMembers = links.find((a) => textOf(a) === tr('chat_add_members_ext')) || null;
            leaveChat = links.find((a) => textOf(a) === tr('leave_chat')) || null;
            const rest = childList(members).filter((c) => c !== header);
            members.props.children = [
                header,
                addMembers ? h('div', { class: 'peer-add-row' }, addMembers) : null,
                ...rest,
            ].filter(Boolean);
        }

        const ul = childList(actions).find((c) => c.type === 'ul');
        const lis = childList(ul).filter((li) => !(li && li.props && HIDDEN_ROW_IDS.has(li.props.id)));
        const used = new Set();
        const pick = (ids) => ids.map((id) => lis.find((li) => li.props && li.props.id === id)).filter((li) => {
            if (li) {
                used.add(li);
            }
            return Boolean(li);
        });

        const headerRows = pick(HEADER_ROW_IDS);
        const manageRows = pick(MANAGE_ROW_IDS);
        const footerRows = pick(FOOTER_ROW_IDS);
        const otherRows = lis.filter((li) => !used.has(li));

        name.props.children = childList(name).filter((c) => c !== actions);

        side.props.children = [
            info,
            block('peer-block--rows', rows(headerRows)),
            block('peer-block--rows peer-block--manage', rows([inviteRow, ...manageRows, ...otherRows].filter(Boolean))),
            members ? block('peer-block--members', members) : null,
            block('peer-block--footer', rows(footerRows), leaveChat ? h('div', { class: 'peer-leave-row' }, leaveChat) : null),
        ].filter(Boolean);
        side.props.class = 'peer-side peer-side--vk';
    };

    const VkPeerWindow = (props) => {
        const root = PeerWindow(props);
        try {
            restructure(root, props);
        } catch (e) {
            console.error('vkify16 | peer window layout failed, using upstream layout:', e);
        }
        return root;
    };

    const prevVnode = options.vnode;
    options.vnode = (vnode) => {
        if (vnode.type === PeerWindow) {
            vnode.type = VkPeerWindow;
        }
        if (prevVnode) {
            prevVnode(vnode);
        }
    };
}
