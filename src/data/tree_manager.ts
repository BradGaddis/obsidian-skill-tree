import { Notice, TFile } from "obsidian";
import { DEFAULT_FRONTMATTER_TEMPLATE } from "../types/constants";
import { Direction } from "../types/enums";
import {
    SkillEdge,
    SkillTreeData,
    FrontmatterProperties,
    SkillNodeData
} from "../types/interfaces";
import {
    Handle,
    Coordinate,
    HandleSide
} from "../types/types";
import { CheckpointNode } from "../nodes/checkpoint_node";
import { OptionalNode } from "../nodes/optional_node";
import { RepeatingNode } from "../nodes/repeating_node";
import { SkillNode } from "../nodes/skill_node";
import { TaskNode } from "../nodes/task_node";
import { TerminalNode } from "../nodes/terminal_node";
import { TreeLinkNode } from "../nodes/tree_link_node";
import { parseTasksFromNode } from "./task_parser";
import { toTitleCase, findTreeByCaseInsensitive, parseTreeList, ensureCurrentTreeInList, findEdgeAtWorld } from "../types/utils";
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
    linkedNodes,
    RefreshLinkedNodes,
    AddToLinkedNodes,
    RemoveFromLinkedNodes
} from "../handlers/linked_nodes";
import { SetupFileWatchers, CleanupFileWatchers } from "../handlers/watcher_setup";

/**
 * Initializes the tree manager by loading the current tree and emitting a tree switched event.
 * Wraps initialization in a try-catch to display user-friendly error notifications.
 */
export async function InitTreeManager(): Promise<void> {
    try {
        await LoadTree();
        skillTreeEvents.emit(EVENTS.TREE_SWITCHED);
    } catch (err) {
        console.error('[InitTreeManager] Failed to initialize tree:', err);
        new Notice('Failed to initialize skill tree');
    }
}

/**
 * Checks if the current tree is locked due to incomplete links from other trees.
 * A tree is locked when other trees have TreeLinkNodes pointing to this tree that are still unavailable.
 * @returns true if the current tree has incomplete links from other trees
 */
export function IsCurrentTreeLocked(): boolean {
    return GetTreesWithIncompleteLinks().length > 0;
}

function ensureTerminalNode(treeName: string): void {
    const tree = view.settings.trees[treeName];
    if (!tree?.nodes) return;

    const hasTerminal = tree.nodes.some((n: SkillNodeData) => n.nodeTypeName === 'TerminalNode');
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

    tree.nodes.push(terminalNode.toJSON() as SkillNodeData);
}

/**
 * Gets the data for the currently active tree from settings.
 * @returns The SkillTreeData for the current tree, or undefined if not found
 */
export function GetCurrentTreeData(): SkillTreeData | undefined {
    return view.settings.trees[view.settings.currentTreeName];
}

/**
 * Global map of all nodes in the current tree, keyed by node ID.
 * ID can be string, number, or null.
 */
export let nodes: Map<string | number | null, SkillNode> = new Map();

/**
 * Gets the global map of all nodes in the current tree.
 * @returns Map of node ID to SkillNode
 */
export function GetNodes(): Map<string | number | null, SkillNode> {
    return nodes;
}

let selectedNodeId: string | number | null = null;

/**
 * Global array of all edges (connections) in the current tree.
 */
export let edges: SkillEdge[] = [];

/**
 * Gets the global array of all edges in the current tree.
 * @returns Array of SkillEdge objects
 */
export function GetEdges(): SkillEdge[] {
    return edges;
}

/**
 * Sets the global edges array to a new set of edges.
 * @param edgesData - Array of SkillEdge objects to replace current edges
 */
export function SetEdges(edgesData: SkillEdge[]): void {
    edges = [...edgesData];
}

/**
 * Synchronizes the parent/child relationships between nodes based on edges.
 * Updates each node's 'from' (parents) and 'to' (children) arrays by iterating through all edges.
 * This is called after loading nodes or changing edges to maintain bidirectional relationships.
 */
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

/**
 * Sets the global nodes map from an array of node data.
 * This clears existing nodes and creates new SkillNode instances from the provided data.
 * Also updates linked nodes map for nodes with file links.
 * @param nodesData - Array of SkillNodeData to create nodes from
 */
