export const SKILL_TREE_STYLES = {
    'gamified': {
        name: 'Gamified',
        backgroundColor: '#1a1410',
        nodeColors: {
            complete: { fill: '#ffd700', stroke: '#ffaa00' },
            inProgress: { fill: '#6a5acd', stroke: '#4b0082' },
            onHold: { fill: '#ff4757', stroke: '#ff6b81' },
            unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' },
            optional: { fill: '#87ceeb', stroke: '#5fb0db' },
            error: { fill: '#dc143c', stroke: '#8b0000' }
        },
        edgeColor: '#ffd700',
        edgeGlow: true,
        nodeShape: 'hexagon',
        animated: true,
        edgeStyle: 'gradient'
    }
};

export const SKILL_TREE_OPTIONAL_NODE_STYLE_OVERRIDE = {
    complete: { fill: '#ffd700', stroke: '#ffaa00' },
    inProgress: { fill: '#6a5acd', stroke: '#4b0082' },
    onHold: { fill: '#ff4757', stroke: '#ff6b81' },
    unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' },
    optional: { fill: '#87ceeb', stroke: '#5fb0db' },
    error: { fill: '#dc143c', stroke: '#8b0000' }
}

// ============================================================================
// Modal Styles
// ============================================================================

export const MODAL_CONTAINER = 'position:absolute;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

export const MODAL_CONTAINER_LARGE = 'position:absolute;width:400px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

export const MODAL_CONTAINER_PANE = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;';

export const MODAL_CONTAINER_FIXED = 'position:fixed;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

export const MODAL_HEADER = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';

export const MODAL_HEADER_NOGRAB = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;';

export const MODAL_TITLE = 'font-weight:bold;font-size:14px;';

export const MODAL_CLOSE_BTN = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';

export const MODAL_CONTENT = 'padding:12px 16px;overflow-y:auto;box-sizing:border-box;width:100%;';

export const MODAL_CONTENT_PADDING = 'padding:16px;';

export const MODAL_STATS = 'border:2px solid var(--interactive-accent);background:linear-gradient(135deg, var(--background-primary) 0%, rgba(255,255,255,0.02) 100%);box-shadow:0 8px 24px rgba(0,0,0,0.25);';

export const MODAL_FOOTER = 'display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;margin-top:auto;';

// ============================================================================
// Form Styles
// ============================================================================

export const FORM_LABEL = 'display:block;margin-bottom:8px;font-weight:500;';

export const FORM_INPUT = 'width:100%;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);box-sizing:border-box;';

export const FORM_INPUT_LARGE = 'width:100%;padding:10px 12px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);box-sizing:border-box;font-size:14px;';

export const FORM_SELECT = 'width:100%;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);box-sizing:border-box;';

export const FORM_TEXTAREA = 'width:100%;min-height:300px;font-family:monospace;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);';

export const FORM_ROW = 'margin-bottom:16px;';

export const FORM_ROW_SMALL = 'margin-bottom:12px;';

export const FORM_INPUT_WRAPPER = 'position:relative;';

export const FORM_STATE_DISPLAY = 'padding:8px;background:var(--background-secondary);border-radius:4px;color:var(--text-muted);font-size:14px;';

// ============================================================================
// Button Styles
// ============================================================================

export const BTN_PRIMARY = 'padding:8px 16px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;';

export const BTN_PRIMARY_SMALL = 'padding:6px 12px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;';

export const BTN_PRIMARY_SMALL_MR = 'padding:6px 12px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;margin-right:8px;';

export const BTN_SECONDARY = 'padding:8px 16px;background:var(--background-secondary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;';

export const BTN_SECONDARY_SMALL = 'padding:6px 12px;background:var(--background-secondary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;';

export const BTN_DANGER = 'padding:8px 16px;background:none;border:1px solid var(--text-error);color:var(--text-error);border-radius:4px;cursor:pointer;';

export const BTN_DANGER_SMALL = 'padding:4px 12px;';

export const STATS_MODAL_ROW = 'margin-bottom: 8px;';

export const STATS_MODAL_TITLE = 'font-weight: 600; font-size: 16px; margin-bottom: 8px;';

