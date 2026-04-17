import { TFile, WorkspaceLeaf } from "obsidian";
import { Coordinate } from "./types";
import { SkillNode } from "../nodes/skill_node";
import { SkillEdge } from "./interfaces";
import { view } from "../utils/globals";

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

export function GetLastIndex(arr: any): any {
    if (arr.length == 0) {
        return []
    }
    return arr[arr.length - 1]
}

export function ensureModalInViewport(modal: HTMLElement): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = modal.offsetWidth || 340;
    const modalHeight = modal.offsetHeight || 200;

    const maxWidth = Math.min(modalWidth, viewportWidth - 20);
    if (modalWidth > viewportWidth - 20) {
        modal.style.width = `${maxWidth}px`;
    }

    let left = parseInt(modal.style.left) || 0;
    let top = parseInt(modal.style.top) || 0;

    const padding = 10;
    left = Math.max(padding, Math.min(left, viewportWidth - maxWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - modalHeight - padding));

    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
}


export function distanceTo(a: Coordinate, b: Coordinate): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
}

export function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy

    if (lenSq === 0) return Math.hypot(px - x1, py - y1)

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))

    const nearX = x1 + t * dx
    const nearY = y1 + t * dy

    return Math.hypot(px - nearX, py - nearY)
}

export function toTitleCase(str: string): string {
    return str
        .toLowerCase()
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function parseTreeList(raw: unknown): string[] {
    if (typeof raw === 'string' && raw.trim() !== '') {
        return [toTitleCase(raw.trim())];
    }
    if (Array.isArray(raw)) {
        const seen = new Set<string>();
        return raw
            .filter((x): x is string => typeof x === 'string')
            .map(x => toTitleCase(x.trim()))
            .filter(x => {
                if (seen.has(x)) return false;
                seen.add(x);
                return true;
            });
    }
    return [];
}

export function ensureCurrentTreeInList(trees: string[]): string[] {
    const currentTreeName = view.settings.currentTreeName;
    if (!trees.includes(currentTreeName)) {
        trees.push(currentTreeName);
    }
    return trees;
}

export function normalizeFilePath(path: string): string {
    let normalized = path.trim();
    if (normalized.startsWith('/')) {
        normalized = normalized.substring(1);
    }
    if (!normalized.endsWith('.md')) {
        normalized = normalized + '.md';
    }
    return normalized;
}

export function parseYamlFrontmatter(frontmatterBlock: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = frontmatterBlock.split('\n');
    let currentKey: string | null = null;
    let arrayBuffer: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('- ')) {
            if (currentKey) {
                arrayBuffer.push(trimmed.slice(2).trim());
            }
            continue;
        }

        if (arrayBuffer.length > 0 && currentKey) {
            result[currentKey] = arrayBuffer;
            arrayBuffer = [];
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (!key) continue;

        currentKey = key;

        const trimmedValue = value.trim();
        if (trimmedValue === 'true') {
            result[key] = true;
        } else if (trimmedValue === 'false') {
            result[key] = false;
        } else if (trimmedValue === '' || trimmedValue === 'null') {
            result[key] = null;
        } else if (/^-?\d+$/.test(trimmedValue)) {
            result[key] = parseInt(trimmedValue, 10);
        } else if (/^-?\d+\.\d+$/.test(trimmedValue)) {
            result[key] = parseFloat(trimmedValue);
        } else if (value.startsWith('[') && value.endsWith(']')) {
            const arrayContent = value.slice(1, -1);
            result[key] = arrayContent.split(',').map(v => v.trim()).filter(v => v);
        } else if (value === '') {
            currentKey = key;
            arrayBuffer = [];
        } else {
            result[key] = value;
        }
    }

    if (arrayBuffer.length > 0 && currentKey) {
        result[currentKey] = arrayBuffer;
    }

    return result;
}

export function isFileOpen(app: any, target: TFile): boolean {
    return app.workspace.getLeavesOfType("markdown").some((leaf: WorkspaceLeaf) => {
        const viewFile = (leaf.view as any)?.file;
        return viewFile?.path === target.path;
    });
}

