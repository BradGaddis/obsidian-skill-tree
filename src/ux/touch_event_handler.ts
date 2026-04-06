import { SkillTreeView } from "src/skilltreeview";
import { Render } from "src/renderer";
import { initEventUtils, getHandleAtWorld, getCheckboxAtWorld, getEdgeEndpointAtWorld, EventToWorldCoordinate, setEdgeDragFrom, setEdgeDragTarget, getEdgeDragFrom, getEdgeDragTarget, completeEdgeCreation, HandleFloatingEdge, view as eventView } from "./event_utils";
import { createStatsModal } from "../modal/skilltree-stats-modal";
import { createEditModal } from "../modal/skilltree-edit-modal";
import { FindNodeAt, SetSelectedNodeID } from "../tree-manager";
import { RecordSnapshot, SaveNodes } from "../recorder";
import { SkillNode } from "src/skill_nodes/skill_node";
import { CenterOnNode } from "src/renderer";

let view: SkillTreeView;

let _pointerDownPos: { x: number; y: number } | null = null;
let _pointerId: number | null = null;
let _lastTapTime: number = 0;
let _lastTapPos: { x: number; y: number } | null = null;
let _isDraggingNode: boolean = false;
let _pointerDownNodeId: string | number | null = null;
let _isPanning: boolean = false;
let _isPinching: boolean = false;
let _initialPinchDistance: number = 0;
let _initialPinchScale: number = 1;

const TAP_THRESHOLD = 10;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DIST = 30;
const LONG_PRESS_TIME = 400;

let _longPressTimer: number | null = null;

export function InitTouchHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    canvas.style.touchAction = 'none';

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
            _isPinching = true;
            _initialPinchDistance = getTouchDistance(e.touches);
            _initialPinchScale = view.scale;
            _clearLongPressTimer();
            return;
        }

        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        _pointerDownPos = { x: touch.clientX, y: touch.clientY };
        _pointerId = touch.identifier;

        const worldPos = EventToWorldCoordinate(touch.clientX, touch.clientY);
        if (!worldPos) return;

        const hitNode = FindNodeAt(worldPos.x, worldPos.y);
        if (hitNode) {
            _pointerDownNodeId = hitNode.id;
            _lastTapPos = { x: touch.clientX, y: touch.clientY };
        }

        _longPressTimer = window.setTimeout(() => {
            if (_pointerDownNodeId && hitNode) {
                _isPanning = false;
                createEditModal(view, hitNode);
            }
        }, LONG_PRESS_TIME);
    };

    const onTouchMove = (e: TouchEvent) => {
        if (_isPinching && e.touches.length === 2) {
            const currentDistance = getTouchDistance(e.touches);
            const scale = (currentDistance / _initialPinchDistance) * _initialPinchScale;
            view.scale = Math.max(0.3, Math.min(3, scale));
            Render();
            return;
        }

        _clearLongPressTimer();

        if (e.touches.length !== 1) return;
        const touch = e.touches[0];

        if (_pointerDownPos) {
            const dx = touch.clientX - _pointerDownPos.x;
            const dy = touch.clientY - _pointerDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > TAP_THRESHOLD) {
                if (_pointerDownNodeId !== null) {
                    _isDraggingNode = true;
                } else {
                    _isPanning = true;
                }
            }
        }

        if (_isPanning) {
            const dx = touch.clientX - (_lastTapPos?.x || 0);
            const dy = touch.clientY - (_lastTapPos?.y || 0);
            view.offset.x += dx;
            view.offset.y += dy;
            _lastTapPos = { x: touch.clientX, y: touch.clientY };
            Render();
        }
    };

    const onTouchEnd = (e: TouchEvent) => {
        _clearLongPressTimer();

        if (_isPinching && e.touches.length < 2) {
            _isPinching = false;
            return;
        }

        if (e.touches.length > 0) return;

        const touch = e.changedTouches[0];
        const worldPos = EventToWorldCoordinate(touch.clientX, touch.clientY);
        
        if (!worldPos) {
            resetState();
            return;
        }

        const now = Date.now();
        const dx = touch.clientX - (_lastTapPos?.x || 0);
        const dy = touch.clientY - (_lastTapPos?.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (_isDraggingNode && _pointerDownNodeId !== null) {
            const nodes = (eventView as any).nodes;
            const hitNode = nodes.find((n: any) => n.id === _pointerDownNodeId);
            if (hitNode) {
                hitNode.x = worldPos.x;
                hitNode.y = worldPos.y;
                Render();
                SaveNodes();
            }
        } else if (!_isPanning && dist < TAP_THRESHOLD) {
            const hitNode = FindNodeAt(worldPos.x, worldPos.y);

            if (_lastTapTime && now - _lastTapTime < DOUBLE_TAP_TIME && _lastTapPos) {
                const lastDx = touch.clientX - _lastTapPos.x;
                const lastDy = touch.clientY - _lastTapPos.y;
                if (Math.sqrt(lastDx * lastDx + lastDy * lastDy) < DOUBLE_TAP_DIST) {
                    if (hitNode) {
                        createStatsModal(view, hitNode);
                    }
                    _lastTapTime = 0;
                    _lastTapPos = null;
                    resetState();
                    return;
                }
            }

            const checkboxHit = getCheckboxAtWorld(worldPos);
            if (checkboxHit && checkboxHit.userCompletable) {
                if (checkboxHit.state === 'in-progress') {
                    checkboxHit.state = 'complete';
                }
                Render();
                SaveNodes();
                resetState();
                return;
            }

            if (hitNode) {
                SetSelectedNodeID(hitNode.id);
                CenterOnNode(hitNode);
            }

            _lastTapTime = now;
            _lastTapPos = { x: touch.clientX, y: touch.clientY };
        }

        resetState();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return {
        cleanup: () => {
            _clearLongPressTimer();
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        }
    };
}

function getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function _clearLongPressTimer(): void {
    if (_longPressTimer) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
    }
}

function resetState(): void {
    _pointerDownPos = null;
    _pointerId = null;
    _isDraggingNode = false;
    _pointerDownNodeId = null;
    _isPanning = false;
}