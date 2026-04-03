import { Render } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { Coordinate } from "src/types";



let view: SkillTreeView;
let isPanning = false;


export function InitPanHandler(skillTreeView: SkillTreeView, shouldStartPan: (...args: unknown[]) => boolean): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;

    if (!canvas) return { cleanup: () => { } };


    // Event handlers
    const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;  // only left click
        // const rect = canvas.getBoundingClientRect();
        // const w = view.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });;

        if (shouldStartPan()) {
            isPanning = true;
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isPanning) return;
        view.offset.x += e.movementX;
        view.offset.y += e.movementY;
        Render();

    };

    const onMouseUp = () => {
        isPanning = false;
    };

    // Attach listeners
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Return cleanup function
    return {
        cleanup: () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
    };
}
