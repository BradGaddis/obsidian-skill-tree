import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "../skill_nodes/skill_node";
import { createSkillModal, openSkillModal, makeModalDraggable, closeSkillModal } from "./skilltree-modal";

export function createEditModal(view: SkillTreeView, node: SkillNode): HTMLElement {
    view.closeAllModals();
    const modal = createSkillModal(view);

    modal.style.cssText = 'position:fixed;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

    const header = modal.createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';

    const title = header.createEl('span', { text: 'Edit Node' });
    title.style.cssText = 'font-weight:bold;font-size:14px;';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => closeSkillModal(view, modal);

    const content = modal.createEl('div');
    content.style.cssText = 'padding:12px 16px;overflow-y:auto;';

    node.setEditModalContents(view, modal)

    openSkillModal(modal)
    makeModalDraggable(view, modal, 'edit');

    view.installOutsideClickHandler(modal);

    return modal;
}
