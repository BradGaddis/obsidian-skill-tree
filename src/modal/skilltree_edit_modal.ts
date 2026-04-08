import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "src/skill_nodes/skill_node";
import { createSkillModal, openSkillModal, makeModalDraggable, closeSkillModal, installOutsideClickHandler, createModalFooter, ModalButton, closeAllModals } from "./skilltree_modal";
import { fuzzyMatch, getVaultFiles } from "../dialog/fuzzy_search";
import { GetNodes, RemoveNode, OnNodeFileChanged } from "../tree_manager";
import { SaveNodes, RecordSnapshot } from "../recorder";
import { Render } from "../renderer";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import * as S from "../styles";

function handleRelinkClick(
    view: SkillTreeView,
    node: SkillNode,
    relinkBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
    warning: HTMLElement
): void {
    relinkBtn.onclick = async () => {
        const path = fileInput.value.trim();
        if (!path) return;

        RecordSnapshot();

        const oldFileLink = node.fileLink;
        node.fileLink = path;
        OnNodeFileChanged(node);

        if (oldFileLink) {
            const oldPath = oldFileLink.endsWith('.md') ? oldFileLink : oldFileLink + '.md';
            view._lastKnownNodeIds.delete(oldPath);
        }

        const normalizedPath = path.endsWith('.md') ? path : path + '.md';
        view._lastKnownNodeIds.set(normalizedPath, node.id);

        try {
            let np = path.trim();
            if (np.startsWith('/')) np = np.substring(1);
            if (!np.endsWith('.md')) np = np + '.md';

            const file = view.app.vault.getAbstractFileByPath(np) as any;
            if (file) {
                const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
                const validated = validateFrontmatter(fm);

                if (validated.skilltreeNode !== null) {
                    node.id = validated.skilltreeNode as any;
                    view._lastKnownNodeIds.set(np, node.id);
                }

                await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
                    frontmatter['skilltree-node'] = node.id;
                    frontmatter['skilltree-node-exp'] = node.exp ?? 10;
                });
            }

            await SaveNodes();
            Render();
            await view.app.workspace.openLinkText(path, '', false);
        } catch (err) {
            console.error('Failed to relink:', err);
            warning.style.display = 'block';
            warning.textContent = `Failed to relink: ${err.message}`;
            warning.style.color = 'var(--text-error)';
        }
    };
}

function getSuggestions(view: SkillTreeView, query: string): string[] {
    const files = getVaultFiles(view.app);
    return fuzzyMatch(files, query, 8).map(r => r.item);
}

function highlightSuggestion(suggestions: HTMLElement, index: number): number {
    const items = suggestions.querySelectorAll('div');
    items.forEach((item, i) => {
        (item as HTMLElement).style.background = i === index ? 'var(--background-modifier-hover)' : '';
    });
    if (index >= 0 && items[index]) {
        (items[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
    return index;
}

function showSuggestions(
    suggestions: HTMLElement,
    fileInput: HTMLInputElement,
    node: SkillNode,
    view: SkillTreeView,
    getMatches: (query: string) => string[]
): void {
    const matches = getMatches(fileInput.value.trim());
    suggestions.innerHTML = '';

    if (matches.length === 0) {
        suggestions.style.display = 'none';
        return;
    }

    suggestions.style.display = 'block';
    for (const match of matches) {
        const item = suggestions.createEl('div');
        item.style.cssText = S.SUGGESTION_ITEM;
        item.textContent = match;

        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.value = match.replace(/\.md$/, '');
            suggestions.style.display = 'none';
            node.fileLink = match.replace(/\.md$/, '');
            OnNodeFileChanged(node);
            import("src/recorder").then(m => m.SaveNodes());
            import("src/renderer").then(m => m.Render());
        });
    }
}

function createEditModalStateRow(content: HTMLElement, node: SkillNode): void {
    const stateRow = content.createEl('div');
    stateRow.style.cssText = S.FORM_ROW;

    const stateLabel = stateRow.createEl('label');
    stateLabel.textContent = 'State';
    stateLabel.style.cssText = S.FORM_LABEL;

    if (node.state === 'unavailable') {
        const stateDisplay = stateRow.createEl('div');
        stateDisplay.textContent = 'Unavailable';
        stateDisplay.style.cssText = S.FORM_STATE_DISPLAY;
    } else {
        const stateSelect = stateRow.createEl('select') as HTMLSelectElement;
        stateSelect.style.cssText = S.FORM_SELECT;

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
            import("src/recorder").then(m => m.SaveNodes());
            import("src/renderer").then(m => m.Render());
            import("src/dialog/json_editor").then(m => m.RefreshJsonEditor());
        };
    }
}

