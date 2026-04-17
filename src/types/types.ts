import { SkillNode } from "../nodes/skill_node";

/**
 * 2D coordinate with numeric `x` and `y` properties.
 */
export type Coordinate = Record<'x' | 'y', number>

export type Mode = Partial<'view' | 'edit'>

export type RepeatResetMode = 'cooldown';

/**
 * Handle side positions for node connections.
 */
export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export type Handle = { node: SkillNode, side: HandleSide, hx: number, hy: number }
export type EdgeDrag = { handle: Handle }

