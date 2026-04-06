import { SkillTreeView } from "src/skilltreeview";
import { SkillTreeData } from "src/interfaces";
import { UpdateTreeSelector, GetNodes, GetEdges, SetNodesFromSnapshot, SetEdgesFromSnapshot } from "../tree_manager";
import { SaveNodes } from "../recorder";
import { Render } from "../renderer";

let view: SkillTreeView;

export function initJsonEditorValidation(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function getOriginalNodeTypes(): Map<string | number, string> {
    const originalNodeTypes = new Map<string | number, string>();
    for (const node of GetNodes().values()) {
        originalNodeTypes.set(node.id, (node as any).nodeTypeName);
    }
    return originalNodeTypes;
}

export function checkNodeTypeChanges(
    parsedNodes: any[],
    originalNodeTypes: Map<string | number, string>
): string[] {
    const changed: string[] = [];
    for (const node of parsedNodes) {
        const originalType = originalNodeTypes.get(node.id);
        if (originalType && node.nodeType && originalType !== node.nodeType) {
            changed.push(`Node "${node.id}": ${originalType} → ${node.nodeType}`);
        }
    }
    return changed;
}

export async function showNodeTypeWarning(changedNodes: string[]): Promise<boolean> {
    if (view.settings.suppressNodeTypeWarning) {
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
        checkboxText.textContent = "Don't show this warning again";

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
}

export async function updateAndSave(
    textarea: HTMLTextAreaElement,
    originalNodeTypes: Map<string | number, string>,
    errorDiv: HTMLElement,
    warningDiv: HTMLElement
): Promise<boolean> {
    try {
        if (!textarea.value.trim()) {
            await SaveNodes();
            Render();
            errorDiv.style.display = 'none';
            warningDiv.style.display = 'none';
            return true;
        }

        const parsed = JSON.parse(textarea.value);

        const changedNodeTypes = checkNodeTypeChanges(parsed.nodes || [], originalNodeTypes);
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
                    UpdateTreeSelector(treeSelect);
                    treeSelect.value = newName;
                }
            }
        }

        SetNodesFromSnapshot(parsed.nodes || []);
        SetEdgesFromSnapshot(parsed.edges || []);
        await SaveNodes();
        Render();
        errorDiv.style.display = 'none';
        warningDiv.style.display = 'none';
        return true;
    } catch (e: any) {
        const lineMatch = e.message.match(/line (\d+)/i);
        let lineInfo = '';
        if (lineMatch) {
            lineInfo = ` at line ${lineMatch[1]}`;
        }
        errorDiv.textContent = `JSON parse error${lineInfo}: ${e.message}`;
        errorDiv.style.display = 'block';
        warningDiv.style.display = 'none';
        return false;
    }
}

export function getInitialTreeData(): SkillTreeData {
    return {
        name: view.settings.currentTreeName,
        nodes: Array.from(GetNodes().values()),
        edges: GetEdges()
    };
}