import { SkillEdge, SkillTreeData, SkillTask } from "./interfaces";
import { SaveNodes } from "./recorder";
import { nodeRadii, nodeRadius, handleRadius, Recenter, Render } from "src/renderer";
import { CheckpointNode } from "./skill_nodes/checkpoint_node";
import { OptionalNode } from "./skill_nodes/optional_node";
import { RepeatingNode } from "./skill_nodes/repeating_node";
import { SkillNode } from "./skill_nodes/skill_node";
import { TaskNode } from "./skill_nodes/task_node";
import { TreeLinkNode } from "./skill_nodes/tree_link_node";
import { SkillTreeView } from "./skilltreeview";
import { Handle, Coordinate } from "./types";
import { Direction } from "./enums";
import { TFile } from "obsidian";
import { InitFileWatcher, SetupFileWatchers, CleanupFileWatchers } from "./ux/file_watcher";
import { InitCollisionDetector, findNearestEmptyPosition } from "./utils/collision";


// TODO: deal with the lazy evaluation issue

let view: SkillTreeView
let currentTree: SkillTreeData

let nodes: Map<string | number | null, SkillNode> = new Map();
let edges: SkillEdge[] = [];

let selectedNodeId: string | number | null


// export function GetNodeTasks(nodeId: string | number): SkillTask[] {
//     return tasksCache.get(nodeId) || [];
// }


export async function InitTreeManager(skillTreeView: SkillTreeView): Promise<void> {
    view = skillTreeView
    InitFileWatcher(skillTreeView)
    InitCollisionDetector(skillTreeView)
    await LoadTree()
    await LoadAllNodeTasks()
    SetupFileWatchers()
}


export function GetNodes(): Map<string | number | null, SkillNode> {
    return nodes;
}

export function GetEdges(): SkillEdge[] {
    return edges;
}

export function SetNodesFromSnapshot(nodesData: any[]): void {
    nodes.clear();
    for (const data of nodesData) {
        const node = NodeFromJSON(data);
        if (node) {
            nodes.set(node.id, node);
        }
    }
}

export function SetEdgesFromSnapshot(edgesData: SkillEdge[]): void {
    edges = [...edgesData];
}

export function RemoveEdge(edgeId: number) {
    edges = edges.filter(e => e.id !== edgeId)
}

export function ReplaceNode(nodeId: string | number, newNode: SkillNode) {
    nodes.set(nodeId, newNode)
}

export function RemoveNode(nodeId: string | number): void {
    // Remove this node from other nodes' to/from arrays to allow GC
    for (const node of nodes.values()) {
        node.to = node.to.filter(n => n.id !== nodeId);
        node.from = node.from.filter(n => n.id !== nodeId);
    }

    nodes.delete(nodeId);
    // edges = edges.filter(e => e.from !== nodeId && e.to !== nodeId);
}

export function CreateEdge(edge: SkillEdge) {
    edges.push(edge)
}

export function FindNearestHandleOnNode(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
    const r = nodeRadii[targetNode.id] || nodeRadius;
    const handles = [
        { side: 'top', hx: targetNode.x, hy: targetNode.y - r },
        { side: 'right', hx: targetNode.x + r, hy: targetNode.y },
        { side: 'bottom', hx: targetNode.x, hy: targetNode.y + r },
        { side: 'left', hx: targetNode.x - r, hy: targetNode.y },
    ];

    let nearest: { side: string, hx: number, hy: number } | null = null;
    let minDist = Infinity;

    for (const h of handles) {
        const dx = h.hx - refX;
        const dy = h.hy - refY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            nearest = h;
        }
    }
    return nearest;
}

export function FindNearestHandleToPosition(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    let nearest: { node: SkillNode; side: 'top' | 'right' | 'bottom' | 'left'; hx: number; hy: number } | null = null;
    let minDist = Infinity;

    for (const node of nodes.values()) {
        const r = (nodeRadii[node.id] || nodeRadius) + handleRadius;
        const handles = [
            { side: 'top' as const, hx: node.x, hy: node.y - r },
            { side: 'right' as const, hx: node.x + r, hy: node.y },
            { side: 'bottom' as const, hx: node.x, hy: node.y + r },
            { side: 'left' as const, hx: node.x - r, hy: node.y },
        ];

        for (const h of handles) {
            const dx = worldPos.x - h.hx;
            const dy = worldPos.y - h.hy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = { node, side: h.side, hx: h.hx, hy: h.hy };
            }
        }
    }

    return nearest;
}

