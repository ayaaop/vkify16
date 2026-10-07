function childList(vnode) {
    const children = vnode && vnode.props ? vnode.props.children : null;
    if (children == null) {
        return [];
    }
    return (Array.isArray(children) ? children.flat(Infinity) : [children]).filter((c) => c != null && c !== false && c !== '');
}

function textOf(vnode) {
    return childList(vnode).map((c) => (typeof c === 'string' ? c : '')).join('').trim();
}

function addClass(vnode, name) {
    const current = vnode.props.class || vnode.props.className || '';
    vnode.props.class = (current + ' ' + name).trim();
}

export function createActionsBar({ ActionsBar }) {
    return function VkActionsBar(props) {
        const root = ActionsBar(props);
        try {
            const tr = typeof window.tr === 'function' ? window.tr : (k) => k;
            const right = childList(root)[1];
            childList(right).forEach((tab) => {
                const link = childList(tab)[0];
                if (!link || !link.props) {
                    return;
                }
                const label = textOf(link);
                let role = 'extra';
                if (link.props.onClick === props.onDelete) {
                    role = 'delete';
                } else if (link.props.onClick === props.onReply) {
                    role = 'reply';
                } else if (link.props.onClick === props.onForwardClick) {
                    role = 'forward';
                } else if (label === tr('pin')) {
                    role = 'pin';
                } else if (label === tr('unpin')) {
                    role = 'unpin';
                }
                addClass(tab, 'message-tab--' + role);
                if (role === 'delete' || role === 'pin' || role === 'unpin') {
                    link.props.title = label;
                    link.props['aria-label'] = label;
                }
            });
        } catch (e) {
            console.error('vkify16 | actions bar tagging failed:', e);
        }
        return root;
    };
}
