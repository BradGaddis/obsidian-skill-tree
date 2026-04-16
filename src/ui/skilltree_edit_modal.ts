import { SkillTreeView } from "../skilltreeview";
import { SkillNode } from "../nodes/skill_node";
import { ModalButton } from "../types/interfaces";
import { SkillModal } from "./skilltree_modal";
import { openFileLinkPickerWithCreate } from "./file_link_picker";
import { RemoveNode } from "../data/tree_manager";
import { AddToLinkedNodes, RemoveFromLinkedNodes } from "../handlers/file_watcher";
import { SaveNodes, RecordSnapshot } from "../data/recorder";
import { Update } from "../rendering/renderer";
import { GetCurrentTree } from "../data/tree_manager";

export function buildRepeatingNodeEditRows(_view: SkillTreeView, node: SkillNode, content: HTMLElement): void {
    const minutesRow = content.createEl('div');
    minutesRow.classList.add('skill-tree-form-row');

    const minutesLabel = minutesRow.createEl('label');
    minutesLabel.textContent = 'Cooldown (minutes)';
    minutesLabel.classList.add('skill-tree-form-label');

    const minutesInput = minutesRow.createEl('input') as HTMLInputElement;
    minutesInput.type = 'number';
    minutesInput.min = '0';
    minutesInput.placeholder = '0';
    minutesInput.value = String((node as any).repeatCooldownMinutes || 0);
    minutesInput.classList.add('skill-tree-form-input');

    minutesInput.onchange = () => {
        (node as any).repeatCooldownMinutes = parseInt(minutesInput.value, 10) || 0;
        import("../data/recorder").then(m => m.RecordSnapshot());
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };

    const hoursRow = content.createEl('div');
    hoursRow.classList.add('skill-tree-form-row');

    const hoursLabel = hoursRow.createEl('label');
    hoursLabel.textContent = 'Cooldown (hours)';
    hoursLabel.classList.add('skill-tree-form-label');

    const hoursInput = hoursRow.createEl('input') as HTMLInputElement;
    hoursInput.type = 'number';
    hoursInput.min = '0';
    hoursInput.placeholder = '0';
    hoursInput.value = String((node as any).repeatCooldownHours || 0);
    hoursInput.classList.add('skill-tree-form-input');

    hoursInput.onchange = () => {
        (node as any).repeatCooldownHours = parseInt(hoursInput.value, 10) || 0;
        import("../data/recorder").then(m => m.RecordSnapshot());
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };

    const daysRow = content.createEl('div');
    daysRow.classList.add('skill-tree-form-row');

    const daysLabel = daysRow.createEl('label');
    daysLabel.textContent = 'Cooldown (days)';
    daysLabel.classList.add('skill-tree-form-label');

    const daysInput = daysRow.createEl('input') as HTMLInputElement;
    daysInput.type = 'number';
    daysInput.min = '0';
    daysInput.placeholder = '0';
    daysInput.value = String((node as any).repeatCooldownDays || 0);
    daysInput.classList.add('skill-tree-form-input');

    daysInput.onchange = () => {
        (node as any).repeatCooldownDays = parseInt(daysInput.value, 10) || 0;
        import("../data/recorder").then(m => m.RecordSnapshot());
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };

    const maxRow = content.createEl('div');
    maxRow.classList.add('skill-tree-form-row');

    const maxLabel = maxRow.createEl('label');
    maxLabel.textContent = 'Max completions (optional)';
    maxLabel.classList.add('skill-tree-form-label');

    const maxInput = maxRow.createEl('input') as HTMLInputElement;
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.placeholder = 'Unlimited';
    maxInput.value = (node as any).repeatMax ? String((node as any).repeatMax) : '';
    maxInput.classList.add('skill-tree-form-input');

    maxInput.onchange = () => {
        (node as any).repeatMax = maxInput.value ? parseInt(maxInput.value, 10) : undefined;
        import("../data/recorder").then(m => m.RecordSnapshot());
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };

    const countRow = content.createEl('div');
    countRow.classList.add('skill-tree-form-row');

    const countLabel = countRow.createEl('label');
    countLabel.textContent = `Repeat count: ${(node as any).repeatCount || 0}`;
    countLabel.style.cssText = 'font-size:14px;color:var(--text-muted);';

    const resetRow = content.createEl('div');
    resetRow.classList.add('skill-tree-btn-row');

    const resetBtn = resetRow.createEl('button', { text: 'Reset Repeat' });
    resetBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');
    resetBtn.onclick = () => {
        (node as any).resetRepeatCount();
        import("../data/recorder").then(m => m.RecordSnapshot());
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };
}

export function buildTreeLinkNodeEditRows(view: SkillTreeView, node: SkillNode, content: HTMLElement): void {
    const row = content.createEl('div');
    row.classList.add('skill-tree-form-row');

    const label = row.createEl('label');
    label.textContent = 'Link to tree:';
    label.classList.add('skill-tree-form-label');

    const select = row.createEl('select') as HTMLSelectElement;
    select.classList.add('skill-tree-form-select');

    const currentTreeName = GetCurrentTree();
    const treeNames = Object.keys((view as any).settings?.trees || {})
        .filter(name => name !== currentTreeName);

    for (const name of treeNames) {
        const opt = select.createEl('option');
        opt.value = name;
        opt.textContent = name;
        if (name === (node as any).treeLink) opt.selected = true;
    }

    select.onchange = () => {
        (node as any).treeLink = select.value;
        node.userModified = true;
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };
}