export function FindHandleAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        const r = (nodeRadii[node.id] || nodeRadius) + handleRadius;
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ];

        for (const h of handles) {
            const dx = worldPos.x - h.hx;
            const dy = worldPos.y - h.hy;
            const dist2 = dx * dx + dy * dy;
            const handleThreshold = handleRadius;

            if (dist2 <= handleThreshold * handleThreshold) {
                return { node, side: h.side as 'top' | 'right' | 'bottom' | 'left', hx: h.hx, hy: h.hy };
            }
        }
    }
    return null;
}

export function FindEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const threshold = 20 / view.scale;

    for (const e of edges) {
        if (!e.from || !e.to) continue;

        const a = nodes.get(e.from as string | number);
        const b = nodes.get(e.to as string | number);
        if (!a || !b) continue;

        const rFrom = nodeRadii[a.id] || nodeRadius;
        const rTo = nodeRadii[b.id] || nodeRadius;

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

        const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
            const A = px - x1;
            const B = py - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;
            let xx, yy;
            if (param < 0) {
                xx = x1;
                yy = y1;
            } else if (param > 1) {
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }
            const ddx = px - xx;
            const ddy = py - yy;
            return Math.sqrt(ddx * ddx + ddy * ddy);
        };

        const dist = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, toX, toY);

        if (dist <= threshold) {
            const distanceTo = (p1: Coordinate, p2: { x: number, y: number }) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const fromDist = distanceTo(worldPos, { x: fromX, y: fromY });
            const toDist = distanceTo(worldPos, { x: toX, y: toY });

            if (fromDist <= toDist) {
                return { node: a, side: (e.fromSide || 'right') as 'top' | 'right' | 'bottom' | 'left', hx: fromX, hy: fromY };
            } else {
                return { node: b, side: (e.toSide || 'left') as 'top' | 'right' | 'bottom' | 'left', hx: toX, hy: toY };
            }
        }
    }

    return null;
}

export function UpdateConnectedEdgesToNearestHandles(node: SkillNode): void {
    for (const edge of edges) {
        if (edge.from === node.id) {
            const toNode = nodes.get(edge.to as string | number);
            if (toNode) {
                const nearest = FindNearestHandleOnNode(node, toNode.x, toNode.y);
                if (nearest) {
                    edge.fromX = nearest.hx;
                    edge.fromY = nearest.hy;
                    edge.fromSide = nearest.side as any;
                }
            }
        }
        if (edge.to === node.id) {
            const fromNode = nodes.get(edge.from as string | number);
            if (fromNode) {
                const nearest = FindNearestHandleOnNode(node, fromNode.x, fromNode.y);
                if (nearest) {
                    edge.toX = nearest.hx;
                    edge.toY = nearest.hy;
                    edge.toSide = nearest.side as any;
                }
            }
        }
    }
}

export function AddNode(x: number, y: number, fileLink?: string, nodeType?: string): SkillNode | null {
    const baseRadius = view.settings.nodeRadius || 40;
    const adjustedX = Math.round(x);
    const adjustedY = Math.round(y);

    const pos = findNearestEmptyPosition(adjustedX, adjustedY, baseRadius);

    const nodeData: any = {
        x: pos.x,
        y: pos.y,
        state: 'unavailable',
        nodeType: nodeType || 'BaseNode',
    };

    if (fileLink) {
        nodeData.fileLink = fileLink;
    }

    const node = NodeFromJSON(nodeData);

    if (node) {
        nodes.set(node.id, node);
        if (node.fileLink) {
            LoadNodeTasks(node);
        }
        return node;
    }

    return null;
}


