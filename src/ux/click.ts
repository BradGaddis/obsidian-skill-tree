import { CenterOnNode, Render, nodeRadius, nodeRadii } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt, GetNodes, GetEdges, CreateEdge } from "../tree-manager";
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

export function InitClickHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };



    const onMouseDown = (e: MouseEvent) => {
        console.log('[click] mousedown', { mode: view.settings.mode, x: e.clientX, y: e.clientY })
        if (view.settings.mode !== "edit") return

        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        console.log('[click] worldPos', worldPos)

        hitNode = FindNodeAt(worldPos.x, worldPos.y);
        console.log('[click] hitNode', hitNode?.id)

        if (!hitNode) return

        const r = nodeRadii[hitNode.id] || nodeRadius

        const dist = Math.hypot(worldPos.x - hitNode.x, worldPos.y - hitNode.y)
        const edgeThreshold = 15 / view.scale
        console.log('[click] dist, r, edgeThreshold', dist, r, edgeThreshold)

        if (Math.abs(dist - r) <= edgeThreshold) {
            console.log('[click] near edge, getting handle')
            const handle = getHandleAtWorld(worldPos)
            console.log('[click] handle', handle)
            if (handle) {
                setEdgeDragFrom({ handle })
                setEdgeDragTarget(worldPos)
                Render()
            }
        }
    };

    // TODO: fix for node dragging
    const onMouseMove = (e: MouseEvent) => {
        if (!edgeDragFrom) return

        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        // mousePosition = worldPos
        setEdgeDragTarget(worldPos)
        Render()
    };

    const onMouseUp = () => {
        if (edgeDragFrom && edgeDragTarget) {
            completeEdgeCreation(edgeDragTarget)
        }
        hitNode = null
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
    console.log('[getHandleAtWorld] checking', nodes.size, 'nodes')
    for (const node of nodes.values()) {
        const r = nodeRadii[node.id] || nodeRadius
        const handles = [
            { side: 'top', hx: node.x, hy: node.y - r },
            { side: 'right', hx: node.x + r, hy: node.y },
            { side: 'bottom', hx: node.x, hy: node.y + r },
            { side: 'left', hx: node.x - r, hy: node.y },
        ]
        const handleThreshold = 20 / view.scale
        console.log('[getHandleAtWorld] node', node.id, 'r', r, 'threshold', handleThreshold)
        for (const h of handles) {
            const dx = coords.x - h.hx
            const dy = coords.y - h.hy
            const dist2 = dx * dx + dy * dy
            console.log('[getHandleAtWorld] checking handle', h.side, { dx, dy, dist2, threshold2: handleThreshold * handleThreshold })
            if (dist2 <= handleThreshold * handleThreshold) {
                console.log('[getHandleAtWorld] FOUND handle', h.side)
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

    console.log("sanity check")
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
