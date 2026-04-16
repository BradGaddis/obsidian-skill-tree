import { SkillNode } from "../nodes/skill_node";
import { Coordinate } from "../types/types";

import { CenterOnNode, levelPaneElement, Update } from "../rendering/renderer";
import { GetSelectedNodeId, SetSelectedNodeID, GetNodes, CreateEdge, RemoveEdge } from "../data/tree_manager";
import { RecordSnapshot } from "../data/recorder";

import { createStatsModal } from "../ui/skilltree_stats_modal";
import { createEditModal } from "../ui/skilltree_edit_modal";
import {
    completeEdgeDrag,
    findEdgeEndpointAt,
    findHandleAt,
    findNearestHandle,
    findNodeAt,
    getCheckboxAtWorld,
    handleCheckboxClick,
    HandleFloatingEdge,
    hitNode,
    isDragging,
    isDraggingEdgeEndpoint,
    isInEditMode,
    resetDragState,
    screenToWorldCoordinate,
    setDraggingOverEdge,
    setEdgeDragFrom,
    setEdgeDragTarget,
    setIsDragging,
    startEdgeDrag,
    startLevelPaneDrag,
    startNodeDrag,
    updateFloatingEdge,
    updateNodeDrag,
    moveLevelPane,
    endLevelPaneDrag,
    getEdgeDragFrom,
    findEdgeAt,
} from "./interactions";
import { view } from "../utils/globals";

const TAP_THRESHOLD = 10;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DIST = 30;
const LONG_PRESS_TIME = 400;

let _canvasRef: HTMLCanvasElement | null = null;
let _touchStartPos: { x: number, y: number } | null = null;
let _touchDownPos: { x: number, y: number } | null = null;
let _longPressTimer: number | null = null;
let _isPanning = false;
let _isPinning = false;
let _initialPinchDistance = 0;
let _initialPinchScale = 1;
let _lastTapTime = 0;
let _lastTapPos: { x: number, y: number } | null = null;
let _pendingDoubleTap = false;
let _touchDownNodeId: string | number | null = null;
let _touchDownHandle: { node: any, side: string, hx: number, hy: number } | null = null;
let _wasLongPress = false;

function clearLongPressTimer(): void {
    if (_longPressTimer !== null) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
    }
}

function getTouchDistance(touches: TouchList): number {
    const t0 = touches[0];
    const t1 = touches[1];
    if (t0 === undefined || t1 === undefined) {
        console.error('Touch list missing required touches');
        return 0;
    }
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.hypot(dx, dy);
}

function handlePinchStart(touches: TouchList): void {
    _isPinning = true;
    _initialPinchDistance = getTouchDistance(touches);
    _initialPinchScale = view.scale;
    clearLongPressTimer();
}

function handlePinchMove(touches: TouchList): void {
    const currentDistance = getTouchDistance(touches);
    const scale = currentDistance / _initialPinchDistance;
    let newScale = _initialPinchScale * scale;
    newScale = Math.max(0.3, Math.min(3, newScale));
    view.scale = newScale;
    Update();
}

function setTouchState(x: number, y: number): void {
    _touchStartPos = { x, y };
    _touchDownPos = { x, y };
    _isPanning = false;
    _pendingDoubleTap = false;
    _touchDownNodeId = null;
    _wasLongPress = false;
}

function updateActiveState(touch: Touch, canvas: HTMLCanvasElement): void {
    const isOnCanvas = touch.target === canvas || canvas.contains(touch.target as Node);
    view.touchActive = isOnCanvas;
}

function handleEdgeEndpointHit(worldPos: Coordinate): void {
    const edgeEndpointHit = findEdgeEndpointAt(worldPos);
    if (edgeEndpointHit) {
        _longPressTimer = window.setTimeout(() => {
            if (edgeEndpointHit) {
                _wasLongPress = true;
                startEdgeDrag(edgeEndpointHit);
                Update();
            }
            _longPressTimer = null;
        }, LONG_PRESS_TIME);
    }
}

