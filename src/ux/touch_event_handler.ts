import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "src/skill_nodes/skill_node";
import { Handle } from "../types";
import {
    initInputHandler,
    screenToWorldCoordinate,
    findNodeAt,
    findHandleAt,
    findEdgeEndpointAt,
    isInEditMode,
    startEdgeDrag,
    updateFloatingEdge,
    startNodeDrag,
    updateNodeDrag,
    endNodeDrag,
    handleEdgeEndpointDrag,
    completeEdgeDrag,
    resetDragState,
    selectNode,
    clearSelection,
    isDragging,
    isDraggingEdgeEndpoint,
    draggingEdgeEndpoint,
    requestRender,
    setEdgeDragFrom,
    setEdgeDragTarget,
    getEdgeDragFrom,
    getEdgeDragTarget,
    handleFloatingEdge,
    getView
} from "./input_handler";
import { GetSelectedNodeId } from "../tree_manager";
import { CenterOnNode } from "../renderer";
import { InitZoomHandler } from "./zoom";
import { createStatsModal } from "../modal/skilltree_stats_modal";
import { createEditModal } from "../modal/skilltree_edit_modal";
import { getFloatingEdge } from "./event_utils";

let view: SkillTreeView;

let _touchDownPos: { x: number, y: number } | null = null;
let _longPressTimer: number | null = null;
let _isPanning = false;
let _isPinning = false;
let _initialPinchDistance: number = 0;
let _initialPinchScale: number = 1;
let _lastTapTime: number = 0;
let _lastTapPos: { x: number, y: number } | null = null;
let _pendingDoubleTap: boolean = false;
let _touchDownNodeId: string | number | null = null;
let _wasLongPress: boolean = false;
let _touchDownEdgeEndpoint: Handle | null = null;
let _touchStartPos: { x: number, y: number } | null = null;

const TAP_THRESHOLD = 10;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DIST = 30;
const LONG_PRESS_TIME = 400;

