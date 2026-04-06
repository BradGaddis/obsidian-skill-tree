import { SkillTreeView } from "src/skilltreeview";
import { GetSelectedNodeId, SetSelectedNodeID } from "../tree_manager";
import { SaveNodes } from "../recorder";
import { CenterOnNode, Render } from "../renderer";
import { InitZoomHandler } from "./zoom";
import { createStatsModal } from "../modal/skilltree_stats_modal";
import { createEditModal } from "../modal/skilltree_edit_modal";
import { getCheckboxAtWorld, initEventUtils } from "./event_utils";
import { 
    initInputHandler,
    isInEditMode,
    screenToWorldCoordinate,
    findNodeAt,
    findHandleAt,
    findEdgeEndpointAt,
    startEdgeDrag,
    startNodeDrag,
    updateFloatingEdge,
    updateNodeDrag,
    setEdgeDragFrom,
    setEdgeDragTarget,
    getEdgeDragFrom,
    resetDragState,
    completeEdgeDrag,
    handleFloatingEdge,
    isDragging,
    isDraggingEdgeEndpoint
} from "./input_handler";

let view: SkillTreeView;

const TAP_THRESHOLD = 10;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DIST = 30;
const LONG_PRESS_TIME = 400;

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
let _wasLongPress = false;

export function InitTouchHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    initInputHandler(skillTreeView);
    initEventUtils(skillTreeView);

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
        // Handle pinch zoom
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

        _touchStartPos = { x: touch.clientX, y: touch.clientY };
        _touchDownPos = { x: touch.clientX, y: touch.clientY };
        _isPanning = false;
        _pendingDoubleTap = false;
        _touchDownNodeId = null;
        _wasLongPress = false;

        if (!isInEditMode()) return;

        const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
        if (!worldPos) return;

        // Check for checkbox hit
        const checkboxHit = getCheckboxAtWorld(worldPos);
        if (checkboxHit && checkboxHit.userCompletable) {
            if (checkboxHit.state === 'in-progress') {
                checkboxHit.state = 'complete';
            }
            Render();
            SaveNodes();
            return;
        }

        // Check for edge endpoint (floating edge dragging)
        const edgeEndpointHit = findEdgeEndpointAt(worldPos);
        if (edgeEndpointHit) {
            _longPressTimer = window.setTimeout(() => {
                if (edgeEndpointHit) {
                    _wasLongPress = true;
                    startEdgeDrag(edgeEndpointHit);
                    Render();
                }
                _longPressTimer = null;
            }, LONG_PRESS_TIME);
            return;
        }

        // Check for node handle (new edge creation)
        const handle = findHandleAt(worldPos);
        if (handle) {
            setEdgeDragFrom(handle);
            setEdgeDragTarget(worldPos);
            Render();
            return;
        }

        // Check for node (node dragging)
        const hit = findNodeAt(worldPos.x, worldPos.y);
        if (!hit) {
            // No node hit - don't return, allow panning to happen on move
        } else {
            // Track for double tap
            const now = Date.now();
            const distSinceLastTap = _lastTapPos
                ? Math.hypot(touch.clientX - _lastTapPos.x, touch.clientY - _lastTapPos.y)
                : Infinity;

            if (_lastTapTime > 0 && (now - _lastTapTime) < DOUBLE_TAP_TIME && distSinceLastTap < DOUBLE_TAP_DIST) {
                _pendingDoubleTap = true;
            }

            // Long press to start dragging
            _touchDownNodeId = hit.id;
            _longPressTimer = window.setTimeout(() => {
                if (_touchDownNodeId && !isDragging) {
                    const node = findNodeAt(worldPos.x, worldPos.y);
                    if (node && node.id === _touchDownNodeId) {
                        _wasLongPress = true;
                        _lastTapTime = 0;
                        _lastTapPos = null;
                        startNodeDrag(node);
                    }
                }
                _longPressTimer = null;
            }, LONG_PRESS_TIME);
        }
    };

    const onTouchMove = (e: TouchEvent): void => {
        // Handle pinch zoom
        if (_isPinning && e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches);
            const scale = currentDistance / _initialPinchDistance;
            let newScale = _initialPinchScale * scale;
            newScale = Math.max(0.3, Math.min(3, newScale));
            view.scale = newScale;
            return;
        }

        if (e.touches.length !== 1) return;
        if (!_touchDownPos) return;

        e.preventDefault();

        const touch = e.touches[0];
        const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);
        if (!worldPos) return;

        // Update floating edge while dragging
        updateFloatingEdge(worldPos);

        // Node dragging
        if (isDragging && _touchDownNodeId) {
            updateNodeDrag(worldPos);
            return;
        }

        // Edge target update while dragging new edge
        if (getEdgeDragFrom()) {
            setEdgeDragTarget(worldPos);
            Render();
            return;
        }

        // Check movement distance
        const dx = touch.clientX - _touchDownPos.x;
        const dy = touch.clientY - _touchDownPos.y;
        const dist = Math.hypot(dx, dy);

        // Clear long press timer once we move past threshold
        if (dist > TAP_THRESHOLD && _longPressTimer) {
            clearLongPressTimer();
            _touchDownNodeId = null;
        }

        if (dist > TAP_THRESHOLD && !isDragging && !isDraggingEdgeEndpoint) {
            // Start panning if not on node/handle
            const hit = findNodeAt(worldPos.x, worldPos.y);
            const handleHit = findHandleAt(worldPos);

            if (!hit && !handleHit && !getEdgeDragFrom()) {
                _isPanning = true;
            }

            if (_isPanning) {
                const moveDx = touch.clientX - _touchStartPos.x;
                const moveDy = touch.clientY - _touchStartPos.y;
                view.offset.x += moveDx;
                view.offset.y += moveDy;
                _touchStartPos = { x: touch.clientX, y: touch.clientY };
                Render();
            }
        }
    };

    const onTouchEnd = (e: TouchEvent): void => {
        // Handle pinch zoom end
        if (_isPinning && e.touches.length < 2) {
            _isPinning = false;
        }

        if (e.touches.length > 0) return;
        if (!_touchDownPos) return;

        clearLongPressTimer();

        const touch = e.changedTouches[0];
        const worldPos = screenToWorldCoordinate(touch.clientX, touch.clientY);

        // Check for panning
        const dx = touch.clientX - _touchDownPos.x;
        const dy = touch.clientY - _touchDownPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > TAP_THRESHOLD && _isPanning) {
            _isPanning = false;
            _touchDownPos = null;
            return;
        }

        // Handle floating edge (floating edge dragging)
        if (worldPos) {
            handleFloatingEdge(worldPos);
        }

        // Handle new edge creation
        if (getEdgeDragFrom() && worldPos) {
            completeEdgeDrag(worldPos);
            Render();
        }

        resetDragState();

        // If moved past threshold, don't process tap
        if (dist > TAP_THRESHOLD) {
            _touchDownPos = null;
            return;
        }

        // Tap handling
        if (worldPos) {
            const hit = findNodeAt(worldPos.x, worldPos.y);

            // Double tap: open editor modal
            if (hit && _pendingDoubleTap && !_wasLongPress) {
                _pendingDoubleTap = false;
                _lastTapTime = 0;
                _lastTapPos = null;
                createEditModal(view, hit);
                _touchDownPos = null;
                return;
            }

            // Single tap: select and center
            if (hit && !_wasLongPress) {
                const wasSelected = GetSelectedNodeId() === hit.id;
                selectNode(hit);
                CenterOnNode(hit);

                // Second tap on same node: open stats modal
                if (wasSelected) {
                    createStatsModal(view, hit);
                }
            } else if (!hit && !_wasLongPress) {
                clearSelection();
            }
        }

        _lastTapTime = Date.now();
        _lastTapPos = { x: touch.clientX, y: touch.clientY };
        _touchDownPos = null;
        _touchDownNodeId = null;
        _wasLongPress = false;
    };

    const selectNode = (node: any): void => {
        SetSelectedNodeID(node.id);
    };

    const clearSelection = (): void => {
        SetSelectedNodeID(null);
    };

    // Prevent synthetic click events
    const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    canvas.addEventListener('click', onClick, { capture: true });

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // Reset touchActive when touching outside canvas
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
