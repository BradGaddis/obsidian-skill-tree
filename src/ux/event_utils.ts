import { Render, nodeRadius, nodeRadii, fontSize, screenToWorld, handleRadius, CenterOnNode } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection, SetSelectedNodeID, FindNearestHandleOnNode } from "../tree_manager";
import { RecordSnapshot, SaveNodes } from "../recorder";
import { SkillNode } from "src/skill_nodes/skill_node";
import { Coordinate, Handle } from "src/types";
import { SkillEdge } from "src/interfaces";
import { Direction } from "src/enums";
import { distanceTo, pointToSegmentDistance } from "../utils";

let view: SkillTreeView;

export function initEventUtils(skillTreeView: SkillTreeView): void {
    view = skillTreeView;
}

export function isInEditMode(): boolean {
    return view?.settings?.mode === "edit";
}

// State - consolidated from input_handler.ts and event_utils.ts
export let hitNode: SkillNode | null = null;
export let isDragging: boolean = false;
export let isDraggingEdgeEndpoint: boolean = false;
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null = null;
export let edgeDragFrom: Handle | null = null;
export let edgeDragTarget: Coordinate | null = null;
export let edgeDragSourcePos: Coordinate | null = null;
let floatingEdge: SkillEdge | null = null;
let previousEdgeFromFloating: SkillEdge | null = null;
export let floatingEdgeDirection: Direction = Direction.none;

// Hit detection constants
export const HANDLE_HIT_BASE = 20;
export const HANDLE_HIT_SCALE = 2;

// Setters/Getters
export function setHitNode(node: SkillNode | null): void {
    hitNode = node;
}

export function setIsDragging(dragging: boolean): void {
    isDragging = dragging;
}

export function getIsDraggingEdge(): boolean {
    return isDraggingEdgeEndpoint
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

export function getEdgeDragTarget(): Coordinate | null {
    return edgeDragTarget;
}

export function setEdgeDragSourcePos(pos: Coordinate | null): void {
    edgeDragSourcePos = pos;
}

export function getFloatingEdge(): SkillEdge | null {
    return floatingEdge
}

export function setPreviousEdgeFromFloating(edge: SkillEdge | null): void {
    previousEdgeFromFloating = edge
}

export function getPreviousEdgeFromFloating(): SkillEdge | null {
    return previousEdgeFromFloating
}

export function setFloatingEdgeDirection(dir: Direction): void {
    floatingEdgeDirection = dir
}

export function getFloatingEdgeDirection(): Direction {
    return floatingEdgeDirection
}

export function getView(): SkillTreeView {
    return view;
}

// Coordinate conversion
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

// Node/Handle hit detection
export function findNodeAt(x: number, y: number): SkillNode | null {
    return FindNodeAt(x, y);
}

export function findHandleAt(worldPos: Coordinate): Handle | null {
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

            if (dist2 <= Math.sqrt(r) + r) {
                return { node, side: h.side as 'top' | 'right' | 'bottom' | 'left', hx: h.hx, hy: h.hy };
            }
        }
    }
    return null;
}

export function getHandleAtWorld(coords: Coordinate): Handle | null {
    const nodes = GetNodes()
    for (const node of nodes.values()) {
        const r = (nodeRadii[node.id] || nodeRadius) + handleRadius
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ]
        const handleThreshold = handleRadius

        for (const h of handles) {
            const dx = coords.x - h.hx
            const dy = coords.y - h.hy
            const dist2 = dx * dx + dy * dy
            if (dist2 <= handleThreshold * handleThreshold) {
                return { node, side: h.side, hx: h.hx, hy: h.hy }
            }
        }
    }
    return null
}

export function findNearestHandle(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
    const r = (nodeRadii[targetNode.id] || nodeRadius) + handleRadius
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

        const r = nodeRadii[node.id] || nodeRadius
        const minScreenSize = 14
        const maxScreenSize = 24
        const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25))
        const checkboxSize = baseScreenSize / view.scale

        const lineHeight = fontSize / view.scale
        
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

export function getEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes()
    const edges = GetEdges()
    const threshold = 20 / view.scale

    for (const e of edges) {
        if (!e.from || !e.to) continue

        const a = nodes.get(e.from as string | number)
        const b = nodes.get(e.to as string | number)
        if (!a || !b) continue

        const rFrom = nodeRadii[a.id] || nodeRadius
        const rTo = nodeRadii[b.id] || nodeRadius

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

        const dist = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, toX, toY)

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

        const dist = pointToSegmentDistance(worldPos.x, worldPos.y, fromX, fromY, toX, toY);

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
    Render();
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
    Render();
}

