// TODO: refactor view nightmare
import { SkillTreeView } from "./skilltreeview";

let view: SkillTreeView


export function InitDialog(skillTreeView: SkillTreeView) {
    view = skillTreeView

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
        dialogBox.style.cssText = `
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 400px;
      `;

        const title = dialogBox.createEl('h3');
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px;';
        title.textContent = 'Delete Tree';

        const message = dialogBox.createEl('p');
        message.style.cssText = 'margin: 0 0 20px 0; color: var(--text-normal);';
        message.textContent = `Are you sure you want to delete "${treeName}"? view action cannot be undone.`;

        const buttonRow = dialogBox.createEl('div');
        buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); color: var(--text-normal); cursor: pointer;';

        const deleteBtn = buttonRow.createEl('button', { text: 'Delete' });
        deleteBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #dc3545; color: white; cursor: pointer;';

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
        dialogBox.style.cssText = `
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 400px;
      `;

        const title = dialogBox.createEl('h3');
        title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
        title.textContent = 'New Tree';

        const input = dialogBox.createEl('input');
        input.type = 'text';
        input.placeholder = 'Tree name';
        input.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        color: var(--text-normal);
        font-size: 14px;
        margin-bottom: 16px;
        box-sizing: border-box;
      `;

        const buttonRow = dialogBox.createEl('div');
        buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); color: var(--text-normal); cursor: pointer;';

        const createBtn = buttonRow.createEl('button', { text: 'Create' });
        createBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer;';

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


export function OpenAddNodeDialog() {
    //     const container = view.canvasWrap || view.containerEl;
    //     if (!container) return;
    //
    //     view.closeAllModals();
    //     const modal = container.createEl('div', { cls: 'skill-tree-node-modal' });
    //     modal.style.cssText = 'position:fixed;width:400px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';
    //
    //     const header = modal.createEl('div');
    //     header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';
    //
    //     const title = header.createEl('span', { text: 'Add Node' });
    //     title.style.cssText = 'font-weight:bold;font-size:14px;';
    //
    //     const closeBtn = header.createEl('button', { text: '×' });
    //     closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    //     closeBtn.onclick = () => {
    //         modal.remove();
    //         view.removeOutsideClickHandler();
    //     };
    //
    //     const content = modal.createEl('div');
    //     content.style.cssText = 'padding:16px;';
    //
    //     view.makeModalDraggable(modal, 'addNodeDialog');
    //     view.installOutsideClickHandler(modal);
    //
    //     const label = content.createEl('label', { text: 'File name:' });
    //     label.style.cssText = 'display:block;margin-bottom:8px;font-weight:500;';
    //
    //     const inputWrapper = content.createEl('div');
    //     inputWrapper.style.cssText = 'position:relative;';
    //
    //     const input = inputWrapper.createEl('input', { attr: { type: 'text', placeholder: 'Search or create file...', autocomplete: 'off' } });
    //     input.style.cssText = 'width:100%;padding:8px 12px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);box-sizing:border-box;';
    //     input.focus();
    //
    //     const suggestions = inputWrapper.createEl('div');
    //     suggestions.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px;max-height:200px;overflow-y:auto;z-index:10000;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    //
    //     const warning = content.createEl('div');
    //     warning.style.cssText = 'margin-top:8px;padding:8px 12px;background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.4);border-radius:4px;color:var(--text-warning);font-size:13px;display:none;';
    //
    //     const actions = content.createEl('div');
    //     actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';
    //
    //     const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    //     cancelBtn.style.cssText = 'padding:8px 16px;';
    //     cancelBtn.onclick = () => {
    //         modal.remove();
    //         view.removeOutsideClickHandler();
    //     };
    //
    //     const createBtn = actions.createEl('button', { text: 'Create' });
    //     createBtn.style.cssText = 'padding:8px 16px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;';
    //
    //     const fileExists = (path: string): boolean => {
    //         let normalizedPath = path.trim();
    //         if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
    //         if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
    //         const file = view.app.vault.getAbstractFileByPath(normalizedPath);
    //         return file !== null && file !== undefined;
    //     };
    //
    //     const getSuggestions = (query: string): string[] => {
    //         if (!query || query.length < 1) return [];
    //         const normalizedQuery = query.toLowerCase();
    //         const files = view.app.vault.getFiles();
    //         return files
    //             .filter(f => f.name.toLowerCase().includes(normalizedQuery))
    //             .map(f => f.path)
    //             .sort((a, b) => {
    //                 const aStartsWith = a.toLowerCase().startsWith(normalizedQuery);
    //                 const bStartsWith = b.toLowerCase().startsWith(normalizedQuery);
    //                 if (aStartsWith && !bStartsWith) return -1;
    //                 if (!aStartsWith && bStartsWith) return 1;
    //                 return a.localeCompare(b);
    //             })
    //             .slice(0, 10);
    //     };
    //
    //     let selectedSuggestionIndex = -1;
    //
    //     const highlightSuggestion = (index: number) => {
    //         const items = suggestions.querySelectorAll('div');
    //         items.forEach((item, i) => {
    //             if (i === index) {
    //                 (item as HTMLElement).style.background = 'var(--interactive-accent)';
    //                 (item as HTMLElement).style.color = 'var(--text-on-accent)';
    //             } else {
    //                 (item as HTMLElement).style.background = '';
    //                 (item as HTMLElement).style.color = '';
    //             }
    //         });
    //         selectedSuggestionIndex = index;
    //     };
    //
    //     const showSuggestions = (query: string) => {
    //         const matches = getSuggestions(query);
    //         suggestions.innerHTML = '';
    //         selectedSuggestionIndex = -1;
    //
    //         if (matches.length === 0) {
    //             suggestions.style.display = 'none';
    //             return;
    //         }
    //
    //         for (const match of matches) {
    //             const item = suggestions.createEl('div');
    //             item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;';
    //             item.textContent = match;
    //             item.onmouseenter = () => {
    //                 const items = Array.from(suggestions.querySelectorAll('div'));
    //                 const idx = items.indexOf(item);
    //                 highlightSuggestion(idx);
    //             };
    //             item.onmouseleave = () => {
    //                 item.style.background = '';
    //                 item.style.color = '';
    //             };
    //             item.onclick = () => {
    //                 input.value = match;
    //                 suggestions.style.display = 'none';
    //                 updateWarning();
    //                 createBtn.focus();
    //             };
    //         }
    //
    //         suggestions.style.display = 'block';
    //     };
    //
    //     const hideSuggestions = () => {
    //         suggestions.style.display = 'none';
    //         selectedSuggestionIndex = -1;
    //     };
    //
    //     const isFileAlreadyANode = (path: string): { isNode: boolean; message: string } => {
    //         let normalizedPath = path.trim();
    //         if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
    //         if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
    //
    //         // Check if file is already linked to a node in view tree
    //         const existingNodeId = view.getNodeIdLinkedToPath(normalizedPath);
    //         if (existingNodeId !== null) {
    //             return { isNode: true, message: `"${normalizedPath}" is already linked to a node in view tree.` };
    //         }
    //
    //         // Note: We intentionally allow files linked to other trees to be added
    //         // The same node ID will be used across trees for consistency
    //
    //         return { isNode: false, message: '' };
    //     };
    //
    //     const updateWarning = () => {
    //         const query = input.value.trim();
    //         if (!query) {
    //             warning.style.display = 'none';
    //             warning.style.background = 'rgba(255,193,7,0.15)';
    //             warning.style.borderColor = 'rgba(255,193,7,0.4)';
    //             warning.style.color = 'var(--text-warning)';
    //             createBtn.textContent = 'Create';
    //             createBtn.disabled = true;
    //             return;
    //         }
    //
    //         // First check if file is already a node
    //         const nodeCheck = isFileAlreadyANode(query);
    //         if (nodeCheck.isNode) {
    //             warning.style.display = 'block';
    //             warning.style.background = 'rgba(220,53,69,0.15)';
    //             warning.style.borderColor = 'rgba(220,53,69,0.4)';
    //             warning.style.color = 'var(--text-error)';
    //             warning.innerHTML = nodeCheck.message;
    //             createBtn.textContent = 'Create';
    //             createBtn.disabled = true;
    //             return;
    //         }
    //
    //         // Then check if file exists
    //         warning.style.background = 'rgba(255,193,7,0.15)';
    //         warning.style.borderColor = 'rgba(255,193,7,0.4)';
    //         warning.style.color = 'var(--text-warning)';
    //
    //         if (fileExists(query)) {
    //             warning.style.display = 'none';
    //             createBtn.textContent = 'Add';
    //             createBtn.disabled = false;
    //         } else {
    //             warning.style.display = 'block';
    //             warning.innerHTML = `<strong>Note:</strong> "${query}" will be created when you continue.`;
    //             createBtn.textContent = 'Create';
    //             createBtn.disabled = false;
    //         }
    //     };
    //
    //     const createNode = async () => {
    //         const fileName = input.value.trim();
    //         if (!fileName) {
    //             new Notice('Please enter a file name');
    //             return;
    //         }
    //
    //         let normalizedPath = fileName;
    //         if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
    //         if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
    //
    //         // Final check before creating
    //         const nodeCheck = isFileAlreadyANode(normalizedPath);
    //         if (nodeCheck.isNode) {
    //             new Notice(nodeCheck.message);
    //             return;
    //         }
    //
    //         modal.remove();
    //         view.removeOutsideClickHandler();
    //
    //         view.recordSnapshot();
    //
    //         let worldPos = { x: 200, y: 150 };
    //         if (view.canvas) {
    //             const rect = view.canvas.getBoundingClientRect();
    //             worldPos = view.screenToWorld(rect.width / 2, rect.height / 2);
    //         }
    //
    //         view.addNodeAt(worldPos.x, worldPos.y);
    //         const newNode = view.nodes[view.nodes.length - 1];
    //         if (newNode) {
    //             newNode.fileLink = normalizedPath;
    //         }
    //
    //         await view.saveNodes();
    //         view.requestRender();
    //         view.refreshJsonEditor();
    //     };
    //
    //     input.addEventListener('input', () => {
    //         updateWarning();
    //         const query = input.value.trim();
    //         if (query.length > 0) {
    //             showSuggestions(query);
    //         } else {
    //             hideSuggestions();
    //         }
    //     });
    //
    //     input.addEventListener('blur', () => {
    //         setTimeout(hideSuggestions, 200);
    //     });
    //
    //     input.addEventListener('focus', () => {
    //         const query = input.value.trim();
    //         if (query.length > 0) {
    //             showSuggestions(query);
    //         }
    //     });
    //
    //     createBtn.onclick = createNode;
    //     createBtn.disabled = true;
    //     input.addEventListener('keydown', (e) => {
    //         const items = suggestions.querySelectorAll('div');
    //         const itemCount = items.length;
    //
    //         if (e.key === 'ArrowDown') {
    //             e.preventDefault();
    //             if (suggestions.style.display === 'none') {
    //                 const query = input.value.trim();
    //                 if (query.length > 0) {
    //                     showSuggestions(query);
    //                 }
    //             } else if (itemCount > 0) {
    //                 const newIndex = selectedSuggestionIndex < itemCount - 1 ? selectedSuggestionIndex + 1 : 0;
    //                 highlightSuggestion(newIndex);
    //                 const selectedItem = items[newIndex] as HTMLElement;
    //                 if (selectedItem) {
    //                     selectedItem.scrollIntoView({ block: 'nearest' });
    //                 }
    //             }
    //             return;
    //         }
    //
    //         if (e.key === 'ArrowUp') {
    //             e.preventDefault();
    //             if (itemCount > 0) {
    //                 const newIndex = selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : itemCount - 1;
    //                 highlightSuggestion(newIndex);
    //                 const selectedItem = items[newIndex] as HTMLElement;
    //                 if (selectedItem) {
    //                     selectedItem.scrollIntoView({ block: 'nearest' });
    //                 }
    //             }
    //             return;
    //         }
    //
    //         if (e.key === 'Enter' && !createBtn.disabled) {
    //             if (suggestions.style.display === 'block' && selectedSuggestionIndex >= 0) {
    //                 e.preventDefault();
    //                 const selectedItem = items[selectedSuggestionIndex] as HTMLElement;
    //                 if (selectedItem) {
    //                     input.value = selectedItem.textContent || '';
    //                     hideSuggestions();
    //                     updateWarning();
    //                     return;
    //                 }
    //             }
    //             createNode();
    //         } else if (e.key === 'Escape') {
    //             hideSuggestions();
    //         }
    //     });
    //
    //     updateWarning();
}



export function OpenAddRepeatingNodeDialog(x: number, y: number) {
    // const container = view.canvasWrap || view.containerEl;
    // if (!container) return;
    //
    // view.closeAllModals();
    // const modal = container.createEl('div', { cls: 'skill-tree-node-modal' });
    // modal.style.cssText = 'position:fixed;width:360px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';
    //
    // const header = modal.createEl('div');
    // header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);';
    //
    // const title = header.createEl('span', { text: 'Add Repeating Node' });
    // title.style.cssText = 'font-weight:bold;font-size:14px;';
    //
    // const closeBtn = header.createEl('button', { text: '×' });
    // closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    // closeBtn.onclick = () => {
    //   modal.remove();
    //   view.removeOutsideClickHandler();
    // };
    //
    // const content = modal.createEl('div');
    // content.style.cssText = 'padding:16px;';
    //
    // const form = content.createEl('div');
    // form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    //
    // const labelRow1 = form.createEl('div');
    // labelRow1.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    // const resetLabel = labelRow1.createEl('label', { text: 'Reset Mode:' });
    // resetLabel.style.cssText = 'font-size:13px;';
    // const resetSelect = labelRow1.createEl('select');
    // resetSelect.style.cssText = 'width:160px;padding:4px;';
    // const opt = resetSelect.createEl('option', { value: 'cooldown', text: 'Cooldown' });
    // opt.selected = true;
    //
    // const cooldownRow = form.createEl('div');
    // cooldownRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    // const cooldownLabel = cooldownRow.createEl('label', { text: 'Cooldown (hours):' });
    // cooldownLabel.style.cssText = 'font-size:13px;';
    // const cooldownInput = cooldownRow.createEl('input', { type: 'number' });
    // cooldownInput.style.cssText = 'width:80px;padding:4px;';
    // (cooldownInput as HTMLInputElement).step = '0.5';
    // (cooldownInput as HTMLInputElement).min = '0.5';
    // cooldownInput.value = '24';
    //
    // resetSelect.onchange = () => {
    //   cooldownRow.style.display = resetSelect.value === 'cooldown' ? 'flex' : 'none';
    // };
    //
    // const maxRow = form.createEl('div');
    // maxRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    // const maxLabel = maxRow.createEl('label', { text: 'Max Repeats (0=unlimited):' });
    // maxLabel.style.cssText = 'font-size:13px;';
    // const maxInput = maxRow.createEl('input', { type: 'number' });
    // maxInput.style.cssText = 'width:80px;padding:4px;';
    // maxInput.value = '0';
    //
    // const expRow = form.createEl('div');
    // expRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    // const expLabel = expRow.createEl('label', { text: 'EXP per completion:' });
    // expLabel.style.cssText = 'font-size:13px;';
    // const expInput = expRow.createEl('input', { type: 'number' });
    // expInput.style.cssText = 'width:80px;padding:4px;';
    // expInput.value = '10';
    //
    // const buttons = content.createEl('div');
    // buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
    //
    // const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    // cancelBtn.style.cssText = 'padding:6px 12px;';
    // cancelBtn.onclick = () => {
    //   modal.remove();
    //   view.removeOutsideClickHandler();
    // };
    //
    // const createBtn = buttons.createEl('button', { text: 'Create Node' });
    // createBtn.style.cssText = 'padding:6px 12px;background:var(--interactive);color:var(--text-on-interactive);border:none;border-radius:4px;';
    // createBtn.onclick = async () => {
    //   view.recordSnapshot();
    //   const repeatExtras: Record<string, any> = {
    //     nodeType: 'RepeatingNode',
    //     repeating: true,
    //     shape: 'repeat',
    //     repeatReset: 'cooldown',
    //     exp: parseInt(expInput.value) || 10,
    //   };
    //   if (resetSelect.value === 'cooldown') {
    //     repeatExtras.repeatCooldownHours = parseFloat(cooldownInput.value) || 24;
    //   }
    //   const maxVal = parseInt(maxInput.value);
    //   if (maxVal > 0) {
    //     repeatExtras.repeatMax = maxVal;
    //   }
    //   view.addNodeAt(x, y, repeatExtras);
    //   await view.saveNodes();
    //   view.requestRender();
    //   view.refreshJsonEditor();
    //   modal.remove();
    //   view.removeOutsideClickHandler();
    // };
    //
    // view.makeModalDraggable(modal, 'addRepeatingDialog');
    // view.installOutsideClickHandler(modal);
}



