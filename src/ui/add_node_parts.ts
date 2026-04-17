import { TFile } from "obsidian";
import { SkillTreeView } from "../skilltreeview";
import { GetNodes, AddNode } from "../data/tree_manager";
import { linkedNodes } from "../handlers/linked_nodes";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { DEFAULT_FRONTMATTER_TEMPLATE } from "../types/constants";
import { SaveNodes, RecordSnapshot } from "../data/recorder";
import { Update, screenToWorld } from "../rendering/renderer";
import { AddNodeContentElements } from "../types/interfaces";

interface FuzzyResult {
    item: string;
    score: number;
}

function fuzzyMatch(items: string[], query: string, limit = 10): FuzzyResult[] {
    if (!query) {
        return items.slice(0, limit).map(f => ({ item: f, score: 0 }));
    }

    const lowerQuery = query.toLowerCase();
    const results: FuzzyResult[] = [];

    for (const item of items) {
        const lowerItem = item.toLowerCase();
        let score = 0;

        if (lowerItem === lowerQuery) score = 1000;
        else if (lowerItem.startsWith(lowerQuery)) score = 500;
        else if (lowerItem.includes(lowerQuery)) score = 100;

        if (score > 0) results.push({ item, score });
    }

    return results
        .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
        .slice(0, limit);
}


export function createAddNodeModal(container: HTMLElement): HTMLElement {
    const modal = container.createEl('div', { cls: 'skill-tree-node-modal' });
    modal.classList.add('skill-tree-modal', 'skill-tree-modal--large');

    const rect = container.getBoundingClientRect();
    const left = (rect.width / 2) - 200;
    const top = (rect.height / 2) - 100;
    modal.style.left = `${Math.max(20, left)}px`;
    modal.style.top = `${Math.max(20, top)}px`;

    return modal;
}

export function createAddNodeHeader(modal: HTMLElement): HTMLElement {
    const header = modal.createEl('div');
    header.classList.add('skill-tree-modal-header', 'skill-tree-modal-header--nograb');

    const title = header.createEl('span', { text: 'Add Node' });
    title.classList.add('skill-tree-modal-title');

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.classList.add('skill-tree-modal-close');

    return header;
}

