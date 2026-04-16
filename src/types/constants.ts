export const VIEW_TYPE_SKILLTREE = 'skill-tree-view';

export const DEFAULT_NODE_DESCRIPTION = 'No description';

export const NODE_COLORS = {
    complete: { fill: '#ffd700', stroke: '#ffaa00' },
    inProgress: { fill: '#6a5acd', stroke: '#4b0082' },
    onHold: { fill: '#ff4757', stroke: '#ff6b81' },
    unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' },
    optional: { fill: '#87ceeb', stroke: '#5fb0db' },
    error: { fill: '#dc143c', stroke: '#8b0000' }
};

export const MODAL_WIDTH = 340;
export const MODAL_HEIGHT = 200;
export const MODAL_DEFAULT_TOP_OFFSET = 150;
export const MODAL_CENTER_THRESHOLD = 8;

export const DEFAULT_FRONTMATTER_TEMPLATE = (
    nodeId: string | number | null,
    treeName: string,
    exp: number = 10
) => {
    return `---
skilltree-node: ${nodeId}
skilltree-tree: 
  - ${treeName}
skilltree-node-exp: ${exp}
skilltree-node-desc: "${DEFAULT_NODE_DESCRIPTION}"
---
`;
};

export const HISTORY_UPPER_BOUNDS = 100;

export const LOOP_UPPER_LIMIT = 1000;

export const WORDS_PER_LINE = 2;
export const UNLINKED_LABEL = ' [Unlinked]';
