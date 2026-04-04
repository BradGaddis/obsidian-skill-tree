import { CenterOnNode, Render, nodeRadius, nodeRadii } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge } from "../tree-manager";
import { SkillNode } from "src/skill_nodes/skill_node";
import { createStatsModal } from "../modal/stilltree-stats-modal";
import { Coordinate } from "src/types";
import { InitPanHandler } from "./panning";
import { InitZoomHandler } from "./zoom";
import { SkillEdge } from "src/interfaces";

let view: SkillTreeView;

type Handle = { node: SkillNode, side: string, hx: number, hy: number }
type EdgeDrag = { handle: Handle }

// prevents node from opening on first click
let nodeWasSelected: SkillNode | null
export let edgeDragFrom: EdgeDrag | null
export let edgeDragTarget: Coordinate | null
export let hitNode: SkillNode | null
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null
export let edgeDragSourcePos: Coordinate | null

export function InitClickHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };



    const onMouseDown = (e: MouseEvent) => {
        if (view.settings.mode !== "edit") return

        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        const endpointHit = getEdgeEndpointAtWorld(worldPos.x, worldPos.y)

        if (endpointHit) {
            draggingEdgeEndpoint = { edgeId: endpointHit.edge.id, which: endpointHit.which }
            edgeDragSourcePos = { x: endpointHit.ex, y: endpointHit.ey }
            Render()
            return
        }

        hitNode = FindNodeAt(worldPos.x, worldPos.y);

        if (!hitNode) return

        const r = nodeRadii[hitNode.id] || nodeRadius

        const dist = Math.hypot(worldPos.x - hitNode.x, worldPos.y - hitNode.y)
        const edgeThreshold = 15 / view.scale

        if (Math.abs(dist - r) <= edgeThreshold) {
            const handle = getHandleAtWorld(worldPos)
            if (handle) {
                setEdgeDragFrom({ handle })
                setEdgeDragTarget(worldPos)
                Render()
            }
        }
    };

    // TODO: fix for node dragging
    const onMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (draggingEdgeEndpoint) {
            edgeDragSourcePos = worldPos
            edgeDragTarget = worldPos
            Render()
            return
        }

        if (!edgeDragFrom) return //TODO: add node dragging check

        setEdgeDragTarget(worldPos)
        Render()
    };

    const onMouseUp = () => {
        if (draggingEdgeEndpoint && edgeDragTarget) {
            handleExistingEdgeDrop(edgeDragTarget)
        }
        hitNode = null
        if (edgeDragFrom && edgeDragTarget) {
            completeEdgeCreation(edgeDragTarget)
        }
        if (edgeDragFrom) {
            edgeDragFrom = null
            edgeDragTarget = null
            Render()
        }
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
            return hitNode == null && edgeDragFrom == null
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
        const dx = h.hx - refX
        const dy = h.hy - refY
        const dist = dx * dx + dy * dy
        if (dist < minDist) {
            minDist = dist
            nearest = h
        }
    }
    return nearest
}

export function setEdgeDragFrom(edgeDrag: EdgeDrag): void {
    edgeDragFrom = edgeDrag

}

export function getEdgeDragFrom(): EdgeDrag | null {
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

    const sourceNode = edgeDragFrom.handle.node

    // Find target node at drop position
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    if (!targetNode || targetNode.id === sourceNode.id) return false

    // Check for duplicate edge
    const edges = GetEdges()
    const duplicate = edges.some(e => e.from === sourceNode.id && e.to === targetNode.id)
    if (duplicate) return false

    // Get source and target sides
    const sourceHandle = edgeDragFrom.handle
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


function getEdgeEndpointAtWorld(x: number, y: number): { edge: SkillEdge, which: 'from' | 'to', ex: number, ey: number } | null {
    const nodes = GetNodes()
    const edges = GetEdges()

    // TODO: deal with magic numbers
    const threshold = 20 / view.scale

    for (const e of edges) {
        if (!e.from || !e.to) continue

        const a = nodes.get(e.from as string | number)
        const b = nodes.get(e.to as string | number)
        if (!a || !b) continue

        const rFrom = nodeRadii[a.id] || nodeRadius
        const rTo = nodeRadii[b.id] || nodeRadius

        // Calculate "from" endpoint position
        let fromX = a.x, fromY = a.y

        if (e.fromSide === 'top') fromY -= rFrom
        else if (e.fromSide === 'right') fromX += rFrom
        else if (e.fromSide === 'bottom') fromY += rFrom
        else if (e.fromSide === 'left') fromX -= rFrom
        else {

            // Default: midpoint direction
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
            fromX = a.x + (dx / d) * rFrom
            fromY = a.y + (dy / d) * rFrom
        }

        // Calculate "to" endpoint position
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

        // Check if click is near "from" endpoint
        if ((x - fromX) ** 2 + (y - fromY) ** 2 <= threshold ** 2) {
            return { edge: e, which: 'from', ex: fromX, ey: fromY }
        }

        // Check if click is near "to" endpoint
        if ((x - toX) ** 2 + (y - toY) ** 2 <= threshold ** 2) {
            return { edge: e, which: 'to', ex: toX, ey: toY }
        }
    }

    return null
}

function handleExistingEdgeDrop(worldPos: Coordinate): void {
    if (!draggingEdgeEndpoint) return
    
    const edge = GetEdges().find(e => e.id === draggingEdgeEndpoint!.edgeId)
    if (!edge) return
    
    const targetNode = FindNodeAt(worldPos.x, worldPos.y)
    const sourceNodeId = draggingEdgeEndpoint.which === 'from' ? edge.from : edge.to
    const otherNodeId = draggingEdgeEndpoint.which === 'from' ? edge.to : edge.from
    
    // If dropping on the same node, just clear the drag state (no change)
    if (targetNode && targetNode.id === otherNodeId) {
        draggingEdgeEndpoint = null
        edgeDragSourcePos = null
        edgeDragTarget = null
        Render()
        return
    }
    
    // If dropping on a different node, reconnect the edge
    if (targetNode && targetNode.id !== sourceNodeId) {
        if (draggingEdgeEndpoint.which === 'from') {
            edge.from = targetNode.id
            edge.fromSide = 'right' // TODO: calculate proper side
        } else {
            edge.to = targetNode.id
            edge.toSide = 'left' // TODO: calculate proper side
        }
    }
    
    // If dropping on empty space, remove the edge connection
    if (!targetNode) {
        RemoveEdge(edge.id)
    }
    
    draggingEdgeEndpoint = null
    edgeDragSourcePos = null
    edgeDragTarget = null
    Render()
}
