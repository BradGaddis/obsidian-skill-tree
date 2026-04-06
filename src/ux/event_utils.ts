import { CenterOnNode, Render, nodeRadius, nodeRadii, fontSize, screenToWorld, handleRadius } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { FindNodeAt, GetNodes, GetEdges, CreateEdge, RemoveEdge, FindEdgeAtHandle, GetEdgeDirection } from "../tree-manager";
import { SkillNode } from "src/skill_nodes/skill_node";
import { Coordinate, Handle } from "src/types";
import { SkillEdge } from "src/interfaces";
import { Direction } from "src/enums";
import { distanceTo, pointToSegmentDistance } from "../utils";

// Hit detection constants - base threshold plus scale factor for larger nodes
export const HANDLE_HIT_BASE = 20;
export const HANDLE_HIT_SCALE = 2;

export let view: SkillTreeView;

export function initEventUtils(skillTreeView: SkillTreeView): void {
    view = skillTreeView;
}

export let edgeDragFrom: Handle | null = null;
export let edgeDragTarget: Coordinate | null = null;
export let edgeDragSourcePos: Coordinate | null = null;
export let draggingEdgeEndpoint: { edgeId: number, which: 'from' | 'to' } | null = null;
let floatingEdge: SkillEdge | null = null;
let previousEdgeFromFloating: SkillEdge | null = null;
export let floatingEdgeDirection: Direction = Direction.none;

export function setEdgeDragFrom(edgeDrag: Handle): void {
    edgeDragFrom = edgeDrag
}

export function getEdgeDragFrom(): Handle | null {
    return edgeDragFrom
}

export function setEdgeDragTarget(target: Coordinate): void {
    edgeDragTarget = target
}

export function getEdgeDragTarget(): Coordinate | null {
    return edgeDragTarget
}

export function setEdgeDragSourcePos(pos: Coordinate | null): void {
    edgeDragSourcePos = pos;
}

export function setFloatingEdge(edge: SkillEdge | null): void {
    floatingEdge = edge
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
        if (node.state !== 'in-progress' && node.state !== 'complete') continue

        const r = nodeRadii[node.id] || nodeRadius
        const minScreenSize = 14
        const maxScreenSize = 24
        const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25))
        const checkboxSize = baseScreenSize / view.scale

        const lineHeight = fontSize / view.scale
        const isUnlinked = node.fileLink === ''
        const label = isUnlinked ? node.fileLink : node.fileLink || '' + ' [Unlinked]'
        const words = (label || '').split(/\s+/).filter(Boolean)
        const nodeLines: string[] = []
        for (let i = 0; i < words.length; i += 4) {
            nodeLines.push(words.slice(i, i + 4).join(' '))
        }
        const totalLines = nodeLines.length + (isUnlinked ? 1 : 0)
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

export function EventToWorldCoordinate(clientX: number, clientY: number): Coordinate | null {
    const canvas = view?.canvas
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect();
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top });
}