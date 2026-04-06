import { SkillTreeView } from "../skilltreeview";
import { RecordSnapshot, Undo } from "../recorder";
import { RefreshJsonEditor } from "./json-editor";
import { createJsonEditorModal, createJsonEditorHeader, createJsonEditorContent, createJsonEditorFooter } from "./json-editor-ui";
import { initJsonEditorValidation, getOriginalNodeTypes, updateAndSave, getInitialTreeData } from "./json-editor-validation";
import { makeModalDraggable } from "../modal/skilltree-modal";

export { RefreshJsonEditor } from "./json-editor";

let view: SkillTreeView;

export function InitJSONEditor(skillTreeView: SkillTreeView) {
    view = skillTreeView;
    initJsonEditorValidation(skillTreeView);
}

export async function OpenJsonEditor() {
    if (!view.containerEl) return;

    view.closeAllModals();
    RecordSnapshot();

    const container = createJsonEditorModal(view.containerEl);

    makeModalDraggable(view, container, 'jsonEditor');

    const onClose = () => {
        container.remove();
        view._jsonTextarea = null;
        view.removeOutsideClickHandler();
    };

    createJsonEditorHeader(container, onClose);

    const { textarea, lineNumbers, errorDiv, warningDiv } = createJsonEditorContent(container, view);

    createJsonEditorFooter(container, () => {
        container.remove();
        view._jsonTextarea = null;
        view.removeOutsideClickHandler();
    });

    const originalNodeTypes = getOriginalNodeTypes();

    let saveTimeout: number | null = null;

    textarea.addEventListener('input', () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            updateAndSave(textarea, originalNodeTypes, errorDiv, warningDiv);
        }, 300);
    });

    const treeData = getInitialTreeData();
    textarea.value = JSON.stringify(treeData, null, 2);
    
    const lines = textarea.value.split('\n').length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');

    setTimeout(() => textarea.focus(), 10);
}