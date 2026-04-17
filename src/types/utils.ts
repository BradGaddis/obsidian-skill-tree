import { TFile, WorkspaceLeaf } from "obsidian";
import { Coordinate } from "./types";
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
