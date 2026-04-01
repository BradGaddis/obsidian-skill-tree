import { editorEditorField, Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview"
import { Undo, Redo } from "./recorder";
import {
    TOOLBAR_DOM_EL_INFO,
    TOOL_BAR_WRAPPER_DOM_EL_INFO,
    TOOLBAR_BUTTON_DOM_EL_INFO,
    COLLAPSE_DOM_EL_INFO
} from "./constants";
import { GetLastIndex, TestIsMobile } from "./utils"
import {
    GetTreeCount,
    DeleteTree,
    UpdateTreeSelector,
    GetCurrentTree,
    GetTreesLinkingToCurrent,
    SwitchTree,
    CreateTree,
} from "./tree-manager"
import { RequestRender } from "./renderer";
import { ShowNewTreeDialog, ShowDeleteTreeDialog, OpenAddNodeDialog, OpenAddRepeatingNodeDialog } from "./dialog";
import { RecordSnapshot, SaveNodes } from "./recorder";
import { OpenJsonEditor as OpenJSONEditor, RefreshJsonEditor as RefreshJSONEditor } from "./json_editor";
import { openNodeListModal as OpenNodeListModal, OpenOrphanedNodeListPane as OpenOrphanedNodeListModal } from "./modal";

// TODO bulletproof these later
let view: SkillTreeView
let isMobile: boolean
let toolBarElements: Record<string, HTMLElement> = {}
let editModeOnlyButtons: Array<HTMLElement> = []
let toolbar: HTMLElement
let toolbarWrapper: HTMLElement
let toolbarButtons: HTMLElement
let modeToggleBtn: HTMLButtonElement
let goToLinkedBtn: HTMLElement
let nodeJumpBtn: HTMLElement
let orphanJumpBtn: HTMLElement
let treeSelectorDiv: HTMLElement
let treeSelect: HTMLSelectElement


export function InitToolBar(skillTreeView: SkillTreeView) {
    view = skillTreeView
    view.containerEl.empty();
    isMobile = TestIsMobile(); //currently not used for anything. just here for later
    toolbar = view.containerEl.createEl('div', TOOLBAR_DOM_EL_INFO);
    toolbar.style.marginTop = isMobile ? '60px' : '0px';
    SetUpToolBarWrapper()
    SetupCollapseButton()
    SetupToolbarButtons()
}




function SetUpToolBarWrapper(): void {
    // Wrapper div for buttons and collapse
    const wrapper = toolbar.createEl('div', TOOL_BAR_WRAPPER_DOM_EL_INFO);
    wrapper.style.padding = '4px 16px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    toolbarWrapper = wrapper

}

function SetupCollapseButton(): void {
    const collapseBtn = toolbarWrapper.createEl('button', COLLAPSE_DOM_EL_INFO);
    collapseBtn.title = 'Collapse toolbar';
    collapseBtn.style.marginRight = '16px';
    if (isMobile) {
        collapseBtn.style.marginTop = '60px';
    }
    toolBarElements["collapseBtn"] = collapseBtn
}

function SetupToolbarButtons(): void {
    const buttons = toolbarWrapper.createEl('div', TOOLBAR_BUTTON_DOM_EL_INFO)
    buttons.style.marginLeft = '16px';
    toolbarButtons = buttons

    SetupModeToggleButton();

    // TODO add wrapper for these two buttons after I get the thing working
    SetupUndoButton();
    SetupRedoButton();

    SetupAddNodeButton();
    SetupAddEmptyButton();
    SetupAddOptionalButton();
    SetupAddCheckpointButton();
    SetupAddSubTreeButton();
    SetupAddRepeatingButton();
    SetupEditAsJSONButton();

    SetupJumpToNodeButton();
    SetupJumpToOrphanButton();
    // SetupTreeSelectorDiv();
    // SetupRenameTreeButton()
    // SetupDeleteTreeButton();
    // SetUpGoToLinkedBtn();

    // Initialize to not showing edit mode buttons
    for (let button of editModeOnlyButtons) {
        button.style.display = 'none';
    }
}

function SetupJumpToOrphanButton() {
    orphanJumpBtn = toolbarButtons.createEl('button', { text: 'Find Orphans' });
    orphanJumpBtn.style.marginLeft = '8px';
    orphanJumpBtn.onclick = () => {
        OpenOrphanedNodeListModal();
    };
    updateOrphanJumpBtnVisibility();
}

function updateOrphanJumpBtnVisibility() {
    console.log('TODO')
}

function SetupJumpToNodeButton() {
    // Node jump button (opens centered pane with clickable node list)
    nodeJumpBtn = toolbarButtons.createEl('button', { text: 'Jump to Node' });
    nodeJumpBtn.style.marginLeft = '8px';
    nodeJumpBtn.onclick = () => {
        OpenNodeListModal();
    };
}

async function SetupAddNodeButton() {
    AddEditModeButton('Add Node', 'Add a node with a file link')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        OpenAddNodeDialog();
    };
}

