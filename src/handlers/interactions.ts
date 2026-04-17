import { Update, nodeRadii, screenToWorld, handleRadius, levelPaneElement, GetLevelPaneDragState, UpdateLevelPanePosition } from "../rendering/renderer";
import { FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection, SetSelectedNodeID, IsCurrentTreeLocked, SyncNodeMetadataToFile } from "../data/tree_manager";
import { RecordSnapshot, SaveNodes } from "../data/recorder";
import { SkillNode } from "../nodes/skill_node";
import { Coordinate, Handle, HandleSide } from "../types/types";
import { SkillEdge } from "../types/interfaces";
import { Direction } from "../types/enums";
import { view } from "../utils/globals";
import { Notice } from "obsidian";
import { findEdgeAtWorld } from "../types/utils";


/**
 * Checks if the skill tree is currently in edit mode.
 * Edit mode enables additional UI elements like node handles and allows node/edge manipulation.
 * @returns true if in edit mode, false otherwise
 */
export function isInEditMode(): boolean {
    return view?.settings?.mode === "edit";
}

export let hitNode: SkillNode | null = null;
export let isDragging: boolean = false;
export let isDraggingEdgeEndpoint: boolean = false;
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null = null;
export let edgeDragFrom: Handle | null = null;
export let edgeDragTarget: Coordinate | null = null;
export let edgeDragSourcePos: Coordinate | null = null;
export let draggingOverEdge: SkillEdge | null = null;
export let floatingEdge: SkillEdge | null = null;
let previousEdgeFromFloating: SkillEdge | null = null;
export let floatingEdgeDirection: Direction = Direction.none;

export const HANDLE_HIT_BASE = 20;
export const HANDLE_HIT_SCALE = 2;

// Setters/Getters
/**
 * Sets the current hit node (the node under the cursor/mouse).
 * @param node - The node that was hit, or null if no node
 */
export function setHitNode(node: SkillNode | null): void {
    hitNode = node;
}

/**
 * Sets the global dragging state flag.
 * @param dragging - true if currently dragging something (node or edge)
 */
export function setIsDragging(dragging: boolean): void {
    isDragging = dragging;
}

/**
 * Sets the edge currently being hovered over during drag operations.
 * @param edge - The edge under the cursor, or null if not over an edge
 */
export function setDraggingOverEdge(edge: SkillEdge | null): void {
    draggingOverEdge = edge;
}

/**
 * Sets the handle that an edge is being dragged from.
 * @param handle - The handle (node + side + position) where drag starts
 */
export function setEdgeDragFrom(handle: Handle): void {
    edgeDragFrom = handle;
}

/**
 * Gets the handle that an edge is being dragged from (if any).
 * @returns The handle or null if not currently dragging an edge
 */
export function getEdgeDragFrom(): Handle | null {
    return edgeDragFrom;
}

/**
 * Sets the target position for an edge being dragged.
 * @param coord - The world coordinates of the drag target, or null to clear
 */
export function setEdgeDragTarget(coord: Coordinate | null): void {
    edgeDragTarget = coord;
}


/**
 * Converts DOM mouse event coordinates to world coordinates.
 * Takes clientX/clientY from a mouse event and returns the corresponding world position.
 * @param clientX - The X coordinate from the mouse event
 * @param clientY - The Y coordinate from the mouse event
 * @returns The world coordinates or null if canvas not available
 */
export function screenToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}

/**
 * Converts DOM mouse event coordinates to world coordinates (alias for screenToWorldCoordinate).
 * @param clientX - The X coordinate from the mouse event
 * @param clientY - The Y coordinate from the mouse event
 * @returns The world coordinates or null if canvas not available
 */
export function EventToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}

/**
 * Finds a node at the given world position (wrapper around tree_manager's FindNodeAt).
 * @param worldPos - The world coordinates to check
 * @returns The SkillNode at that position, or null if none found
 */
export function findNodeAt(worldPos: Coordinate): SkillNode | null {
    return FindNodeAt(worldPos.x, worldPos.y);
}

/**
 * Finds a handle (connection point) at the given world position.
 * Checks handles extended by handleRadius (for easier hit detection during edge creation).
 * Skips TerminalNode as it doesn't have handles.
 * @param worldPos - The world coordinates to check
 * @returns The Handle at that position, or null if none found
 */
