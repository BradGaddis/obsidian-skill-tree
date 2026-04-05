import { CenterOnNode, Render, nodeRadius, nodeRadii } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection } from "../tree-manager";
import { distanceTo, pointToSegmentDistance } from "../utils";
import { SkillNode } from "src/skill_nodes/skill_node";
import { createStatsModal } from "../modal/stilltree-stats-modal";
import { Coordinate, Handle } from "src/types";
import { InitPanHandler } from "./panning";
import { InitZoomHandler } from "./zoom";
import { SkillEdge } from "src/interfaces";
import { Direction, Direction as EdgeDirection } from "src/enums";

let view: SkillTreeView;


// prevents node from opening on first click
let nodeWasSelected: SkillNode | null
export let edgeDragFrom: Handle | null
export let edgeDragTarget: Coordinate | null
export let hitNode: SkillNode | null
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null
export let edgeDragSourcePos: Coordinate | null
let floatingEdge: SkillEdge | null
let previousEdgeFromFloating: SkillEdge | null

let floatingEdgeDirection: EdgeDirection

let isDragging: boolean



export function InitClickHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    const onMouseDown = (e: MouseEvent) => {
        if (view.settings.mode !== "edit") return

        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });


        hitNode = FindNodeAt(worldPos.x, worldPos.y);

        if (e.button === 2 && hitNode) {
            SetSelectedNodeID(hitNode.id)
            CenterOnNode(hitNode)
            createStatsModal(view, hitNode)
            // TODO: open edit modal
            return
        }

        const edgeHandle = getEdgeEndpointAtWorld(worldPos)
        if (edgeHandle) {
            isDragging = true
            floatingEdge = FindEdgeAtHandle(edgeHandle)
            floatingEdgeDirection = GetEdgeDirection(floatingEdge, edgeHandle.node)
            previousEdgeFromFloating = JSON.parse(JSON.stringify(floatingEdge))
            return
        }

        if (!hitNode) return

        const handle = getHandleAtWorld(worldPos)
        if (!handle) {
            isDragging = true
            return
        }

        const r = nodeRadii[hitNode.id] || nodeRadius
        const dist = Math.hypot(worldPos.x - hitNode.x, worldPos.y - hitNode.y)
        const edgeThreshold = 15 / view.scale

        if (Math.abs(dist - r) >= edgeThreshold) {
            return
        }

        floatingEdge = FindEdgeAtHandle(handle)

        if (floatingEdge) {
            isDragging = true
            floatingEdgeDirection = GetEdgeDirection(floatingEdge, handle.node)
            previousEdgeFromFloating = JSON.parse(JSON.stringify(floatingEdge))
            return // remove
        }

        floatingEdgeDirection = Direction.none

        setEdgeDragFrom(handle)
        setEdgeDragTarget(worldPos)
        // Render()
    };

    // TODO: fix for node dragging
    const onMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (floatingEdge) {
            if (floatingEdgeDirection === Direction.from) {
                floatingEdge.fromX = worldPos.x
                floatingEdge.fromY = worldPos.y
                floatingEdge.from = null
            } else {
                floatingEdge.toX = worldPos.x
                floatingEdge.toY = worldPos.y
                floatingEdge.to = null
            }
            Render()
            return
        }

        if (isDragging && hitNode) {
            hitNode.x = worldPos.x
            hitNode.y = worldPos.y
            Render()
            return
        }

        if (draggingEdgeEndpoint) {
            edgeDragSourcePos = worldPos
            edgeDragTarget = worldPos
            Render()
            return
        }

        if (!edgeDragFrom) return


        setEdgeDragTarget(worldPos)
        Render()
    };

    const onMouseUp = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        HandleFloatingEdge(worldPos)


        if (edgeDragFrom && edgeDragTarget) {
            completeEdgeCreation(edgeDragTarget)
        }

        hitNode = null
        floatingEdge = null
        previousEdgeFromFloating = null
        edgeDragFrom = null
        edgeDragTarget = null
        isDragging = false
        Render()
    };

    const onClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const hitNode = FindNodeAt(worldPos.x, worldPos.y);

        if (!hitNode) {
            SetSelectedNodeID(null)
            return
        }

        if (nodeWasSelected?.id === hitNode.id) {
            createStatsModal(view, hitNode);
        }

        SetSelectedNodeID(hitNode.id)
        nodeWasSelected = hitNode
        CenterOnNode(hitNode)

    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);



    const panCleanup = InitPanHandler(view,
        () => {
            return (hitNode == null && !isDragging)
        }
    ).cleanup;

    const zoomCleanup = InitZoomHandler(view, {
        minScale: 0.3,
        maxScale: 3
    }).cleanup;

    return {
        cleanup: () => {
            panCleanup();
            zoomCleanup();
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('click', onClick);
        }
    };
}