export function endNodeDrag(): void {
    const node = hitNode;
    hitNode = null;
    isDragging = false;
    Render();
    SaveNodes();
    if (node && node.fileLink && node.userCompletable) {
        import("src/tree_manager").then(m => m.SyncNodeMetadataToFile(node));
    }
}

export function handleEdgeEndpointDrag(worldPos: Coordinate): void {
    edgeDragSourcePos = worldPos;
    edgeDragTarget = worldPos;
    Render();
}

export function completeEdgeDrag(worldPos: Coordinate): void {
    handleFloatingEdge(worldPos);

    if (edgeDragFrom && edgeDragTarget) {
        const sourceNode = edgeDragFrom.node;
        const targetNode = FindNodeAt(worldPos.x, worldPos.y);

        if (targetNode && targetNode.id !== sourceNode.id) {
            const edges = GetEdges();
            const duplicate = edges.some(e => e.from === sourceNode.id && e.to === targetNode.id);

            if (!duplicate) {
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
                Render();
                SaveNodes();
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
    Render()
    return true
}

export function handleFloatingEdge(worldPos: Coordinate): void {
    if (!floatingEdge || !previousEdgeFromFloating) {
        return;
    }

    const targetNode = FindNodeAt(worldPos.x, worldPos.y);

    if (!targetNode) {
        RemoveEdge(floatingEdge.id);
        return;
    }

    RemoveEdge(floatingEdge.id);

    const nodes = GetNodes();

    const otherNodeId = floatingEdgeDirection === Direction.to ? previousEdgeFromFloating.from : previousEdgeFromFloating.to;

    const otherNode = nodes.get(otherNodeId as string | number);

    if (!otherNode) return;

    const nearest = findNearestHandle(targetNode, otherNode.x, otherNode.y);

    if (!nearest) return;

    const newEdge: SkillEdge = {
        id: floatingEdge.id,
        from: floatingEdgeDirection === Direction.from ? targetNode.id : previousEdgeFromFloating.from,
        to: floatingEdgeDirection === Direction.to ? targetNode.id : previousEdgeFromFloating.to,
        fromSide: floatingEdgeDirection === Direction.from ? nearest.side as any : previousEdgeFromFloating.fromSide,
        toSide: floatingEdgeDirection === Direction.to ? nearest.side as any : previousEdgeFromFloating.toSide,
    };

    CreateEdge(newEdge);
}

export function HandleFloatingEdge(worldPos: Coordinate): void {
    const fEdge = getFloatingEdge()
    const prevEdge = getPreviousEdgeFromFloating()
    if (!fEdge || !prevEdge) {
        return
    }
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    if (!targetNode) {
        RemoveEdge(fEdge.id)
        return
    }

    RemoveEdge(fEdge.id)

    const fDir = getFloatingEdgeDirection()
    if (fDir === Direction.to && targetNode.id === prevEdge.to) {
        CreateEdge(prevEdge)
        return
    }
    if (fDir === Direction.from && targetNode.id === prevEdge.from) {
        CreateEdge(prevEdge)
        return
    }

    const nodes = GetNodes()
    const otherNodeId = fDir === Direction.to ? prevEdge.from : prevEdge.to
    const otherNode = nodes.get(otherNodeId as string | number)
    if (!otherNode) return

    const nearest = findNearestHandle(targetNode, otherNode.x, otherNode.y)
    if (!nearest) return

    const newEdge: SkillEdge = {
        id: fEdge.id,
        from: fDir === Direction.from ? targetNode.id : prevEdge.from,
        to: fDir === Direction.to ? targetNode.id : prevEdge.to,
        fromSide: fDir === Direction.from ? nearest.side as any : prevEdge.fromSide,
        toSide: fDir === Direction.to ? nearest.side as any : prevEdge.toSide,
    }
    CreateEdge(newEdge)
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
    Render();
    SaveNodes();
}

export function selectNode(node: SkillNode): void {
    SetSelectedNodeID(node.id);
}

export function clearSelection(): void {
    SetSelectedNodeID(null);
}
