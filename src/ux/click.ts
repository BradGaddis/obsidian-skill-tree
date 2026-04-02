import { Render, CenterOnNode } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt } from "../tree-manager";

let view: SkillTreeView;

// Need to handle node radii - maybe pass from renderer or recalculate
export function InitClickHandler(skillTreeView: SkillTreeView): { cleanup: () => void } {
    view = skillTreeView;
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };
    const onClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const worldPos = view.screenToWorld(
            e.clientX - rect.left,
            e.clientY - rect.top
        );
        // Hit detection - check if click is on any node
        const hitNode = FindNodeAt(worldPos.x, worldPos.y);

        if (hitNode) {
            SetSelectedNodeID(hitNode.id)
            CenterOnNode(hitNode)
        } else {
            SetSelectedNodeID(null)
        }

        Render();
    };
    canvas.addEventListener('click', onClick);
    return {
        cleanup: () => {
            canvas.removeEventListener('click', onClick);
        }
    };
}