export function findHandleAt(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (node.nodeTypeName === 'TerminalNode') continue;
        const r = nodeRadii[node.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${node.id} in findHandleAt`);
            continue;
        }
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r - handleRadius },
            { side: 'right', hx: node.x + r + handleRadius, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r + handleRadius },
            { side: 'left', hx: node.x - r - handleRadius, hy: node.y },
        ]

        for (const h of handles) {
            const dx = worldPos.x - h.hx;
            const dy = worldPos.y - h.hy;
            const dist2 = dx * dx + dy * dy;

            if (dist2 <= handleRadius * handleRadius) {
                return { node, side: h.side as 'top' | 'right' | 'bottom' | 'left', hx: h.hx, hy: h.hy };
            }
        }
    }
    return null;
}

/**
 * Gets a handle at world position using a larger threshold (2x handleRadius).
 * Used for snapping when dragging edges - allows more lenient handle detection.
 * @param coords - The world coordinates to check
 * @returns The Handle at that position, or null if none within range
 */
export function getHandleAtWorld(coords: Coordinate): Handle | null {
    const nodes = GetNodes()
    for (const node of nodes.values()) {
        if (node.nodeTypeName === 'TerminalNode') continue;
        const r = nodeRadii[node.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${node.id} in getHandleAtWorld`);
            continue;
        }
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ]


        for (const h of handles) {
            const dx = coords.x - h.hx
            const dy = coords.y - h.hy
            const dist2 = dx * dx + dy * dy
            if (dist2 <= handleRadius * 2) {
                return { node, side: h.side as HandleSide, hx: h.hx, hy: h.hy }
            }
        }
    }
    return null
}

/**
 * Finds the nearest handle on a target node to a given reference position.
 * Used to determine which side of a node to connect an edge to.
 * @param targetNode - The node to find the nearest handle on
 * @param refX - Reference X coordinate to measure distance from
 * @param refY - Reference Y coordinate to measure distance from
 * @returns Object with side, hx (handle x), hy (handle y) or null if no handles
 */
export function findNearestHandle(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
    const r = nodeRadii[targetNode.id];
    if (r === undefined) {
        console.error(`nodeRadii missing for node ${targetNode.id} in findNearestHandle`);
        return null;
    }
    const handles = [
        { side: 'top', hx: targetNode.x, hy: targetNode.y - r - handleRadius },
        { side: 'right', hx: targetNode.x + r + handleRadius, hy: targetNode.y },
        { side: 'bottom', hx: targetNode.x, hy: targetNode.y + r + handleRadius },
        { side: 'left', hx: targetNode.x - r - handleRadius, hy: targetNode.y },
    ]
    let nearest: { side: string, hx: number, hy: number } | null = null
    let minDist = Infinity

    for (const h of handles) {
        const dx = h.hx - refX
        const dy = h.hy - refY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist) {
            minDist = dist
            nearest = h
        }
    }
    return nearest
}

/**
 * Finds the checkbox (for user-completable nodes) at the given world position.
 * Only checks nodes that are userCompletable and in 'inProgress' or 'complete' state.
 * Calculates checkbox position based on node's label and radius.
 * @param worldPos - The world coordinates to check
 * @returns The node whose checkbox was hit, or null if none
 */