function createEditModalDisplayTextRow(content: HTMLElement, node: SkillNode): void {
    const textRow = content.createEl('div');
    textRow.style.cssText = S.FORM_ROW;

    const textLabel = textRow.createEl('label');
    textLabel.textContent = 'Display Text';
    textLabel.style.cssText = S.FORM_LABEL;

    const textInput = textRow.createEl('input') as HTMLInputElement;
    textInput.type = 'text';
    textInput.value = node.displayText || '';
    textInput.placeholder = 'Leave empty to show file name';
    textInput.style.cssText = S.FORM_INPUT;

    textInput.oninput = () => {
        const val = textInput.value.trim();
        node.displayText = val || undefined;
        node.userModified = true;
    };

    textInput.onchange = () => {
        import("src/recorder").then(m => m.SaveNodes());
        import("src/renderer").then(m => m.Render());
    };
}

function createEditModalFileRow(view: SkillTreeView, content: HTMLElement, node: SkillNode): void {
    const fileRow = content.createEl('div');
    fileRow.style.cssText = S.FORM_ROW_SMALL;

    const fileLabel = fileRow.createEl('label');
    fileLabel.textContent = 'File Link';
    fileLabel.style.cssText = S.FORM_LABEL;

    const inputWrapper = fileRow.createEl('div');
    inputWrapper.style.cssText = S.FORM_INPUT_WRAPPER;

    const fileInput = inputWrapper.createEl('input') as HTMLInputElement;
    fileInput.type = 'text';
    fileInput.value = node.fileLink || '';
    fileInput.placeholder = 'e.g., Notes/MyNote.md';
    fileInput.style.cssText = S.FORM_INPUT;

    const suggestions = inputWrapper.createEl('div');
    suggestions.style.cssText = S.SUGGESTIONS_LIST;

    let selectedSuggestionIndex = -1;

    const warning = fileRow.createEl('div');
    warning.style.cssText = S.WARNING_BOX;

    const btnRow = fileRow.createEl('div');
    btnRow.style.cssText = S.BTN_ROW;

    const createBtn = btnRow.createEl('button', { text: 'Create New' });
    createBtn.style.cssText = S.BTN_PRIMARY_SMALL;
    createBtn.style.display = 'none';

    const relinkBtn = btnRow.createEl('button', { text: 'Relink' });
    relinkBtn.style.cssText = S.BTN_PRIMARY_SMALL_MR;
    relinkBtn.style.display = 'none';

    const getMatches = (q: string) => getSuggestions(view, q);

    fileInput.addEventListener('input', () => {
        const query = fileInput.value.trim();
        if (query.length > 0) {
            showSuggestions(suggestions, fileInput, node, view, getMatches);
        } else {
            suggestions.style.display = 'none';
        }
        checkFileExists();
    });

    fileInput.addEventListener('focus', () => {
        const query = fileInput.value.trim();
        if (query.length > 0) {
            showSuggestions(suggestions, fileInput, node, view, getMatches);
        }
    });

    fileInput.addEventListener('blur', () => {
        setTimeout(() => { suggestions.style.display = 'none'; }, 150);
    });

    fileInput.addEventListener('keydown', (e) => {
        const items = suggestions.querySelectorAll('div');
        const itemCount = items.length;
        if (suggestions.style.display === 'none' || itemCount === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = highlightSuggestion(suggestions, selectedSuggestionIndex < itemCount - 1 ? selectedSuggestionIndex + 1 : 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = highlightSuggestion(suggestions, selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : itemCount - 1);
        } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
            e.preventDefault();
            const selectedItem = items[selectedSuggestionIndex] as HTMLElement;
            selectedItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        } else if (e.key === 'Escape') {
            suggestions.style.display = 'none';
            selectedSuggestionIndex = -1;
        }
    });

    const checkFileExists = async () => {
        const path = fileInput.value.trim();
        if (!path) { warning.style.display = 'none'; createBtn.style.display = 'none'; relinkBtn.style.display = 'none'; return; }

        let normalizedPath = path;
        if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';

        const nodes = GetNodes();
        let linkedToOtherNode = false;
        for (const [id, n] of nodes) {
            if (id === node.id) continue;
            const nFileLink = n.fileLink || '';
            const nNormalized = nFileLink.endsWith('.md') ? nFileLink : nFileLink + '.md';
            if (nNormalized === normalizedPath) {
                linkedToOtherNode = true;
                break;
            }
        }

        if (linkedToOtherNode) {
            warning.style.display = 'block';
            warning.textContent = 'This file is already linked to another node in this tree';
            warning.style.color = 'var(--text-error)';
            createBtn.style.display = 'none';
            relinkBtn.style.display = 'none';
            return;
        }

        const file = view.app.vault.getAbstractFileByPath(normalizedPath);
        if (!file) {
            warning.style.display = 'block';
            warning.textContent = 'File does not exist';
            warning.style.color = 'var(--text-warning)';
            createBtn.style.display = 'inline-block';
            relinkBtn.style.display = 'none';
        } else {
            const fm = view.app.metadataCache.getFileCache(file as any)?.frontmatter;
            const validated = validateFrontmatter(fm);
            const hasExistingNodeId = validated.skilltreeNode !== null;

            const currentPathWithExt = normalizedPath;
            const existingNodeId = view._lastKnownNodeIds.get(currentPathWithExt);
            const isLinkedToThisNode = node.fileLink && node.fileLink.replace('.md', '') === path.replace('.md', '');

            if (hasExistingNodeId && !isLinkedToThisNode) {
                warning.style.display = 'block';
                warning.textContent = `File is already linked to node: ${validated.skilltreeNode}`;
                warning.style.color = 'var(--text-warning)';
                createBtn.style.display = 'none';
                relinkBtn.style.display = 'inline-block';
                relinkBtn.textContent = 'Relink';
            } else {
                warning.style.display = 'none';
                createBtn.style.display = 'none';
                relinkBtn.style.display = hasExistingNodeId ? 'inline-block' : 'none';
                if (hasExistingNodeId) {
                    relinkBtn.textContent = `Relink (node ${validated.skilltreeNode})`;
                } else {
                    relinkBtn.textContent = 'Relink';
                }
            }
        }
    };

    createBtn.onclick = async () => {
        let path = fileInput.value.trim();
        if (!path) return;

        if (!path.endsWith('.md')) path = path + '.md';

        const existing = view.app.vault.getAbstractFileByPath(path);
        if (existing) {
            node.fileLink = path.replace('.md', '');
            OnNodeFileChanged(node);
            import("src/recorder").then(m => m.SaveNodes());
            import("src/renderer").then(m => m.Render());
            return;
        }

        const initialContent = `---\nskilltree-node: ${node.id}\nskilltree-node-exp: 10\nskilltree-node-desc: "No description"\n---\n\n`;

        try {
            await view.app.vault.create(path, initialContent);
            node.fileLink = path.replace('.md', '');
            OnNodeFileChanged(node);
            import("src/recorder").then(m => m.SaveNodes());
            import("src/renderer").then(m => m.Render());
            warning.style.display = 'none';
            createBtn.style.display = 'none';
        } catch (err) {
            warning.style.display = 'block';
            warning.textContent = `Failed to create file: ${err.message}`;
            warning.style.color = 'var(--text-error)';
        }
    };

    handleRelinkClick(view, node, relinkBtn, fileInput, warning);

    fileInput.addEventListener('change', () => {
        node.fileLink = fileInput.value.trim() || undefined;
        OnNodeFileChanged(node);
        import("src/recorder").then(m => m.SaveNodes());
        import("src/renderer").then(m => m.Render());
    });
}

