import { TFile } from "obsidian";
import { DEFAULT_FRONTMATTER_TEMPLATE } from "../types/constants";
import { Direction } from "../types/enums";
import {
    SkillEdge,
    SkillTreeData
} from "../types/interfaces";
import {
    Handle,
    Coordinate
} from "../types/types";
import { CheckpointNode } from "../nodes/checkpoint_node";
import { OptionalNode } from "../nodes/optional_node";
import { RepeatingNode } from "../nodes/repeating_node";
import { SkillNode } from "../nodes/skill_node";
import { TaskNode } from "../nodes/task_node";
import { TerminalNode } from "../nodes/terminal_node";
import { TreeLinkNode } from "../nodes/tree_link_node";
import { parseTasksFromNode } from "./task_parser";
import {
    nodeRadii,
    handleRadius,
    Recenter,
    Update,
    UpdateLevelPane
} from "../rendering/renderer";
import { SaveNodes, ClearHistory } from "./recorder";
import { findNearestEmptyPosition } from "../utils/collision";
import { skillTreeEvents, EVENTS } from "../utils/events";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { view } from "../utils/globals";
import { floatingEdge } from "../handlers/interactions";
import {
    SetupFileWatchers,
    CleanupFileWatchers,
    linkedNodes,
    RefreshLinkedNodes,
    AddToLinkedNodes,
    RemoveFromLinkedNodes
} from "../handlers/file_watcher";

export async function InitTreeManager(): Promise<void> {
    await LoadTree()
    skillTreeEvents.emit(EVENTS.TREE_SWITCHED);
}

export function IsCurrentTreeLocked(): boolean {
    return GetTreesWithIncompleteLinks().length > 0;
}

function ensureTerminalNode(treeName: string): void {
    const tree = view.settings.trees[treeName];
    if (!tree?.nodes) return;

    const hasTerminal = tree.nodes.some((n: any) => n.nodeTypeName === 'TerminalNode');
    if (hasTerminal) return;

    const pos = findNearestEmptyPosition(0, 0, 100);

    const terminalNode = new TerminalNode({
        id: `terminal-${treeName}`,
        x: pos.x,
        y: pos.y,
        state: 'unavailable',
        exp: 0,
        totalExp: 0,
    });

    tree.nodes.push(terminalNode.toJSON() as any);
}

export function GetCurrentTreeData(): SkillTreeData | undefined {
    return view.settings.trees[view.settings.currentTreeName];
}

export let nodes: Map<string | number | null, SkillNode> = new Map();

export function GetNodes(): Map<string | number | null, SkillNode> {
    return nodes;
}

let selectedNodeId: string | number | null = null;

export let edges: SkillEdge[] = [];

export function GetEdges(): SkillEdge[] {
    return edges;
}

export function SetEdges(edgesData: SkillEdge[]): void {
    edges = [...edgesData];
}

function SyncNodeConnections(): void {
    for (const edge of edges) {
        if (edge.from == null || edge.to == null) continue;

        const childNode = nodes.get(edge.from);
        const parentNode = nodes.get(edge.to);

        if (!childNode || !parentNode) {
            return
        }
        if (childNode != parentNode) childNode.from.push(parentNode);
        if (parentNode != childNode) parentNode.to.push(childNode);
    }
}

export function SetNodes(nodesData: any[]): void {
    nodes.clear();
    for (const data of nodesData) {
        const node = NodeFromJSON(data);
        if (node) {
            nodes.set(node.id, node);
        }
    }
    SyncNodeConnections();
}

export function RemoveEdge(edgeId: number) {
    edges = edges.filter(e => e.id !== edgeId)
    ValidateEdges()
}

export function ReplaceNode(nodeId: string | number, newNode: SkillNode) {
    nodes.set(nodeId, newNode)
}

export function PromoteToTaskNode(node: SkillNode): void {
    if (!node.tasks || node.tasks.length === 0) return;

    const toNodes = [...node.to];
    const fromNodes = [...node.from];

    const newTaskNode = new TaskNode(node as any);

    newTaskNode.to = toNodes;
    newTaskNode.from = fromNodes;
    newTaskNode.previousType = node.nodeTypeName;

    ReplaceNode(node.id, newTaskNode);
}

