import { NodeState } from "src/skill_nodes/types";

export interface ValidatedFrontmatter {
  skilltreeNode: string | null;
  skilltreeTree: string | null;
  skilltreeState: NodeState | null;
  exp: number;
  shape: 'circle' | 'square' | 'hexagon' | 'diamond' | 'repeat';
  repeating: boolean;
  repeatCount: number;
  repeatMax: number | undefined;
  repeatReset: 'cooldown' | undefined;
  repeatCooldownHours: number | undefined;
  repeatLastCompleted: number | null;
  skilltreeTo: string[];
  skilltreeFrom: string[];
  x?: number;
  y?: number;
}

const VALID_SHAPES = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];
const VALID_STATES: NodeState[] = ['unavailable', 'inProgress', 'complete', 'onHold', 'error'];

export function validateFrontmatter(fm: Record<string, any> | null | undefined): ValidatedFrontmatter {
  if (!fm) {
    return getDefaultValidated();
  }

  const skilltreeNodeRaw = fm['skilltree-node'] ?? fm['skilltree_node'];
  const skilltreeNode = (skilltreeNodeRaw !== undefined && skilltreeNodeRaw !== null && String(skilltreeNodeRaw).trim() !== '')
    ? String(skilltreeNodeRaw).trim()
    : null;

  const skilltreeTreeRaw = fm['skilltree-tree'];
  const skilltreeTree = (typeof skilltreeTreeRaw === 'string' && skilltreeTreeRaw.trim() !== '')
    ? skilltreeTreeRaw.trim()
    : null;

  const skilltreeStateRaw = fm['skilltree-state'];
  const skilltreeState = (typeof skilltreeStateRaw === 'string' && VALID_STATES.includes(skilltreeStateRaw as NodeState))
    ? skilltreeStateRaw as NodeState
    : null;

  const skilltreeToRaw = fm['skilltree-to'];
  const skilltreeTo = Array.isArray(skilltreeToRaw) ? skilltreeToRaw.filter((x): x is string => typeof x === 'string') : [];

  const skilltreeFromRaw = fm['skilltree-from'];
  const skilltreeFrom = Array.isArray(skilltreeFromRaw) ? skilltreeFromRaw.filter((x): x is string => typeof x === 'string') : [];

  const expRaw = fm['skilltree-exp'];
  const exp = (typeof expRaw === 'number' && !isNaN(expRaw)) ? expRaw : 10;

  const xRaw = fm['skilltree-x'];
  const x = (typeof xRaw === 'number' && !isNaN(xRaw)) ? xRaw : undefined;

  const yRaw = fm['skilltree-y'];
  const y = (typeof yRaw === 'number' && !isNaN(yRaw)) ? yRaw : undefined;

  const shapeRaw = fm['skilltree-shape'] ?? fm['shape'];
  const shape = (typeof shapeRaw === 'string' && VALID_SHAPES.includes(shapeRaw))
    ? shapeRaw as ValidatedFrontmatter['shape']
    : 'circle';

  const repeatingRaw = fm['skilltree-node-repeat'];
  const repeating = repeatingRaw === true;

  const repeatCountRaw = fm['skilltree-node-repeat-count'];
  const repeatCount = (typeof repeatCountRaw === 'number' && repeatCountRaw >= 0 && Number.isInteger(repeatCountRaw))
    ? repeatCountRaw
    : 0;

  const repeatMaxRaw = fm['skilltree-node-repeat-max'];
  const repeatMax = (typeof repeatMaxRaw === 'number' && repeatMaxRaw >= 0 && Number.isInteger(repeatMaxRaw))
    ? repeatMaxRaw
    : undefined;

  const repeatResetRaw = fm['skilltree-node-repeat-reset'];
  const repeatReset = (repeatResetRaw === 'cooldown') ? 'cooldown' : undefined;

  const repeatCooldownRaw = fm['skilltree-node-repeat-cooldown'];
  const repeatCooldownHours = (typeof repeatCooldownRaw === 'number' && repeatCooldownRaw >= 0)
    ? repeatCooldownRaw
    : undefined;

  const repeatLastRaw = fm['skilltree-node-repeat-last'];
  const repeatLastCompleted = (typeof repeatLastRaw === 'number' || repeatLastRaw === null)
    ? (repeatLastRaw === null ? null : repeatLastRaw)
    : null;

  return {
    skilltreeNode,
    skilltreeTree,
    skilltreeState,
    exp,
    x,
    y,
    shape,
    repeating,
    repeatCount,
    repeatMax,
    repeatReset,
    repeatCooldownHours,
    repeatLastCompleted,
    skilltreeTo,
    skilltreeFrom,
  };
}

function getDefaultValidated(): ValidatedFrontmatter {
  return {
    skilltreeNode: null,
    skilltreeTree: null,
    skilltreeState: null,
    exp: 10,
    x: undefined,
    y: undefined,
    shape: 'circle',
    repeating: false,
    repeatCount: 0,
    repeatMax: undefined,
    repeatReset: undefined,
    repeatCooldownHours: undefined,
    repeatLastCompleted: null,
    skilltreeTo: [],
    skilltreeFrom: [],
  };
}

export function frontmatterHasValidNodeId(fm: Record<string, any> | null | undefined): boolean {
  if (!fm) return false;
  const nodeId = fm['skilltree-node'] ?? fm['skilltree_node'];
  return nodeId !== undefined && nodeId !== null && String(nodeId).trim() !== '';
}