export function SetNodes(nodesData: SkillNodeData[]): void {
    nodes.clear();
    for (const data of nodesData) {
        const node = NodeFromJSON(data);
        if (node) {
            nodes.set(node.id, node);
            if (node.fileLink) {
                AddToLinkedNodes(node.fileLink, node);
            }
        }
    }
    SyncNodeConnections();
}

/**
 * Removes an edge from the tree by its ID.
 * @param edgeId - The unique identifier of the edge to remove
 */
export function RemoveEdge(edgeId: number) {
    edges = edges.filter(e => e.id !== edgeId)
    ValidateEdges()
}

/**
 * Replaces a node in the global nodes map with a new node instance.
 * Useful for node type transformations (e.g., converting a base node to a task node).
 * @param nodeId - The ID of the node to replace
 * @param newNode - The new node to store in the map
 */
export function ReplaceNode(nodeId: string | number, newNode: SkillNode) {
    nodes.set(nodeId, newNode)
}

/**
 * Promotes a node to a TaskNode if it has associated tasks.
 * This transformation preserves the node's existing connections (to/from arrays).
 * The previous node type is stored in previousType for potential demotion back.
 * @param node - The node to promote to a TaskNode
 */
export function PromoteToTaskNode(node: SkillNode): void {
    if (!node.tasks || node.tasks.length === 0) return;

    const toNodes = [...node.to];
    const fromNodes = [...node.from];

    const nodeData = node.toJSON();
    const newTaskNode = new TaskNode(nodeData as ConstructorParameters<typeof TaskNode>[0]);

    newTaskNode.to = toNodes;
    newTaskNode.from = fromNodes;
    newTaskNode.previousType = node.nodeTypeName;

    ReplaceNode(node.id, newTaskNode);
}

/**
 * Demotes a TaskNode back to its previous node type when it has no remaining tasks.
 * Restores the original connections and node type while removing TaskNode-specific properties.
 * @param node - The TaskNode to demote (type-cast from SkillNode)
 */
export function DemoteFromTaskNode(node: TaskNode): void {
    const taskNode = node as TaskNode;
    if (taskNode.tasks.length > 0) return;

    const targetType = node.previousType || 'BaseNode';
    const toNodes = [...node.to];
    const fromNodes = [...node.from];

    const newNodeData = {
        x: node.x,
        y: node.y,
        state: node.state,
        id: node.id,
        ...node.toJSON(),
        nodeTypeName: targetType
    };

    const newNode: SkillNode | null = NodeFromJSON(newNodeData);

    if (newNode) {
        newNode.to = toNodes;
        newNode.from = fromNodes;
        ReplaceNode(node.id, newNode);
    }
}

/**
 * Removes a node from the tree and cleans up all related data.
 * This includes:
 * - Updating frontmatter in linked files (removing tree association)
 * - Removing from other nodes' to/from arrays
 * - Removing from linked nodes map
 * - Removing associated edges
 * Note: Terminal nodes cannot be deleted.
 * @param nodeId - The ID of the node to remove
 */
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

    const file = view.app.vault.getAbstractFileByPath(fileLink);
    if (!file || !(file instanceof TFile)) {
        console.error('[SyncNodeMetadataToFile] File not found or not a TFile:', fileLink);
        return;
    }

    const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) {
        console.error('[SyncNodeMetadataToFile] No frontmatter found for file:', fileLink);
        return;
    }

    const rawTrees = fm['skilltree-tree'];
    let currentTrees = parseTreeList(rawTrees);

    const currentTreeName = view.settings.currentTreeName;
    const remainingTrees = currentTrees.filter(t => t !== currentTreeName);

    view.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (remainingTrees.length === 0) {
            delete frontmatter['skilltree-node'];
            delete frontmatter['skilltree-tree'];
            delete frontmatter['skilltree-exp'];
            delete frontmatter['skilltree-shape'];
            delete frontmatter['skilltree-x'];
            delete frontmatter['skilltree-y'];
            delete frontmatter['skilltree-display-text'];
        } else {
            frontmatter['skilltree-tree'] = remainingTrees;
        }
    });
}

/**
 * Creates a new edge and adds it to the global edges array.
 * The edge is assigned a unique ID based on the current timestamp.
 * @param edge - The edge to create
 */
export function CreateEdge(edge: SkillEdge) {
    edges.push(edge)
}