export function GetTreesLinkingToCurrent(): string[] {
    const currentTreeName = view.settings.currentTreeName;
    const linkingTrees: string[] = [];

    // TODO:
    // for (const [treeName, tree] of Object.entries(view.settings.trees)) {
    //     if (treeName === currentTreeName) continue;
    //
    //     const hasLinkToCurrent = tree.nodes?.some(n =>
    //         n.treeLink && (
    //             n.treeLink === currentTreeName ||
    //             (n.treeLink === '' && view.settings.currentTreeName === currentTreeName)
    //         )
    //     );
    //
    //     if (hasLinkToCurrent) {
    //         linkingTrees.push(treeName);
    //     }
    // }

    return linkingTrees;
}

export function GetTrees(): object {
    return view.settings.trees;
}

export function GetCurrentTree(): string {
    return view.settings.currentTreeName
}

export function GetTreeCount(): number {
    return Object.keys(view.settings.trees).length;
}

export async function DeleteTree(name: string) {
    const wasCurrentTree = view.settings.currentTreeName === name;

    if (view.settings.trees[name]) {
        delete view.settings.trees[name];
    }

    if (wasCurrentTree) {
        const remainingTrees = Object.keys(view.settings.trees);
        if (remainingTrees.length > 0) {
            const firstTree = remainingTrees[0];
            view.settings.currentTreeName = firstTree;
            if (!view.settings.trees[firstTree]) {
                view.settings.trees[firstTree] = {
                    name: firstTree,
                    nodes: [],
                    edges: []
                };
            }
            await LoadTree();
            await LoadAllNodeTasks();
            CleanupFileWatchers();
            SetupFileWatchers();
            Recenter();
            Render();
        } else {
            view.settings.trees['default'] = {
                name: 'default',
                nodes: [],
                edges: []
            };
            view.settings.currentTreeName = 'default';
            await LoadTree();
            CleanupFileWatchers();
            SetupFileWatchers();
            Recenter();
            Render();
        }
    }

    await view.plugin.saveSettings();
}



export function UpdateTreeSelector(select: HTMLSelectElement) {
    select.innerHTML = '';
    for (const treeName of Object.keys(view.settings.trees)) {
        const option = select.createEl('option', { text: treeName });
        option.value = treeName;
        if (treeName === view.settings.currentTreeName) {
            option.selected = true;
        }
    }
    const newTreeOption = select.createEl('option', { text: '+ New Tree...' });
    newTreeOption.value = '__NEW_TREE__';
}

export async function CreateTree(treeName: string) {

}

export async function SwitchTree(treeName: string) {
    view.settings.currentTreeName = treeName;
    if (!view.settings.trees[treeName]) {
        view.settings.trees[treeName] = {
            name: treeName,
            nodes: [],
            edges: []
        };
    }

    await LoadTree();
    await LoadAllNodeTasks();

    CleanupFileWatchers();
    SetupFileWatchers();

    // for (const node of nodes.values()) {
    //     node.updateRelationShips()
    // }
    // for (const node of nodes.values()) {
    //     if (node.getStructuralType() === "start" || node.getStructuralType() === "orphaned") {
    //         node.validate()
    //     }
    // }

    Recenter();
    Render();
}

async function LoadTree() {
    currentTree = view.settings.trees[view.settings.currentTreeName];

    if (!currentTree) {
        console.log("current tree not available. using default")
        // Initialize if tree doesn't exist
        view.settings.trees[view.settings.currentTreeName] = {
            name: view.settings.currentTreeName,
            nodes: [],
            edges: []
        };
        await view.plugin.saveSettings();
        return
    }

    loadFromJSON(currentTree.nodes || [], currentTree.edges || []);

    edges = edges.filter(e => nodes.get(e.to) && nodes.get(e.from))
}


function loadFromJSON(nodesData: any[], edgesData: SkillEdge[]): void {
    nodes.clear();
    edges = [...edgesData];
    for (const data of nodesData) {
        const node: SkillNode = NodeFromJSON(data);
        if (!node) {
            return
        }
        nodes.set(node.id, node);
    }


    // edges = edges.filter(e => nodes.get(e.to) && nodes.get(e.from))

}

