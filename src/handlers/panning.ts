import { Update } from "../rendering/renderer";
import { view } from "utils/globals";

export let isPanning = false;

export interface PanHandlerOptions {
    threshold?: number;
    getDelta?: () => { x: number, y: number } | null;
}

export function InitPanHandler(
    shouldStartPan: (...args: unknown[]) => boolean, options?: PanHandlerOptions): { cleanup: () => void } {
    const canvas = view.canvas;
    const threshold = options?.threshold;
    const getDelta = options?.getDelta;

    if (!canvas) return { cleanup: () => { } };

    const onMouseDown = (e: MouseEvent) => {
        if (e.button === 0 && shouldStartPan()) {
            isPanning = true;
        } else if (e.button === 1) {
            isPanning = true;
        } else if (e.button === 2 && shouldStartPan()) {
            isPanning = true;
        }
    };

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isPanning) return;

        let dx = e.movementX;
        let dy = e.movementY;

        if (getDelta) {
            const delta = getDelta();
            if (delta) {
                dx = delta.x;
                dy = delta.y;
            }
        }

        if (threshold !== undefined && threshold > 0) {
            if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
                return;
            }
        }

        view.offset.x += dx;
        view.offset.y += dy;
        Update();
    };

    const onMouseUp = () => {
        isPanning = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return {
        cleanup: () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
    };
}
