// TODO Refactor the hell out of this... | Cleanup
//
import { SkillTreeData } from "./interfaces";
import { RecordSnapshot, SaveNodes, Undo } from "./recorder";
import { } from "./renderer";
import { SkillTreeView } from "./skilltreeview";
import { UpdateTreeSelector } from "./tree-manager";

let view: SkillTreeView;

export function InitJSONEditor(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function RefreshJsonEditor(): void {
    if (view._jsonTextarea) {
        const treeData: SkillTreeData = {
            name: view.settings.currentTreeName,
            nodes: view.nodes,
            edges: view.edges
        };
        view._jsonTextarea.value = JSON.stringify(treeData, null, 2);
    }
}

export async function OpenJsonEditor() {
    if (!view.containerEl) return;

    view.closeAllModals();

    RecordSnapshot();

    const container = view.containerEl.createDiv({ cls: 'skill-tree-json-modal' });
    container.style.cssText = `
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

    // TODO make a method in the modal class. Maybe define an SkillTreeModal object there?
    // view.makeModalDraggable(container, 'jsonEditorModal');

    const header = container.createDiv({ cls: 'st-json-header' });
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
    closeBtn.onclick = () => {
        Undo()
        container.remove();
        view._jsonTextarea = null;
        view.removeOutsideClickHandler();
    };

    const jsonContainer = container.createDiv({ cls: 'st-json-content' });
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
        vimWarning.textContent = 'Note: Vim motions are not supported in view editor. Disable Vim mode in Settings > Editor to use standard keyboard shortcuts.';
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
    textarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = textarea.scrollTop;
    });

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

    const footer = container.createDiv({ cls: 'st-json-footer' });
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
    closeEditBtn.onclick = () => {
        container.remove();
        view._jsonTextarea = null;
        view.removeOutsideClickHandler();
    };

    const originalNodeTypes = new Map<string | number, string>();
    for (const node of view.nodes) {
        originalNodeTypes.set(node.id, (node as any).nodeTypeName);
    }
    let hasWarnedviewSession = false;

    const checkNodeTypeChanges = (parsedNodes: any[]): string[] => {
        const changed: string[] = [];
        for (const node of parsedNodes) {
            const originalType = originalNodeTypes.get(node.id);
            if (originalType && node.nodeType && originalType !== node.nodeType) {
                changed.push(`Node "${node.id}": ${originalType} → ${node.nodeType}`);
            }
        }
        return changed;
    };

    const showNodeTypeWarning = async (changedNodes: string[]): Promise<boolean> => {
        if (view.settings.suppressNodeTypeWarning || hasWarnedviewSession) {
            return true;
        }

        return new Promise((resolve) => {
            const warningModal = view.containerEl?.createDiv({ cls: 'skill-tree-warning-modal' });
            if (!warningModal) {
                resolve(true);
                return;
            }

            warningModal.style.cssText = `
          position: fixed;
          z-index: 2000;
          background-color: var(--background-primary);
          border: 1px solid var(--text-accent);
          border-radius: 8px;
          padding: 20px;
          max-width: 500px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        `;

            const title = warningModal.createEl('h3', { text: 'Node Type Changed' });
            title.style.marginTop = '0';
            title.style.color = 'var(--text-accent)';

            const message = warningModal.createDiv();
            message.style.marginBottom = '16px';
            message.textContent = 'Changing a node type will reset it to the default properties for that type. Any custom properties specific to the previous type will be lost.';

            const list = warningModal.createDiv();
            list.style.cssText = `
          max-height: 150px;
          overflow-y: auto;
          background: var(--background-secondary);
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-family: monospace;
          font-size: 12px;
        `;
            list.textContent = changedNodes.join('\n');

            const checkboxLabel = warningModal.createDiv();
            checkboxLabel.style.display = 'flex';
            checkboxLabel.style.alignItems = 'center';
            checkboxLabel.style.gap = '8px';
            checkboxLabel.style.marginBottom = '16px';

            const checkbox = checkboxLabel.createEl('input') as HTMLInputElement;
            checkbox.type = 'checkbox';
            const checkboxText = checkboxLabel.createEl('span');
            checkboxText.textContent = "Don't show view warning again";

            const buttonRow = warningModal.createDiv();
            buttonRow.style.display = 'flex';
            buttonRow.style.gap = '8px';
            buttonRow.style.justifyContent = 'flex-end';

            const proceedBtn = buttonRow.createEl('button', { text: 'Proceed' });
            proceedBtn.style.cssText = `
          padding: 6px 16px;
          background: var(--interactive-accent);
          color: var(--text-on-accent);
          border: none;
          border-radius: 4px;
          cursor: pointer;
        `;

            const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
            cancelBtn.style.cssText = `
          padding: 6px 16px;
          background: var(--background-secondary);
          color: var(--text-normal);
          border: 1px solid var(--background-modifier-border);
          border-radius: 4px;
          cursor: pointer;
        `;

            let resolved = false;
            const doResolve = (value: boolean) => {
                if (resolved) return;
                resolved = true;
                hasWarnedviewSession = true;
                if (checkbox.checked) {
                    view.settings.suppressNodeTypeWarning = true;
                    view.plugin.saveSettings();
                }
                warningModal.remove();
                resolve(value);
            };

            proceedBtn.onclick = () => doResolve(true);
            cancelBtn.onclick = () => doResolve(false);
        });
    };

    const updateAndSave = async () => {
        try {
            // Handle empty/whitespace-only content as empty tree
            if (!textarea.value.trim()) {
                view.nodes = [];
                view.edges = [];
                // view.computeAllNodeRadii();
                view.graph.loadFromJSON([], []);
                await SaveNodes()
                RequestRender()
                errorDiv.style.display = 'none';
                warningDiv.style.display = 'none';
                return true;
            }

            const parsed = JSON.parse(textarea.value);

            const changedNodeTypes = checkNodeTypeChanges(parsed.nodes || []);
            if (changedNodeTypes.length > 0) {
                const proceed = await showNodeTypeWarning(changedNodeTypes);
                if (!proceed) {
                    return false;
                }
            }

            const newName = parsed.name?.trim();
            const oldName = view.settings.currentTreeName;

            if (newName && newName !== oldName) {
                if (view.settings.trees[newName]) {
                    errorDiv.textContent = `Tree "${newName}" already exists. Please use a different name.`;
                    errorDiv.style.display = 'block';
                    return false;
                }

                const treeData = view.settings.trees[oldName];
                if (treeData) {
                    delete view.settings.trees[oldName];
                    view.settings.trees[newName] = {
                        ...treeData,
                        name: newName
                    };
                    view.settings.currentTreeName = newName;

                    const treeSelect = view.containerEl?.querySelector('select') as HTMLSelectElement;
                    if (treeSelect) {
                        UpdateTreeSelector(treeSelect)
                        treeSelect.value = newName;
                    }
                }
            }

            view.nodes = parsed.nodes || [];
            view.edges = parsed.edges || [];
            // view.computeAllNodeRadii();
            view.graph.loadFromJSON(view.nodes, view.edges);
            await SaveNodes()
            RequestRender()
            errorDiv.style.display = 'none';

            // const nodesWithTasks = new Set(view._tasksCache.keys());
            warningDiv.style.display = 'none';
            return true;
        } catch (e: any) {
            const lineMatch = e.message.match(/line (\d+)/i);
            let lineInfo = '';
            if (lineMatch) {
                lineInfo = ` at line ${lineMatch[1]}`;
                setTimeout(() => {
                    const lines = textarea.value.split('\n');
                    let charCount = 0;
                    for (let i = 0; i < parseInt(lineMatch[1]) - 1; i++) {
                        charCount += lines[i].length + 1;
                    }
                    textarea.focus();
                    textarea.setSelectionRange(charCount, charCount + (lines[parseInt(lineMatch[1]) - 1]?.length || 0));
                    const lineHeight = 18;
                    textarea.scrollTop = (parseInt(lineMatch[1]) - 1) * lineHeight - textarea.clientHeight / 2;
                    lineNumbers.scrollTop = textarea.scrollTop;
                }, 50);
            }
            errorDiv.textContent = `JSON parse error${lineInfo}: ${e.message}`;
            errorDiv.style.display = 'block';
            warningDiv.style.display = 'none';
            return false;
        }
    };

    textarea.addEventListener('input', () => {
        updateAndSave();
    });

    const treeData: SkillTreeData = {
        name: view.settings.currentTreeName,
        nodes: view.nodes,
        edges: view.edges
    };
    textarea.value = JSON.stringify(treeData, null, 2);
    updateLineNumbers();

    setTimeout(() => textarea.focus(), 10);
}
