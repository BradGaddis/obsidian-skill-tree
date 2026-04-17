import { Notice, TFile } from "obsidian";
import { validateFrontmatter } from "./utils/frontmatter_validator";
import { Undo, Redo } from "./data/recorder";
import { GetLastIndex, toTitleCase, findTreeByCaseInsensitive } from "./types/utils"
import {
    GetTreeCount,
    DeleteTree,
    UpdateTreeSelector,
    GetCurrentTree,
    SwitchTree,
    AddNode,
    AddNodeWithData,
    GetTreesLinkingToCurrent,
} from "./data/tree_manager"
import { Recenter, Update, screenToWorld, SetupLockedTreeBanner, } from "./rendering/renderer";
import { ShowNewTreeDialog, ShowDeleteTreeDialog } from "./ui/dialog";

import { RecordSnapshot, SaveNodes } from "./data/recorder";
import { RefreshJsonEditor } from "./ui/json_editor";
import { skillTreeEvents, EVENTS } from "./utils/events";
import { NodeSuggestModal, OrphanNodeSuggestModal, TreeSuggestModal } from "./ui/fuzzy_suggest_modal";
import { SkillModal } from "./ui/skilltree_modal";
import { openFileLinkPickerWithCreate } from "./ui/file_link_picker";
import { createEditModal } from "./ui/skilltree_edit_modal";
import { view } from "./utils/globals";


export let modeToggleBtn: HTMLButtonElement
export let editModeOnlyButtons: Array<HTMLElement> = []
export let collapseBtn: HTMLElement
export let toolbar: HTMLElement
export let toolbarWrapper: HTMLElement
export let collapseButtonWrapper: HTMLElement
export let toolbarButtons: HTMLElement
export let nodeJumpBtn: HTMLElement
export let orphanJumpBtn: HTMLElement
let goToLinkedBtn: HTMLElement
let addLinkedTreeBtn: HTMLElement
export let treeSelectorDiv: HTMLElement
export let treeSelect: HTMLSelectElement
export let floatingExpandBtn: HTMLElement
export let toolbarCollapsed: boolean


export function InitToolBar() {
    view.containerEl.empty();
    toolbar = view.containerEl.createEl('div');
    toolbar.addClass('skill-tree-toolbar');
    toolbar.style.display = 'flex'
    toolbar.style.touchAction = 'none';
    SetupCollapseButtonWrapper()
    SetupFloatingExpandBtn()
    SetupCollapseButton()
    SetUpToolBarWrapper()
    SetupToolbarButtons()
    UpdateToolbarUI()
}
function SetupCollapseButtonWrapper(): void {
    const wrapper = toolbar.createEl('div');
    wrapper.addClass('skill-tree-toolbar-wrapper');
    wrapper.style.padding = '4px 16px';
    wrapper.style.display = 'flex';
    wrapper.style.position = 'relative'
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    collapseButtonWrapper = wrapper
}


function SetUpToolBarWrapper(): void {
    toolbarWrapper = toolbar.createEl('div');
    toolbarWrapper.addClass('skill-tree-toolbar-wrapper');
    SetWrapperStyles()
}

function SetWrapperStyles() {
    toolbarWrapper.style.padding = '4px 16px';
    toolbarWrapper.style.display = 'flex';
    toolbarWrapper.style.position = 'relative'
    toolbarWrapper.style.alignItems = 'center';
    toolbarWrapper.style.justifyContent = 'center';
    toolbarWrapper.style.display = toolbarCollapsed ? 'none' : '';
}

function SetupCollapseButton(): void {
    collapseBtn = collapseButtonWrapper.createEl('button');
    collapseBtn.addClass('skill-tree-collapse-btn');
    collapseBtn.textContent = '▼';
    collapseBtn.title = 'Collapse toolbar';
    collapseBtn.style.position = 'absolute';
    collapseBtn.style.left = '8px';
    collapseBtn.style.zIndex = '100';
    collapseBtn.onclick = ToggleToolbar
}

function SetupToolbarButtons(): void {
    const buttons = toolbarWrapper.createEl('div');
    buttons.addClass('skill-tree-toolbar-buttons');
    buttons.style.marginLeft = '16px';
    toolbarButtons = buttons

    SetupModeToggleButton();

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
    SetupTreeSelectorDiv();
    SetupRenameTreeButton()
    SetupDeleteTreeButton();
    SetupGoToLinkedButton(toolbarButtons);

    skillTreeEvents.on(EVENTS.TREE_ADDED, () => {
        updateGoToLinkedBtnVisibility();
        updateAddLinkedTreeBtnVisibility();
    });
    skillTreeEvents.on(EVENTS.TREE_DELETED, () => {
        updateGoToLinkedBtnVisibility();
        updateAddLinkedTreeBtnVisibility();
    });

    SetUpRecenterButton();

    SetupLockedTreeBanner();

    // Initialize to not showing edit mode buttons
    for (let button of editModeOnlyButtons) {
        button.style.display = 'none';
    }
}

