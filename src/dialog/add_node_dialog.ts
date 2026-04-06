import { SkillTreeView } from "../skilltreeview";
import { getVaultFiles } from "./fuzzy_search";
import { closeAllModals } from "../modal/skilltree_modal";
import {
    createAddNodeModal,
    createAddNodeHeader,
    createAddNodeContent,
    updateWarningState,
    renderSuggestions,
    createOutsideClickHandler,
    setupInputHandlers,
    createNewNode
} from "./add_node_parts";

let view: SkillTreeView;

export function InitAddNodeDialog(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function OpenAddNodeDialog() {
    const container = view.canvasWrap || view.containerEl;
    if (!container) return;

    closeAllModals();

    const modal = createAddNodeModal(container);
    const header = createAddNodeHeader(modal);
    const { input, suggestions, warning, cancelBtn, createBtn } = createAddNodeContent(modal);

    const closeBtn = header.querySelector('button')!;
    const files = getVaultFiles(view.app);

    let selectedPath: string | null = null;

    const onClose = () => {
        modal.remove();
        document.removeEventListener('click', outsideHandler);
    };

    closeBtn.onclick = onClose;
    cancelBtn.onclick = onClose;

    const outsideHandler = createOutsideClickHandler(modal, onClose);

    const setSelectedPath = (path: string | null) => {
        selectedPath = path;
    };

    const onSuggestionSelect = (path: string) => {
        input.value = path.replace(/\.md$/, '');
        selectedPath = path;
        suggestions.style.display = 'none';
        updateWarningState(input, warning, createBtn, view, setSelectedPath);
    };

    setupInputHandlers(
        input,
        suggestions,
        files,
        onSuggestionSelect,
        () => updateWarningState(input, warning, createBtn, view, setSelectedPath)
    );

    createBtn.onclick = async () => {
        if (!selectedPath) return;
        await createNewNode(view, selectedPath, onClose);
    };

    setTimeout(() => {
        document.addEventListener('click', outsideHandler);
    }, 10);
}