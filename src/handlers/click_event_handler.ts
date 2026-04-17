import { RecordSnapshot, SaveNodes } from "../data/recorder";
import { CenterOnNode, levelPaneElement, Update } from "../rendering/renderer";
import { CreateEdge, GetNodes, GetSelectedNodeId, RemoveEdge, RemoveNode, SetSelectedNodeID, SyncNodeMetadataToFile } from "../data/tree_manager";
import { SkillNode } from "../nodes/skill_node";

import { createEditModal } from "../ui/skilltree_edit_modal";
import { createStatsModal } from "../ui/skilltree_stats_modal";

import { InitPanHandler } from "./panning";
import { InitZoomHandler } from "./zoom";
import { view } from "../utils/globals";

import {
    completeEdgeDrag,
    edgeDragFrom,
    edgeDragTarget,
    draggingEdgeEndpoint,
    edgeDragSourcePos,
    findEdgeAt,
    findEdgeEndpointAt,
    findHandleAt,
    findNearestHandle,
    findNodeAt,
    getCheckboxAtWorld,
    floatingEdge,
    handleCheckboxClick,
    HandleFloatingEdge,
    hitNode,
    isDragging,
    isDraggingEdgeEndpoint,
    isInEditMode,
    moveLevelPane,
    resetDragState,
    screenToWorldCoordinate,
    setDraggingOverEdge,
    setEdgeDragFrom,
    setEdgeDragTarget,
    setHitNode,
    setIsDragging,
    startEdgeDrag,
    startLevelPaneDrag,
    startNodeDrag,
    updateFloatingEdge,
    endLevelPaneDrag,
} from "./interactions";

export { edgeDragFrom, edgeDragTarget, draggingEdgeEndpoint, edgeDragSourcePos };


let nodeWasSelected: SkillNode | null = null;
let didMoveEdgeDrag = false;

function handleMouseDown(e: MouseEvent): void {
    const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
    if (!worldPos) {
        Update(true);
        return;
    }

    didMoveEdgeDrag = false;

    const checkboxHit = getCheckboxAtWorld(worldPos);
    if (checkboxHit && handleCheckboxClick(checkboxHit)) {
        Update(true);
        return;
    }

    setHitNode(findNodeAt(worldPos));

    if (!isInEditMode()) {
        Update(true);
        return;
    }

    if (e.button === 2 && hitNode) {
        SetSelectedNodeID(hitNode.id);
        nodeWasSelected = hitNode;
        createEditModal(view, hitNode);
        Update(true);
        return;
    }

    const floatingEdgeHandle = findEdgeEndpointAt(worldPos);

    if (floatingEdgeHandle && !hitNode) {
        startEdgeDrag(floatingEdgeHandle);
        Update(true);
        return;
    }

    const handle = findHandleAt(worldPos);

    if (handle) {
        setIsDragging(true)
        RecordSnapshot();
        setEdgeDragFrom(handle);
        Update(true);
        setEdgeDragTarget(worldPos);
    }

    if (!hitNode) return;

    setIsDragging(true)

    // const r = nodeRadii[hitNode.id];
    // const dist = Math.hypot(worldPos.x - hitNode.x, worldPos.y - hitNode.y)
    // const edgeThreshold = 15 / view.scale

    // if (Math.abs(dist - r) >= edgeThreshold) {
    // return
    // }

    startNodeDrag(hitNode);
    RecordSnapshot();
}

function handleMouseMove(e: MouseEvent): void {
    const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
    if (!worldPos) {
        Update(true);
        return;
    }

    updateFloatingEdge(worldPos);

    if (isDragging && hitNode) {
        hitNode.x = worldPos.x;
        hitNode.y = worldPos.y;
        setDraggingOverEdge(findEdgeAt(worldPos));
        Update();
        return;
    }

    if (edgeDragFrom || floatingEdge) {
        didMoveEdgeDrag = true;
        setEdgeDragTarget(worldPos);
        Update();
    }
}

