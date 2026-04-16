import { SkillTreeView } from "../skilltreeview";
import { JsonEditorElements } from "../types/interfaces";

export function createJsonEditorModal(container: HTMLElement): HTMLElement {
    const modal = container.createDiv({ cls: 'skill-tree-json-modal' });
    return modal;
}

export function createJsonEditorHeader(modal: HTMLElement, onClose: () => void): HTMLElement {
    const header = modal.createDiv({ cls: 'st-json-header' });

    header.createEl('h3', { text: 'Edit Tree as JSON' });

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.onclick = onClose;

    return header;
}

export function createJsonEditorContent(modal: HTMLElement, view: SkillTreeView): JsonEditorElements {
    const jsonContainer = modal.createDiv({ cls: 'st-json-content' });

    const isVimMode = (view.app.vault as any).config?.vimMode === true ||
        (view.app.vault as any).config?.legacyVimMode === true ||
        (window as any).CodeMirrorAdapter?.Vim?.isEnabled?.();
    if (isVimMode) {
        const vimWarning = jsonContainer.createDiv({ cls: 'st-json-vim-warning' });
        vimWarning.textContent = 'Note: Vim motions are not supported in JSON editor. Disable Vim mode in Settings > Editor to use standard keyboard shortcuts.';
    }

    const editorWrapper = jsonContainer.createDiv({ cls: 'st-json-editor-wrapper' });

    const lineNumbers = editorWrapper.createDiv({ cls: 'st-json-line-numbers' });

    const textarea = editorWrapper.createEl('textarea') as HTMLTextAreaElement;
    view._jsonTextarea = textarea;

    const updateLineNumbers = () => {
        const lines = textarea.value.split('\n').length;
        const numbers = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        lineNumbers.textContent = numbers;
    };

    textarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener('input', updateLineNumbers);

    const errorDiv = jsonContainer.createDiv({ cls: 'st-json-error' });

    const warningDiv = jsonContainer.createDiv({ cls: 'st-json-warning' });

    return { container: jsonContainer, textarea, lineNumbers, errorDiv, warningDiv };
}

export function createJsonEditorFooter(modal: HTMLElement, onClose: () => void): void {
    const footer = modal.createDiv({ cls: 'st-json-footer' });

    const closeText = footer.createEl('span');
    closeText.textContent = 'Changes are saved automatically';

    const closeEditBtn = footer.createEl('button', { text: 'Close' });
    closeEditBtn.onclick = onClose;
}