export function getCheckboxAtWorld(worldPos: Coordinate): SkillNode | null {
    const nodes = GetNodes()
    for (const node of nodes.values()) {
        if (!node.userCompletable) continue
        if (node.state !== 'inProgress' && node.state !== 'complete') continue

        const r = nodeRadii[node.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${node.id} in getCheckboxAtWorld`);
            continue;
        }
        const minScreenSize = 14;
        const maxScreenSize = 24;
        const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25));
        const checkboxSize = baseScreenSize / view.scale;

        const lineHeight = view.settings.fontSize / view.scale;

        let label = '';
        if (node.displayText && node.displayText.trim()) {
            label = node.displayText;
        } else if (node.fileLink) {
            const filename = node.fileLink.split('/').pop()?.replace('.md', '') || node.fileLink;
            label = filename;
        } else {
            label = '[unlinked]';
        }

        const words = (label || '').split(/\s+/).filter(Boolean)
        const nodeLines: string[] = []
        for (let i = 0; i < words.length; i += 4) {
            nodeLines.push(words.slice(i, i + 4).join(' '))
        }
        const totalLines = nodeLines.length + (label === '[unlinked]' ? 1 : 0)
        const firstLineY = node.y - ((totalLines - 1) * lineHeight) / 2
        const textBottomY = firstLineY + totalLines * lineHeight

        const checkboxX = node.x - checkboxSize / 2
        const checkboxY = textBottomY + 4 / view.scale

        const dx = worldPos.x - checkboxX
        const dy = worldPos.y - checkboxY

        if (dx >= 0 && dx <= checkboxSize && dy >= 0 && dy <= checkboxSize) {
            return node
        }
    }
    return null
}

/**
 * Handles a click on a node's checkbox (for user-completable nodes).
 * If the node is in 'inProgress' state, marks it as 'complete'.
 * Records the change and triggers a render update.
 * Does nothing if tree is locked or node is not user-completable.
 * @param node - The node whose checkbox was clicked
 * @returns true if the click was handled, false otherwise
 */
export function handleCheckboxClick(node: SkillNode): boolean {
    if (!node || !node.userCompletable) return false;
    if (IsCurrentTreeLocked()) {
        new Notice("Tree is locked, you can't update this skill");
        return true;
    }

    if (node.state === 'inProgress') {
        node.state = 'complete';
        node.userModified = true;
        node.fromNote = false;
    }

    SaveNodes();
    Update();
    return true;
}

/**
 * Finds an edge endpoint (from or to handle) at the given world position.
 * Used during edge dragging to detect when mouse is near an edge endpoint.
 * Uses a threshold scaled by view scale for consistent detection.
 * @param worldPos - The world coordinates to check
 * @returns The Handle at that position, or null if none found
 */
export function getEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes()
    const edges = GetEdges()
    const threshold = 20 / view.scale

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
 * Finds an edge endpoint at the given world position using a larger threshold (30/scale).
 * Similar to getEdgeEndpointAtWorld but with different threshold for specific use cases.
 * @param worldPos - The world coordinates to check
 * @returns The Handle at that position, or null if none found
 */
export function findEdgeEndpointAt(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const scale = view?.scale || 1;
    const threshold = 30 / scale;

    const hit = findEdgeAtWorld(worldPos, edges, nodes, nodeRadii, threshold);
    if (!hit) return null;

    const a = nodes.get(hit.edge.from as string | number);
    const b = nodes.get(hit.edge.to as string | number);
    if (!a || !b) return null;

    if (hit.closerToFrom) {
        return { node: a, side: (hit.edge.fromSide || 'right') as Handle['side'], hx: hit.fromX, hy: hit.fromY };
    } else {
        return { node: b, side: (hit.edge.toSide || 'left') as Handle['side'], hx: hit.toX, hy: hit.toY };
    }
}

/**
 * Finds an edge at the given world position.
 * Uses a threshold scaled by view scale for consistent hit detection.
 * @param worldPos - The world coordinates to check
 * @returns The SkillEdge at that position, or null if none found
 */
export function findEdgeAt(worldPos: Coordinate): SkillEdge | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const scale = view?.scale || 1;
    const threshold = 30 / scale;

    const hit = findEdgeAtWorld(worldPos, edges, nodes, nodeRadii, threshold);
    return hit?.edge ?? null;
}

// Edge dragging

/**
 * Begins dragging an existing edge from a handle.
 * Records a snapshot for undo support and sets up floating edge state.
 * If an edge exists at the handle, stores it as floatingEdge and determines direction.
 * @param handle - The handle (node side) where the drag begins
 */
export function startEdgeDrag(handle: Handle): void {
    RecordSnapshot();
    isDragging = true;
    const edge = FindEdgeAtHandle(handle);
    if (edge) {
        floatingEdge = edge;
        floatingEdgeDirection = GetEdgeDirection(edge, handle.node);
        previousEdgeFromFloating = JSON.parse(JSON.stringify(edge));
    }
}

/**
 * Updates the position of a floating (dragging) edge.
 * Moves the dragged endpoint to the new world position and detaches it from its node.
 * @param worldPos - The new world position for the floating edge endpoint
 */
export function updateFloatingEdge(worldPos: Coordinate): void {
    if (!floatingEdge) return;

    if (floatingEdgeDirection === Direction.from) {
        floatingEdge.fromX = worldPos.x;
        floatingEdge.fromY = worldPos.y;
        floatingEdge.from = null;
    } else {
        floatingEdge.toX = worldPos.x;
        floatingEdge.toY = worldPos.y;
        floatingEdge.to = null;
    }
    Update();
}

/**
 * Begins dragging a node (for repositioning).
 * Records a snapshot for undo support and sets the hit node and dragging state.
 * @param node - The node to start dragging
 */
export function startNodeDrag(node: SkillNode): void {
    RecordSnapshot();
    hitNode = node;
    isDragging = true;
}

/**
 * Updates a node's position during a drag operation.
 * Moves the hit node to the new world coordinates.
 * @param worldPos - The new world position for the dragged node
 */
export function updateNodeDrag(worldPos: Coordinate): void {
    if (!hitNode || !isDragging) return;

    hitNode.x = worldPos.x;
    hitNode.y = worldPos.y;
    Update();
}

/**
 * Ends a node drag operation.
 * Clears drag state, saves nodes, and syncs metadata to file if the node has a linked file.
 */
export function endNodeDrag(): void {
    const node = hitNode;
    hitNode = null;
    isDragging = false;
    SaveNodes();
    Update();
    if (node && node.fileLink && node.userCompletable) {
        SyncNodeMetadataToFile(node);
    }
}

/**
 * Handles the drag motion of an edge endpoint (not a full edge, but the endpoint being repositioned).
 * Updates both the source position and target position for rendering the temporary line.
 * @param worldPos - Current world position of the drag
 */
export function handleEdgeEndpointDrag(worldPos: Coordinate): void {
    edgeDragSourcePos = worldPos;
    edgeDragTarget = worldPos;
    Update();
}

/**
 * Completes an edge drag operation by either:
 * 1. Handling the floating edge (reconnecting or removing it)
 * 2. Creating a new edge if dragging to a valid target node
 * Checks for duplicate edges and finds the nearest handle on the target node.
 * @param worldPos - The final world position where the drag ended
 */
export function completeEdgeDrag(worldPos: Coordinate): void {
    HandleFloatingEdge(worldPos);

    if (edgeDragFrom && edgeDragTarget) {
        const sourceNode = edgeDragFrom.node;
        const targetNode = FindNodeAt(worldPos.x, worldPos.y);

        if (targetNode && targetNode.id !== sourceNode.id) {
            const edges = GetEdges();
            const duplicate = edges.some(e => e.from === sourceNode.id && e.to === targetNode.id);

            if (!duplicate) {
                const r = nodeRadii[targetNode.id];
                if (r === undefined) {
                    console.error(`nodeRadii missing for node ${targetNode.id} in completeEdgeDrag`);
                    return;
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
                    const dx = h.hx - edgeDragFrom.hx;
                    const dy = h.hy - edgeDragFrom.hy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = h;
                    }
                }

                const newEdge: SkillEdge = {
                    id: Date.now(),
                    from: sourceNode.id,
                    to: targetNode.id,
                    fromSide: edgeDragFrom.side as any,
                    toSide: (nearest?.side || 'top') as any
                };

                CreateEdge(newEdge);
                SaveNodes();
                Update();
            }
        }
    }

    resetDragState();
}

/**
 * Completes a new edge creation (not modifying an existing edge).
 * Creates an edge from the source handle to the target node at the given position.
 * Checks for duplicates and finds the nearest handle on the target node.
 * @param worldPos - The target world position for the new edge
 * @returns true if edge was created, false otherwise (no source, same node, or duplicate)
 */
export function completeEdgeCreation(worldPos: Coordinate): boolean {
    if (!edgeDragFrom) return false

    const sourceNode = edgeDragFrom.node
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    if (!targetNode || targetNode.id === sourceNode.id) return false

    const edges = GetEdges()
    const duplicate = edges.some(e => e.from === sourceNode.id && e.to === targetNode.id)
    if (duplicate) return false

    const sourceHandle = edgeDragFrom
    const nearest = findNearestHandle(targetNode, sourceHandle.hx, sourceHandle.hy)
    const toSide = nearest?.side || 'top'

    const newEdge: SkillEdge = {
        id: Date.now(),
        from: sourceNode.id,
        to: targetNode.id,
        fromSide: sourceHandle.side as any,
        toSide: toSide as any
    }

    CreateEdge(newEdge)
    Update()
    return true
}

/**
 * Handles the completion of dragging a floating edge.
 * If dropped on a node, reconnects the edge to that node (finding nearest handle).
 * If dropped on empty space, removes the floating edge.
 * If dropped back on the original node, restores the original edge.
 * @param worldPos - The world position where the drag ended
 */
export function HandleFloatingEdge(worldPos: Coordinate): void {
    const prevEdge = previousEdgeFromFloating;
    if (!floatingEdge || !prevEdge) return;

    const targetNode = FindNodeAt(worldPos.x, worldPos.y);
    if (!targetNode) {
        RemoveEdge(floatingEdge.id);
        Update()
        return;
    }

    const fDir = floatingEdgeDirection;

    const otherNodeId = fDir === Direction.to ? prevEdge.from : prevEdge.to;

    const otherNode = GetNodes().get(otherNodeId as string | number);

    const draggedEndpointId = fDir === Direction.to ? prevEdge.to : prevEdge.from;

    if (targetNode.id === otherNode?.id || targetNode.id === draggedEndpointId) {
        RemoveEdge(floatingEdge.id);
        CreateEdge(prevEdge);
        Update()
        return;
    }

    RemoveEdge(floatingEdge.id);

    const isDraggingTo = fDir === Direction.to;
    const refX = isDraggingTo ? (prevEdge.fromX || 0) : (prevEdge.toX || 0);
    const refY = isDraggingTo ? (prevEdge.fromY || 0) : (prevEdge.toY || 0);
    const nearest = findNearestHandle(targetNode, refX, refY);

    const newEdge: SkillEdge = {
        id: Date.now(),
        from: isDraggingTo ? prevEdge.from : targetNode.id,
        to: isDraggingTo ? targetNode.id : prevEdge.to,
        fromSide: (isDraggingTo ? (prevEdge.fromSide || 'right') : (nearest?.side || 'right')) as SkillEdge['fromSide'],
        toSide: (isDraggingTo ? (nearest?.side || 'left') : (prevEdge.toSide || 'left')) as SkillEdge['toSide']
    };

    CreateEdge(newEdge);
    Update()
}

/**
 * Resets all drag-related state variables to their defaults.
 * Clears: hitNode, floatingEdge, previousEdgeFromFloating, edgeDragFrom, edgeDragTarget,
 * edgeDragSourcePos, isDragging, isDraggingEdgeEndpoint, draggingEdgeEndpoint, floatingEdgeDirection,
 * draggingOverEdge. Also saves nodes and triggers a render update.
 */
export function resetDragState(): void {
    hitNode = null;
    floatingEdge = null;
    previousEdgeFromFloating = null;
    edgeDragFrom = null;
    edgeDragTarget = null;
    edgeDragSourcePos = null;
    isDragging = false;
    isDraggingEdgeEndpoint = false;
    draggingEdgeEndpoint = null;
    floatingEdgeDirection = Direction.none;
    draggingOverEdge = null;
    SaveNodes();
    Update();
}

/**
 * Sets the currently selected node by ID.
 * @param node - The node to select
 */
export function selectNode(node: SkillNode): void {
    SetSelectedNodeID(node.id);
}

/**
 * Clears the current node selection by setting selected ID to null.
 */
export function clearSelection(): void {
    SetSelectedNodeID(null);
}

// Level pane drag handlers

/**
 * Starts dragging the level pane.
 * Records initial position and cursor style for computing drag offset.
 * @param initialPos - The initial mouse position where drag started
 */
export function startLevelPaneDrag(initialPos: { x: number, y: number }): void {
    if (!levelPaneElement) return;
    const dragState = GetLevelPaneDragState();
    dragState.isDragging = true;
    dragState.startX = initialPos.x;
    dragState.startY = initialPos.y;
    dragState.initialLeft = levelPaneElement.offsetLeft;
    dragState.initialTop = levelPaneElement.offsetTop;
    levelPaneElement.style.cursor = 'grabbing';
}

/**
 * Moves the level pane during a drag operation.
 * Calculates the new position based on the difference from the initial drag position.
 * @param currentPos - The current mouse position
 */
export function moveLevelPane(currentPos: { x: number, y: number }): void {
    if (!levelPaneElement) return;
    const dragState = GetLevelPaneDragState();
    if (!dragState.isDragging) return;
    const dx = currentPos.x - dragState.startX;
    const dy = currentPos.y - dragState.startY;
    const newLeft = dragState.initialLeft + dx;
    const newTop = dragState.initialTop + dy;
    UpdateLevelPanePosition(newLeft, newTop);
}

/**
 * Ends the level pane drag operation by resetting the drag state and cursor style.
 */
export function endLevelPaneDrag(): void {
    if (!levelPaneElement) return;
    const dragState = GetLevelPaneDragState();
    dragState.isDragging = false;
    levelPaneElement.style.cursor = 'move';
}