export function InitTouchHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    initInputHandler(skillTreeView);

    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    canvas.style.touchAction = 'none';

    const clearLongPressTimer = (): void => {
        if (_longPressTimer !== null) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
        }
    };

    const onTouchStart = (e: TouchEvent): void => {
        if (e.touches.length === 2) {
            e.preventDefault();
            _isPinning = true;
            _initialPinchDistance = getTouchDistance(e.touches);
            _initialPinchScale = view.scale;
            clearLongPressTimer();
            return;
        }

        if (e.touches.length !== 1) return;

        e.preventDefault();

        const touch = e.touches[0];
        const isOnCanvas = touch.target === canvas || canvas.contains(touch.target as Node);

        if (isOnCanvas) {
            view.touchActive = true;
        } else {
            view.touchActive = false;
        }

        _touchDownPos = { x: touch.clientX, y: touch.clientY };
        _touchStartPos = { x: touch.clientX, y: touch.clientY };
        _isPanning = false;
        _pendingDoubleTap = false;
        _touchDownNodeId = null;
        _wasLongPress = false;

        if (isInEditMode()) {
            const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
            if (!worldPos) return;

            const edgeEndpointHit = findEdgeEndpointAt(worldPos);
            if (edgeEndpointHit) {
                _touchDownEdgeEndpoint = edgeEndpointHit;

                _longPressTimer = window.setTimeout(() => {
                    if (_touchDownEdgeEndpoint) {
                        _wasLongPress = true;
                        startEdgeDrag(_touchDownEdgeEndpoint);
                        requestRender();
                    }
                    _longPressTimer = null;
                }, LONG_PRESS_TIME);
            } else {
                const hit = findNodeAt(worldPos.x, worldPos.y);
                if (hit) {
                    const handleHit = findHandleAt(worldPos);

                    const now = Date.now();
                    const distSinceLastTap = _lastTapPos
                        ? Math.hypot(touch.clientX - _lastTapPos.x, touch.clientY - _lastTapPos.y)
                        : Infinity;

                    if (_lastTapTime && (now - _lastTapTime) < DOUBLE_TAP_TIME && distSinceLastTap < DOUBLE_TAP_DIST) {
                        _pendingDoubleTap = true;
                    }

                    if (!handleHit) {
                        _touchDownNodeId = hit.id;
                        _longPressTimer = window.setTimeout(() => {
                            if (_touchDownNodeId && !isDragging) {
                                const node = findNodeAt(worldPos.x, worldPos.y);
                                if (node && node.id === _touchDownNodeId) {
                                    _wasLongPress = true;
                                    _lastTapTime = 0;
                                    _lastTapPos = null;
                                    selectNode(node);
                                    startNodeDrag(node);
                                    requestRender();
                                }
                            }
                            _longPressTimer = null;
                        }, LONG_PRESS_TIME);
                    }
                }
            }
        }
    };

    const onTouchMove = (e: TouchEvent): void => {
        if (_isPinning && e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches);
            const scale = currentDistance / _initialPinchDistance;
            let newScale = _initialPinchScale * scale;
            newScale = Math.max(0.3, Math.min(3, newScale));
            view.scale = newScale;
            requestRender();
            return;
        }

        if (e.touches.length !== 1) return;
        if (!_touchDownPos) return;

        e.preventDefault();

        const touch = e.touches[0];

        // Update floating edge while dragging
        const worldPosCheck = screenToWorldCoordinate(touch.clientX, touch.clientY);
        if (worldPosCheck) {
            updateFloatingEdge(worldPosCheck);
        }

        if (isDragging) {
            const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
            if (worldPos && _touchDownNodeId) {
                updateNodeDrag(worldPos);
            }
            return;
        }

        if (isDraggingEdgeEndpoint || draggingEdgeEndpoint) {
            const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
            if (worldPos) {
                handleEdgeEndpointDrag(worldPos);
            }
            return;
        }

        // Update edge drag target while dragging
        if (getEdgeDragFrom()) {
            const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
            if (worldPos) {
                setEdgeDragTarget(worldPos);
                requestRender();
            }
            return;
        }

        const dx = touch.clientX - _touchDownPos.x;
        const dy = touch.clientY - _touchDownPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > TAP_THRESHOLD && !isDragging && !_isPinning && !isDraggingEdgeEndpoint && !draggingEdgeEndpoint) {
            clearLongPressTimer();
            _touchDownNodeId = null;

            // Check for panning first (empty space)
            if (!getEdgeDragFrom()) {
                const worldPos = screenToWorldCoordinate(_touchDownPos.x, _touchDownPos.y);
                if (worldPos) {
                    const hit = findNodeAt(worldPos.x, worldPos.y);
                    const handleHit = findHandleAt(worldPos);
                    if (!hit && !handleHit) {
                        _isPanning = true;
                    }
                }
            }

            // Only check for handles if NOT panning
            if (!_isPanning && isInEditMode()) {
                const worldPos = screenToWorldCoordinate(_touchDownPos.x, _touchDownPos.y);
                if (worldPos) {
                    const handleHit = findHandleAt(worldPos);
                    if (handleHit) {
                        setEdgeDragFrom(handleHit);
                        setEdgeDragTarget(worldPos);
                    }
                }
            }

            if (_isPanning) {
                const moveDx = touch.clientX - _touchStartPos.x;
                const moveDy = touch.clientY - _touchStartPos.y;
                view.offset.x += moveDx;
                view.offset.y += moveDy;
                _touchStartPos = { x: touch.clientX, y: touch.clientY };
                requestRender();
                return;
            }
        }
    };

    const onTouchEnd = (e: TouchEvent): void => {
        if (_isPinning && e.touches.length < 2) {
            _isPinning = false;
        }

        if (e.touches.length > 0) return;
        if (!_touchDownPos) return;

        clearLongPressTimer();

        const touch = e.changedTouches[0];

        // Check for panning first - don't handle floating edges when panning
        const dx = touch.clientX - _touchDownPos.x;
        const dy = touch.clientY - _touchDownPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > TAP_THRESHOLD && _isPanning) {
            _isPanning = false;
            _touchDownPos = null;
            return;
        }

        // Handle floating edge (edge endpoint drag reattachment or removal)
        const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
        if (worldPos && !getFloatingEdge()) {
            handleFloatingEdge(worldPos);
        }

        if (isDragging) {
            endNodeDrag();
            _touchDownNodeId = null;
            _touchDownPos = null;
            _wasLongPress = false;
            return;
        }

        if (isDraggingEdgeEndpoint || draggingEdgeEndpoint) {
            resetDragState();
            _touchDownPos = null;
            return;
        }

        if (_isPanning) {
            _isPanning = false;
            _touchDownPos = null;
            return;
        }

        if (getEdgeDragFrom() && getEdgeDragTarget() && worldPos) {
            completeEdgeDrag(worldPos);
        }

        resetDragState();

        if (dist > TAP_THRESHOLD) {
            _touchDownPos = null;
            return;
        }

        if (worldPos) {
            const hit = findNodeAt(worldPos.x, worldPos.y);

            // Quick double tap: open editor modal
            if (hit && _pendingDoubleTap && !_wasLongPress) {
                _pendingDoubleTap = false;
                _lastTapTime = 0;
                _lastTapPos = null;
                createEditModal(getView(), hit);
                _touchDownPos = null;
                return;
            }

            // Single tap
            if (hit && !_wasLongPress) {
                const wasSelected = GetSelectedNodeId() === hit.id;
                selectNode(hit);
                CenterOnNode(hit);
                requestRender();

                // Second tap on same node: open stats modal
                if (wasSelected) {
                    createStatsModal(getView(), hit);
                }
            } else if (!hit && !_wasLongPress) {
                clearSelection();
                requestRender();
            }
        }

        _lastTapTime = Date.now();
        _lastTapPos = { x: touch.clientX, y: touch.clientY };
        _touchDownPos = null;
        _touchDownNodeId = null;
        _wasLongPress = false;

        // Delay clearing touch active to prevent synthetic clicks from other handlers
        setTimeout(() => {
            view.touchActive = false;
        }, 500);
    };

    // Prevent synthetic click events after touch
    const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    canvas.addEventListener('click', onClick, { capture: true });

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // Reset touchActive when touching outside canvas (allows modal outside click to work)
    const onDocumentTouchStart = (e: TouchEvent) => {
        if (e.target === canvas || canvas.contains(e.target as Node)) return;
        view.touchActive = false;
    };
    document.addEventListener('touchstart', onDocumentTouchStart, { passive: true });

    const zoomCleanup = InitZoomHandler(view, {
        minScale: 0.3,
        maxScale: 3
    }).cleanup;

    const getTouchDistance = (touches: TouchList): number => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    return {
        cleanup: () => {
            zoomCleanup();
            clearLongPressTimer();
            document.removeEventListener('touchstart', onDocumentTouchStart);
            canvas.removeEventListener('click', onClick, { capture: true });
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        }
    };
}
