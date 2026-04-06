import { SkillTreeView } from "src/skilltreeview";

export interface JsonEditorElements {
    container: HTMLElement;
    textarea: HTMLTextAreaElement;
    lineNumbers: HTMLElement;
    errorDiv: HTMLElement;
    warningDiv: HTMLElement;
}

export function createJsonEditorModal(container: HTMLElement): HTMLElement {
    const modal = container.createDiv({ cls: 'skill-tree-json-modal' });
    modal.style.cssText = `
      position: fixed;
      width: 750px;
      height: 600px;
      max-height: 80vh;
      z-index: 1000;
      background-color: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    return modal;
}

export function createJsonEditorHeader(modal: HTMLElement, onClose: () => void): HTMLElement {
    const header = modal.createDiv({ cls: 'st-json-header' });
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;

    const title = header.createEl('h3', { text: 'Edit Tree as JSON' });
    title.style.margin = '0';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0 8px;
      color: var(--text-muted);
    `;
    closeBtn.onclick = onClose;

    return header;
}

export function createJsonEditorContent(modal: HTMLElement, view: SkillTreeView): JsonEditorElements {
    const jsonContainer = modal.createDiv({ cls: 'st-json-content' });
    jsonContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    `;

    const isVimMode = (view.app.vault as any).config?.vimMode === true ||
        (view.app.vault as any).config?.legacyVimMode === true ||
        (window as any).CodeMirrorAdapter?.Vim?.isEnabled?.();
    if (isVimMode) {
        const vimWarning = jsonContainer.createDiv({ cls: 'st-json-vim-warning' });
        vimWarning.style.cssText = `
          color: #b8860b;
          font-size: 12px;
          font-family: monospace;
          padding: 8px 12px;
          background: var(--background-secondary);
          border: 1px solid #b8860b;
          border-radius: 4px;
        `;
        vimWarning.textContent = 'Note: Vim motions are not supported in JSON editor. Disable Vim mode in Settings > Editor to use standard keyboard shortcuts.';
    }

    const editorWrapper = jsonContainer.createDiv({ cls: 'st-json-editor-wrapper' });
    editorWrapper.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
      background: var(--background-secondary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
    `;

    const lineNumbers = editorWrapper.createDiv({ cls: 'st-json-line-numbers' });
    lineNumbers.style.cssText = `
      padding: 12px 8px;
      background: var(--background-primary);
      color: var(--text-muted);
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      text-align: right;
      user-select: none;
      min-width: 40px;
      overflow: hidden;
      border-right: 1px solid var(--background-modifier-border);
      white-space: pre;
    `;

    const textarea = editorWrapper.createEl('textarea') as HTMLTextAreaElement;
    view._jsonTextarea = textarea;
    textarea.style.cssText = `
      flex: 1;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      padding: 12px;
      background: transparent;
      color: var(--text-normal);
      border: none;
      resize: none;
      min-height: 0;
      outline: none;
    `;

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
    errorDiv.style.cssText = `
      color: var(--text-accent);
      font-size: 12px;
      font-family: monospace;
      padding: 4px 8px;
      background: var(--background-secondary);
      border-radius: 4px;
      display: none;
    `;

    const warningDiv = jsonContainer.createDiv({ cls: 'st-json-warning' });
    warningDiv.style.cssText = `
      color: #b8860b;
      font-size: 12px;
      font-family: monospace;
      padding: 4px 8px;
      background: var(--background-secondary);
      border: 1px solid #b8860b;
      border-radius: 4px;
      display: none;
    `;

    return { container: jsonContainer, textarea, lineNumbers, errorDiv, warningDiv };
}

export function createJsonEditorFooter(modal: HTMLElement, onClose: () => void): void {
    const footer = modal.createDiv({ cls: 'st-json-footer' });
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--background-modifier-border);
    `;

    const closeText = footer.createEl('span');
    closeText.style.cssText = `
      flex: 1;
      font-size: 12px;
      color: var(--text-muted);
    `;
    closeText.textContent = 'Changes are saved automatically';

    const closeEditBtn = footer.createEl('button', { text: 'Close' });
    closeEditBtn.style.cssText = `
      padding: 6px 16px;
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeEditBtn.onclick = onClose;
}