function SetupJumpToOrphanButton() {
    orphanJumpBtn = toolbarButtons.createEl('button', { text: 'Find Orphans' });
    orphanJumpBtn.style.marginLeft = '8px';
    orphanJumpBtn.onclick = () => {
        new OrphanNodeSuggestModal(view.app).open();
    };
    updateOrphanJumpBtnVisibility();
}

function updateOrphanJumpBtnVisibility() {
}

function SetupJumpToNodeButton() {
    // Node jump button (opens centered pane with clickable node list)
    nodeJumpBtn = toolbarButtons.createEl('button', { text: 'Jump to Node' });
    nodeJumpBtn.style.marginLeft = '8px';
    nodeJumpBtn.onclick = () => {
        new NodeSuggestModal(view.app).open();
    };
}

function SetupGoToLinkedButton(toolbarButtons: HTMLElement) {
    goToLinkedBtn = toolbarButtons.createEl('button', { text: 'Go to Linked' });
    goToLinkedBtn.style.marginLeft = '6px';
    goToLinkedBtn.title = 'Jump to a tree that links to this one';

    updateGoToLinkedBtnVisibility();

    goToLinkedBtn.onclick = async () => {
        const linkingTrees = GetTreesLinkingToCurrent();

        if (linkingTrees.length === 0) {
            return;
        }

        if (linkingTrees.length === 1) {
            const firstTree = linkingTrees[0];
            if (firstTree !== undefined) {
                await SwitchTree(firstTree);
            }
            return;
        }

        new TreeSuggestModal(view.app, async (treeName) => {
            await SwitchTree(treeName);
            SkillModal.closeAll();
        }, linkingTrees).open();
    };
}

export function UpdateToolbarUI(): void {
    switch (view.settings.mode) {
        case "edit":
            view.settings.mode = "edit"
            modeToggleBtn.textContent = 'Edit Mode';
            break;
        case "view":
            view.settings.mode = "view"
            modeToggleBtn.textContent = 'View Mode';
            break;
        default:
            new Notice("Somehow the toggle broke. Debugging needed...")
            break;
    }

    for (let button of editModeOnlyButtons) {
        button.style.display = view.settings.mode == "edit" ? 'inline-block' : 'none';
    };

    updateGoToLinkedBtnVisibility();
}

function updateGoToLinkedBtnVisibility(): void {
    if (!goToLinkedBtn) return;

    const linkingTrees = GetTreesLinkingToCurrent();
    goToLinkedBtn.style.display = linkingTrees.length > 0 ? '' : 'none';
}

async function SetupAddNodeButton() {
AddEditModeButton('Add Skill', 'A linked skill with a note')
        GetLastIndex(editModeOnlyButtons).onclick = async () => {
            let worldPos = { x: 200, y: 150 };
            if (view.canvas) {
                const rect = view.canvas.getBoundingClientRect();
                worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
            }
            openFileLinkPickerWithCreate(view.app, { id: crypto.randomUUID() }, async (path) => {
                const filePath = path.endsWith('.md') ? path : path + '.md';
                const newNode = AddNode(worldPos.x, worldPos.y, filePath);
                if (newNode) {
                    const file = view.app.vault.getAbstractFileByPath(filePath);
                    if (file && file instanceof TFile) {
                        const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
                        if (fm) {
                            const validated = validateFrontmatter(fm);
                            if (validated.displayText) newNode.displayText = validated.displayText;
                            if (validated.shape) newNode.shape = validated.shape;
                            if (validated.x !== undefined) newNode.x = validated.x;
                            if (validated.y !== undefined) newNode.y = validated.y;
                        }
                    }
                }
                SaveNodes();
                Update();
                RefreshJsonEditor();
            });
        };
}

function SetupAddEmptyButton() {
    AddEditModeButton('Add Empty', 'Add a node with a file link')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
        }
        AddNode(worldPos.x, worldPos.y);
        await SaveNodes();
        Update();
        RefreshJsonEditor();
    };
}

function SetupAddOptionalButton() {
    AddEditModeButton('Add Optional', 'Add an optional path node')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
        }
        AddNode(worldPos.x, worldPos.y, undefined, 'OptionalNode');
        await SaveNodes();
        Update();
        RefreshJsonEditor();
    };
}

