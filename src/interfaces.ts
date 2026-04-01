

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


export interface SkillTreeData {
    /** Display name of this skill tree */
    name: string;
    /** All nodes in this tree */
    nodes: SkillNode[];
    /** All edges in this tree */
    edges: SkillEdge[];
}



