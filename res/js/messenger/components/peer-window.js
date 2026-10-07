let installed = false;

const HEADER_ROW_IDS = ['dm_files', 'search', 'pinned'];
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

    const restructure = (root) => {
        const side = findByClass(root, 'peer-side');
        const info = side && findByClass(side, 'peer-info');
        const name = info && findByClass(info, 'peer-name');
        const actions = name && findByClass(name, 'peer-actions-1');
        if (!actions) {
            return;
        }

        const container = findByClass(side, 'peer-actions-container');
        const invite = container && findByClass(container, 'peer-invite-section');
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
        const lis = childList(ul);
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
            block('peer-block--rows peer-block--manage', invite, rows([...manageRows, ...otherRows])),
            members ? block('peer-block--members', members) : null,
            block('peer-block--footer', rows(footerRows), leaveChat ? h('div', { class: 'peer-leave-row' }, leaveChat) : null),
        ].filter(Boolean);
        side.props.class = 'peer-side peer-side--vk';
    };

    const VkPeerWindow = (props) => {
        const root = PeerWindow(props);
        try {
            restructure(root);
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