export function NodeFromJSON(data: any): any {
    if (data.nodeType) {
        switch (data.nodeType) {
            case "BaseNode":
            case "RegularNode": // TODO: remove before release. This is old AI slop version. That refused to listen to me when I said other nodes should inherit
                return SkillNode.fromJSON(data)
            case 'CheckpointNode':
                return CheckpointNode.fromJSON(data);
            case 'TreeLinkNode':
                return TreeLinkNode.fromJSON(data);
            case 'RepeatingNode':
                return RepeatingNode.fromJSON(data);
            case 'TaskNode':
                return TaskNode.fromJSON(data);
            case 'OptionalNode':
                return OptionalNode.fromJSON(data);
            default:
                return null
        }
    }
}



function buildRelationshipsFromEdges(): void {
    for (const edge of edges) {
        if (edge.from == null || edge.to == null) continue;
        const childNode = nodes.get(edge.from);
        const parentNode = nodes.get(edge.to);
        if (childNode && parentNode) {
            childNode.from.push(parentNode);
            parentNode.to.push(childNode);
        }
    }
}
export function GetNodeAtWorld(x: number, y: number): SkillNode | null {
    for (const node of nodes.values()) {
        const dx = x - node.x;
        const dy = y - node.y;
        const radius = nodeRadii[node.id] || view.settings.nodeRadius;
        if (dx * dx + dy * dy <= radius * radius) {
            return node;
        }
    }
    return null;
}

export function GetNodeByID(id: string | number | null): SkillNode | null {
    const node = nodes.get(id);
    if (!node) return null;
    return node;
}

export function SetSelectedNodeID(ID: string | number | null): void {
    selectedNodeId = ID
}

export function GetSelectedNodeId(): string | number | null {
    return selectedNodeId;
}


export function FindNodeAt(x: number, y: number): SkillNode | null {
    for (const node of nodes.values()) {
        const dx = x - node.x;
        const dy = y - node.y;
        const radius = view.settings.nodeRadius;
        if (dx * dx + dy * dy <= radius * radius) {
            return node;
        }
    }
    return null;
}

export function FindEdgeAtHandle(handle: Handle): SkillEdge | null {
    const id = handle.node.id
    const side = handle.side
    return edges.find(e =>
        (e.from === id && e.fromSide === side) ||
        (e.to === id && e.toSide === side)
    ) ?? null
}


export function GetEdgeDirection(edge: SkillEdge, node: SkillNode): Direction {
    const id = node.id
    if (edge.from === id) {
        return Direction.from
    }
    if (edge.to === id) {
        return Direction.to
    }
    return Direction.none
}

export async function LoadAllNodeTasks(): Promise<void> {
    for (const node of nodes.values()) {
        if (node.fileLink) {
            await LoadNodeTasks(node);
        }
    }
}

export async function LoadNodeTasks(node: SkillNode): Promise<void> {
    if (!node.fileLink) return;

    const tasks = await GetTasksFromFile(node.fileLink);
    // tasksCache.set(node.id, tasks);
    node.tasks = tasks;

    if (tasks.length > 0) {
        node.canSkipOrphanUnavailable = true;
    }

    // UpdateNodeStateFromTasks(node);
}

export async function OnNodeFileChanged(node: SkillNode): Promise<void> {
    if (node.fileLink) {
        await LoadNodeTasks(node);
    } else {
        node.tasks = [];
        node.canSkipOrphanUnavailable = false;
    }
    await SaveNodes();
    Render();
}