function handleMouseUp(e: MouseEvent): void {
    const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
    if (!worldPos) {
        Update(true);
        return;
    }

    if (hitNode) {
        if (e.button === 0 && nodeWasSelected == hitNode) {
            createStatsModal(hitNode);
            SetSelectedNodeID(null);
            CenterOnNode(hitNode)
        }
        SetSelectedNodeID(hitNode.id)
    } else {
        SetSelectedNodeID(null);
    }

    nodeWasSelected = hitNode

    if (didMoveEdgeDrag && floatingEdge) {
        HandleFloatingEdge(worldPos);
        resetDragState();
        Update(true);
        return;
    }
    if (didMoveEdgeDrag && edgeDragFrom && edgeDragTarget) {
        completeEdgeDrag(edgeDragTarget);
        Update(true);
        return;
    }

    if (!isDragging || !hitNode) {
        resetDragState();
        Update(true);
        return;
    }

    const draggedNode = hitNode;

    resetDragState();

    const targetEdge = findEdgeAt(worldPos);
    if (!targetEdge) {
        Update(true);
        return;
    }

    const nodes = GetNodes();
    const fromNode = nodes.get(targetEdge.from as string | number);
    const toNode = nodes.get(targetEdge.to as string | number);
    if (!fromNode || !toNode) {
        Update(true);
        return;
    }

    if (fromNode.onlyFrom || toNode.onlyTo) {
        Update(true);
        return;
    }

    const nearestToFrom = findNearestHandle(draggedNode, fromNode.x, fromNode.y);
    const nearestToTo = findNearestHandle(draggedNode, toNode.x, toNode.y);

    CreateEdge({
        id: Date.now(),
        from: fromNode.id,
        to: draggedNode.id,
        fromSide: targetEdge.fromSide,
        toSide: nearestToFrom?.side as any
    });

    CreateEdge({
        id: Date.now() + 1,
        from: draggedNode.id,
        to: toNode.id,
        fromSide: nearestToTo?.side as any,
        toSide: targetEdge.toSide
    });

    RemoveEdge(targetEdge.id);

    if (draggedNode.fileLink) {
        SyncNodeMetadataToFile(draggedNode);
    }

    resetDragState();
}



function handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = GetSelectedNodeId();
        if (selectedId && isInEditMode()) {
            RecordSnapshot();
            RemoveNode(selectedId);
            SetSelectedNodeID(null);
            SaveNodes();
            Update(true);
        }
    }
}

function handleLevelPaneMouseDown(e: MouseEvent): void {
    startLevelPaneDrag({ x: e.clientX, y: e.clientY });
}

function handleLevelPaneMouseMove(e: MouseEvent): void {
    moveLevelPane({ x: e.clientX, y: e.clientY });
}

function handleLevelPaneMouseUp(): void {
    endLevelPaneDrag();
    Update(true);
}

export function InitClickHandler(): { cleanup: () => void } {

    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    if (levelPaneElement) {
        levelPaneElement.addEventListener('mousedown', handleLevelPaneMouseDown);
    }
    document.addEventListener('mousemove', handleLevelPaneMouseMove);
    document.addEventListener('mouseup', handleLevelPaneMouseUp);


    const zoomCleanup = InitZoomHandler(view, {
        minScale: 0.3,
        maxScale: 3
    }).cleanup;

    const panCleanup = InitPanHandler(
        () => {
            return !(hitNode || isDragging || isDraggingEdgeEndpoint);
        }
    ).cleanup;

    return {
        cleanup: () => {
            panCleanup();
            zoomCleanup();
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
            if (levelPaneElement) {
                levelPaneElement.removeEventListener('mousedown', handleLevelPaneMouseDown);
            }
            document.removeEventListener('mousemove', handleLevelPaneMouseMove);
            document.removeEventListener('mouseup', handleLevelPaneMouseUp);
        }
    };
}
