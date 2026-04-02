import { SkillTreeView } from "src/skilltreeview";
import { SkillTreeModal } from "./skilltree-modal";

export class SkillTreeStatsModal extends SkillTreeModal {
    constructor(skillTreeView: SkillTreeView, closeModals: boolean = true) {
        super(skillTreeView, closeModals)
        this.modal.style.cssText = 'position:fixed;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

        const header = this.modal.createEl('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';

        const title = header.createEl('span', { text: 'Node Info' });
        title.style.cssText = 'font-weight:bold;font-size:14px;';

        const closeBtn = header.createEl('button', { text: '×' });
        closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
        closeBtn.onclick = () => {
            this.modal.remove();
            this.view.removeOutsideClickHandler();
        };

        const content = this.modal.createEl('div');
        content.style.cssText = 'padding:12px 16px;overflow-y:auto;flex:1;';

    }
}


