import { SkillTreeView } from "../skilltreeview";
import { closeAllModals } from "../modal/skilltree_modal";
import {
    createAddNodeModal,
    createAddNodeHeader,
    createRepeatNodeContent,
    createRepeatNode
} from "./add_node_parts";

let view: SkillTreeView;

export function InitRepeatNodeDialog(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function OpenAddRepeatingNodeDialog(x: number, y: number) {
    const container = view.canvasWrap || view.containerEl;
    if (!container) return;

    closeAllModals();

    const modal = createAddNodeModal(container);
    const header = createAddNodeHeader(modal);
    const title = header.querySelector('span')!;
    title.textContent = 'Add Repeat Node';

    const { minutesInput, hoursInput, daysInput, maxInput, displayInput, cancelBtn, createBtn } = createRepeatNodeContent(modal);

    const closeBtn = header.querySelector('button')!;

    const onClose = () => {
        modal.remove();
        document.removeEventListener('click', outsideHandler);
    };

    closeBtn.onclick = onClose;
    cancelBtn.onclick = onClose;

    const outsideHandler = (e: MouseEvent) => {
        if (!modal.contains(e.target as Node)) {
            onClose();
        }
    };

    createBtn.onclick = async () => {
        const minutes = parseInt(minutesInput.value, 10) || 0;
        const hours = parseInt(hoursInput.value, 10) || 0;
        const days = parseInt(daysInput.value, 10) || 0;
        const max = maxInput.value ? parseInt(maxInput.value, 10) : undefined;
        const display = displayInput.value.trim() || undefined;

        const worldPos = { x, y };
        if (!worldPos.x || !worldPos.y) {
            if (view.canvas) {
                const rect = view.canvas.getBoundingClientRect();
                const { screenToWorld } = await import('../renderer');
                worldPos.x = rect.width / 2;
                worldPos.y = rect.height / 2;
                const world = screenToWorld({ x: worldPos.x, y: worldPos.y });
                worldPos.x = Math.round(world.x);
                worldPos.y = Math.round(world.y);
            } else {
                worldPos.x = 200;
                worldPos.y = 150;
            }
        }

        await createRepeatNode(view, worldPos.x, worldPos.y, minutes, hours, days, max, display);
        onClose();
    };

    setTimeout(() => {
        document.addEventListener('click', outsideHandler);
    }, 10);
}