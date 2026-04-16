import { SkillTreeData } from "../types/interfaces";
import { GetNodes, GetEdges } from "../data/tree_manager";
import { SaveNodes } from "../data/recorder";
import { view } from "../utils/globals";
import { createJsonEditorModal, createJsonEditorHeader, createJsonEditorContent, createJsonEditorFooter } from "./json_editor_ui";
import { SkillModal } from "./skilltree_modal";

let jsonModal: HTMLElement | null = null;

export function OpenJsonEditor(): void {
    if (!view?.containerEl) return;

    if (jsonModal) {
        jsonModal.remove();
        jsonModal = null;
    }

    jsonModal = createJsonEditorModal(view.containerEl);
    SkillModal.makeDraggable(jsonModal, 'jsonEditorModal');
    createJsonEditorHeader(jsonModal, closeJsonEditor);

    const elements = createJsonEditorContent(jsonModal, view);

    elements.textarea.addEventListener('input', () => {
        try {
            const parsed = JSON.parse(elements.textarea.value);
            elements.errorDiv.style.display = 'none';
            if (parsed.name && typeof parsed.name === 'string') {
                const newName = parsed.name.trim();
                if (newName && newName !== view.settings.currentTreeName && view.settings.trees[newName]) {
                    view.settings.currentTreeName = newName;
                }
            }
            SaveNodes();
        } catch (e) {
            const msg = (e as Error).message || 'Invalid JSON';
            elements.errorDiv.textContent = msg;
            elements.errorDiv.style.display = 'block';
        }
    });

    createJsonEditorFooter(jsonModal, () => {
        closeJsonEditor();
    });

    RefreshJsonEditor();
}

function closeJsonEditor(): void {
    if (jsonModal) {
        jsonModal.remove();
        jsonModal = null;
    }
}

export function RefreshJsonEditor(): void {
    if (!view) return;
    if (view._jsonTextarea) {
        const treeData: SkillTreeData = {
            name: view.settings.currentTreeName,
            nodes: Array.from(GetNodes().values()),
            edges: GetEdges()
        };
        view._jsonTextarea.value = JSON.stringify(treeData, null, 2);
    }
}
