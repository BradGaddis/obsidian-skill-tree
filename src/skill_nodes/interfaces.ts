import { NodeShape, NodeState } from "./types";

export interface ISkillNode {
    /** Unique identifier for this node (string or number) */
    id: string | number;
    /** X position on the canvas */
    x: number;
    /** Y position on the canvas */
    y: number;
    /** Current state of the node */
    state?: NodeState
    /** A previously held state if on-hold */
    heldState: NodeState | null;
    /** Path to an Obsidian file linked to this node */
    fileLink?: string;
    /** Experience points awarded when this node is completed */
    exp?: number;
    /** Whether this node represents an optional path */
    shape?: NodeShape
    /** Whether user can manually complete this node (only regular nodes) */
    userCompletable?: boolean;
    /** Whether this node can be complete when orphaned (tree-link, nodes-with-tasks) */
    canSkipOrphanUnavailable?: boolean;
    /** Child nodes (transient) */
    children?: ISkillNode[];
    /** Parent nodes (transient) */
    parents?: ISkillNode[];
    /** Validates its own state */
    validate?: () => void;
}
