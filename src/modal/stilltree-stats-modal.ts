import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "../skill_nodes/skill_node";
import { createSkillModal, openSkillModal, makeModalDraggable, closeSkillModal } from "./skilltree-modal";
import { OptionalNode } from "src/skill_nodes/optional_node";
import { CheckpointNode } from "src/skill_nodes/checkpoint_node";
import { RepeatingNode } from "src/skill_nodes/repeating_node";
import { TreeLinkNode } from "src/skill_nodes/tree_link_node";

// TODO: clean this up

export function createStatsModal(view: SkillTreeView, node: SkillNode): HTMLElement {
    view.closeAllModals();
    const modal = createSkillModal(view);

    if (node instanceof OptionalNode || node instanceof CheckpointNode) {
        return modal;
    }

    if (node instanceof RepeatingNode) {
        // TODO:
    }
    if (node instanceof TreeLinkNode) {
        // TODO:
    }

    openBaseStatsModal(view, modal, node)

    return modal;
}

function openBaseStatsModal(view: SkillTreeView, modal: HTMLElement, node: SkillNode) {
    console.log("opening stats modal")

    modal.style.cssText = 'position:fixed;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

    const header = modal.createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';

    const title = header.createEl('span', { text: 'Node Info' });
    title.style.cssText = 'font-weight:bold;font-size:14px;';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => closeSkillModal(view, modal);

    const content = modal.createEl('div');
    content.style.cssText = 'padding:12px 16px;overflow-y:auto;flex:1;';

    node.setStatsModalContents(view, modal, node)

    openSkillModal(modal)
    makeModalDraggable(view, modal, 'stats');

    view.installOutsideClickHandler(modal);

}
