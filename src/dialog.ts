// TODO: refactor view nightmare
import { SkillTreeView } from "./skilltreeview";
import * as S from "./styles";
import { InitRepeatNodeDialog, OpenAddRepeatingNodeDialog } from "./dialog/add_repeat_node_dialog";
import { InitTreeLinkDialog } from "./dialog/add_tree_link_dialog";

let view: SkillTreeView


export function InitDialog(skillTreeView: SkillTreeView) {
    view = skillTreeView
    InitRepeatNodeDialog(skillTreeView);
    InitTreeLinkDialog(skillTreeView);
}

export function ShowDeleteTreeDialog(treeName: string): Promise<boolean> {
    return new Promise((resolve) => {
        const container = view.canvasWrap || view.containerEl;
        if (!container) {
            resolve(false);
            return;
        }

        const dialog = container.createEl('div');
        dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

        const dialogBox = dialog.createEl('div');
        dialogBox.style.cssText = S.DIALOG_BOX;

        const title = dialogBox.createEl('h3');
        title.style.cssText = S.DIALOG_TITLE;
        title.textContent = 'Delete Tree';

        const message = dialogBox.createEl('p');
        message.style.cssText = S.DIALOG_MESSAGE;
        message.textContent = `Are you sure you want to delete "${treeName}"? This action cannot be undone.`;

        const buttonRow = dialogBox.createEl('div');
        buttonRow.style.cssText = S.DIALOG_BUTTON_ROW;

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.style.cssText = S.BTN_SECONDARY_BORDER;

        const deleteBtn = buttonRow.createEl('button', { text: 'Delete' });
        deleteBtn.style.cssText = S.BTN_DANGER_RED;

        const closeDialog = (result: boolean) => {
            dialog.remove();
            document.removeEventListener('click', outsideHandler);
            document.removeEventListener('keydown', keyHandler);
            resolve(result);
        };

        cancelBtn.onclick = () => closeDialog(false);
        deleteBtn.onclick = () => closeDialog(true);

        const outsideHandler = (e: MouseEvent) => {
            if (!dialogBox.contains(e.target as Node)) {
                closeDialog(false);
            }
        };

        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeDialog(false);
            } else if (e.key === 'Enter') {
                closeDialog(true);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', outsideHandler);
            document.addEventListener('keydown', keyHandler);
        }, 10);
    });
}

export function ShowNewTreeDialog(): Promise<string | null> {
    return new Promise((resolve) => {
        const container = view.canvasWrap || view.containerEl;
        if (!container) {
            resolve(null);
            return;
        }

        const dialog = container.createEl('div');
        dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

        const dialogBox = dialog.createEl('div');
        dialogBox.style.cssText = S.DIALOG_BOX;

        const title = dialogBox.createEl('h3');
        title.style.cssText = S.DIALOG_TITLE_LARGE;
        title.textContent = 'New Tree';

        const input = dialogBox.createEl('input');
        input.type = 'text';
        input.placeholder = 'Tree name';
        input.style.cssText = S.DIALOG_INPUT;

        const buttonRow = dialogBox.createEl('div');
        buttonRow.style.cssText = S.DIALOG_BUTTON_ROW;

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.style.cssText = S.BTN_SECONDARY_BORDER;

        const createBtn = buttonRow.createEl('button', { text: 'Create' });
        createBtn.style.cssText = S.BTN_PRIMARY;

        const closeDialog = (result: string | null) => {
            dialog.remove();
            document.removeEventListener('click', outsideHandler);
            document.removeEventListener('keydown', keyHandler);
            resolve(result);
        };

        cancelBtn.onclick = () => closeDialog(null);
        createBtn.onclick = () => closeDialog(input.value.trim() || null);

        const outsideHandler = (e: MouseEvent) => {
            if (!dialogBox.contains(e.target as Node)) {
                closeDialog(null);
            }
        };

        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeDialog(null);
            } else if (e.key === 'Enter') {
                closeDialog(input.value.trim() || null);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', outsideHandler);
            document.addEventListener('keydown', keyHandler);
            input.focus();
        }, 10);
    });
}

export function OpenAddNodeDialog(): void {
    // Functionality moved to add_node_parts.ts
}