import { CenterOnNode } from "src/renderer";
import { SkillTreeView } from "src/skilltreeview";
import { SetSelectedNodeID, FindNodeAt } from "../tree-manager";
import { SkillNode } from "src/skill_nodes/skill_node";
import { createStatsModal } from "../modal/stilltree-stats-modal";

let view: SkillTreeView;

// prevents node from opening on first click
let nodeWasSelected: SkillNode | null

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

        if (!hitNode) {
            SetSelectedNodeID(null)
            return
        }

        if (nodeWasSelected?.id === hitNode.id) {
            createStatsModal(view, hitNode);
        }

        SetSelectedNodeID(hitNode.id)
        nodeWasSelected = hitNode

        CenterOnNode(hitNode)
    };
    canvas.addEventListener('click', onClick);
    return {
        cleanup: () => {
            canvas.removeEventListener('click', onClick);
        }
    };
}

