import { ModalStyleOptions } from "./types";

export const VIEW_TYPE_SKILLTREE = 'skill-tree-view';

export const DEFAULT_MODAL_STYLES: ModalStyleOptions = {
    position: "absolute",
    top: "60px",
    right: "20px",
    zIndex: "1000",
    backgroundColor: "var(--background-primary)",
    border: "1px solid var(--background-modifier-border)",
    borderRadius: "8px",
    padding: "20px",
    minWidth: "300px",
    maxWidth: "400px",
    minHeight: '400px',
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
};

export const TOOLBAR_DOM_EL_INFO = { cls: 'skill-tree-toolbar' }
export const TOOL_BAR_WRAPPER_DOM_EL_INFO = { cls: 'skill-tree-toolbar-wrapper' }
export const COLLAPSE_DOM_EL_INFO = { text: '▼', cls: 'skill-tree-collapse-btn' }
export const TOOLBAR_BUTTON_DOM_EL_INFO = { cls: 'skill-tree-toolbar-buttons' }

export const SKILLTREE_CANVAS_WRAP = { cls: 'skill-tree-canvas-wrap' };

export const HISTORY_UPPER_BOUNDS = 100;

export const LOOP_UPPER_LIMIT = 1000;