export function DemoteFromTaskNode(node: TaskNode): void {
    const taskNode = node as TaskNode;
    if (taskNode.tasks.length > 0) return;

    const targetType = node.previousType || 'BaseNode';
    const toNodes = [...node.to];
    const fromNodes = [...node.from];

    const newNodeData = {
        ...node.toJSON(),
        nodeTypeName: targetType
    };

    const newNode: SkillNode = NodeFromJSON(newNodeData);

    if (newNode) {
        newNode.to = toNodes;
        newNode.from = fromNodes;
        ReplaceNode(node.id, newNode);
    }
}

export function RemoveNode(nodeId: string | number): void {
    const node = nodes.get(nodeId);
    if (!node) return;

    // Prevent deletion of terminal nodes
    if (node.nodeTypeName === 'TerminalNode') {
        return;
    }

    // Update frontmatter before removing (fire and forget)
    if (node.fileLink) {
        updateNodeFrontmatterOnRemove(node, nodeId);
    }

    // Remove this node from other nodes' to/from arrays to allow GC
    for (const n of nodes.values()) {
        n.to = n.to.filter(n => n.id !== nodeId);
        n.from = n.from.filter(n => n.id !== nodeId);
    }

    if (node.fileLink) {
        RemoveFromLinkedNodes(node.fileLink);
    }

    nodes.delete(nodeId);
    edges = edges.filter(e => e.from !== nodeId && e.to !== nodeId);
}

function updateNodeFrontmatterOnRemove(node: SkillNode, _nodeId: string | number): void {
    const fileLink = node.fileLink;
    if (!fileLink) return;

    try {
        let normalizedPath = fileLink.trim();
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        if (!normalizedPath.endsWith('.md')) {
            normalizedPath = normalizedPath + '.md';
        }

        const file = view.app.vault.getAbstractFileByPath(normalizedPath);
        if (!file || !(file instanceof TFile)) return;

        const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!fm) return;

        const currentTrees: string[] = (Array.isArray(fm['skilltree-tree'])
            ? fm['skilltree-tree']
            : fm['skilltree-tree']
                ? [fm['skilltree-tree']]
                : []) as string[];

        const currentTreeName = view.settings.currentTreeName;
        const remainingTrees = currentTrees.filter(t => t !== currentTreeName);

        view.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (remainingTrees.length === 0) {
                // Node no longer in any tree - delete ALL skilltree-* properties
                delete frontmatter['skilltree-node'];
                delete frontmatter['skilltree-tree'];
                delete frontmatter['skilltree-exp'];
                delete frontmatter['skilltree-shape'];
                delete frontmatter['skilltree-x'];
                delete frontmatter['skilltree-y'];
                delete frontmatter['skilltree-display-text'];
            } else {
                // Node in other trees - only update skilltree-tree
                frontmatter['skilltree-tree'] = remainingTrees;
            }
        });
    } catch (e) {
        console.warn('[RemoveNode] Failed to update frontmatter:', e);
    }
}

export function CreateEdge(edge: SkillEdge) {
    edges.push(edge)
}

export function FindNearestHandleOnNode(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
    const r = nodeRadii[targetNode.id];
    if (r === undefined) {
        console.error(`nodeRadii missing for node ${targetNode.id} in FindNearestHandleOnNode`);
        return null;
    }
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

export function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
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
}

