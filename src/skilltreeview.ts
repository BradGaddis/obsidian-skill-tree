import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import SkillTreePlugin, { defaultSettings } from "./main";
import { VIEW_TYPE_SKILLTREE } from "./constants";
import { Coordinate, Mode } from "./types";
import { SkillTreeSettings } from "./main";
import { InitRecorder } from "./recorder";
import { InitRenderer, Recenter, Render, UpdateToolbarUI } from "./renderer";
import { InitTreeManager } from "./tree-manager";
import { InitToolBar } from "./toolbar";
import { InitDialog } from "./dialog";
import { InitSkillTreeModal } from "./modal/skilltree-modal"
import { InitStatsModal } from "./modal/skilltree-stats-modal"
import { InitNodeListModal } from "./modal/skilltree-pane"
import { InitJSONEditor } from "./dialog/json_editor";

import { modeToggleBtn } from "./toolbar";

// import { InitPanHandler } from "./ux/panning";
// import { InitZoomHandler } from "./ux/zoom";
import { edgeDragFrom, hitNode, InitClickHandler } from "./ux/click_event_handler";

export class SkillTreeView extends ItemView {
    // private panCleanup: (() => void) | null = null;
    // private zoomCleanup: (() => void) | null = null;
    private clickCleanup: (() => void) | null = null;

    private _scale: number = 1
    get scale(): number { return this._scale }
    set scale(val: number) { this._scale = val <= 1 ? 1 : val }
    offset: Coordinate = { x: 0, y: 0 };

    canvas: HTMLCanvasElement | null = null;
    context: CanvasRenderingContext2D | null = null;
    canvasWrap: HTMLDivElement | null = null;
    resizeObserver: ResizeObserver | null = null;

    plugin: SkillTreePlugin;
    get settings(): SkillTreeSettings { return this.plugin.settings; }

    _jsonTextarea: HTMLTextAreaElement | null = null;
    modalOutsideListener: ((e: Event) => void) | null = null;

    selectedNodeId: string | null = null;
    _lastKnownNodeIds: Map<string, string | number> = new Map();

    getViewType(): string { return VIEW_TYPE_SKILLTREE; }
    getDisplayText(): string { return 'Skill Tree'; }

    constructor(leaf: WorkspaceLeaf,
        plugin: SkillTreePlugin) {
        super(leaf);
        this.plugin = plugin;
    }


    protected async onOpen(): Promise<void> {
        InitRecorder(this)
        await InitTreeManager(this) // this must be called before InitToolBar
        InitToolBar(this)
        InitDialog(this)
        InitSkillTreeModal(this)
        InitStatsModal(this)
        InitNodeListModal(this)
        InitJSONEditor(this)
        InitRenderer(this)
        this.clickCleanup = InitClickHandler(this).cleanup

        await this.loadSettings();
        Recenter()
    }

    protected async onClose(): Promise<void> {
        this.clickCleanup?.();
        this.resizeObserver?.disconnect();
    }

    async loadSettings() {
        this.plugin.settings = Object.assign(defaultSettings(), await this.plugin.loadData());
        UpdateToolbarUI();
    }

    async SwitchMode(mode: Mode) {
        switch (mode) {
            case "edit":
                this.plugin.settings.mode = "edit"
                modeToggleBtn.textContent = 'Edit Mode';
                break;
            case "view":
                this.plugin.settings.mode = "view"
                modeToggleBtn.textContent = 'View Mode';
                break;
            default:
                new Notice("Somehow the toggle broke. Debugging needed...")
                break;
        }

        if (this.plugin.settings.mode != mode) {
            new Notice(`Switched to ${mode} mode`);
        }
        this.plugin.settings.mode = mode
        await this.plugin.saveSettings();
        UpdateToolbarUI();
        Render();
    }

    // TODO: maybe move into modal module
    closeAllModals() {
        // Remove any modal elements from the container or the document body
        try {
            // Look in the container first
            if (this.containerEl) {
                const nodeModal = this.containerEl.querySelectorAll('.skill-tree-node-modal');
                nodeModal.forEach((n) => n.remove());
            }
            // Also remove any modals appended to document body
            const bodyModals = document.querySelectorAll('.skill-tree-node-modal');
            bodyModals.forEach((n) => n.remove());
        } catch (e) { }
        // also remove any outside-click listener
        this.removeOutsideClickHandler();
    }

    // TODO: maybe move into modal module
    removeOutsideClickHandler() {
        if (this.modalOutsideListener) {
            document.removeEventListener('pointerdown', this.modalOutsideListener);
            this.modalOutsideListener = null;
        }
    }


    isTasksPluginInstalled(): boolean {
        try {
            const tasksPlugin = (this.app as any).plugins?.plugins?.['obsidian-tasks-plugin'];
            return !!tasksPlugin;
        } catch (e) {
            return false;
        }
    }

    isDataviewPluginInstalled(): boolean {
        try {
            const dataviewPlugin = (this.app as any).plugins?.plugins?.['dataview'];
            return !!dataviewPlugin;

        } catch (e) {
            return false;
        }
    }


}