function SetupAddEmptyButton() {
    AddEditModeButton('Add Empty', 'Add a node with a file link')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const worldPos = view.screenToWorld(centerX, centerY);
            // TODO Refactor into Graph or something?
            view.addNodeAt(worldPos.x, worldPos.y);
        } else {
            view.addNodeAt(200, 150);
        }
        await SaveNodes();
        RequestRender();
        RefreshJSONEditor();
    };

}

function SetupAddOptionalButton() {
    AddEditModeButton('Add Optional', 'Add an optional path node')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            worldPos = view.screenToWorld(centerX, centerY);
        }
        view.addNodeAt(worldPos.x, worldPos.y, { nodeType: 'OptionalNode', optional: true, state: 'in-progress', exp: 0 });
        await SaveNodes();
        RequestRender();
        RefreshJSONEditor();
    };
}

function SetupAddCheckpointButton() {
    AddEditModeButton('Add Checkpoint', 'Add a checkpoint node')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            worldPos = view.screenToWorld(centerX, centerY);
        }
        view.addNodeAt(worldPos.x, worldPos.y, { nodeType: 'CheckpointNode', checkpoint: true, shape: 'diamond', exp: 0 });
        await SaveNodes();
        RequestRender();
        RefreshJSONEditor();
    };
}

function SetupAddSubTreeButton() {
    AddEditModeButton('Add Sub Tree(Tree Link)', 'Add a link to another skill tree')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        console.log("TODO")
        // view.openAddTreeLinkModal();
    };
}

function SetupAddRepeatingButton() {
    AddEditModeButton('Add Repeating', 'Add a repeating node that can be completed multiple times')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            worldPos = view.screenToWorld(centerX, centerY);
        }
        OpenAddRepeatingNodeDialog(worldPos.x, worldPos.y);
    };
}

function SetupModeToggleButton(): void {
    const toggleBtn = toolbarButtons.createEl('button', {
        text: view.plugin.editMode ? 'Edit Mode' : 'View Mode',
        cls: 'skill-tree-editmode-toggle'
    });
    toggleBtn.classList.toggle('active', view.plugin.editMode);
    toggleBtn.style.marginRight = '16px';
    toggleBtn.style.fontWeight = '500';
    toggleBtn.style.border = '1px solid var(--text-muted)';
    toggleBtn.style.padding = '4px 12px';
    toggleBtn.style.lineHeight = '1.2';

    modeToggleBtn = toggleBtn
    modeToggleBtn.onclick = async () => {
        view.plugin.editMode = !view.plugin.editMode;
        view.plugin.settings.editMode = view.plugin.editMode;
        await view.plugin.saveSettings();
        UpdateEditModeUI(view.plugin.editMode);
        new Notice(view.plugin.editMode ? "Switched to Edit mode" : "Switched to View mode");
        RequestRender();
    };
}

function SetupUndoButton() {

    const undoBtn = toolbarButtons.createEl('button', { text: 'Undo' });
    undoBtn.onclick = () => {
        if (!view.plugin.editMode) {
            view.plugin.editMode = true;
            view.plugin.settings.editMode = true;
            UpdateEditModeUI(true);
            new Notice("Switched to Edit mode");
        }
        Undo();
    };
}

function SetupRedoButton() {

    const redoBtn = toolbarButtons.createEl('button', { text: 'Redo' });
    redoBtn.onclick = () => {
        if (!view.plugin.editMode) {
            view.plugin.editMode = true;
            view.plugin.settings.editMode = true;
            UpdateEditModeUI(true);
            new Notice("Switched to Edit mode");
        }
        Redo();
    };
}

function AddEditModeButton(txt: string, title: string): void {
    const btn = toolbarButtons.createEl('button', { text: txt });
    btn.title = title;
    btn.style.marginLeft = '6px';
    editModeOnlyButtons.push(btn);
}


function SetupEditAsJSONButton() {
    AddEditModeButton('Edit as JSON', 'Edit nodes as JSON')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        OpenJSONEditor();
    };
}

// TODO refactor
async function SetupDeleteTreeButton() {
    AddEditModeButton('Delete Tree', 'Delete Current Tree')
    GetLastIndex(editModeOnlyButtons).style.color = '#dc3545';
    GetLastIndex(editModeOnlyButtons).onclick = async () => {

        const currentTree = GetCurrentTree()
        const treeCount = GetTreeCount()

        if (treeCount <= 1) {
            new Notice('Cannot delete the only remaining tree');
            return;
        }

        const confirmDelete = await ShowDeleteTreeDialog(currentTree);
        if (confirmDelete) {
            await DeleteTree(currentTree);
            UpdateTreeSelector(treeSelect);
            RequestRender()
        };
    };
}

