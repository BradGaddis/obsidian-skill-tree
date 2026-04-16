import { App } from "obsidian";
import { VaultFileSuggestModal, TreeSuggestModal } from "./fuzzy_suggest_modal";
import { createSkillNodeFile } from "../data/tree_manager";

const defaultOnCreate = async (_path: string) => {
    // Default create behavior - do nothing
};

export function openFileLinkPicker(
    app: App,
    onSelect: (path: string) => void,
    onCreate?: (path: string) => Promise<void>
): void {
    const fmodal = new VaultFileSuggestModal(
        app,
        onSelect,
        onCreate ?? defaultOnCreate
    );
    fmodal.open();
}

export function openTreePicker(
    app: App,
    onSelect: (treeName: string) => void
): void {
    const modal = new TreeSuggestModal(app, onSelect);
    modal.open();
}

export function openFileLinkPickerWithCreate(
    app: App,
    node: { id: string | number },
    onSelect: (path: string) => void
): void {
    openFileLinkPicker(
        app,
        onSelect,
        async (path) => {
            await createSkillNodeFile(node as any, path);
        }
    );
}