// TODO: move all of these functions into seperate module?

function getHandleAtWorld(coords: Coordinate): Handle | null {
    const nodes = GetNodes()
    for (const node of nodes.values()) {
        const r = nodeRadii[node.id] || nodeRadius
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ]
        const handleThreshold = 20 / view.scale
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

// TODO: move into tree manager
function findNearestHandle(targetNode: SkillNode, refX: number, refY: number): { side: string, hx: number, hy: number } | null {
    const r = nodeRadii[targetNode.id] || nodeRadius
    const handles = [
        { side: 'top', hx: targetNode.x, hy: targetNode.y - r },
        { side: 'right', hx: targetNode.x + r, hy: targetNode.y },
        { side: 'bottom', hx: targetNode.x, hy: targetNode.y + r },
        { side: 'left', hx: targetNode.x - r, hy: targetNode.y },
    ]

    let nearest: { side: string, hx: number, hy: number } | null = null
    let minDist = Infinity

    for (const h of handles) {
        const dist = distanceTo({ x: h.hx, y: h.hy }, { x: refX, y: refY })
        if (dist < minDist) {
            minDist = dist
            nearest = h
        }
    }
    return nearest
}

export function setEdgeDragFrom(edgeDrag: Handle): void {
    edgeDragFrom = edgeDrag
}

export function getEdgeDragFrom(): Handle | null {
    return edgeDragFrom
}

export function setEdgeDragTarget(target: Coordinate): void {
    edgeDragTarget = target
}

export function getEdgeDragTarget(): typeof edgeDragTarget | null {
    return edgeDragTarget
}



function completeEdgeCreation(worldPos: Coordinate): boolean {
    if (!edgeDragFrom) return false

    const sourceNode = edgeDragFrom.node

    // Find target node at drop position
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    if (!targetNode || targetNode.id === sourceNode.id) return false

    // Check for duplicate edge
    const edges = GetEdges()
    const duplicate = edges.some(e => e.from === sourceNode.id && e.to === targetNode.id)
    if (duplicate) return false

    // Get source and target sides
    const sourceHandle = edgeDragFrom
    const nearest = findNearestHandle(targetNode, sourceHandle.hx, sourceHandle.hy)
    const toSide = nearest?.side || 'top'  // fallback

    // Create new edge
    const newEdge: SkillEdge = {
        id: Date.now(),
        from: sourceNode.id,
        to: targetNode.id,
        fromSide: sourceHandle.side as any,
        toSide: toSide as any
    }

    // Add to edges
    // Note: Need to use AddEdge from tree-manager or direct push
    CreateEdge(newEdge)

    Render()
    return true
}


function getEdgeEndpointAtWorld(worldPos: Coordinate): Handle | null {
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


function HandleFloatingEdge(worldPos: Coordinate) {
    if (!floatingEdge || !previousEdgeFromFloating) {
        return
    }
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    if (!targetNode) {
        RemoveEdge(floatingEdge.id)
        return
    }

    // Delete the floating edge
    RemoveEdge(floatingEdge.id)
    // If dropping on original node(s), recreate original edge
    if (floatingEdgeDirection === Direction.to && targetNode.id === previousEdgeFromFloating.to) {
        CreateEdge(previousEdgeFromFloating)
        return
    }
    if (floatingEdgeDirection === Direction.from && targetNode.id === previousEdgeFromFloating.from) {
        CreateEdge(previousEdgeFromFloating)
        return
    }
    // Dropping on a different node - create new edge with swapped endpoint
    const nodes = GetNodes()
    const otherNodeId = floatingEdgeDirection === Direction.to
        ? previousEdgeFromFloating.from
        : previousEdgeFromFloating.to
    const otherNode = nodes.get(otherNodeId as string | number)
    if (!otherNode) {
        return
    }
    const nearest = findNearestHandle(targetNode, otherNode.x, otherNode.y)
    if (!nearest) {
        return
    }
    const newEdge: SkillEdge = {
        id: floatingEdge.id,
        from: floatingEdgeDirection === Direction.from ? targetNode.id : previousEdgeFromFloating.from,
        to: floatingEdgeDirection === Direction.to ? targetNode.id : previousEdgeFromFloating.to,
        fromSide: floatingEdgeDirection === Direction.from ? nearest.side as any : previousEdgeFromFloating.fromSide,
        toSide: floatingEdgeDirection === Direction.to ? nearest.side as any : previousEdgeFromFloating.toSide,
    }
    CreateEdge(newEdge)
}