/**
 * Finds the nearest handle (connection point) on a target node to a given reference position.
 * Checks all four sides (top, right, bottom, left) and returns the closest one.
 * @param targetNode - The node to find the nearest handle on
 * @param refX - The x coordinate of the reference position
 * @param refY - The y coordinate of the reference position
 * @returns Object with side, hx (handle x), hy (handle y) or null if no handle found
 */
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

/**
 * Calculates the shortest distance from a point (px, py) to a line segment defined by (x1, y1) to (x2, y2).
 * Uses the projection formula to find the closest point on the segment, then computes Euclidean distance.
 * @param px - X coordinate of the point
 * @param py - Y coordinate of the point
 * @param x1 - X coordinate of line segment start
 * @param y1 - Y coordinate of line segment start
 * @param x2 - X coordinate of line segment end
 * @param y2 - Y coordinate of line segment end
 * @returns The shortest distance from the point to the line segment
 */
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

/**
 * Finds the nearest handle to a given world position across all nodes.
 * Iterates through all nodes and checks their handles to find the closest one within threshold.
 * @param worldPos - The world coordinates to search near
 * @returns The Handle object (node, side, hx, hy) or null if none within threshold
 */
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

/**
 * Finds the edge endpoint (handle) at a given world position.
 * Used to detect when user hovers near an edge endpoint to enable dragging.
 * Checks both 'from' and 'to' sides of all edges to find the closest endpoint.
 * @param worldPos - The world coordinates to check
 * @returns The Handle (node, side, hx, hy) at that position, or null if none found
 */
export function FindEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const threshold = 20 / view.scale;

    const hit = findEdgeAtWorld(worldPos, edges, nodes, nodeRadii, threshold);
    if (!hit) return null;

    const a = nodes.get(hit.edge.from as string | number);
    const b = nodes.get(hit.edge.to as string | number);
    if (!a || !b) return null;

    if (hit.closerToFrom) {
        return { node: a, side: (hit.edge.fromSide || 'right') as HandleSide, hx: hit.fromX, hy: hit.fromY };
    } else {
        return { node: b, side: (hit.edge.toSide || 'left') as HandleSide, hx: hit.toX, hy: hit.toY };
    }
}

/**
 * Validates all edges in the tree and ensures proper node connections.
 * This function:
 * 1. Clears all existing from/to arrays on nodes
 * 2. Checks for invalid edges (missing nodes, self-referential)
 * 3. Updates edge endpoint coordinates based on nearest handles
 * 4. Updates node relationships via updateRelationShips
 * Called during rendering to ensure edges connect properly to nodes.
 */
export function ValidateEdges(): void {
    for (const node of nodes.values()) { node.from = []; node.to = []; }

    const hasRadii = Object.keys(nodeRadii).length > 0;

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

        if (hasRadii) {
            let nearest = FindNearestHandleOnNode(fromNode, toNode.x, toNode.y);
            if (!nearest) {
                continue
            }
            edge.fromX = nearest.hx;
            edge.fromY = nearest.hy;
            edge.fromSide = nearest.side as HandleSide;
            nearest = FindNearestHandleOnNode(toNode, fromNode.x, fromNode.y);
            if (!nearest) {
                continue
            }
            edge.toX = nearest.hx;
            edge.toY = nearest.hy;
            edge.toSide = nearest.side as HandleSide;
        }

        toNode.updateRelationShips(edge)
        fromNode.updateRelationShips(edge)
    }
}

/**
 * Adds a new node at the specified world coordinates.
 * Finds the nearest empty position around the given coordinates to avoid overlaps.
 * @param x - The x coordinate for the node
 * @param y - The y coordinate for the node
 * @param fileLink - Optional file path to link the node to a markdown note
 * @param nodeType - Optional node type name (defaults to 'BaseNode')
 * @returns The created SkillNode or null if creation failed
 */
