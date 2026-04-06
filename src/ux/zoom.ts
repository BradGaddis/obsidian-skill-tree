
import { Render, screenToWorld } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";

// TODO: add to settings
export interface ZoomConfig {
    minScale: number,
    maxScale: number
}

let view: SkillTreeView;
let minScale = 0.3;
let maxScale = 3;
let scrollDelta = 0;

let scrollRafId: number | null = null;

export function InitZoomHandler(skillTreeView: SkillTreeView, config: ZoomConfig): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };

    minScale = config.minScale;
    maxScale = config.maxScale;
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (e.deltaY === 0) return;

        // Accumulate scroll delta with damping
        scrollDelta += Math.tanh(-e.deltaY * 0.0015);

        if (!scrollRafId) {
            scrollRafId = requestAnimationFrame(() => {
                if (scrollDelta !== 0 && canvas) {
                    const rect = canvas.getBoundingClientRect();

                    // Zoom toward cursor position
                    const cursorX = e.clientX - rect.left;
                    const cursorY = e.clientY - rect.top;
                    const worldBefore = screenToWorld({ x: cursorX, y: cursorY });
                    // Apply delta with clamping
                    const clampedDelta = Math.max(-0.5, Math.min(0.5, scrollDelta));
                    const factor = 1 + clampedDelta;
                    const newScale = view.scale * factor;
                    // Clamp scale
                    if (factor < 1) {
                        view.scale = Math.max(minScale, newScale);
                    } else {
                        view.scale = Math.min(maxScale, newScale);
                    }
                    // Adjust offset to keep cursor over same world point
                    view.offset.x = cursorX - worldBefore.x * view.scale;
                    view.offset.y = cursorY - worldBefore.y * view.scale;
                    Render();
                }
                scrollDelta = 0;
                scrollRafId = null;
            });
        }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return {
        cleanup: () => {
            canvas.removeEventListener('wheel', onWheel);
            if (scrollRafId) {
                cancelAnimationFrame(scrollRafId);
                scrollRafId = null;
            }
        }
    };
}