export function createEditModal(view: SkillTreeView, node: SkillNode): HTMLElement {
    closeAllModals();
    const modal = createSkillModal();

    const container = view.canvasWrap || view.containerEl;
    modal.style.cssText = S.MODAL_CONTAINER;

    const rect = container.getBoundingClientRect();
    const left = (rect.width / 2) - 170;
    const top = (rect.height / 2) - 150;
    modal.style.left = `${Math.max(20, left)}px`;
    modal.style.top = `${Math.max(20, top)}px`;

    const header = modal.createEl('div');
    header.style.cssText = S.MODAL_HEADER;

    const title = header.createEl('span', { text: 'Edit Node' });
    title.style.cssText = S.MODAL_TITLE;

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = S.MODAL_CLOSE_BTN;
    closeBtn.onclick = () => closeSkillModal(view, modal);

    const content = modal.createEl('div');
    content.style.cssText = S.MODAL_CONTENT;

    createEditModalStateRow(content, node);
    createEditModalDisplayTextRow(content, node);

    if (node.getEditModalRows) {
        node.getEditModalRows(view, content);
    }

    if (!node.repeating) {
        createEditModalFileRow(view, content, node);
    }

    const footerButtons: ModalButton[] = [
        {
            text: 'Delete Node',
            variant: 'danger',
            onClick: () => {
                RecordSnapshot();
                RemoveNode(node.id);
                SaveNodes();
                Render();
                closeSkillModal(view, modal);
            }
        },
        {
            text: 'Cancel',
            variant: 'secondary',
            onClick: () => closeSkillModal(view, modal)
        }
    ];
    createModalFooter(modal, footerButtons);

    openSkillModal(modal)
    makeModalDraggable(view, modal, 'edit');

    installOutsideClickHandler(modal);

    return modal;
}