export function AddNode(x: number, y: number, fileLink?: string, nodeType?: string): SkillNode | null {
    const baseRadius = view.settings.minNodeRadius || 40;
    const adjustedX = Math.round(x);
    const adjustedY = Math.round(y);

    const pos = findNearestEmptyPosition(adjustedX, adjustedY, baseRadius);

    const nodeData: SkillNodeData = {
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

/**
 * Adds a new node with additional custom data.
 * Similar to AddNode but allows passing extra properties to override defaults.
 * @param x - The x coordinate for the node
 * @param y - The y coordinate for the node
 * @param fileLink - Optional file path to link the node
 * @param nodeType - Optional node type name
 * @param extraData - Additional partial node data to merge into the node
 * @returns The created SkillNode or null if creation failed
 */
export function AddNodeWithData(x: number, y: number, fileLink: string | undefined, nodeType: string | undefined, extraData: Partial<SkillNodeData>): SkillNode | null {
    const baseRadius = view.settings.minNodeRadius || 40;
    const adjustedX = Math.round(x);
    const adjustedY = Math.round(y);

    const pos = findNearestEmptyPosition(adjustedX, adjustedY, baseRadius);

    const nodeData: SkillNodeData = {
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


/**
 * Gets a list of tree names that have TreeLinkNodes pointing to the current tree.
 * Used to show which other trees link into the current tree.
 * @returns Array of tree names that link to the current tree
 */
export function GetTreesLinkingToCurrent(): string[] {
    const currentTreeName = view.settings.currentTreeName;
    const linkingTrees: string[] = [];

    for (const [treeName, tree] of Object.entries(view.settings.trees)) {
        if (treeName === currentTreeName) continue;

        const hasLinkToCurrent = tree.nodes?.some(n =>
            n.nodeTypeName === 'TreeLinkNode' && n.treeLink === currentTreeName
        );

        if (hasLinkToCurrent) {
            linkingTrees.push(treeName);
        }
    }

    return linkingTrees;
}

/**
 * Gets trees that have incomplete (unavailable) links to the current tree.
 * Used to determine if the current tree is locked - if other trees have unavailable
 * TreeLinkNodes pointing to this tree, the current tree cannot be fully completed.
 * @returns Array of objects with treeName and nodeCount for trees with incomplete links
 */
export function GetTreesWithIncompleteLinks(): { treeName: string; nodeCount: number }[] {
    const currentTreeName = view.settings.currentTreeName;
    const result: { treeName: string; nodeCount: number }[] = [];

    for (const [treeName, tree] of Object.entries(view.settings.trees)) {
        if (treeName === currentTreeName) continue;

        const linkingNodes = tree.nodes?.filter(n =>
            n.nodeTypeName === 'TreeLinkNode' && n.treeLink === currentTreeName && n.state === 'unavailable'
        ) || [];

        if (linkingNodes.length > 0) {
            result.push({ treeName, nodeCount: linkingNodes.length });
        }
    }

    return result;
}

/**
 * Gets the name of the currently active tree.
 * @returns The current tree name string
 */
export function GetCurrentTree(): string {
    return view.settings.currentTreeName
}

/**
 * Gets the total number of trees in the plugin settings.
 * @returns The count of trees
 */
export function GetTreeCount(): number {
    return Object.keys(view.settings.trees).length;
}

/**
 * Deletes a tree by name from the settings.
 * If the deleted tree was the current tree, switches to another available tree or creates a default one.
 * After deletion, reinitializes file watchers, recenters view, and saves settings.
 * @param name - The name of the tree to delete
 */
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
            try {
                await LoadTree();
            } catch (err) {
                console.error('[DeleteTree] LoadTree failed:', err);
                new Notice('Failed to load tree after deletion');
                return;
            }
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
            try {
                await LoadTree();
            } catch (err) {
                console.error('[DeleteTree] LoadTree failed:', err);
                new Notice('Failed to load tree after deletion');
                return;
            }
            CleanupFileWatchers();
            SetupFileWatchers();
            Recenter();
            Update();
        }
    }

    try {
        await view.plugin.saveSettings();
    } catch (err) {
        console.error('[DeleteTree] Failed to save settings:', err);
        new Notice('Failed to save after deleting tree');
    }
}



/**
 * Updates a select element to contain all available tree names as options.
 * Adds a "New Tree..." option at the end that can be used to create new trees.
 * Marks the current tree as selected.
 * @param select - The HTMLSelectElement to update with tree options
 */
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


/**
 * Switches the active tree to the specified tree name.
 * If the tree doesn't exist, creates a new tree with that name.
 * Clears undo history if switching to a different tree, ensures terminal node exists,
 * loads the new tree data, reinitializes file watchers, recenters the view, and triggers a render update.
 * @param treeName - The name of the tree to switch to
 */
export async function SwitchTree(treeName: string) {
    const normalizedName = toTitleCase(treeName);
    const existingMatch = findTreeByCaseInsensitive(treeName, view.settings.trees);

    if (existingMatch) {
        view.settings.currentTreeName = existingMatch;
    } else {
        view.settings.currentTreeName = normalizedName;
        view.settings.trees[normalizedName] = {
            name: normalizedName,
            nodes: [],
            edges: []
        };
    }

    if (normalizedName !== view.settings.currentTreeName) {
        ClearHistory();
    }

    ensureTerminalNode(view.settings.currentTreeName);

    try {
        await LoadTree();
    } catch (err) {
        console.error('[SwitchTree] LoadTree failed:', err);
        new Notice('Failed to load tree');
        return;
    }

    CleanupFileWatchers();
    SetupFileWatchers();

    Recenter();
    Update();
    skillTreeEvents.emit(EVENTS.TREE_SWITCHED);
}

/**
 * Loads the current tree data into the view.
 * This performs a full load sequence:
 * 1. Creates a default tree if current tree doesn't exist in settings
 * 2. Ensures terminal node exists for the current tree
 * 3. Loads nodes and edges from JSON
 * 4. Parses tasks from linked files for nodes with file links
 * 5. Filters out edges that reference non-existent nodes
 * 6. Refreshes linked nodes map
 * 7. Validates all linked files exist in vault
 * 8. Updates nodes from their linked note frontmatter
 * 9. Validates overall tree state (checks for duplicates, orphan relationships)
 * 10. Saves nodes to history for undo capability
 * Called when initializing or switching trees.
 */
export async function LoadTree() {
    const currentTree = GetCurrentTreeData();

    if (!currentTree) {
        view.settings.trees[view.settings.currentTreeName] = {
            name: view.settings.currentTreeName,
            nodes: [],
            edges: []
        };
        try {
            await view.plugin.saveSettings();
        } catch (err) {
            console.error('[LoadTree] Failed to save settings:', err);
            new Notice('Failed to save tree settings');
        }
        return
    }

    ensureTerminalNode(view.settings.currentTreeName);

    loadFromJSON(currentTree.nodes || [], currentTree.edges || []);

    for (const node of nodes.values()) {
        if (node.fileLink) {
            try {
                node.tasks = await parseTasksFromNode(view.app, node);
            } catch (err) {
                console.error(`[LoadTree] Failed to parse tasks for node ${node.id}:`, err);
                node.tasks = [];
            }
        }
    }

    edges = edges.filter(e => nodes.get(e.to) && nodes.get(e.from))

    RefreshLinkedNodes();

    try {
        await ValidateLinkedFiles();
    } catch (err) {
        console.error('[LoadTree] ValidateLinkedFiles failed:', err);
        new Notice('Failed to validate linked files');
    }

    try {
        await UpdateNodesFromNotes();
    } catch (err) {
        console.error('[LoadTree] UpdateNodesFromNotes failed:', err);
        new Notice('Failed to update nodes from notes');
    }

    const nodesArray = Array.from(nodes.values());
    ValidateTreeState(nodesArray);

    try {
        await SaveNodes();
    } catch (err) {
        console.error('[LoadTree] SaveNodes failed:', err);
    }
}


/**
 * Validates that all nodes with file links actually exist in the vault.
 * Removes file links from nodes whose linked files no longer exist.
 * This ensures the tree doesn't reference deleted files.
 * @returns The count of nodes that had their links removed (unlinked)
 */
export async function ValidateLinkedFiles(): Promise<number> {
    let unlinkedCount = 0;
    try {
        const allFiles = new Set(view.app.vault.getFiles().map(f => f.path));

        for (const node of nodes.values()) {
            if (!node.fileLink) continue;

            if (!allFiles.has(node.fileLink)) {
                const oldFileLink = node.fileLink;
                node.fileLink = undefined;
                node.tasks = [];
                if (oldFileLink) RemoveFromLinkedNodes(oldFileLink);
                unlinkedCount++;
            }
        }
    } catch (err) {
        console.error('[ValidateLinkedFiles] Error validating linked files:', err);
        new Notice('Error validating linked files');
    }

    return unlinkedCount;
}


/**
 * Updates node properties from their linked markdown notes' frontmatter.
 * Scans all markdown files in the vault and for those that:
 * - Have valid skilltree frontmatter
 * - Are assigned to the current tree
 * Updates the corresponding node's position, display text, shape, and exp.
 * Creates new nodes for files that don't have a corresponding node yet.
 * This enables editing node properties directly in note frontmatter.
 */
export async function UpdateNodesFromNotes(): Promise<void> {
    const treeName = view.settings.currentTreeName;
    const allFiles = view.app.vault.getFiles();

    const mdFiles = allFiles.filter(f => f instanceof TFile && f.path.endsWith('.md'));

    for (const file of mdFiles) {
        try {
            const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
            if (!fm) continue;

            const validated = validateFrontmatter(fm);
            if (!validated.skilltreeNode) continue;
            if (!validated.skilltreeTrees.includes(treeName)) continue;

            const nodeId = validated.skilltreeNode;
            const existingNode = nodes.get(nodeId);

            if (existingNode) {
                if (!existingNode.fileLink) {
                    existingNode.fileLink = file.path;
                }

                if (validated.displayText !== null) {
                    existingNode.displayText = validated.displayText || undefined;
                }
                if (validated.x !== undefined) {
                    existingNode.x = validated.x;
                }
                if (validated.y !== undefined) {
                    existingNode.y = validated.y;
                }
                if (validated.shape) {
                    existingNode.shape = validated.shape;
                }

                linkedNodes.set(file.path, existingNode);
                continue;
            }

            const nodeX = validated.x ?? 200;
            const nodeY = validated.y ?? 200;
            const exp = validated.exp ?? view.settings.defaultExp;
            const displayText = validated.displayText;
            const shape = validated.shape;
            const desc = fm['skilltree-node-desc'] ?? '';
            const fileLink = file.path;

            const newNode = AddNode(nodeX, nodeY, fileLink, 'BaseNode');
            if (!newNode) continue;

            newNode.exp = exp;
            if (displayText) {
                newNode.displayText = displayText;
            }
            if (shape) {
                newNode.shape = shape;
            }
            // Cast to access description and id properties on the node
            // These are stored in the runtime but not in the interface
            (newNode as SkillNode & { description?: string; id: string | number }).description = desc;
            // Update the node ID if different from auto-generated one
            if (nodeId !== newNode.id) {
                nodes.delete(newNode.id);
                newNode.id = nodeId;
                nodes.set(nodeId, newNode);
            }
            nodes.set(nodeId, newNode);
            linkedNodes.set(file.path, newNode);

            const currentTree = GetCurrentTreeData();
            if (currentTree) {
                const existingIdx = currentTree.nodes.findIndex(n => n.id === nodeId);
                if (existingIdx === -1) {
                    currentTree.nodes.push({
                        id: nodeId,
                        x: nodeX,
                        y: nodeY,
                        state: 'unavailable',
                        nodeTypeName: 'BaseNode',
                        fileLink: fileLink,
                        exp: exp,
                        description: desc
                    });
                }
            }
        } catch (err) {
            console.error(`[UpdateNodesFromNotes] Error processing file ${file.path}:`, err);
        }
    }
}

/**
 * Loads nodes and edges from raw JSON data into the runtime tree.
 * This is an internal function that:
 * 1. Stops any active timers on RepeatingNodes to clean up previous state
 * 2. Clears the existing nodes map
 * 3. Copies edges array from the data
 * 4. Creates SkillNode instances from the node data (using NodeFromJSON)
 * 5. Ensures the terminal node is properly added to the nodes map if it exists in settings
 * 6. Calls SyncNodeConnections to establish parent/child relationships
 * @param nodesData - Array of node data from tree JSON
 * @param edgesData - Array of edge data from tree JSON
 */
function loadFromJSON(nodesData: SkillNodeData[], edgesData: SkillEdge[]): void {
    for (const node of nodes.values()) {
        if (node.nodeTypeName === 'RepeatingNode' && 'stopTimer' in node) {
            (node as RepeatingNode).stopTimer();
        }
    }

    nodes.clear();
    edges = [...edgesData];

    for (const data of nodesData) {
        const node = NodeFromJSON(data);
        if (!node) {
            console.warn('[loadFromJSON] Failed to parse node:', data?.id, data?.nodeTypeName);
            continue;
        }
        nodes.set(node.id, node);
    }

    // Ensure terminal node exists in nodes map if it was added to settings but not parsed
    const currentTreeName = view.settings.currentTreeName;
    const tree = view.settings.trees[currentTreeName];
    if (tree?.nodes) {
        const hasTerminal = tree.nodes.some((n: SkillNodeData) => n.nodeTypeName === 'TerminalNode');
        const terminalInMap = nodes.has(`terminal-${currentTreeName}`);
        if (hasTerminal && !terminalInMap) {
            const termData = tree.nodes.find((n: SkillNodeData) => n.nodeTypeName === 'TerminalNode');
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

/**
 * Creates a SkillNode instance from raw JSON data.
 * Uses the nodeTypeName field to determine which node class to instantiate.
 * Supports: BaseNode, CheckpointNode, TreeLinkNode, RepeatingNode, TaskNode, OptionalNode, TerminalNode.
 * @param data - The SkillNodeData object from JSON
 * @returns A new SkillNode instance or null if node type is unknown/invalid
 */
export function NodeFromJSON(data: SkillNodeData): SkillNode | null {
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
    return null;
}



/**
 * Finds a node at the given world coordinates by checking if the point is within the node's radius.
 * Iterates through all nodes and returns the first one whose bounding circle contains the point.
 * @param x - The x coordinate in world space
 * @param y - The y coordinate in world space
 * @returns The SkillNode at the position, or null if no node found
 */
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

/**
 * Gets a node by its ID from the global nodes map.
 * @param id - The node ID to look up (can be string, number, or null)
 * @returns The SkillNode if found, or null
 */
export function GetNodeByID(id: string | number | null): SkillNode | null {
    const node = nodes.get(id);
    if (!node) return null;
    return node;
}

/**
 * Sets the currently selected node ID (for UI selection/highlighting).
 * @param ID - The node ID to set as selected, or null to clear selection
 */
export function SetSelectedNodeID(ID: string | number | null): void {
    selectedNodeId = ID
}

/**
 * Gets the ID of the currently selected node.
 * @returns The selected node ID, or null if nothing is selected
 */
export function GetSelectedNodeId(): string | number | null {
    return selectedNodeId;
}


/**
 * Finds a node at the given world coordinates.
 * This is an alias for GetNodeAtWorld for better readability in some contexts.
 * @param x - The x coordinate in world space
 * @param y - The y coordinate in world space
 * @returns The SkillNode at the position, or null if no node found
 */
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

/**
 * Finds an edge that connects to a specific handle (node side).
 * Searches through all edges to find one that has either its from or to
 * endpoint at the given handle's node and side.
 * @param handle - The handle to find a connecting edge for
 * @returns The SkillEdge connected to the handle, or null if none found
 */
export function FindEdgeAtHandle(handle: Handle): SkillEdge | null {
    const id = handle.node.id
    const side = handle.side
    return edges.find(e =>
        (e.from === id && e.fromSide === side) ||
        (e.to === id && e.toSide === side)
    ) ?? null
}


/**
 * Determines the direction of an edge relative to a given node.
 * Returns Direction.from if the edge comes from this node,
 * Direction.to if the edge goes to this node,
 * or Direction.none if the edge doesn't involve this node.
 * @param edge - The edge to check
 * @param node - The node to get the direction relative to
 * @returns The Direction enum value
 */
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



/**
 * Handles file change events for a node with a linked file.
 * When a linked file is modified, this function:
 * 1. Syncs node metadata back to the file if the node is user-completable
 * 2. Clears tasks if the node has no file link
 * 3. Saves nodes to persist changes
 * 4. Triggers a render update
 * @param node - The node whose linked file changed
 */
export async function OnNodeFileChanged(node: SkillNode): Promise<void> {
    try {
        if (node.fileLink) {
            if (node.userCompletable) {
                await SyncNodeMetadataToFile(node);
            }
        } else {
            node.tasks = [];
        }
        await SaveNodes();
        Update();
    } catch (err) {
        console.error('[OnNodeFileChanged] Error handling file change:', err);
        new Notice('Failed to sync node changes');
    }
}

const SYNC_COOLDOWN_MS = 500;
const nodeSyncTimestamps = new Map<string, number>();

/**
 * Syncs a node's metadata (position, exp, shape, display text) to its linked file's frontmatter.
 * Uses a cooldown mechanism (SYNC_COOLDOWN_MS) to prevent excessive writes.
 * Updates the frontmatter with skilltree-* properties reflecting the node's current state.
 * Only syncs if the node has a valid file link.
 * @param node - The node to sync metadata for
 */
export async function SyncNodeMetadataToFile(node: SkillNode): Promise<void> {
    if (!node.fileLink) return;

    const nodeKey = node.fileLink;
    const now = Date.now();
    const lastSync = nodeSyncTimestamps.get(nodeKey) || 0;
    if (now - lastSync < SYNC_COOLDOWN_MS) return;
    nodeSyncTimestamps.set(nodeKey, now);

    const file = view.app.vault.getAbstractFileByPath(node.fileLink);
    if (!file || !(file instanceof TFile)) return;

    try {
        const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;

        const rawTrees = fm?.['skilltree-tree'];
        const currentTrees = ensureCurrentTreeInList(parseTreeList(rawTrees));

        const skilltreeProps: FrontmatterProperties = {
            'skilltree-exp': node.exp ?? 10,
            'skilltree-shape': node.shape,
            'skilltree-x': node.x,
            'skilltree-y': node.y,
        };

        if (currentTrees.length === 1) {
            skilltreeProps['skilltree-tree'] = currentTrees[0];
        } else {
            skilltreeProps['skilltree-tree'] = currentTrees;
        }

        if (node.displayText && node.displayText.trim()) {
            skilltreeProps['skilltree-display-text'] = node.displayText;
        }

        await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
            Object.assign(frontmatter, skilltreeProps);
        });

        await view.plugin.saveSettings();
    } catch (err) {
        console.error('[SyncNodeMetadataToFile] Error syncing to file:', node.fileLink, err);
        new Notice('Failed to sync node to file');
    }
}


/**
 * Validates the overall state of the tree.
 * This function:
 * 1. Skips validation if currently dragging a floating edge
 * 2. Calls ValidateEdges to ensure proper edge connections
 * 3. Checks for duplicate node IDs and removes duplicates
 * 4. Checks for duplicate file links and removes duplicates
 * 5. Updates node relationships for all nodes
 * 6. Validates nodes that are "start" or "orphaned" in structure
 * 7. Updates the level pane display if enabled
 * @param nodes - Array of nodes to validate
 */
export function ValidateTreeState(nodes: SkillNode[]) {
    if (floatingEdge) {
        return
    }
    ValidateEdges()

    const seenIds = new Set<string | number>();
    const seenLinks = new Set<string>();

    for (const node of nodes) {
        if (seenIds.has(node.id)) {
            RemoveNode(node.id)
            const currentTree = GetCurrentTreeData();
            if (currentTree) {
                currentTree.nodes = currentTree.nodes.filter(n => n.id !== node.id);
            }
            continue;
        }
        seenIds.add(node.id);

        const fileLink = node.fileLink;
        if (fileLink && seenLinks.has(fileLink)) {
            RemoveNode(node.id)
            const currentTree = GetCurrentTreeData();
            if (currentTree) {
                currentTree.nodes = currentTree.nodes.filter(n => n.id !== node.id);
            }
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

/**
 * Creates a new markdown file for a node and links it.
 * Generates default frontmatter using DEFAULT_FRONTMATTER_TEMPLATE with the node's ID,
 * current tree name, and default exp value. Adds the file to the vault at the specified path.
 * Updates the node's fileLink and linked nodes map, then triggers save and render.
 * @param node - The SkillNode to create a file for
 * @param path - The file path (relative to vault root) for the new file
 */
export async function createSkillNodeFile(node: SkillNode, path: string): Promise<void> {
    const defaultPath = view.plugin.settings.defaultFilePath || '';
    const basePath = (defaultPath ? defaultPath + '/' : '') + path;
    const fullPath = basePath.endsWith('.md') ? basePath : basePath + '.md';
    const treeName = view.settings.currentTreeName;
    const exp = view.settings.defaultExp;
    const content = DEFAULT_FRONTMATTER_TEMPLATE(node.id, treeName, exp);

    try {
        await view.app.vault.create(fullPath, content);
        node.fileLink = fullPath;
        AddToLinkedNodes(fullPath, node);
        SaveNodes();
        Update();
    } catch (err) {
        console.error('[createSkillNodeFile] Error creating file:', fullPath, err);
        new Notice('Failed to create linked note file');
    }
}

