import { SkillTreeView } from "../skilltreeview";
import { fuzzyMatch, getVaultFiles } from "./fuzzy_search";
import { GetNodes, AddNode } from "../tree_manager";
import { SaveNodes, RecordSnapshot } from "../recorder";
import { Render, screenToWorld } from "../renderer";
import * as S from "../styles";

export function createAddNodeModal(container: HTMLElement): HTMLElement {
    const modal = container.createEl('div', { cls: 'skill-tree-node-modal' });
    modal.style.cssText = S.MODAL_CONTAINER_LARGE;

    const rect = container.getBoundingClientRect();
    const left = (rect.width / 2) - 200;
    const top = (rect.height / 2) - 100;
    modal.style.left = `${Math.max(20, left)}px`;
    modal.style.top = `${Math.max(20, top)}px`;

    return modal;
}

export function createAddNodeHeader(modal: HTMLElement): HTMLElement {
    const header = modal.createEl('div');
    header.style.cssText = S.MODAL_HEADER_NOGRAB;

    const title = header.createEl('span', { text: 'Add Node' });
    title.style.cssText = S.MODAL_TITLE;

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = S.MODAL_CLOSE_BTN;

    return header;
}

export interface AddNodeContentElements {
    input: HTMLInputElement;
    suggestions: HTMLElement;
    warning: HTMLElement;
    cancelBtn: HTMLButtonElement;
    createBtn: HTMLButtonElement;
}

export function createAddNodeContent(modal: HTMLElement): AddNodeContentElements {
    const content = modal.createEl('div');
    content.style.cssText = S.MODAL_CONTENT_PADDING;

    const inputWrapper = content.createEl('div');
    inputWrapper.style.cssText = S.FORM_INPUT_WRAPPER;

    const input = inputWrapper.createEl('input', { attr: { type: 'text', placeholder: 'Search or create file...', autocomplete: 'off' } }) as HTMLInputElement;
    input.style.cssText = S.FORM_INPUT_LARGE;
    input.focus();

    const suggestions = inputWrapper.createEl('div');
    suggestions.style.cssText = S.SUGGESTIONS_LIST_LARGE;

    const warning = content.createEl('div');
    warning.style.cssText = S.WARNING_BOX_LARGE;

    const actions = content.createEl('div');
    actions.style.cssText = S.BTN_ROW_LARGE;

    const cancelBtn = actions.createEl('button', { text: 'Cancel' }) as HTMLButtonElement;
    cancelBtn.style.cssText = S.BTN_SECONDARY;

    const createBtn = actions.createEl('button', { text: 'Create' }) as HTMLButtonElement;
    createBtn.style.cssText = S.BTN_PRIMARY;

    return { input, suggestions, warning, cancelBtn, createBtn };
}

export function isFileAlreadyNode(path: string): boolean {
    for (const node of GetNodes().values()) {
        if (node.fileLink === path) {
            return true;
        }
    }
    return false;
}

export function updateWarningState(
    input: HTMLInputElement,
    warning: HTMLElement,
    createBtn: HTMLButtonElement,
    view: SkillTreeView,
    setSelectedPath: (path: string | null) => void
): void {
    const query = input.value.trim();
    
    if (!query) {
        warning.style.display = 'none';
        createBtn.disabled = true;
        createBtn.textContent = 'Create';
        setSelectedPath(null);
        return;
    }

    let normalizedPath = query;
    if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';

    if (isFileAlreadyNode(normalizedPath)) {
        warning.style.display = 'block';
        warning.style.background = 'rgba(220,53,69,0.15)';
        warning.style.borderColor = 'rgba(220,53,69,0.4)';
        warning.style.color = 'var(--text-error)';
        warning.textContent = `"${query}" is already linked to a node.`;
        createBtn.disabled = true;
        createBtn.textContent = 'Add';
        setSelectedPath(null);
        return;
    }

    const fileExists = view.app.vault.getAbstractFileByPath(normalizedPath) !== null;
    
    if (fileExists) {
        warning.style.display = 'none';
        createBtn.textContent = 'Add Existing';
        createBtn.disabled = false;
        setSelectedPath(normalizedPath);
    } else {
        warning.style.display = 'block';
        warning.style.background = 'rgba(255,193,7,0.15)';
        warning.style.borderColor = 'rgba(255,193,7,0.4)';
        warning.style.color = 'var(--text-warning)';
        warning.innerHTML = `<strong>Note:</strong> "${query}" will be created when you continue.`;
        createBtn.textContent = 'Create New';
        createBtn.disabled = false;
        setSelectedPath(normalizedPath);
    }
}