function SetupAddCheckpointButton() {
    AddEditModeButton('Add Checkpoint', 'Add a checkpoint node')
    GetLastIndex(editModeOnlyButtons).onclick = async () => {
        RecordSnapshot();
        let worldPos = { x: 200, y: 150 };
        if (view.canvas) {
            const rect = view.canvas.getBoundingClientRect();
            worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
        }
        AddNode(worldPos.x, worldPos.y, undefined, 'CheckpointNode');
        await SaveNodes();
        Update();
        RefreshJsonEditor();
    };
}

function SetupAddSubTreeButton() {
    addLinkedTreeBtn = AddEditModeButton('Add Linked Skill Tree', 'Add a link to another skill tree')

    addLinkedTreeBtn.onclick = async () => {
        const currentTreeName = GetCurrentTree();
        const treeNames = Object.keys(view.settings.trees).filter(t => t !== currentTreeName);

        if (treeNames.length === 0) {
            new Notice('No other trees to link to');
            return;
        }

        const targetTree = treeNames[0];

        if (targetTree === undefined) {
            new Notice('No other trees to link to');
            return;
        }

        if (treeNames.length > 1) {
            new TreeSuggestModal(view.app, async (selectedTree) => {
                SkillModal.closeAll();
                addTreeLinkNode(selectedTree);
            }, treeNames).open();
        } else {
            addTreeLinkNode(targetTree);
        }
    };

    updateAddLinkedTreeBtnVisibility();
}

function addTreeLinkNode(targetTree: string): void {
    RecordSnapshot();
    let worldPos = { x: 200, y: 150 };
    if (view.canvas) {
        const rect = view.canvas.getBoundingClientRect();
        worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
    }
    const newNode = AddNodeWithData(worldPos.x, worldPos.y, undefined, 'TreeLinkNode', { treeLink: targetTree });
    if (newNode) {
        SaveNodes();
        Update();
        createEditModal(view, newNode);
    }
}

function updateAddLinkedTreeBtnVisibility(): void {
    if (!addLinkedTreeBtn) return;
    const treeCount = Object.keys(view.settings.trees).length;
    addLinkedTreeBtn.style.display = treeCount > 0 ? '' : 'none';
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
            worldPos = screenToWorld({ x: centerX, y: centerY });
        }
        const newNode = AddNode(worldPos.x, worldPos.y, undefined, 'RepeatingNode');
        if (newNode) {
            (newNode as any).repeatCooldownHours = 1;
            SaveNodes();
            Update();
            createEditModal(view, newNode);
        }
    };
}

function SetupModeToggleButton(): void {
    const toggleBtn = toolbarButtons.createEl('button', {
        text: 'View Mode',
        cls: 'skill-tree-editmode-toggle'
    });
    // toggleBtn.classList.toggle('active', view.settings.mode == "edit");
    toggleBtn.style.marginRight = '16px';
    toggleBtn.style.fontWeight = '500';
    toggleBtn.style.border = '1px solid var(--text-muted)';
    toggleBtn.style.padding = '4px 12px';
    toggleBtn.style.lineHeight = '1.2';

    modeToggleBtn = toggleBtn

    modeToggleBtn.onclick = async () => {
        switch (view.plugin.settings.mode) {
            case "edit":
                {
                    view.SwitchMode("view");
                    break;
                }
            case "view":
                {
                    view.SwitchMode("edit")
                    break;
                }
            default:
                new Notice("Somehow the toggle broke. Debugging needed...")
                break;
        }
        await view.plugin.saveSettings();
        UpdateToolbarUI();
        Update();
    };
}

function SetupUndoButton() {
    const undoBtn = toolbarButtons.createEl('button', { text: 'Undo' });
    undoBtn.onclick = async () => {
        view.SwitchMode('edit')
        Undo();
    };
}

function SetupRedoButton() {

    const redoBtn = toolbarButtons.createEl('button', { text: 'Redo' });
    redoBtn.onclick = () => {
        view.SwitchMode('edit')
        Redo();
    };
}

function AddEditModeButton(txt: string, title: string): HTMLElement {
    const btn = toolbarButtons.createEl('button', { text: txt });
    btn.title = title;
    btn.style.marginLeft = '6px';
    editModeOnlyButtons.push(btn);
    return btn;
}


function SetupEditAsJSONButton() {
}

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
            Update()
        };
    };
}

