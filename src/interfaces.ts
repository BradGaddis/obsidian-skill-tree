/**
 * Represents a node (skill) on the skill tree.
 * @remarks
 * Nodes may optionally reference an Obsidian note via `fileLink` and carry
 * experience points in `exp`. Shape can be set via front matter (default: 'circle' for simple-light/simple-dark styles, 'hexagon' for gamified).
 */
export interface SkillNode {
  id: number;
  x: number;
  y: number;
  state?: 'complete' | 'in-progress' | 'unavailable';
  fileLink?: string; // Path to an Obsidian file
  exp?: number; // Experience points for this node
  shape?: 'circle' | 'square' | 'hexagon' | 'diamond'; // Node shape
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
 * Node color scheme for different states.
 */
export interface NodeColors {
  complete: { fill: string; stroke: string };
  inProgress: { fill: string; stroke: string };
  unavailable: { fill: string; stroke: string };
  error: { fill: string; stroke: string }; // For nodes with file link issues
}

/**
 * Style definition for the skill tree canvas.
 */
export interface SkillTreeStyle {
  name: string;
  backgroundColor: string;
  nodeColors: NodeColors;
  edgeColor: string;
  edgeGlow?: boolean; // Whether edges should have a glow effect
  nodeShape?: 'circle' | 'square' | 'hexagon' | 'star' | 'diamond'; // Shape for nodes in this style
  animated?: boolean; // Whether to use animations
  edgeStyle?: 'straight' | 'wavy' | 'gradient'; // Edge rendering style
}

/**
 * Available styles for the skill tree.
 */
export const SKILL_TREE_STYLES: Record<string, SkillTreeStyle> = {
  'simple-light': {
    name: 'Simple Light',
    backgroundColor: '#e7f5ff', // Light blue
    nodeColors: {
      complete: { fill: '#4caf50', stroke: '#2e7d32' }, // Green
      inProgress: { fill: '#2b6', stroke: '#173' }, // Teal
      unavailable: { fill: '#7a7a7a', stroke: '#5a5a5a' }, // Gray (mixed)
      error: { fill: '#f44336', stroke: '#c62828' } // Red
    },
    edgeColor: 'auto' // Use theme-based color
  },
  'simple-dark': {
    name: 'Simple Dark',
    backgroundColor: '#1e1e1e', // Dark gray
    nodeColors: {
      complete: { fill: '#4caf50', stroke: '#2e7d32' }, // Green
      inProgress: { fill: '#2b6', stroke: '#173' }, // Teal
      unavailable: { fill: '#7a7a7a', stroke: '#5a5a5a' }, // Gray (mixed)
      error: { fill: '#f44336', stroke: '#c62828' } // Red
    },
    edgeColor: 'auto' // Use theme-based color
  },
  'gamified': {
    name: 'Gamified',
    backgroundColor: '#1a1410', // Dark parchment/stone
    nodeColors: {
      complete: { fill: '#ffd700', stroke: '#ffaa00' }, // Gold
      inProgress: { fill: '#6a5acd', stroke: '#4b0082' }, // Slate blue to indigo
      unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' }, // Dark gray
      error: { fill: '#dc143c', stroke: '#8b0000' } // Crimson red
    },
    edgeColor: '#ffd700', // Gold
    edgeGlow: true, // Enable glow effect for edges
    nodeShape: 'hexagon', // Use hexagon shape for gamified style
    animated: true, // Enable animations
    edgeStyle: 'gradient' // Use gradient edges
  }
};

/**
 * Plugin settings persisted between Obsidian sessions.
 */
export interface SkillTreeSettings {
  nodeRadius: number;
  showHandles: boolean;
  showBezier: boolean;
  defaultExp: number;
  showExpAsFraction: boolean;
  currentTreeName: string;
  trees: Record<string, SkillTreeData>;
  defaultFilePath: string; // Default path for creating files (empty string = root)
  style: string; // Style name (key from SKILL_TREE_STYLES)
}