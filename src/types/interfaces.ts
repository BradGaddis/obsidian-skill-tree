import { SkillNode } from "../nodes/skill_node";
import { NodeState, NodeShape } from "../nodes/types";
import { NODE_COLORS } from "./constants";

export interface ISkillNode {
    id: string | number;
    x: number;
    y: number;

    shape?: NodeShape
    displayText?: string;
    fileLink?: string;
    state?: NodeState
    heldState: NodeState | null;
    exp?: number;
    accumulatedExp?: number;
    totalExp?: number;
    colorOverride: typeof NODE_COLORS;

    to?: ISkillNode[];
    from?: ISkillNode[];
    tasks?: SkillTask[];

    userModified?: boolean;
    fromNote?: boolean;
    linkable?: boolean;

    nodeTypeName: string;

    getEditModalRows?(content: HTMLElement): void;
    getStatsModalRows?(content: HTMLElement): void;

    validate(): void;
    cascadeTo(): void;
}

export interface SkillTask {
    id?: number,
    text: string
    line: number
    originalTask: string
    exp: 10
    status: ' ' | 'x' | '/'
    children: Array<SkillTask>
    scheduled: Date
    due: Date
    startDate: Date
    parent?: SkillTask
    priority: string
    filePath: string
    recurring: boolean
}

export interface SkillEdge {
    id: number;
    from: string | number | null;
    to: string | number | null;
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
    fromSide?: 'top' | 'right' | 'bottom' | 'left';
    toSide?: 'top' | 'right' | 'bottom' | 'left';
}

export interface SkillTreeData {
    name: string;
    nodes: SkillNode[];
    edges: SkillEdge[];
}

export interface ValidatedFrontmatter {
    skilltreeNode: string | null;
    skilltreeTrees: string[];
    exp: number;
    shape: 'circle' | 'square' | 'hexagon' | 'diamond' | 'repeat';
    repeating: boolean;
    repeatCount: number;
    repeatMax: number | undefined;
    repeatReset: 'cooldown' | undefined;
    repeatCooldownHours: number | undefined;
    repeatLastCompleted: number | null;
    x?: number;
    y?: number;
    displayText: string | null;
}

export interface FrontmatterProperties {
    'skilltree-exp': number;
    'skilltree-shape': string;
    'skilltree-x': number;
    'skilltree-y': number;
    'skilltree-tree'?: string | string[];
    'skilltree-display-text'?: string;
    'skilltree-node-repeat'?: boolean;
    'skilltree-node-repeat-count'?: number;
    'skilltree-node-repeat-max'?: number;
    'skilltree-node-repeat-reset'?: 'cooldown';
    'skilltree-node-repeat-cooldown'?: number;
    'skilltree-node-repeat-last'?: number | null;
}

export interface LabelInfo {
    label: string;
    lines: string[];
}

export interface ModalButton {
    text: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
}

export interface SkillTreeSettings {
    mode: string
    previousMode: string
    minNodeRadius: number;
    maxNodeRadius: number;
    defaultExp: number;
    showExpAsFraction: boolean;
    currentTreeName: string;
    trees: Record<string, SkillTreeData>;
    defaultFilePath: string;
    handleRadius: number
    modalPositions?: Record<string, { left: number; top: number }>;
    suppressDeleteConfirmation?: boolean;
    showLevelPane?: boolean;
    levelMultiplier?: number;
    currentExp?: number;
    aggregateExp?: number;
    totalExp?: number;
    aggregateTotalExp?: number;
    levelDisplayMode?: 'current' | 'aggregate' | 'both';
    expDisplayMode?: 'current' | 'aggregate' | 'both';
    showStatusBar?: boolean;
    fontSize: number;
    customTaskQuery?: string;
    lastModified?: number;
}

export interface ZoomConfig {
    minScale: number,
    maxScale: number
}

export interface ExpDisplayData {
    multiplier: number;
    levelMode: 'current' | 'aggregate' | 'both';
    expMode: 'current' | 'aggregate' | 'both';
    currentExp: number;
    totalExp: number;
    aggregateExp: number;
    aggregateTotalExp: number;
    currentLevel: number;
    aggregateLevel: number;
    currentProgress: { expInLevel: number; expForNextLevel: number };
    aggregateProgress: { expInLevel: number; expForNextLevel: number };
}

export interface AddNodeContentElements {
    input: HTMLInputElement;
    suggestions: HTMLElement;
    warning: HTMLElement;
    cancelBtn: HTMLButtonElement;
    createBtn: HTMLButtonElement;
}

export interface JsonEditorElements {
    container: HTMLElement;
    textarea: HTMLTextAreaElement;
    lineNumbers: HTMLElement;
    errorDiv: HTMLElement;
    warningDiv: HTMLElement;
}
