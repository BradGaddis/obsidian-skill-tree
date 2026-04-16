

import { view } from "../utils/globals";



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
        dialogBox.classList.add('skill-tree-dialog', 'skill-tree-dialog--box');

        const title = dialogBox.createEl('h3');
        title.classList.add('skill-tree-dialog-title');
        title.textContent = 'Delete Tree';

        const message = dialogBox.createEl('p');
        message.classList.add('skill-tree-dialog-message');
        message.textContent = `Are you sure you want to delete "${treeName}"? This action cannot be undone.`;

        const buttonRow = dialogBox.createEl('div');
        buttonRow.classList.add('skill-tree-dialog-buttons');

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary-border');

        const deleteBtn = buttonRow.createEl('button', { text: 'Delete' });
        deleteBtn.classList.add('skill-tree-btn', 'skill-tree-btn--danger-red');

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
        dialogBox.classList.add('skill-tree-dialog', 'skill-tree-dialog--box');

        const title = dialogBox.createEl('h3');
        title.classList.add('skill-tree-dialog-title', 'skill-tree-dialog-title--large');
        title.textContent = 'New Tree';

        const input = dialogBox.createEl('input');
        input.type = 'text';
        input.placeholder = 'Tree name';
        input.classList.add('skill-tree-dialog-input');

        const buttonRow = dialogBox.createEl('div');
        buttonRow.classList.add('skill-tree-dialog-buttons');

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary-border');

        const createBtn = buttonRow.createEl('button', { text: 'Create' });
        createBtn.classList.add('skill-tree-btn', 'skill-tree-btn--primary');

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