function handleNodeHit(node: SkillNode, worldPos: Coordinate, touch: Touch): void {
    const now = Date.now();
    const distSinceLastTap = _lastTapPos && touch
        ? Math.hypot(touch.clientX - _lastTapPos.x, touch.clientY - _lastTapPos.y)
        : Infinity;

    if (_lastTapTime > 0 && (now - _lastTapTime) < DOUBLE_TAP_TIME && distSinceLastTap < DOUBLE_TAP_DIST) {
        _pendingDoubleTap = true;
    }

    _touchDownNodeId = node.id;
    _longPressTimer = window.setTimeout(() => {
        if (_touchDownNodeId && !isDragging) {
            const foundNode = findNodeAt(worldPos);
            if (foundNode && foundNode.id === _touchDownNodeId) {
                _wasLongPress = true;
                _lastTapTime = 0;
                _lastTapPos = null;
                startNodeDrag(foundNode);
            }
        }
        _longPressTimer = null;
    }, LONG_PRESS_TIME);
}

function handleTouchStart(e: TouchEvent): void {
    if (!_canvasRef) return;

    if (e.touches.length === 2) {
        handlePinchStart(e.touches);
        return;
    }

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (touch === undefined) {
        console.error('touch is undefined in handleTouchStart');
        return;
    }

    updateActiveState(touch, _canvasRef);
    setTouchState(touch.clientX, touch.clientY);

    if (!isInEditMode()) return;

    const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
    if (!worldPos) return;

    const checkboxHit = getCheckboxAtWorld(worldPos);
    if (checkboxHit && handleCheckboxClick(checkboxHit)) return;

    const hit = findNodeAt(worldPos);
    if (hit) {
        handleNodeHit(hit, worldPos, touch);
        return;
    }

    const handle = findHandleAt(worldPos);
    if (handle) {
        _touchDownHandle = handle;
        clearLongPressTimer();
        return;
    }

    handleEdgeEndpointHit(worldPos);
}

function handleTouchMove(e: TouchEvent): void {
    if (_isPinning && e.touches.length === 2) {
        e.preventDefault();
        handlePinchMove(e.touches);
        return;
    }

    if (e.touches.length !== 1) return;
    if (!_touchDownPos) return;

    const touch = e.touches[0];
    if (touch === undefined) {
        console.error('touch is undefined in handleTouchMove');
        return;
    }

    const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
    if (!worldPos) return;

    updateFloatingEdge(worldPos);

    if (isDragging && _touchDownNodeId) {
        updateNodeDrag(worldPos);
        if (worldPos) {
            setDraggingOverEdge(findEdgeAt(worldPos));
        }
        return;
    }

    if (getEdgeDragFrom() && worldPos) {
        setEdgeDragTarget(worldPos);
        Update();
        return;
    }

    const dx = touch.clientX - _touchDownPos.x;
    const dy = touch.clientY - _touchDownPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > TAP_THRESHOLD && _longPressTimer && !_touchDownHandle) {
        clearLongPressTimer();
        _touchDownNodeId = null;
    }

    if (dist > TAP_THRESHOLD && _touchDownHandle && !getEdgeDragFrom()) {
        _wasLongPress = true;
        setIsDragging(true);
        RecordSnapshot();
        setEdgeDragFrom(_touchDownHandle);
        setEdgeDragTarget(worldPos);
        Update();
        _touchDownHandle = null;
        return;
    }

    if (dist > TAP_THRESHOLD && !isDragging && !isDraggingEdgeEndpoint) {
        const hit = findNodeAt(worldPos);
        const handleHit = findHandleAt(worldPos);

        if (!hit && !handleHit && !getEdgeDragFrom()) {
            _isPanning = true;
        }

        if (_isPanning && _touchStartPos) {
            const moveDx = touch.clientX - _touchStartPos.x;
            const moveDy = touch.clientY - _touchStartPos.y;
            view.offset.x += moveDx;
            view.offset.y += moveDy;
            _touchStartPos = { x: touch.clientX, y: touch.clientY };
            Update();
        }
    }
}

function handleNodeDrop(draggedNode: SkillNode, worldPos: Coordinate): void {
    const targetEdge = findEdgeAt(worldPos);
    if (!targetEdge) return;

    const nodes = GetNodes();
    const fromNode = nodes.get(targetEdge.from as string | number);
    const toNode = nodes.get(targetEdge.to as string | number);

    if (!fromNode || !toNode) return;
    if (fromNode.onlyFrom || toNode.onlyTo) return;

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
}