function SetupRenameTreeButton() {
    const renameTreeBtn = treeSelectorDiv.createEl('button', { text: '✎' });
    renameTreeBtn.title = 'Rename current tree';
    renameTreeBtn.style.padding = '2px 6px';
    renameTreeBtn.style.marginLeft = '4px';
    renameTreeBtn.onclick = async () => {
        const currentName = view.settings.currentTreeName;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.classList.add('skill-tree-rename-modal-input');

        const container = view.canvasWrap || view.containerEl;
        const modal = container.createEl('div');
        modal.classList.add('skill-tree-rename-modal');
        modal.innerHTML = `<div class="skill-tree-rename-modal-title">Rename Tree</div>`;
        modal.appendChild(input);

        const btnRow = modal.createEl('div');
        btnRow.classList.add('skill-tree-rename-modal-buttons');

        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        cancelBtn.classList.add('skill-tree-rename-modal-btn', 'skill-tree-rename-modal-btn--cancel');
        cancelBtn.onclick = () => modal.remove();

        const saveBtn = btnRow.createEl('button', { text: 'Rename' });
        saveBtn.classList.add('skill-tree-rename-modal-btn', 'skill-tree-rename-modal-btn--save');
        saveBtn.onclick = async () => {
            const newNameRaw = input.value.trim();
            if (newNameRaw && newNameRaw !== currentName) {
                const newName = toTitleCase(newNameRaw);
                const existingMatch = findTreeByCaseInsensitive(newNameRaw, view.settings.trees);
                if (existingMatch) {
                    new Notice(`A tree with that name already exists: "${existingMatch}"`);
                } else {
                    const currentTree = view.settings.trees[currentName];
                    if (!currentTree) {
                        new Notice('Current tree not found');
                        return;
                    }
                    view.settings.trees[newName] = currentTree;
                    view.settings.trees[newName].name = newName;
                    delete view.settings.trees[currentName];
                    view.settings.currentTreeName = newName;
                    await view.plugin.saveSettings();
                    UpdateTreeSelector(treeSelect);
                    treeSelect.value = newName;
                    Update();
                    new Notice(`Tree renamed to "${newName}"`);
                }
            }
            modal.remove();
        };

        input.focus();
        input.select();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') saveBtn.click();
            if (e.key === 'Escape') modal.remove();
        };
    };
}

function SetupTreeSelectorDiv() {
    treeSelectorDiv = toolbarButtons.createEl('div');
    treeSelectorDiv.classList.add('skill-tree-tree-selector-div');
    // const treeSelectLabel = treeSelectorDiv.createEl('label', { text: 'Current Tree:' });
    treeSelect = treeSelectorDiv.createEl('select', { cls: 'skill-tree-toolbar-select' }) as HTMLSelectElement;
    UpdateTreeSelector(treeSelect);

    skillTreeEvents.on(EVENTS.TREE_ADDED, () => UpdateTreeSelector(treeSelect));
    skillTreeEvents.on(EVENTS.TREE_DELETED, () => UpdateTreeSelector(treeSelect));
    skillTreeEvents.on(EVENTS.TREE_SWITCHED, () => UpdateTreeSelector(treeSelect));

    treeSelect.onchange = async () => {
        if (treeSelect.value === '__NEW_TREE__') {
            const newNameRaw = await ShowNewTreeDialog();
            if (newNameRaw && newNameRaw.trim()) {
                const newName = toTitleCase(newNameRaw.trim());
                const existingMatch = findTreeByCaseInsensitive(newNameRaw, view.settings.trees);
                if (existingMatch) {
                    new Notice(`A tree with that name already exists: "${existingMatch}"`);
                } else {
                    await SwitchTree(newName);
                    UpdateTreeSelector(treeSelect);
                }
            } else {
                UpdateTreeSelector(treeSelect);
            }
        } else {
            await SwitchTree(treeSelect.value);
            UpdateTreeSelector(treeSelect);
        }
        Update()
    };

}


function ToggleToolbar(): void {
    toolbarCollapsed = !toolbarCollapsed;
    collapseBtn.style.display = !toolbarCollapsed ? '' : 'none';
    floatingExpandBtn.style.display = toolbarCollapsed ? '' : 'none';
    SetWrapperStyles()
}

function SetupFloatingExpandBtn() {
    floatingExpandBtn = collapseButtonWrapper.createEl('button', {
        text: '▶',
        cls: 'skill-tree-floating-expand-btn'
    });
    floatingExpandBtn.title = 'Expand toolbar';
    floatingExpandBtn.style.display = 'none';
    floatingExpandBtn.style.position = 'absolute';
    floatingExpandBtn.style.left = '8px';
    floatingExpandBtn.style.zIndex = '100';
    floatingExpandBtn.onclick = ToggleToolbar
}

function SetUpRecenterButton() {
    const recenterBtn = toolbarButtons.createEl('button', { text: 'Recenter' });
    recenterBtn.style.marginLeft = '8px';

    recenterBtn.onclick = () => Recenter();
}