export function createAddNodeContent(modal: HTMLElement): AddNodeContentElements {
    const content = modal.createEl('div');
    content.classList.add('skill-tree-modal-content', 'skill-tree-modal-content--padding');

    const inputWrapper = content.createEl('div');
    inputWrapper.classList.add('skill-tree-form-input-wrapper');

    const input = inputWrapper.createEl('input', { attr: { type: 'text', placeholder: 'Search or create file...', autocomplete: 'off' } }) as HTMLInputElement;
    input.classList.add('skill-tree-form-input', 'skill-tree-form-input--large');
    input.focus();

    const suggestions = inputWrapper.createEl('div');
    suggestions.classList.add('skill-tree-suggestions-list', 'skill-tree-suggestions-list--large');

    const warning = content.createEl('div');
    warning.classList.add('skill-tree-warning', 'skill-tree-warning--large');

    const actions = content.createEl('div');
    actions.classList.add('skill-tree-btn-row', 'skill-tree-btn-row--large');

    const cancelBtn = actions.createEl('button', { text: 'Cancel' }) as HTMLButtonElement;
    cancelBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');

    const createBtn = actions.createEl('button', { text: 'Create' }) as HTMLButtonElement;
    createBtn.classList.add('skill-tree-btn', 'skill-tree-btn--primary');

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

    if (isFileAlreadyNode(normalizedPath) || linkedNodes.has(normalizedPath)) {
        warning.style.display = 'block';
        warning.style.background = 'rgba(220,53,69,0.15)';
        warning.style.borderColor = 'rgba(220,53,69,0.4)';
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
        if (match === undefined) {
            console.error(`Match ${i} is undefined`);
            continue;
        }
        const item = suggestions.createEl('div');
        item.classList.add('skill-tree-suggestion-item', 'skill-tree-suggestion-item--large');
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
        handleSuggestionKeydown(e, suggestions, input, files, onSelect, () => { });
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
        const treeName = view.settings.currentTreeName;
        const exp = view.settings.defaultExp;
        const initialContent = DEFAULT_FRONTMATTER_TEMPLATE(crypto.randomUUID(), treeName, exp);
        try {
            await view.app.vault.create(selectedPath, initialContent);
        } catch (err) {
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

    const newNode = AddNode(worldPos.x, worldPos.y, selectedPath);
    if (newNode) {
        const file = view.app.vault.getAbstractFileByPath(selectedPath);
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
    await SaveNodes();
    Update();
}

export interface RepeatNodeContentElements {
    minutesInput: HTMLInputElement;
    hoursInput: HTMLInputElement;
    daysInput: HTMLInputElement;
    maxInput: HTMLInputElement;
    displayInput: HTMLInputElement;
    cancelBtn: HTMLButtonElement;
    createBtn: HTMLButtonElement;
}

export function createRepeatNodeContent(modal: HTMLElement): RepeatNodeContentElements {
    const content = modal.createEl('div');
    content.classList.add('skill-tree-modal-content', 'skill-tree-modal-content--padding');

    const minutesRow = content.createEl('div');
    minutesRow.classList.add('skill-tree-form-row');
    const minutesLabel = minutesRow.createEl('label');
    minutesLabel.textContent = 'Cooldown (minutes)';
    minutesLabel.classList.add('skill-tree-form-label');
    const minutesInput = minutesRow.createEl('input') as HTMLInputElement;
    minutesInput.type = 'number';
    minutesInput.min = '0';
    minutesInput.value = '0';
    minutesInput.classList.add('skill-tree-form-input');
    minutesInput.focus();

    const hoursRow = content.createEl('div');
    hoursRow.classList.add('skill-tree-form-row');
    const hoursLabel = hoursRow.createEl('label');
    hoursLabel.textContent = 'Cooldown (hours)';
    hoursLabel.classList.add('skill-tree-form-label');
    const hoursInput = hoursRow.createEl('input') as HTMLInputElement;
    hoursInput.type = 'number';
    hoursInput.min = '0';
    hoursInput.value = '0';
    hoursInput.classList.add('skill-tree-form-input');

    const daysRow = content.createEl('div');
    daysRow.classList.add('skill-tree-form-row');
    const daysLabel = daysRow.createEl('label');
    daysLabel.textContent = 'Cooldown (days)';
    daysLabel.classList.add('skill-tree-form-label');
    const daysInput = daysRow.createEl('input') as HTMLInputElement;
    daysInput.type = 'number';
    daysInput.min = '0';
    daysInput.value = '0';
    daysInput.classList.add('skill-tree-form-input');

    const maxRow = content.createEl('div');
    maxRow.classList.add('skill-tree-form-row');
    const maxLabel = maxRow.createEl('label');
    maxLabel.textContent = 'Max completions (optional)';
    maxLabel.classList.add('skill-tree-form-label');
    const maxInput = maxRow.createEl('input') as HTMLInputElement;
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.placeholder = 'Unlimited';
    maxInput.classList.add('skill-tree-form-input');

    const displayRow = content.createEl('div');
    displayRow.classList.add('skill-tree-form-row');
    const displayLabel = displayRow.createEl('label');
    displayLabel.textContent = 'Display text (optional)';
    displayLabel.classList.add('skill-tree-form-label');
    const displayInput = displayRow.createEl('input') as HTMLInputElement;
    displayInput.type = 'text';
    displayInput.placeholder = 'Repeat task name';
    displayInput.classList.add('skill-tree-form-input');

    const actions = content.createEl('div');
    actions.classList.add('skill-tree-btn-row', 'skill-tree-btn-row--large');

    const cancelBtn = actions.createEl('button', { text: 'Cancel' }) as HTMLButtonElement;
    cancelBtn.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');

    const createBtn = actions.createEl('button', { text: 'Create' }) as HTMLButtonElement;
    createBtn.classList.add('skill-tree-btn', 'skill-tree-btn--primary');

    return { minutesInput, hoursInput, daysInput, maxInput, displayInput, cancelBtn, createBtn };
}

export async function createRepeatNode(
    _view: SkillTreeView,
    x: number,
    y: number,
    cooldownMinutes: number,
    cooldownHours: number,
    cooldownDays: number,
    maxCompletions: number | undefined,
    displayText: string | undefined
): Promise<void> {
    const { AddNode } = await import('../data/tree_manager');
    const { SaveNodes, RecordSnapshot } = await import('../data/recorder');
    const { Update: Render } = await import('../rendering/renderer');

    RecordSnapshot();

    const newNode = AddNode(x, y, undefined, 'RepeatingNode');

    if (newNode) {
        const repeatingNode = newNode as import('../nodes/repeating_node').RepeatingNode;
        repeatingNode.repeatCooldownMinutes = cooldownMinutes;
        repeatingNode.repeatCooldownHours = cooldownHours;
        repeatingNode.repeatCooldownDays = cooldownDays;
        if (maxCompletions) repeatingNode.repeatMax = maxCompletions;
        if (displayText) repeatingNode.displayText = displayText;
    }

    await SaveNodes();
    Render();
}