export function findTreeByCaseInsensitive(treeName: string, trees: Record<string, any>): string | null {
    const normalized = toTitleCase(treeName);
    for (const existingName of Object.keys(trees)) {
        if (toTitleCase(existingName) === normalized) {
            return existingName;
        }
    }
    return null;
}

/**
 * Threshold for treating an edge as straight line vs orthogonal (3-segment) path.
 * When the shorter dimension of the edge is less than this, use simple line distance.
 */
const EDGE_STRAIGHT_LINE_THRESHOLD = 10;

/**
 * Result from edge hit-testing containing the edge and endpoint information.
 */
export interface EdgeHitResult {
    edge: SkillEdge;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    distance: number;
    closerToFrom: boolean;
}

/**
 * Performs edge hit-testing with support for orthogonal edges.
 * 
 * @param worldPos - The world coordinate to test
 * @param edges - Array of edges to check
 * @param nodes - Map of nodes for edge endpoints
 * @param nodeRadii - Map of node radii
 * @param threshold - Maximum distance from edge to consider a hit (in world coords)
 * @returns EdgeHitResult if edge is hit within threshold, null otherwise
 */
export function findEdgeAtWorld(
    worldPos: Coordinate,
    edges: SkillEdge[],
    nodes: Map<string | number | null, SkillNode>,
    nodeRadii: Record<string | number, number>,
    threshold: number
): EdgeHitResult | null {
    for (const e of edges) {
        if (!e.from || !e.to) continue;

        const a = nodes.get(e.from as string | number);
        const b = nodes.get(e.to as string | number);
        if (!a || !b) continue;

        const rFrom = nodeRadii[a.id];
        const rTo = nodeRadii[b.id];
        if (rFrom === undefined || rTo === undefined) continue;

        // Calculate from endpoint position
        let fromX = a.x, fromY = a.y;
        if (e.fromSide === 'top') fromY -= rFrom;
        else if (e.fromSide === 'right') fromX += rFrom;
        else if (e.fromSide === 'bottom') fromY += rFrom;
        else if (e.fromSide === 'left') fromX -= rFrom;
        else {
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            fromX = a.x + (dx / d) * rFrom;
            fromY = a.y + (dy / d) * rFrom;
        }

        // Calculate to endpoint position
        let toX = b.x, toY = b.y;
        if (e.toSide === 'top') toY -= rTo;
        else if (e.toSide === 'right') toX += rTo;
        else if (e.toSide === 'bottom') toY += rTo;
        else if (e.toSide === 'left') toX -= rTo;
        else {
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            toX = b.x - (dx / d) * rTo;
            toY = b.y - (dy / d) * rTo;
        }

        // Calculate distance to edge (supporting orthogonal edges)
        let dist: number;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const midSegmentLength = Math.abs(dx) >= Math.abs(dy) ? Math.abs(dy) : Math.abs(dx);

        if (midSegmentLength < EDGE_STRAIGHT_LINE_THRESHOLD) {
            dist = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, toX, toY);
        } else {
            const midX = (fromX + toX) / 2;
            const midY = (fromY + toY) / 2;

            if (Math.abs(dx) >= Math.abs(dy)) {
                const seg1 = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, midX, fromY);
                const seg2 = pointToSegmentDistance(worldPos.x, worldPos.y, midX, fromY, midX, toY);
                const seg3 = pointToSegmentDistance(worldPos.x, worldPos.y, midX, toY, toX, toY);
                dist = Math.min(seg1, seg2, seg3);
            } else {
                const seg1 = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, fromX, midY);
                const seg2 = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, midY, toX, midY);
                const seg3 = pointToSegmentDistance(worldPos.x, worldPos.y, toX, midY, toX, toY);
                dist = Math.min(seg1, seg2, seg3);
            }
        }

        if (dist <= threshold) {
            const fromDist = distanceTo(worldPos, { x: fromX, y: fromY });
            const toDist = distanceTo(worldPos, { x: toX, y: toY });

            return {
                edge: e,
                fromX,
                fromY,
                toX,
                toY,
                distance: dist,
                closerToFrom: fromDist <= toDist
            };
        }
    }

    return null;
}