function handleTap(worldPos: Coordinate, touch: Touch): void {
    const hit = findNodeAt(worldPos);

    if (hit && _pendingDoubleTap && !_wasLongPress) {
        _pendingDoubleTap = false;
        _lastTapTime = 0;
        _lastTapPos = null;
        createEditModal(view, hit);
        _touchDownPos = null;
        return;
    }

    if (hit && !_wasLongPress) {
        const wasSelected = GetSelectedNodeId() === hit.id;
        SetSelectedNodeID(hit.id);
        CenterOnNode(hit);

        if (wasSelected) {
            createStatsModal(hit);
        }
    } else if (!hit && !_wasLongPress) {
        SetSelectedNodeID(null);
    }

    _lastTapTime = Date.now();
    _lastTapPos = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(e: TouchEvent): void {
    if (_isPinning && e.touches.length < 2) {
        _isPinning = false;
    }

    if (e.touches.length > 0) return;
    if (!_touchDownPos) return;

    clearLongPressTimer();

    const touch = e.changedTouches[0];
    if (touch === undefined) {
        console.error('touch is undefined in handleTouchEnd');
        return;
    }

    const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);

    const dx = touch.clientX - _touchDownPos.x;
    const dy = touch.clientY - _touchDownPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > TAP_THRESHOLD && _isPanning) {
        _isPanning = false;
        _touchDownPos = null;
        return;
    }

    if (worldPos) {
        HandleFloatingEdge(worldPos);
    }

    if (getEdgeDragFrom() && worldPos) {
        completeEdgeDrag(worldPos);
        Update();
    }

    const draggedNode = hitNode;
    const wasDragging = isDragging;

    if (draggedNode && wasDragging && worldPos) {
        handleNodeDrop(draggedNode, worldPos);
    }

    resetDragState();

    if (dist > TAP_THRESHOLD) {
        _touchDownPos = null;
        return;
    }

    if (worldPos) {
        handleTap(worldPos, touch);
    }

    _touchDownPos = null;
    _touchDownNodeId = null;
    _wasLongPress = false;
}

function handleLevelPaneTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touch === undefined) return;
    startLevelPaneDrag({ x: touch.clientX, y: touch.clientY });
}

function handleLevelPaneTouchMove(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touch === undefined) return;
    moveLevelPane({ x: touch.clientX, y: touch.clientY });
}

function handleLevelPaneTouchEnd(): void {
    endLevelPaneDrag();
}

function handleDocumentTouchStart(e: TouchEvent): void {
    if (!_canvasRef) return;
    if (e.target === _canvasRef || _canvasRef.contains(e.target as Node)) return;
    if (levelPaneElement && (e.target === levelPaneElement || levelPaneElement.contains(e.target as Node))) return;
    view.touchActive = false;
}

export function InitTouchHandler(): { cleanup: () => void } {
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    _canvasRef = canvas;
    canvas.style.touchAction = 'none';

const onClick = () => { };
    canvas.addEventListener('click', onClick, { capture: true });

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    if (levelPaneElement) {
        levelPaneElement.addEventListener('touchstart', handleLevelPaneTouchStart, { passive: true });
        levelPaneElement.addEventListener('touchmove', handleLevelPaneTouchMove, { passive: true });
        levelPaneElement.addEventListener('touchend', handleLevelPaneTouchEnd, { passive: true });
    }

    document.addEventListener('touchstart', handleDocumentTouchStart, { passive: true });

    return {
        cleanup: () => {
            clearLongPressTimer();
            document.removeEventListener('touchstart', handleDocumentTouchStart);
            canvas.removeEventListener('click', onClick, { capture: true });
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            if (levelPaneElement) {
                levelPaneElement.removeEventListener('touchstart', handleLevelPaneTouchStart);
                levelPaneElement.removeEventListener('touchmove', handleLevelPaneTouchMove);
                levelPaneElement.removeEventListener('touchend', handleLevelPaneTouchEnd);
            }
        }
    };
}