export const STATS_MODAL_MUTED = 'margin-bottom: 8px; color: var(--text-muted);';

export const STATS_MODAL_HEADER_RIGHT = 'display: flex; gap: 8px; align-items: center;';

export const STATS_MODAL_GO_BUTTON = 'padding: 4px 12px; cursor: pointer; font-size: 12px;';

export const BTN_ICON = 'padding:4px 12px;';

export const BTN_DANGER_RED = 'padding: 8px 16px; border: none; border-radius: 4px; background: #dc3545; color: white; cursor: pointer;';

export const BTN_SECONDARY_BORDER = 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); color: var(--text-normal); cursor: pointer;';

// ============================================================================
// List/Dropdown Styles
// ============================================================================

export const SUGGESTIONS_LIST = 'position:absolute;top:100%;left:0;right:0;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px;max-height:150px;overflow-y:auto;z-index:1000;display:none;';

export const SUGGESTIONS_LIST_LARGE = 'position:absolute;top:100%;left:0;right:0;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px;max-height:200px;overflow-y:auto;z-index:10000;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);';

export const SUGGESTION_ITEM = 'padding:6px 8px;cursor:pointer;font-size:13px;';

export const SUGGESTION_ITEM_LARGE = 'padding:10px 12px;cursor:pointer;font-size:13px;';

export const SUGGESTION_ITEM_HOVER = 'padding:8px 12px;cursor:pointer;';

// ============================================================================
// Utility Styles
// ============================================================================

export const WARNING_BOX = 'margin-top:8px;padding:8px;background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.4);border-radius:4px;font-size:12px;display:none;';

export const WARNING_BOX_LARGE = 'margin-top:12px;padding:8px 12px;background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.4);border-radius:4px;color:var(--text-warning);font-size:13px;display:none;';

export const BTN_ROW = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;';

export const BTN_ROW_LARGE = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

// ============================================================================
// Settings Styles
// ============================================================================

export const SETTING_ROW = 'display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid var(--background-modifier-border);';

export const SETTING_LABEL = 'display:block;margin-bottom:8px;font-weight:600;';

export const SETTING_HINT = 'font-size:12px;color:var(--text-muted);margin:0 0 8px 0;';

export const SETTING_BTN_GROUP = 'display:flex;gap:8px;';

// ============================================================================
// List/Pane Styles
// ============================================================================

export const LIST_CONTAINER = 'list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;';

export const LIST_ITEM_EMPTY = 'padding:12px;text-align:center;color:var(--text-muted);';

export const LIST_ITEM = 'padding:8px 12px;cursor:pointer;';

export const SEARCH_CONTAINER = 'padding:8px 12px;border-bottom:1px solid var(--background-modifier-border);';

export const SEARCH_INPUT = 'width:100%;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);box-sizing:border-box;';

// ============================================================================
// Dialog Styles
// ============================================================================

export const DIALOG_TITLE = 'margin: 0 0 12px 0; font-size: 16px;';

export const DIALOG_MESSAGE = 'margin: 0 0 20px 0; color: var(--text-normal);';

export const DIALOG_BUTTON_ROW = 'display: flex; gap: 8px; justify-content: flex-end;';

export const DIALOG_BOX = 'background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:20px;';

export const DIALOG_TITLE_LARGE = 'margin: 0 0 16px 0; font-size: 16px;';

export const DIALOG_INPUT = 'width:100%;padding:8px 12px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);font-size:14px;margin-bottom:16px;box-sizing:border-box;';

// ============================================================================
// Theme/Settings Specific
// ============================================================================

export const THEME_ROW = 'display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid var(--background-modifier-border);';

export const THEME_NAME = 'flex:1;';

export const EMPTY_MESSAGE = 'text-align:center;color:var(--text-muted);padding:20px;';

export const NEW_THEME_BTN = 'padding:8px 16px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;';

export const CLOSE_BTN_ABSOLUTE = 'position:absolute;top:16px;right:16px;padding:4px 12px;';

export const SETTING_MARGIN = 'margin:16px 0;';

export const TREE_ROW = 'display:flex;gap:8px;align-items:center;margin:8px 0;';

export const TREE_INPUT = 'flex:1;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);';