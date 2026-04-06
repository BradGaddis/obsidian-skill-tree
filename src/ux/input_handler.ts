import { Render, nodeRadius, nodeRadii, screenToWorld, handleRadius } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection, SetSelectedNodeID } from "../tree-manager";
import { RecordSnapshot, SaveNodes } from "../recorder";
import { SkillNode } from "src/skill_nodes/skill_node";
import { Coordinate, Handle } from "src/types";
import { SkillEdge } from "src/interfaces";
import { Direction } from "src/enums";
import { distanceTo, pointToSegmentDistance } from "../utils";
import { pushNodeFromCollision } from "../utils/collision";

let view: SkillTreeView;

export let hitNode: SkillNode | null = null;
export let isDragging: boolean = false;
export let isDraggingEdgeEndpoint: boolean = false;
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null = null;
export let edgeDragFrom: Handle | null = null;
export let edgeDragTarget: Coordinate | null = null;
export let edgeDragSourcePos: Coordinate | null = null;

let floatingEdge: SkillEdge | null = null;
let previousEdgeFromFloating: SkillEdge | null = null;
let floatingEdgeDirection: Direction = Direction.none;

export function initInputHandler(skillTreeView: SkillTreeView): void {
    view = skillTreeView;
}

export function isInEditMode(): boolean {
    return view?.settings?.mode === "edit";
}

export function setHitNode(node: SkillNode | null): void {
    hitNode = node;
}

export function setIsDragging(dragging: boolean): void {
    isDragging = dragging;
}

export function setEdgeDragFrom(handle: Handle | null): void {
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

export function screenToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}

export function findNodeAt(x: number, y: number): SkillNode | null {
    return FindNodeAt(x, y);
}

export function findHandleAt(worldPos: Coordinate): Handle | null {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        const r = nodeRadii[node.id] || nodeRadius;
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ];
        const handleThreshold = handleRadius;

        for (const h of handles) {
            const dx = worldPos.x - h.hx;
            const dy = worldPos.y - h.hy;
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= handleThreshold * handleThreshold) {
                console.log("hit handle")
                return { node, side: h.side as 'top' | 'right' | 'bottom' | 'left', hx: h.hx, hy: h.hy };
            }
        }
    }
    return null;
}

export function findEdgeEndpointAt(worldPos: Coordinate): Handle | null {
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
    isDragging = true;
    hitNode = node;
}

export function updateNodeDrag(worldPos: Coordinate): void {
    if (!hitNode || !isDragging) return;

    const newPos = pushNodeFromCollision(worldPos.x, worldPos.y, hitNode);
    hitNode.x = newPos.x;
    hitNode.y = newPos.y;
    Render();
}

export function endNodeDrag(): void {
    hitNode = null;
    isDragging = false;
    Render();
    SaveNodes();
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

function findNearestHandleOnNode(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
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

    if (floatingEdgeDirection === Direction.to && targetNode.id === previousEdgeFromFloating.to) {
        CreateEdge(previousEdgeFromFloating);
        return;
    }
    if (floatingEdgeDirection === Direction.from && targetNode.id === previousEdgeFromFloating.from) {
        CreateEdge(previousEdgeFromFloating);
        return;
    }

    const nodes = GetNodes();
    const otherNodeId = floatingEdgeDirection === Direction.to ? previousEdgeFromFloating.from : previousEdgeFromFloating.to;
    const otherNode = nodes.get(otherNodeId as string | number);
    if (!otherNode) return;

    const nearest = findNearestHandleOnNode(targetNode, otherNode.x, otherNode.y);
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

export function getView(): SkillTreeView {
    return view;
}

export function requestRender(): void {
    Render();
}
