import { SkillTreeView } from "./skilltreeview";

// TODO IMPLEMENT
let view: SkillTreeView

export function InitRenderer(skillTreeView: SkillTreeView) {
    view = skillTreeView
}

export function RequestRender(): void {
    // if (view._renderScheduled) return;
    //
    // // No throttling - render immediately
    //
    // // Render once (not continuous loop)
    // view._renderScheduled = true;
    // view._renderFrameId = requestAnimationFrame(() => {
    //     view._renderScheduled = false;
    //     view._renderFrameId = null;
    //     // Sync edit mode button with plugin state
    //     if (view._editModeButton) {
    //         view._editModeButton.textContent = view.plugin.editMode ? 'Edit Mode' : 'View Mode';
    //         view._editModeButton.classList.toggle('active', view.plugin.editMode);
    //         view.syncEditModeButtons(view.plugin.editMode);
    //     }
    //     // Apply custom theme if changed
    //     view.applyCustomTheme();
    //     try {
    //         view.render();
    //     } catch (e) {
    //         console.warn('Error during scheduled render:', e);
    //     }
    //
    // });
}

export function ComputeAllNodeRadii() {

}