function SetupRenameTreeButton() {
    // const renameTreeBtn = treeSelectorDiv.createEl('button', { text: '✎' });
    // renameTreeBtn.title = 'Rename current tree';
    // renameTreeBtn.style.padding = '2px 6px';
    // renameTreeBtn.style.marginLeft = '4px';
    // renameTreeBtn.onclick = async () => {
    //     const currentName = this.settings.currentTreeName;
    //     const newName = await this.showRenameTreeDialog(currentName);
    //     if (newName && newName.trim() && newName.trim() !== currentName) {
    //         const trimmed = newName.trim();
    //         if (this.settings.trees[trimmed]) {
    //             new Notice('A tree with that name already exists');
    //         } else {
    //             // Rename the tree
    //             this.settings.trees[trimmed] = this.settings.trees[currentName];
    //             this.settings.trees[trimmed].name = trimmed;
    //             delete this.settings.trees[currentName];
    //             this.settings.currentTreeName = trimmed;
    //             await this.plugin.saveSettings();
    //             this.updateTreeSelector(treeSelect);
    //             this.requestRender();
    //             new Notice(`Tree renamed to "${trimmed}"`);
    //         }
    //     }
    // };
}

function SetupTreeSelectorDiv() {
    treeSelectorDiv = toolbarButtons.createEl('div');
    treeSelectorDiv.style.display = 'inline-flex';
    treeSelectorDiv.style.alignItems = 'center';
    treeSelectorDiv.style.gap = '4px';
    treeSelectorDiv.style.marginLeft = '8px';
    const treeSelectLabel = treeSelectorDiv.createEl('label', { text: 'Current Tree:' });
    treeSelect = treeSelectorDiv.createEl('select', { cls: 'skill-tree-toolbar-select' }) as HTMLSelectElement;
    treeSelect.style.padding = '4px';
    UpdateTreeSelector(treeSelect);
    treeSelect.onchange = async () => {
        if (treeSelect.value === '__NEW_TREE__') {
            const newName = await ShowNewTreeDialog();
            if (newName && newName.trim()) {
                const trimmedName = newName.trim();
                if (view.settings.trees[trimmedName]) {
                    new Notice('A tree with that name already exists');
                } else {
                    await CreateTree(trimmedName);
                    await SwitchTree(trimmedName);
                    UpdateTreeSelector(treeSelect);
                    RequestRender();
                }
            } else {
                UpdateTreeSelector(treeSelect);
            }
        } else {
            await SwitchTree(treeSelect.value);
            UpdateTreeSelector(treeSelect);
            RequestRender();
        }
    };

}

function SetUpGoToLinkedBtn() {
    goToLinkedBtn = toolbarButtons.createEl('button', { text: 'Go to Linked' });
    goToLinkedBtn.style.marginLeft = '6px';
    goToLinkedBtn.title = 'Jump to a tree that links to view one';

    goToLinkedBtn.onclick = () => {
        const linkingTrees = GetTreesLinkingToCurrent();

        if (linkingTrees.length === 0) {
            new Notice('No trees link to view tree');
            return;
        }

        if (linkingTrees.length === 1) {
            SwitchTree(linkingTrees[0]);
            return;
        }

        const container = view.canvasWrap || view.containerEl;
        if (!container) return;

        view.closeAllModals();

        const dropdown = container.createEl('div');
        dropdown.className = 'skill-tree-dropdown';
        dropdown.style.cssText = `
        position: fixed;
        z-index: 10000;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 8px 0;
        min-width: 180px;
      `;

        const rect = view._goToLinkedBtn!.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + 4}px`;

        linkingTrees.forEach(treeName => {
            const item = dropdown.createEl('div');
            item.style.cssText = 'padding: 8px 16px; cursor: pointer; font-size: 14px;';
            item.textContent = treeName;
            item.onmouseenter = () => {
                item.style.background = 'var(--background-modifier-hover)';
            };
            item.onmouseleave = () => {
                item.style.background = '';
            };
            item.onclick = async () => {
                dropdown.remove();
                view.removeOutsideClickHandler();
                await view.plugin.switchTree(treeName);
                view.plugin.activateView();
            };
        });

        const outsideHandler = (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && e.target !== view._goToLinkedBtn) {
                dropdown.remove();
                document.removeEventListener('click', outsideHandler);
                view.removeOutsideClickHandler();
            }
        };
        setTimeout(() => document.addEventListener('click', outsideHandler), 10);
    };

    updateGoToLinkedBtnVisibility()
}

// Function to update toolbar button visibility/states based on edit mode
export function UpdateEditModeUI(enabled: boolean): void {
    for (let button of editModeOnlyButtons) {
        button.style.display = enabled ? 'inline-block' : 'none';
    };
}

// TODO rename to better name when understanding wtf it was used for
export function updateGoToLinkedBtnVisibility(): void {
    if (!goToLinkedBtn) return;

    const linkingTrees = GetTreesLinkingToCurrent();
    goToLinkedBtn.style.display = linkingTrees.length > 0 ? '' : 'none';
}