export function renderSuggestions(
    suggestions: HTMLElement,
    files: string[],
    query: string,
    onSelect: (path: string) => void
): number {
    const matches = fuzzyMatch(files, query);
    suggestions.innerHTML = '';

    if (matches.length === 0) {
        suggestions.style.display = 'none';
        return -1;
    }

    suggestions.style.display = 'block';
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const item = suggestions.createEl('div');
        item.style.cssText = S.SUGGESTION_ITEM_LARGE;
        item.textContent = match.item;
        item.dataset.index = String(i);

        if (i === 0) {
            item.style.background = 'var(--background-modifier-hover)';
        }

        item.onmouseenter = () => {
            const items = suggestions.querySelectorAll('div');
            items.forEach((el: Element) => (el as HTMLElement).style.background = '');
            item.style.background = 'var(--background-modifier-hover)';
        };

        item.onmouseleave = () => {
            item.style.background = '';
        };

        item.onclick = () => {
            onSelect(match.item);
        };
    }

    return matches.length > 0 ? 0 : -1;
}

export function handleSuggestionKeydown(
    e: KeyboardEvent,
    suggestions: HTMLElement,
    input: HTMLInputElement,
    files: string[],
    onSelect: (path: string) => void,
    onClose: () => void
): boolean {
    const items = suggestions.querySelectorAll('div');
    const itemCount = items.length;
    
    if (suggestions.style.display === 'none' || itemCount === 0) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const matches = fuzzyMatch(files, input.value.trim());
            if (matches.length > 0) {
                renderSuggestions(suggestions, files, input.value.trim(), onSelect);
                return true;
            }
        }
        return false;
    }

    let selectedIndex = -1;
    const currentItems = suggestions.querySelectorAll('div');
    for (let i = 0; i < currentItems.length; i++) {
        if ((currentItems[i] as HTMLElement).style.background === 'var(--background-modifier-hover)') {
            selectedIndex = i;
            break;
        }
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = selectedIndex < itemCount - 1 ? selectedIndex + 1 : 0;
        highlightSuggestion(currentItems, newIndex);
        return true;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : itemCount - 1;
        highlightSuggestion(currentItems, newIndex);
        return true;
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        (currentItems[selectedIndex] as HTMLElement).click();
        return true;
    } else if (e.key === 'Escape') {
        suggestions.style.display = 'none';
        onClose();
        return true;
    }

    return false;
}

function highlightSuggestion(items: NodeListOf<Element>, selectedIndex: number): void {
    items.forEach((el: Element, i: number) => {
        (el as HTMLElement).style.background = i === selectedIndex ? 'var(--background-modifier-hover)' : '';
    });
    if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
}

export function createOutsideClickHandler(modal: HTMLElement, onClose: () => void): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (!modal.contains(e.target as Node)) {
            onClose();
        }
    };
}

export function setupInputHandlers(
    input: HTMLInputElement,
    suggestions: HTMLElement,
    files: string[],
    onSelect: (path: string) => void,
    onUpdateWarning: () => void
): void {
    input.addEventListener('input', () => {
        onUpdateWarning();
        const query = input.value.trim();
        if (query.length > 0) {
            renderSuggestions(suggestions, files, query, onSelect);
        } else {
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('keydown', (e) => {
        handleSuggestionKeydown(e, suggestions, input, files, onSelect, () => {});
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            suggestions.style.display = 'none';
        }, 150);
    });
}

export async function createNewNode(
    view: SkillTreeView,
    selectedPath: string,
    onClose: () => void
): Promise<void> {
    const existingFile = view.app.vault.getAbstractFileByPath(selectedPath);

    if (!existingFile) {
        const initialContent = `---\nskilltree-node: ${crypto.randomUUID()}\nskilltree-node-exp: 10\nskilltree-node-desc: "No description"\n---\n\n`;
        try {
            await view.app.vault.create(selectedPath, initialContent);
        } catch (err) {
            console.log('[AddNode] Failed to create file:', err);
            return;
        }
    }

    onClose();
    RecordSnapshot();

    let worldPos = { x: 200, y: 150 };
    if (view.canvas) {
        const rect = view.canvas.getBoundingClientRect();
        worldPos = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
    }

    AddNode(worldPos.x, worldPos.y, selectedPath);
    await SaveNodes();
    Render();
}