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