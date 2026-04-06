import { SkillTreeView } from "src/skilltreeview";
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
    hitNode,
    isDragging,
    isDraggingEdgeEndpoint,
    draggingEdgeEndpoint,
    requestRender,
    setEdgeDragFrom,
    setEdgeDragTarget,
    getEdgeDragFrom,
    getEdgeDragTarget
} from "./input_handler";
import { InitPanHandler } from "./panning";
import { InitZoomHandler } from "./zoom";

let view: SkillTreeView;

let _pointerDownPos: { x: number, y: number } | null = null;
let _pointerId: number | null = null;
let _longPressTimer: number | null = null;
let _isPinning: boolean = false;
let _initialPinchDistance: number = 0;
let _initialPinchScale: number = 1;
let _lastTapTime: number = 0;
let _lastTapPos: { x: number, y: number } | null = null;
let _pendingDoubleTap: boolean = false;
let _pointerDownNodeId: string | number | null = null;
let _wasLongPress: boolean = false;

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

    const onPointerDown = (e: PointerEvent): void => {
        if (e.pointerType !== 'touch') return;

        e.preventDefault();
        e.stopPropagation();

        _pointerId = e.pointerId;
        _pointerDownPos = { x: e.clientX, y: e.clientY };
        _isPinning = false;
        _pendingDoubleTap = false;
        _pointerDownNodeId = null;
        _wasLongPress = false;

        if (isInEditMode()) {
            const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
            if (!worldPos) return;

            const edgeEndpointHit = findEdgeEndpointAt(worldPos);
            if (edgeEndpointHit) {
                startEdgeDrag(edgeEndpointHit);
                requestRender();
                return;
            }

            const hit = findNodeAt(worldPos.x, worldPos.y);
            if (hit) {
                const handleHit = findHandleAt(worldPos);

                const now = Date.now();
                const distSinceLastTap = _lastTapPos
                    ? Math.hypot(e.clientX - _lastTapPos.x, e.clientY - _lastTapPos.y)
                    : Infinity;

                if (_lastTapTime && (now - _lastTapTime) < DOUBLE_TAP_TIME && distSinceLastTap < DOUBLE_TAP_DIST) {
                    _pendingDoubleTap = true;
                }

                if (!handleHit) {
                    _pointerDownNodeId = hit.id;
                    _longPressTimer = window.setTimeout(() => {
                        if (_pointerDownNodeId && !isDragging) {
                            const node = findNodeAt(worldPos.x, worldPos.y);
                            if (node && node.id === _pointerDownNodeId) {
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
    };

    const onPointerMove = (e: PointerEvent): void => {
        if (e.pointerType !== 'touch') return;
        if (e.pointerId !== _pointerId) return;
        if (!_pointerDownPos) return;

        e.preventDefault();
        e.stopPropagation();

        if (isDragging) {
            const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
            if (worldPos && _pointerDownNodeId) {
                updateNodeDrag(worldPos);
            }
            return;
        }

        if (isDraggingEdgeEndpoint || draggingEdgeEndpoint) {
            const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
            if (worldPos) {
                handleEdgeEndpointDrag(worldPos);
            }
            return;
        }

        const dx = e.clientX - _pointerDownPos.x;
        const dy = e.clientY - _pointerDownPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > TAP_THRESHOLD && !isDragging && !_isPinning) {
            clearLongPressTimer();
            _pointerDownNodeId = null;

            if (isInEditMode()) {
                const worldPos = screenToWorldCoordinate(_pointerDownPos.x, _pointerDownPos.y);
                if (worldPos) {
                    const handleHit = findHandleAt(worldPos);
                    if (handleHit) {
                        setEdgeDragFrom(handleHit);
                        setEdgeDragTarget(worldPos);
                    }
                }
            }

            if (!getEdgeDragFrom() && !_isPinning) {
                const worldPos = screenToWorldCoordinate(_pointerDownPos.x, _pointerDownPos.y);
                if (worldPos) {
                    const hit = findNodeAt(worldPos.x, worldPos.y);
                    const handleHit = findHandleAt(worldPos);
                    if (!hit && !handleHit) {
                        _isPanning = true;
                    }
                }
            }
        }
    };

    let _isPanning = false;

    const onPointerUp = async (e: PointerEvent): Promise<void> => {
        if (e.pointerType !== 'touch') return;
        if (e.pointerId !== _pointerId) return;

        e.preventDefault();
        e.stopPropagation();

        clearLongPressTimer();

        if (isDragging) {
            endNodeDrag();
            _pointerDownNodeId = null;
            _pointerDownPos = null;
            _pointerId = null;
            _wasLongPress = false;
            return;
        }

        if (isDraggingEdgeEndpoint || draggingEdgeEndpoint) {
            const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
            if (worldPos) {
                completeEdgeDrag(worldPos);
            }
            _pointerDownPos = null;
            _pointerId = null;
            return;
        }

        if (_isPanning) {
            _isPanning = false;
            _pointerDownPos = null;
            _pointerId = null;
            return;
        }

        if (!_pointerDownPos) {
            _pointerDownPos = null;
            _pointerId = null;
            return;
        }

        const dx = e.clientX - _pointerDownPos.x;
        const dy = e.clientY - _pointerDownPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > TAP_THRESHOLD) {
            _pointerDownPos = null;
            _pointerId = null;
            return;
        }

        const worldPos = screenToWorldCoordinate(e.clientX, e.clientY);
        if (worldPos && getEdgeDragFrom() && getEdgeDragTarget()) {
            completeEdgeDrag(worldPos);
            resetDragState();
            _pointerDownPos = null;
            _pointerId = null;
            return;
        }

        if (dist <= TAP_THRESHOLD && worldPos) {
            const hit = findNodeAt(worldPos.x, worldPos.y);

            if (hit && _pendingDoubleTap && !_wasLongPress) {
                _pendingDoubleTap = false;
                _lastTapTime = 0;
                _lastTapPos = null;
                _pointerDownPos = null;
                _pointerId = null;
                return;
            }

            if (hit && !_wasLongPress) {
                selectNode(hit);
                requestRender();
            } else if (!hit && !_wasLongPress) {
                clearSelection();
                requestRender();
            }
        }

        _lastTapTime = Date.now();
        _lastTapPos = { x: e.clientX, y: e.clientY };
        _pointerDownPos = null;
        _pointerId = null;
        _pointerDownNodeId = null;
        _wasLongPress = false;
    };

    const onTouchStart = (e: TouchEvent): void => {
        if (e.touches.length === 2) {
            e.preventDefault();
            _isPinning = true;
            _initialPinchDistance = getTouchDistance(e.touches);
            _initialPinchScale = view.scale;
            clearLongPressTimer();
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
        }
    };

    const onTouchEnd = (e: TouchEvent): void => {
        if (_isPinning && e.touches.length < 2) {
            _isPinning = false;
        }
    };

    const getTouchDistance = (touches: TouchList): number => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    const clearLongPressTimer = (): void => {
        if (_longPressTimer !== null) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
        }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    const panCleanup = InitPanHandler(view,
        () => {
            return (hitNode == null && !isDragging && !_isPanning)
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
            clearLongPressTimer();
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        }
    };
}