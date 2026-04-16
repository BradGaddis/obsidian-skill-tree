import { ValidatedFrontmatter } from "../types/interfaces";

const VALID_SHAPES = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];

export function validateFrontmatter(fm: Record<string, any> | null | undefined): ValidatedFrontmatter {
  if (!fm) {
    return getDefaultValidated();
  }

  const skilltreeNodeRaw = fm['skilltree-node'] ?? fm['skilltree_node'];
  const skilltreeNode = (skilltreeNodeRaw !== undefined && skilltreeNodeRaw !== null && String(skilltreeNodeRaw).trim() !== '')
    ? String(skilltreeNodeRaw).trim()
    : null;

  const skilltreeTreeRaw = fm['skilltree-tree'];
  let skilltreeTrees: string[] = [];
  if (typeof skilltreeTreeRaw === 'string' && skilltreeTreeRaw.trim() !== '') {
    skilltreeTrees = [skilltreeTreeRaw.trim()];
  } else if (Array.isArray(skilltreeTreeRaw)) {
    skilltreeTrees = skilltreeTreeRaw.filter((x): x is string => typeof x === 'string').map(x => x.trim());
  }

  const expRaw = fm['skilltree-exp'];
  const exp = (typeof expRaw === 'number' && !isNaN(expRaw)) ? expRaw : 10;

  const xRaw = fm['skilltree-x'];
  const x = (typeof xRaw === 'number' && !isNaN(xRaw)) ? xRaw : undefined;

  const yRaw = fm['skilltree-y'];
  const y = (typeof yRaw === 'number' && !isNaN(yRaw)) ? yRaw : undefined;

  const displayTextRaw = fm['skilltree-display-text'];
  const displayText = (typeof displayTextRaw === 'string' && displayTextRaw.trim() !== '')
    ? displayTextRaw.trim()
    : null;

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
    skilltreeTrees,
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
    displayText,
  };
}

function getDefaultValidated(): ValidatedFrontmatter {
  return {
    skilltreeNode: null,
    skilltreeTrees: [],
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
    displayText: null,
  };
}

export function frontmatterHasValidNodeId(fm: Record<string, any> | null | undefined): boolean {
  if (!fm) return false;
  const nodeId = fm['skilltree-node'] ?? fm['skilltree_node'];
  return nodeId !== undefined && nodeId !== null && String(nodeId).trim() !== '';
}