function createEditModalStateRow(content: HTMLElement, node: SkillNode): void {
    const stateRow = content.createEl('div');
    stateRow.classList.add('skill-tree-form-row');

    const stateLabel = stateRow.createEl('label');
    stateLabel.textContent = 'State';
    stateLabel.classList.add('skill-tree-form-label');

    if (!node.userCompletable) return

    if (node.state === 'unavailable') {
        const stateDisplay = stateRow.createEl('div');
        stateDisplay.textContent = 'Unavailable';
        stateDisplay.classList.add('skill-tree-form-state-display');

    } else {
        const stateSelect = stateRow.createEl('select') as HTMLSelectElement;
        stateSelect.classList.add('skill-tree-form-select');

        const states = ['In Progress', 'Complete'];
        for (const s of states) {
            const opt = stateSelect.createEl('option');
            const convertedValue = s.toLowerCase().replace(/\s+(.)/g, (_, c) => c.toUpperCase());
            opt.value = convertedValue;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            if (convertedValue === node.state) opt.selected = true;
        }

        stateSelect.onchange = () => {
            node.state = stateSelect.value as any;
            node.userModified = true;
            node.fromNote = false;
            import("../data/recorder").then(m => m.SaveNodes());
            import("../rendering/renderer").then(m => m.Update());
            import("../ui/json_editor").then(m => m.RefreshJsonEditor());
        };
    }
}

function createEditModalDisplayTextRow(content: HTMLElement, node: SkillNode): void {
    const textRow = content.createEl('div');
    textRow.classList.add('skill-tree-form-row');

    const textLabel = textRow.createEl('label');
    textLabel.textContent = 'Display Text';
    textLabel.classList.add('skill-tree-form-label');

    const textInput = textRow.createEl('input') as HTMLInputElement;
    textInput.type = 'text';
    textInput.value = node.displayText || '';
    textInput.placeholder = 'Leave empty to show file name';
    textInput.classList.add('skill-tree-form-input');

    textInput.oninput = () => {
        const val = textInput.value.trim();
        node.displayText = val || undefined;
        node.userModified = true;
    };

    textInput.onchange = () => {
        import("../data/recorder").then(m => m.SaveNodes());
        import("../rendering/renderer").then(m => m.Update());
    };
}

function createLinkButton(view: SkillTreeView, node: SkillNode, fileRow: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = 'Link';
    button.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');
    button.onclick = () => {
        openFileLinkPickerWithCreate(view.app, node, (path) => {
            node.fileLink = path;
            AddToLinkedNodes(path, node);
            button.remove();
            const unlinkBtn = document.createElement('button');
            unlinkBtn.textContent = 'Unlink';
            unlinkBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');
            unlinkBtn.onclick = () => {
                if (node.fileLink) {
                    RemoveFromLinkedNodes(node.fileLink);
                    node.fileLink = '';
                    SaveNodes();
                    Update();
                    unlinkBtn.remove();
                    fileRow.querySelector(':scope > .skill-tree-btn')?.remove();
                    fileRow.appendChild(button);
                }
            };
            fileRow.appendChild(unlinkBtn);
            SaveNodes();
            Update();
        });
    };
    return button;
}

function createEditModalFileRow(view: SkillTreeView, content: HTMLElement, node: SkillNode): void {
    const fileRow = content.createEl('div');
    fileRow.classList.add('skill-tree-form-row', 'skill-tree-form-row--small');

    const fileLabel = fileRow.createEl('label');
    fileLabel.textContent = 'Link a file to this Node?';
    fileLabel.classList.add('skill-tree-form-label');

    const inputWrapper = fileRow.createEl('div');
    inputWrapper.classList.add('skill-tree-form-input-wrapper', 'skill-tree-form-input-wrapper--centered');

    inputWrapper.appendChild(createLinkButton(view, node, fileRow));
}

export function createEditModal(view: SkillTreeView, node: SkillNode): HTMLElement {
    SkillModal.closeAll();
    const modal = SkillModal.create();
    SkillModal.createContainer(modal, 'Edit Node')
    const content = SkillModal.createContent(modal)

    createEditModalStateRow(content, node);
    createEditModalDisplayTextRow(content, node);

    const editRowBuilder = editModalRowBuilders[node.nodeTypeName];
    if (editRowBuilder) {
        editRowBuilder(view, node, content);
    }

    if (node.linkable && !node.fileLink) {
        createEditModalFileRow(view, content, node);
    }

    const footerButtons: ModalButton[] = [];

    if (node.fileLink) {
        footerButtons.push({
            text: 'Unlink File',
            variant: 'secondary',
            onClick: () => {
                if (node.fileLink) {
                    RemoveFromLinkedNodes(node.fileLink);
                }
                node.fileLink = undefined;
                SaveNodes();
                Update();
            }
        });
    }

    footerButtons.push(
        {
            text: 'Delete Node',
            variant: 'danger',
            onClick: () => {
                RecordSnapshot();
                RemoveNode(node.id);
                SaveNodes();
                Update();
                SkillModal.close(modal);
            }
        },
        {
            text: 'Cancel',
            variant: 'secondary',
            onClick: () => SkillModal.close(modal)
        }
    );

    SkillModal.createFooter(modal, footerButtons);

    SkillModal.makeDraggable(modal, 'edit');

    SkillModal.installOutsideClickHandler();

    return modal;
}

const editModalRowBuilders: Record<string, (view: SkillTreeView, node: SkillNode, content: HTMLElement) => void> = {
    'BaseNode': () => {},
    'SkillNode': () => {},
    'TaskNode': () => {},
    'TreeLinkNode': buildTreeLinkNodeEditRows,
    'OptionalNode': () => {},
    'RepeatingNode': buildRepeatingNodeEditRows,
    'CheckpointNode': () => {},
    'TerminalNode': () => {},
};