async function GetTasksFromFile(filePath: string): Promise<any[]> {
    try {
        let normalizedPath = filePath.trim();
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        if (!normalizedPath.endsWith('.md')) {
            normalizedPath = normalizedPath + '.md';
        }

        let file = view.app.vault.getAbstractFileByPath(normalizedPath);
        if (!file && !filePath.endsWith('.md')) {
            file = view.app.vault.getAbstractFileByPath(filePath.trim());
            if (file) {
                normalizedPath = filePath.trim();
            }
        }

        if (!file) {
            return [];
        }

        if (!(file instanceof TFile)) {
            return [];
        }

        const content = await view.app.vault.read(file);
        let tasksFromAPI: any[] = [];

        if (view.isDataviewPluginInstalled()) {
            try {
                const dv = (view.app as any).plugins.plugins.dataview?.api;
                if (dv) {
                    const page = dv.page(normalizedPath) || dv.page(file.path) || dv.page((file as any).basename);
                    const dvTasks = page?.file?.tasks;
                    if (dvTasks && dvTasks.length > 0) {
                        const tasksArray = dvTasks.values ? [...dvTasks.values] : [...dvTasks];
                        tasksFromAPI = tasksArray.map((t: any, idx: number) => {
                            const status = (t.status || '').toString().toLowerCase();
                            const completedFlag = !!t.completed || ['x', 'done', 'completed', 'true', '✔'].includes(status);
                            return {
                                id: idx,
                                text: t.text || t.description || '',
                                completed: completedFlag,
                                line: t.line ?? -1,
                                originalTask: t,
                                exp: 10
                            };
                        });
                    }
                }
            } catch (e) {
                console.warn('Dataview failed to parse tasks, falling back:', e);
            }
        }

        if (tasksFromAPI.length === 0 && view.isTasksPluginInstalled()) {
            const tasksPlugin = (view.app as any).plugins.plugins.tasks;
            if (tasksPlugin?.api && typeof tasksPlugin.api.parseTasks === 'function') {
                try {
                    const parsedTasks = tasksPlugin.api.parseTasks(content);
                    if (parsedTasks && parsedTasks.length > 0) {
                        tasksFromAPI = parsedTasks.map((t: any, idx: number) => {
                            const stat = (t.status || '').toString().toLowerCase();
                            const done = !!t.completed || ['x', 'done', 'completed', 'true', '✔'].includes(stat);
                            return {
                                id: idx,
                                text: t.description || t.text || '',
                                completed: done,
                                line: t.line || idx,
                                originalTask: t,
                                exp: 10
                            };
                        });
                    }
                } catch (e) {
                }
            }
        }

        if (tasksFromAPI.length > 0) {
            return tasksFromAPI;
        }

        const tasks: any[] = [];
        const lines = content.split('\n');
        let index = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let taskMatch = line.match(/^(\s*)[-*]\s*\[([ xX])\]\s+(.+)$/);
            if (!taskMatch) {
                taskMatch = line.match(/^(\s*)[-*]\[([ xX])\]\s+(.+)$/);
            }
            if (!taskMatch) {
                taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
            }

            if (taskMatch) {
                const indentStr = taskMatch[1];
                let indent = 0;
                for (let k = 0; k < indentStr.length; k++) {
                    if (indentStr[k] === '\t') {
                        indent += 2;
                    } else if (indentStr[k] === ' ') {
                        indent += 1;
                    }
                }
                const token = taskMatch[2].toLowerCase();
                const isCompleted = token === 'x' || token === '✔' || token === '1';
                const taskText = taskMatch[3].trim();
                tasks.push({
                    id: index++,
                    text: taskText,
                    completed: isCompleted,
                    line: i,
                    originalLine: line,
                    indent: indent,
                    parentIndex: null as number | null,
                    children: [] as number[],
                    exp: 10
                });
            }
        }

        return tasks;
    } catch (e) {
        console.log('[Tasks] Error loading file:', filePath, e);
        return [];
    }
}


// DEPRECATED: Listen, Big Pickled. You gave me a lot of headache by not listening to me when I told you that I didn't want you to do this.
// function UpdateNodeStateFromTasks(node: SkillNode): void {
//     const tasks = tasksCache.get(node.id) || [];
//     const completedTasks = tasks.filter((t: any) => t.completed).length;
//     const totalTasks = tasks.length;
//
//     if (totalTasks === 0) return;
//
//     if (completedTasks === totalTasks) {
//         node.state = 'complete';
//     } else if (completedTasks > 0) {
//         node.state = 'in-progress';
//     } else {
//         node.state = 'unavailable';
//     }
// }
