import { SkillTreeView } from "../skilltreeview";
import { closeAllModals } from "../modal/skilltree_modal";
import {
    createAddNodeModal,
    createAddNodeHeader,
} from "./add_node_parts";

let view: SkillTreeView;

export function InitTreeLinkDialog(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function OpenAddTreeLinkDialog(x: number, y: number) {
    const container = view.canvasWrap || view.containerEl;
    if (!container) return;

    closeAllModals();

    const modal = createAddNodeModal(container);
    const header = createAddNodeHeader(modal);
    const title = header.querySelector('span')!;
    title.textContent = 'Add Tree Link';

    const content = modal.createEl('div');
    content.style.cssText = 'padding: 16px;';

    const row = content.createEl('div');
    row.style.cssText = 'margin-bottom: 12px;';

    const label = row.createEl('label');
    label.textContent = 'Link to tree:';
    label.style.cssText = 'display: block; margin-bottom: 4px; font-weight: 500;';

    const select = row.createEl('select') as HTMLSelectElement;
    select.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--input-border); border-radius: 4px;';

    const treeNames = Object.keys(view.settings.trees);
    const currentTree = view.settings.currentTreeName;
    for (const treeName of treeNames) {
        const option = select.createEl('option');
        option.value = treeName;
        option.textContent = treeName;
        if (treeName === currentTree) {
            option.selected = true;
        }
    }

    const btnRow = content.createEl('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;';

    const cancelBtn = btnRow.createEl('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';

    const createBtn = btnRow.createEl('button');
    createBtn.textContent = 'Create';
    createBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: var(--interactive-accent); color: white; border: none; border-radius: 4px;';

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
        const selectedTree = select.value;

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

        await createTreeLinkNode(view, worldPos.x, worldPos.y, selectedTree);
        onClose();
    };

    setTimeout(() => {
        document.addEventListener('click', outsideHandler);
    }, 10);
}

async function createTreeLinkNode(
    view: SkillTreeView,
    x: number,
    y: number,
    treeLink: string
): Promise<void> {
    const { AddNode } = await import('../tree_manager');
    const { SaveNodes, RecordSnapshot } = await import('../recorder');
    const { Render } = await import('../renderer');

    RecordSnapshot();

    const newNode = AddNode(x, y, undefined, 'TreeLinkNode');
    
    if (newNode) {
        const treeLinkNode = newNode as import('../skill_nodes/tree_link_node').TreeLinkNode;
        treeLinkNode.treeLink = treeLink;
    }

    await SaveNodes();
    Render();
}