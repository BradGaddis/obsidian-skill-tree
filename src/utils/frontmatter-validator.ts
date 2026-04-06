export interface ValidatedFrontmatter {
  skilltreeNode: string | null;
  exp: number;
  shape: 'circle' | 'square' | 'hexagon' | 'diamond' | 'repeat';
  repeating: boolean;
  repeatCount: number;
  repeatMax: number | undefined;
  repeatReset: 'cooldown' | undefined;
  repeatCooldownHours: number | undefined;
  repeatLastCompleted: number | null;
}

const VALID_SHAPES = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];

export function validateFrontmatter(fm: Record<string, any> | null | undefined): ValidatedFrontmatter {
  if (!fm) {
    return getDefaultValidated();
  }

  const skilltreeNodeRaw = fm['skilltree-node'] ?? fm['skilltree_node'];
  const skilltreeNode = (skilltreeNodeRaw !== undefined && skilltreeNodeRaw !== null && String(skilltreeNodeRaw).trim() !== '')
    ? String(skilltreeNodeRaw).trim()
    : null;

  const expRaw = fm['skilltree-node-exp'];
  const exp = (typeof expRaw === 'number' && !isNaN(expRaw)) ? expRaw : 10;

  const shapeRaw = fm['shape'];
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
    exp,
    shape,
    repeating,
    repeatCount,
    repeatMax,
    repeatReset,
    repeatCooldownHours,
    repeatLastCompleted,
  };
}

function getDefaultValidated(): ValidatedFrontmatter {
  return {
    skilltreeNode: null,
    exp: 10,
    shape: 'circle',
    repeating: false,
    repeatCount: 0,
    repeatMax: undefined,
    repeatReset: undefined,
    repeatCooldownHours: undefined,
    repeatLastCompleted: null,
  };
}

export function frontmatterHasValidNodeId(fm: Record<string, any> | null | undefined): boolean {
  if (!fm) return false;
  const nodeId = fm['skilltree-node'] ?? fm['skilltree_node'];
  return nodeId !== undefined && nodeId !== null && String(nodeId).trim() !== '';
}