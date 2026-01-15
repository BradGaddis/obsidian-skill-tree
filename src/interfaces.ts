/**
 * Represents a node (skill) on the skill tree.
 * @remarks
 * Nodes may optionally reference an Obsidian note via `fileLink` and carry
 * experience points in `exp`.
 */
export interface SkillNode {
  id: number;
  x: number;
  y: number;
  label: string;
  state?: 'complete' | 'in-progress' | 'unavailable';
  fileLink?: string; // Path to an Obsidian file
  exp?: number; // Experience points for this node
}

/**
 * Represents a directed connection (edge) between two `SkillNode`s.
 * Either `from` or `to` may be `null` during editing operations.
 */
export interface SkillEdge {
  id: number;
  from: number | null;
  to: number | null;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  fromSide?: 'top'|'right'|'bottom'|'left';
  toSide?: 'top'|'right'|'bottom'|'left';
}

export interface PersistData {
  nodes?: SkillNode[];
  edges?: SkillEdge[];
}

/**
 * Persistable skill tree data structure.
 * Contains the tree `name` and arrays of `nodes` and `edges`.
 */
export interface SkillTreeData {
  name: string;
  nodes: SkillNode[];
  edges: SkillEdge[];
}

/**
 * Plugin settings persisted between Obsidian sessions.
 */
export interface SkillTreeSettings {
  defaultLabel: string;
  nodeRadius: number;
  showHandles: boolean;
  showBezier: boolean;
  defaultExp: number;
  showExpAsFraction: boolean;
  currentTreeName: string;
  trees: Record<string, SkillTreeData>;
}

export interface SkillTreeData {
  name: string;
  nodes: SkillNode[];
  edges: SkillEdge[];
}


export interface SkillTreeSettings {
  defaultLabel: string;
  nodeRadius: number;
  showHandles: boolean;
  showBezier: boolean;
  defaultExp: number;
  showExpAsFraction: boolean;
  currentTreeName: string;
  trees: Record<string, SkillTreeData>;
}