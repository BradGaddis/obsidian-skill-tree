export const SKILL_TREE_STYLES = {
    'gamified': {
        name: 'Gamified',
        backgroundColor: '#1a1410',
        nodeColors: {
            complete: { fill: '#ffd700', stroke: '#ffaa00' },
            inProgress: { fill: '#6a5acd', stroke: '#4b0082' },
            onHold: { fill: '#ff4757', stroke: '#ff6b81' },
            unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' },
            optional: { fill: '#87ceeb', stroke: '#5fb0db' },
            error: { fill: '#dc143c', stroke: '#8b0000' }
        },
        edgeColor: '#ffd700',
        edgeGlow: true,
        nodeShape: 'hexagon',
        animated: true,
        edgeStyle: 'gradient'
    }
};



export interface CustomTheme {
    /** Unique identifier for this theme */
    id: string;
    /** Display name for the theme */
    name: string;
    /** CSS rules scoped to .skill-tree-canvas */
    css: string;
}

export type NodeId = string | number;


export interface SkillEdge {
    /** Unique identifier for this edge */
    id: number;
    /** Source node ID (child/prerequisite), or null during editing */
    from: string | number | null;
    /** Target node ID (parent/dependent), or null during editing */
    to: string | number | null;
    /** Override X position for the source point */
    fromX?: number;
    /** Override Y position for the source point */
    fromY?: number;
    /** Override X position for the target point */
    toX?: number;
    /** Override Y position for the target point */
    toY?: number;
    /** Which side of the source node the edge connects to */
    fromSide?: 'top' | 'right' | 'bottom' | 'left';
    /** Which side of the target node the edge connects to */
    toSide?: 'top' | 'right' | 'bottom' | 'left';
}


// export interface SkillNode {
//     /** Unique identifier for this node (string or number) */
//     id: string | number;
//     /** X position on the canvas */
//     x: number;
//     /** Y position on the canvas */
//     y: number;
//     /** Current state of the node */
//     state?: 'complete' | 'in-progress' | 'unavailable' | 'on-hold';
//     /** Path to an Obsidian file linked to this node */
//     fileLink?: string;
//     /** Experience points awarded when this node is completed (default: 10) */
//     exp?: number;
//     /** Whether this node represents an optional path */
//     optional?: boolean;
//     /** Whether this node is a checkpoint/milestone */
//     checkpoint?: boolean;
//     /** Name of another skill tree to link to (for Tree Link nodes) */
//     treeLink?: string;
//     /** Visual shape of the node (can be overridden in note frontmatter) */
//     shape?: 'circle' | 'square' | 'hexagon' | 'diamond' | 'repeat';
//     /** Whether user can manually complete this node (only regular nodes) */
//     userCompletable?: boolean;
//     /** Whether this node can be complete when orphaned (tree-link, nodes-with-tasks) */
//     canSkipOrphanUnavailable?: boolean;
//     /** Whether this node has tasks */
//     hasTasks?: boolean;
//     /** Child nodes (transient) */
//     children?: SkillNode[];
//     /** Parent nodes (transient) */
//     parents?: SkillNode[];
//     /** Track if linked tree is complete */
//     linkedTreeComplete?: boolean;
//     /** Whether this node is a repeating node (can be completed multiple times) */
//     repeating?: boolean;
//     /** Number of times this repeating node has been completed */
//     repeatCount?: number;
//     /** Maximum number of repeats (undefined = unlimited) */
//     repeatMax?: number;
//     /** Reset mode for repeating nodes */
//     repeatReset?: 'cooldown';
//     /** Cooldown hours for cooldown reset mode */
//     repeatCooldownHours?: number;
//     /** Timestamp of last completion (for time-based reset) */
//     repeatLastCompleted?: number | null;
//     /** Timestamp when the cooldown resets (persisted for reload) */
//     repeatResetTime?: number | null;
//     /** Whether to show repeat count badge on the node */
//     showRepeatCount?: boolean;
//     /** Validate node state */
//     validate?: () => void;
// }

export interface SkillTreeData {
    /** Display name of this skill tree */
    name: string;
    /** All nodes in this tree */
    nodes: SkillNode[];
    /** All edges in this tree */
    edges: SkillEdge[];
}

// export interface SkillTreeSettings {
//     /** Minimum radius for nodes in pixels (default: 36) */
//     nodeRadius: number;
//
//     /** Maximum radius for nodes in pixels (default: 72) */
//     maxNodeRadius: number;
//
//     /** Whether to use curved bezier edges (non-gamified styles only) */
//     showBezier: boolean;
//
//     /** Default EXP value for new nodes (default: 10) */
//     defaultExp: number;
//
//     /** Whether to display EXP as fraction (e.g., "50/100") */
//     showExpAsFraction: boolean;
//
//     /** Name of the currently active skill tree */
//     currentTreeName: string;
//
//     /** All skill trees indexed by name */
//     trees: Record<string, SkillTreeData>;
//
//     /** Default directory for creating new node files (empty = root) */
//     defaultFilePath: string;
//
//     /** Visual style name (key from SKILL_TREE_STYLES) */
//     style: string;
//
//     /** Persisted positions for draggable modals (keys like 'statsModal', 'editorModal') */
//     modalPositions?: Record<string, { left: number; top: number }>;
//
//     /** Whether to suppress the delete confirmation dialog */
//     suppressDeleteConfirmation?: boolean;
//
//     /** Whether to show the level pane in the bottom-left corner */
//     showLevelPane?: boolean;
//
//     /** Whether to show the EXP pane in the top-right corner */
//     showExpPane?: boolean;
//
//     /** Level display mode: 'current' = current tree only, 'aggregate' = all trees, 'both' = both */
//     levelDisplayMode?: 'current' | 'aggregate' | 'both';
//
//     /** EXP display mode: 'current' = current tree only, 'aggregate' = all trees, 'both' = both */
//     expDisplayMode?: 'current' | 'aggregate' | 'both';
//
//     /** Whether to show level/exp in the status bar */
//     showStatusBar?: boolean;
//
//     /** Custom CSS themes (not exported with tree JSON) */
//     // themes: Record<string, CustomTheme>; // TODO reimplement
//     /** Active custom theme ID (undefined = use default style) */
//     activeThemeId?: string;
//
//     /** Whether edit mode is enabled (default: false) */
//     editMode?: boolean;
//
//     /** Whether to suppress the node type change warning in JSON editor */
//     suppressNodeTypeWarning?: boolean;
// }

export interface SkillEdge {
    /** Unique identifier for this edge */
    id: number;
    /** Source node ID (child/prerequisite), or null during editing */
    from: string | number | null;
    /** Target node ID (parent/dependent), or null during editing */
    to: string | number | null;
    /** Override X position for the source point */
    fromX?: number;
    /** Override Y position for the source point */
    fromY?: number;
    /** Override X position for the target point */
    toX?: number;
    /** Override Y position for the target point */
    toY?: number;
    /** Which side of the source node the edge connects to */
    fromSide?: 'top' | 'right' | 'bottom' | 'left';
    /** Which side of the target node the edge connects to */
    toSide?: 'top' | 'right' | 'bottom' | 'left';
}

