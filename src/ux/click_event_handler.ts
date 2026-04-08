import { CenterOnNode, Render, nodeRadius, nodeRadii, handleRadius } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt, GetSelectedNodeId, RemoveNode } from "../tree_manager";
import { RecordSnapshot, SaveNodes } from "../recorder";
import { SkillNode } from "src/skill_nodes/skill_node";
import { createStatsModal } from "../modal/skilltree_stats_modal";
import { createEditModal } from "../modal/skilltree_edit_modal";
import { Coordinate } from "src/types";
import { InitPanHandler } from "./panning";
import { InitZoomHandler } from "./zoom";
import { isInEditMode, screenToWorldCoordinate, findNodeAt, findHandleAt, findEdgeEndpointAt, hitNode, isDragging, edgeDragFrom, edgeDragTarget, resetDragState, setHitNode, setIsDragging, draggingEdgeEndpoint, edgeDragSourcePos, setEdgeDragFrom, setEdgeDragTarget, startNodeDrag, startEdgeDrag, handleEdgeEndpointDrag, updateFloatingEdge, completeEdgeDrag, handleFloatingEdge, initEventUtils } from "./event_utils";
import { getCheckboxAtWorld, completeEdgeCreation } from "./event_utils";

export { edgeDragFrom, edgeDragTarget, draggingEdgeEndpoint, edgeDragSourcePos };

let view: SkillTreeView;

let nodeWasSelected: SkillNode | null = null;

export function InitClickHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    initEventUtils(skillTreeView);

    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    const onMouseDown = (e: MouseEvent) => {
        const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
        if (!worldPos) return;

        const checkboxHit = getCheckboxAtWorld(worldPos);
        if (checkboxHit && checkboxHit.userCompletable) {
            if (checkboxHit.state === 'inProgress') {
                checkboxHit.state = 'complete';
                checkboxHit.userModified = true;
                checkboxHit.fromNote = false;
                if (checkboxHit.repeating) {
                    const repeatingNode = checkboxHit as import("../skill_nodes/repeating_node").RepeatingNode;
                    repeatingNode.startTimer();
                }
            } else if (checkboxHit.state === 'complete') {
                checkboxHit.state = 'inProgress';
                checkboxHit.userModified = true;
                if (checkboxHit.repeating) {
                    const repeatingNode = checkboxHit as import("../skill_nodes/repeating_node").RepeatingNode;
                    repeatingNode.stopTimer();
                }
            }
            Render();
            SaveNodes();
            return;
        }

        if (!isInEditMode()) return;

        setHitNode(findNodeAt(worldPos.x, worldPos.y));

        if (e.button === 2 && hitNode) {
            SetSelectedNodeID(hitNode.id);
            createEditModal(view, hitNode);
            return;
        }

        const edgeHandle = findEdgeEndpointAt(worldPos);

        if (edgeHandle && !hitNode) {
            startEdgeDrag(edgeHandle);
            return;
        }


        const handle = findHandleAt(worldPos);


        if (handle) {
            setIsDragging(true)
            RecordSnapshot();
            setEdgeDragFrom(handle);
            setEdgeDragTarget(worldPos);
        }

        if (!hitNode) return;

        setIsDragging(true)

        const r = nodeRadii[hitNode.id] || nodeRadius

        const dist = Math.hypot(worldPos.x - hitNode.x, worldPos.y - hitNode.y)

        const edgeThreshold = 15 / view.scale

        if (Math.abs(dist - r) >= edgeThreshold) {
            // return
        }

        startNodeDrag(hitNode);
        RecordSnapshot();



    };

    const onMouseMove = (e: MouseEvent) => {
        const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
        if (!worldPos) return;

        updateFloatingEdge(worldPos);

        if (isDragging && hitNode) {
            const newPos = { x: worldPos.x, y: worldPos.y };
            hitNode.x = newPos.x;
            hitNode.y = newPos.y;
            Render();
            return;
        }

        if (edgeDragFrom) {
            setEdgeDragTarget(worldPos);
            Render();
        }
    };

    const onMouseUp = (e: MouseEvent) => {
        const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
        if (!worldPos) return;

        handleFloatingEdge(worldPos);

        if (edgeDragFrom && edgeDragTarget) {
            completeEdgeDrag(edgeDragTarget);
        }

        const draggedNode = hitNode;
        const wasDragging = isDragging;

        resetDragState();

        if (draggedNode && wasDragging) {
            SaveNodes();
            if (draggedNode.fileLink && draggedNode.userCompletable) {
                import("src/tree_manager").then(m => m.SyncNodeMetadataToFile(draggedNode));
            }
        }
    };

    const onClick = (e: MouseEvent) => {
        const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
        if (!worldPos) return;

        const hit = findNodeAt(worldPos.x, worldPos.y);

        if (!hit) {
            SetSelectedNodeID(null);
            return;
        }

        if (nodeWasSelected?.id === hit.id) {
            createStatsModal(view, hit);
        }

        SetSelectedNodeID(hit.id);
        nodeWasSelected = hit;
        CenterOnNode(hit);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);

    const onKeyDown = (e: KeyboardEvent) => {
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
                Render();
                SaveNodes();
            }
        }
    };
    document.addEventListener('keydown', onKeyDown);

    const zoomCleanup = InitZoomHandler(view, {
        minScale: 0.3,
        maxScale: 3
    }).cleanup;

    const panCleanup = InitPanHandler(view,
        () => {
            return (hitNode == null && !isDragging);
        }
    ).cleanup;

    return {
        cleanup: () => {
            panCleanup();
            zoomCleanup();
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeyDown);
        }
    };
}
