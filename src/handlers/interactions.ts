import { Update, nodeRadii, screenToWorld, handleRadius, levelPaneElement, GetLevelPaneDragState, UpdateLevelPanePosition } from "../rendering/renderer";
import { FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection, SetSelectedNodeID, IsCurrentTreeLocked, SyncNodeMetadataToFile } from "../data/tree_manager";
import { RecordSnapshot, SaveNodes } from "../data/recorder";
import { SkillNode } from "../nodes/skill_node";
import { Coordinate, Handle } from "../types/types";
import { SkillEdge } from "../types/interfaces";
import { Direction } from "../types/enums";
import { distanceTo, pointToSegmentDistance } from "../types/utils";
import { view } from "../utils/globals";
import { Notice } from "obsidian";

const EDGE_STRAIGHT_LINE_THRESHOLD = 10;


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
export function setHitNode(node: SkillNode | null): void {
    hitNode = node;
}

export function setIsDragging(dragging: boolean): void {
    isDragging = dragging;
}

export function setDraggingOverEdge(edge: SkillEdge | null): void {
    draggingOverEdge = edge;
}

export function setEdgeDragFrom(handle: Handle): void {
    edgeDragFrom = handle;
}

export function getEdgeDragFrom(): Handle | null {
    return edgeDragFrom;
}

export function setEdgeDragTarget(coord: Coordinate | null): void {
    edgeDragTarget = coord;
}


export function screenToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}

export function EventToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}

export function findNodeAt(worldPos: Coordinate): SkillNode | null {
    return FindNodeAt(worldPos.x, worldPos.y);
}

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
                return { node, side: h.side, hx: h.hx, hy: h.hy }
            }
        }
    }
    return null
}

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

export function getEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes()
    const edges = GetEdges()
    const threshold = 20 / view.scale

    for (const e of edges) {
        if (!e.from || !e.to) continue

        const a = nodes.get(e.from as string | number)
        const b = nodes.get(e.to as string | number)
        if (!a || !b) continue

        const rFrom = nodeRadii[a.id]
        const rTo = nodeRadii[b.id]
        if (rFrom === undefined) {
            console.error(`nodeRadii missing for node ${a.id} (from) in getEdgeEndpointAtWorld`);
            continue;
        }
        if (rTo === undefined) {
            console.error(`nodeRadii missing for node ${b.id} (to) in getEdgeEndpointAtWorld`);
            continue;
        }

        let fromX = a.x, fromY = a.y
        if (e.fromSide === 'top') fromY -= rFrom
        else if (e.fromSide === 'right') fromX += rFrom
        else if (e.fromSide === 'bottom') fromY += rFrom
        else if (e.fromSide === 'left') fromX -= rFrom
        else {
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
            fromX = a.x + (dx / d) * rFrom
            fromY = a.y + (dy / d) * rFrom
        }

        let toX = b.x, toY = b.y
        if (e.toSide === 'top') toY -= rTo
        else if (e.toSide === 'right') toX += rTo
        else if (e.toSide === 'bottom') toY += rTo
        else if (e.toSide === 'left') toX -= rTo
        else {
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
            toX = b.x - (dx / d) * rTo
            toY = b.y - (dy / d) * rTo
        }

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
            const fromDist = distanceTo(worldPos, { x: fromX, y: fromY })
            const toDist = distanceTo(worldPos, { x: toX, y: toY })

            if (fromDist <= toDist) {
                return { node: a, side: e.fromSide || 'right', hx: fromX, hy: fromY }
            } else {
                return { node: b, side: e.toSide || 'left', hx: toX, hy: toY }
            }
        }
    }

    return null
}

export function findEdgeEndpointAt(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const scale = view?.scale || 1;
    const threshold = 30 / scale;

    for (const e of edges) {
        if (!e.from || !e.to) continue;

        const a = nodes.get(e.from as string | number);
        const b = nodes.get(e.to as string | number);
        if (!a || !b) continue;

        const rFrom = nodeRadii[a.id];
        const rTo = nodeRadii[b.id];
        if (rFrom === undefined) {
            console.error(`nodeRadii missing for node ${a.id} (from) in findEdgeEndpointAt`);
            continue;
        }
        if (rTo === undefined) {
            console.error(`nodeRadii missing for node ${b.id} (to) in findEdgeEndpointAt`);
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

            if (fromDist <= toDist) {
                return { node: a, side: (e.fromSide || 'right') as 'top' | 'right' | 'bottom' | 'left', hx: fromX, hy: fromY };
            } else {
                return { node: b, side: (e.toSide || 'left') as 'top' | 'right' | 'bottom' | 'left', hx: toX, hy: toY };
            }
        }
    }

    return null;
}

export function findEdgeAt(worldPos: Coordinate): SkillEdge | null {
    const nodes = GetNodes();
    const edges = GetEdges();
    const scale = view?.scale || 1;
    const threshold = 30 / scale;

    for (const e of edges) {
        if (!e.from || !e.to) continue;

        const a = nodes.get(e.from as string | number);
        const b = nodes.get(e.to as string | number);
        if (!a || !b) continue;

        const rFrom = nodeRadii[a.id];
        const rTo = nodeRadii[b.id];
        if (rFrom === undefined) {
            console.error(`nodeRadii missing for node ${a.id} (from) in findEdgeAt`);
            continue;
        }
        if (rTo === undefined) {
            console.error(`nodeRadii missing for node ${b.id} (to) in findEdgeAt`);
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
            return e;
        }
    }

    return null;
}

// Edge dragging
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

export function startNodeDrag(node: SkillNode): void {
    RecordSnapshot();
    hitNode = node;
    isDragging = true;
}

export function updateNodeDrag(worldPos: Coordinate): void {
    if (!hitNode || !isDragging) return;

    hitNode.x = worldPos.x;
    hitNode.y = worldPos.y;
    Update();
}

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

export function handleEdgeEndpointDrag(worldPos: Coordinate): void {
    edgeDragSourcePos = worldPos;
    edgeDragTarget = worldPos;
    Update();
}

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

export function selectNode(node: SkillNode): void {
    SetSelectedNodeID(node.id);
}

export function clearSelection(): void {
    SetSelectedNodeID(null);
}

// Level pane drag handlers
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

export function endLevelPaneDrag(): void {
    if (!levelPaneElement) return;
    const dragState = GetLevelPaneDragState();
    dragState.isDragging = false;
    levelPaneElement.style.cursor = 'move';
}