export function FindNearestHandleToPosition(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (node.nodeTypeName === 'TerminalNode') continue;
        const r = nodeRadii[node.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${node.id} in FindNearestHandleToPosition`);
            continue;
        }
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

        const rFrom = nodeRadii[a.id];
        const rTo = nodeRadii[b.id];
        if (rFrom === undefined) {
            console.error(`nodeRadii missing for node ${a.id} (from) in FindEdgeEndpointAtWorld`);
            continue;
        }
        if (rTo === undefined) {
            console.error(`nodeRadii missing for node ${b.id} (to) in FindEdgeEndpointAtWorld`);
            continue;
        }

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

export function ValidateEdges(): void {
    for (const node of nodes.values()) { node.from = []; node.to = []; }

    for (const edge of edges) {
        const toNode = nodes.get(edge.to as string | number);
        const fromNode = nodes.get(edge.from as string | number);

        if (!toNode || !fromNode) {
            console.error("Invalid edge. removing")
            RemoveEdge(edge.id);
            continue
        }

        if (toNode.id === fromNode.id) {
            console.error("Self-referential edge. removing")
            RemoveEdge(edge.id);
            continue
        }

        let nearest = FindNearestHandleOnNode(fromNode, toNode.x, toNode.y);
        if (!nearest) {
            continue
        }
        edge.fromX = nearest.hx;
        edge.fromY = nearest.hy;
        edge.fromSide = nearest.side as any;
        nearest = FindNearestHandleOnNode(toNode, fromNode.x, fromNode.y);
        if (!nearest) {
            continue
        }
        edge.toX = nearest.hx;
        edge.toY = nearest.hy;
        edge.toSide = nearest.side as any;

        toNode.updateRelationShips(edge)
        fromNode.updateRelationShips(edge)
    }
}

export function AddNode(x: number, y: number, fileLink?: string, nodeType?: string): SkillNode | null {
    const baseRadius = view.settings.minNodeRadius || 40;
    const adjustedX = Math.round(x);
    const adjustedY = Math.round(y);

    const pos = findNearestEmptyPosition(adjustedX, adjustedY, baseRadius);

    const nodeData: any = {
        x: pos.x,
        y: pos.y,
        state: 'unavailable',
        nodeTypeName: nodeType || 'BaseNode',
    };

    if (fileLink) {
        nodeData.fileLink = fileLink;
    }

    const node = NodeFromJSON(nodeData);

    if (node) {
        nodes.set(node.id, node);
        if (node.fileLink) {
            AddToLinkedNodes(node.fileLink, node);
        }
        return node;
    }

    return null;
}

export function AddNodeWithData(x: number, y: number, fileLink: string | undefined, nodeType: string | undefined, extraData: Record<string, any>): SkillNode | null {
    const baseRadius = view.settings.minNodeRadius || 40;
    const adjustedX = Math.round(x);
    const adjustedY = Math.round(y);

    const pos = findNearestEmptyPosition(adjustedX, adjustedY, baseRadius);

    const nodeData: any = {
        x: pos.x,
        y: pos.y,
        state: 'unavailable',
        nodeTypeName: nodeType || 'BaseNode',
        ...extraData,
    };

    if (fileLink) {
        nodeData.fileLink = fileLink;
    }

    const node = NodeFromJSON(nodeData);

    if (node) {
        nodes.set(node.id, node);
        if (node.fileLink) {
            AddToLinkedNodes(node.fileLink, node);
        }
        return node;
    }

    return null;
}


export function GetTreesLinkingToCurrent(): string[] {
    const currentTreeName = view.settings.currentTreeName;
    const linkingTrees: string[] = [];

    for (const [treeName, tree] of Object.entries(view.settings.trees)) {
        if (treeName === currentTreeName) continue;

        const hasLinkToCurrent = tree.nodes?.some(n =>
            n.nodeTypeName === 'TreeLinkNode' && (n as any).treeLink === currentTreeName
        );

        if (hasLinkToCurrent) {
            linkingTrees.push(treeName);
        }
    }

    return linkingTrees;
}

export function GetTreesWithIncompleteLinks(): { treeName: string; nodeCount: number }[] {
    const currentTreeName = view.settings.currentTreeName;
    const result: { treeName: string; nodeCount: number }[] = [];

    for (const [treeName, tree] of Object.entries(view.settings.trees)) {
        if (treeName === currentTreeName) continue;

        const linkingNodes = tree.nodes?.filter(n =>
            n.nodeTypeName === 'TreeLinkNode' && (n as any).treeLink === currentTreeName && n.state === 'unavailable'
        ) || [];

        if (linkingNodes.length > 0) {
            result.push({ treeName, nodeCount: linkingNodes.length });
        }
    }

    return result;
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
            const firstTree = remainingTrees[0]!;
            view.settings.currentTreeName = firstTree;
            if (!view.settings.trees[firstTree]) {
                view.settings.trees[firstTree] = {
                    name: firstTree,
                    nodes: [],
                    edges: []
                };
            }
            await LoadTree();
            CleanupFileWatchers();
            SetupFileWatchers();
            Recenter();
            Update();
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
            Update();
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


export async function SwitchTree(treeName: string) {
    if (treeName !== view.settings.currentTreeName) {
        ClearHistory();
    }
    view.settings.currentTreeName = treeName;
    if (!view.settings.trees[treeName]) {
        view.settings.trees[treeName] = {
            name: treeName,
            nodes: [],
            edges: []
        };
    }

    ensureTerminalNode(treeName);

    await LoadTree();

    CleanupFileWatchers();
    SetupFileWatchers();

    Recenter();
    Update();
    skillTreeEvents.emit(EVENTS.TREE_SWITCHED);
}

export async function LoadTree() {
    const currentTree = GetCurrentTreeData();

    if (!currentTree) {
        view.settings.trees[view.settings.currentTreeName] = {
            name: view.settings.currentTreeName,
            nodes: [],
            edges: []
        };
        await view.plugin.saveSettings();
        return
    }

    ensureTerminalNode(view.settings.currentTreeName);

    loadFromJSON(currentTree.nodes || [], currentTree.edges || []);

    for (const node of nodes.values()) {
        if (node.fileLink) {
            node.tasks = await parseTasksFromNode(view.app, node);
        }
    }

    edges = edges.filter(e => nodes.get(e.to) && nodes.get(e.from))

    RefreshLinkedNodes();

    await ValidateLinkedFiles();

    await UpdateNodesFromNotes();


    await SaveNodes();
}


export async function ValidateLinkedFiles(): Promise<number> {
    let unlinkedCount = 0;
    const allFiles = new Set(view.app.vault.getFiles().map(f => f.path));

    for (const node of nodes.values()) {
        if (!node.fileLink) continue;

        let normalizedPath = node.fileLink.trim();
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        if (!normalizedPath.endsWith('.md')) {
            normalizedPath = normalizedPath + '.md';
        }

        if (!allFiles.has(normalizedPath)) {
            node.fileLink = undefined;
            node.tasks = [];
            RemoveFromLinkedNodes(normalizedPath);
            unlinkedCount++;
        }
    }

    return unlinkedCount;
}


export async function UpdateNodesFromNotes(): Promise<void> {
    const treeName = view.settings.currentTreeName;
    const allFiles = view.app.vault.getFiles();

    const mdFiles = allFiles.filter(f => f instanceof TFile && f.path.endsWith('.md'));

    for (const file of mdFiles) {
        const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!fm) continue;

        const validated = validateFrontmatter(fm);
        if (!validated.skilltreeNode) continue;
        if (!validated.skilltreeTrees.includes(treeName)) continue;

        const nodeId = validated.skilltreeNode;
        const existingNode = nodes.get(nodeId);

        if (existingNode) {
            if (!existingNode.fileLink) {
                existingNode.fileLink = file.path.replace(/\.md$/, '');
            }

            linkedNodes.set(file.path, existingNode);
            continue;
        }

        const nodeX = fm['skilltree-node-x'] ?? 200;
        const nodeY = fm['skilltree-node-y'] ?? 200;
        const exp = fm['skilltree-node-exp'] ?? view.settings.defaultExp;
        const desc = fm['skilltree-node-desc'] ?? '';
        const fileLink = file.path.replace(/\.md$/, '');

        const newNode = AddNode(nodeX, nodeY, fileLink, 'BaseNode');
        if (!newNode) continue;

        newNode.exp = exp;
        (newNode as any).description = desc;
        (newNode as any).id = nodeId;
        nodes.set(nodeId, newNode);
        nodes.delete(newNode.id);


        const currentTree = GetCurrentTreeData();
        if (currentTree) {
            currentTree.nodes.push({
                id: nodeId,
                x: nodeX,
                y: nodeY,
                state: 'unavailable',
                nodeTypeName: 'BaseNode',
                fileLink: fileLink,
                exp: exp,
                description: desc
            } as any);
        }
    }
}

function loadFromJSON(nodesData: any[], edgesData: SkillEdge[]): void {
    for (const node of nodes.values()) {
        if (node.nodeTypeName === 'RepeatingNode' && 'stopTimer' in node) {
            (node as any).stopTimer();
        }
    }

    nodes.clear();
    edges = [...edgesData];

    for (const data of nodesData) {
        const node: SkillNode = NodeFromJSON(data);
        if (!node) {
            console.warn('[loadFromJSON] Failed to parse node:', data?.id, data?.nodeTypeName || data?.nodeType);
            continue;
        }
        nodes.set(node.id, node);
    }

    // Ensure terminal node exists in nodes map if it was added to settings but not parsed
    const currentTreeName = view.settings.currentTreeName;
    const tree = view.settings.trees[currentTreeName];
    if (tree?.nodes) {
        const hasTerminal = tree.nodes.some((n: any) => n.nodeTypeName === 'TerminalNode');
        const terminalInMap = nodes.has(`terminal-${currentTreeName}`);
        if (hasTerminal && !terminalInMap) {
            const termData = tree.nodes.find((n: any) => n.nodeTypeName === 'TerminalNode');
            if (termData) {
                const termNode = NodeFromJSON(termData);
                if (termNode) {
                    nodes.set(termNode.id, termNode);
                }
            }
        }
    }

    SyncNodeConnections();
}

export function NodeFromJSON(data: any): any {
    const nodeType = data.nodeTypeName;
    if (nodeType) {
        switch (nodeType) {
            case "BaseNode":
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
            case 'TerminalNode':
                return TerminalNode.fromJSON(data);
            default:
                return null
        }
    }
}



export function GetNodeAtWorld(x: number, y: number): SkillNode | null {
    for (const node of nodes.values()) {
        const dx = x - node.x;
        const dy = y - node.y;
        const radius = nodeRadii[node.id] || view.settings.minNodeRadius;
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
        const radius = nodeRadii[node.id] || view.settings.minNodeRadius;
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



export async function OnNodeFileChanged(node: SkillNode): Promise<void> {
    if (node.fileLink) {
        if (node.userCompletable) {
            await SyncNodeMetadataToFile(node);
        }
    } else {
        node.tasks = [];
    }
    await SaveNodes();
    Update();
}

const SYNC_COOLDOWN_MS = 500;
const nodeSyncTimestamps = new Map<string, number>();

export async function SyncNodeMetadataToFile(node: SkillNode): Promise<void> {
    if (!node.fileLink || !node.userCompletable) return;

    const nodeKey = node.fileLink;
    const now = Date.now();
    const lastSync = nodeSyncTimestamps.get(nodeKey) || 0;
    if (now - lastSync < SYNC_COOLDOWN_MS) return;
    nodeSyncTimestamps.set(nodeKey, now);

    try {
        let normalizedPath = node.fileLink.trim();
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        if (!normalizedPath.endsWith('.md')) {
            normalizedPath = normalizedPath + '.md';
        }

        const file = view.app.vault.getAbstractFileByPath(normalizedPath);
        if (!file || !(file instanceof TFile)) return;

        const treeName = view.settings.currentTreeName;

        await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Skip if node ID is already correct (avoids unnecessary file writes)
            if (frontmatter['skilltree-node'] === String(node.id)) {
                return;
            }

            // Just overwrite values directly
            frontmatter['skilltree-node'] = String(node.id);
            frontmatter['skilltree-tree'] = [treeName];
            frontmatter['skilltree-exp'] = node.exp ?? 10;
            frontmatter['skilltree-shape'] = node.shape;
            frontmatter['skilltree-x'] = node.x;
            frontmatter['skilltree-y'] = node.y;
            if (node.displayText && node.displayText.trim()) {
                frontmatter['skilltree-display-text'] = node.displayText;
            }
        });
    } catch (e) {
        console.warn('[SyncNodeMetadata] Failed to sync to file:', e);
    }
}


export function ValidateTreeState(nodes: SkillNode[]) {
    if (floatingEdge) {
        return
    }
    ValidateEdges()

    const seenIds = new Set<string | number>();
    const seenLinks = new Set<string>();

    for (const node of nodes) {
        // Check for duplicate IDs first
        if (seenIds.has(node.id)) {
            RemoveNode(node.id)
            continue;
        }
        seenIds.add(node.id);

        // Also check for duplicate fileLinks (skip empty/undefined)
        const fileLink = node.fileLink;
        if (fileLink && seenLinks.has(fileLink)) {
            RemoveNode(node.id)
            continue;
        }
        if (fileLink) {
            seenLinks.add(fileLink);
        }

        node.updateRelationShips()
        if (node.getStructuralType() === "start" || node.getStructuralType() === "orphaned") {
            node.validate()
        }
    }

    // SaveNodes();

    // Update level pane and status bar
    if (view.settings.showLevelPane !== false) {
        UpdateLevelPane();
    }
}

export async function createSkillNodeFile(node: SkillNode, path: string): Promise<void> {
    const defaultPath = view.plugin.settings.defaultFilePath || '';
    const fullPath = (defaultPath ? defaultPath + '/' : '') + path;
    const filePath = fullPath.endsWith('.md') ? fullPath : fullPath + '.md';
    const treeName = view.settings.currentTreeName;
    const exp = view.settings.defaultExp;
    const content = DEFAULT_FRONTMATTER_TEMPLATE(node.id, treeName, exp);
    await view.app.vault.create(filePath, content);
    node.fileLink = fullPath;
    AddToLinkedNodes(fullPath, node);
    SaveNodes();
    Update();
}

