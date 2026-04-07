import { NodeShape, NodeState } from "./types";
import { SkillTask } from "../interfaces";
import { SKILL_TREE_STYLES } from "src/styles";

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
    /** Shape of the node */
    shape?: NodeShape
    /** Whether user can manually complete this node (only regular nodes) */
    userCompletable?: boolean;
    /** Child nodes (transient) */
    to?: ISkillNode[];
    /** Parent nodes (transient) */
    from?: ISkillNode[];
    /** Whether this node has tasks */
    hasTasks?: boolean; // TODO: check if we should remove this
    /** Label for display */
    label?: string;
    /** Validates its own state */
    validate?: () => void;
    /** Tasks from linked file */
    tasks?: SkillTask[];
    /** Override color for node (if non-empty, overrides default state colors) */
    colorOverride: typeof SKILL_TREE_STYLES.gamified.nodeColors;
    /** Flag set when user directly modifies state (click/touch/modal) */
    userModified?: boolean;
    /** Flag set when state was updated from note's frontmatter */
    fromNote?: boolean;
    /** Custom display text to show instead of fileLink */
    displayText?: string;
}
