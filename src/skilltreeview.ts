import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import SkillTreePlugin, { defaultSettings } from "./main";
import { VIEW_TYPE_SKILLTREE } from "./constants";
import { Coordinate, Mode } from "./types";
import { SkillTreeSettings } from "./main";
// import { Graph } from "./graph";
import { SkillEdge, SkillTreeData } from "./interfaces";
import { SkillNode } from './skill_nodes/skill_node'
import { InitRecorder, RecordSnapshot, SaveNodes, Undo } from "./recorder";
import { InitRenderer, Recenter, Render, UpdateToolbarUI } from "./renderer";
import { InitTreeManager, UpdateTreeSelector, GetNodes, GetEdges } from "./tree-manager";
import { InitToolBar } from "./toolbar";
import { InitDialog } from "./dialog";
import { InitSkillModal } from "./modal";
import { InitJSONEditor } from "./json_editor";

import { modeToggleBtn } from "./toolbar";
import { InitPanHandler } from "./ux/panning";

export class SkillTreeView extends ItemView {
    private panCleanup: (() => void) | null = null;
    canvas: HTMLCanvasElement | null = null;
    context: CanvasRenderingContext2D | null = null;
    canvasWrap: HTMLDivElement | null = null;
    resizeObserver: ResizeObserver | null = null;
    offset: Coordinate = { x: 0, y: 0 };
    private _scale: number = 1

    get scale(): number {
        return this._scale
    }
    set scale(val: number) {
        this._scale = val <= 1 ? 1 : val
    }
    plugin: SkillTreePlugin;
    _jsonTextarea: HTMLTextAreaElement | null = null;
    modalOutsideListener: ((e: Event) => void) | null = null;

    // TODO: implement
    _fileWatchers: Map<string, () => void> = new Map();
    _tasksCache: Map<string, any[]> = new Map();
    selectedNodeId: string | null = null;

    get settings(): SkillTreeSettings {
        return this.plugin.settings;
    }

    getViewType(): string { return VIEW_TYPE_SKILLTREE; }
    getDisplayText(): string { return 'Skill Tree'; }

    constructor(leaf: WorkspaceLeaf,
        plugin: SkillTreePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    screenToWorld(sx: number, sy: number) {
        return { x: (sx - this.offset.x) / this.scale, y: (sy - this.offset.y) / this.scale };
    }


    protected async onOpen(): Promise<void> {
        InitRecorder(this)
        await InitTreeManager(this) // this must be called before InitToolBar
        InitToolBar(this)
        InitDialog(this)
        InitSkillModal(this)
        InitJSONEditor(this)

        InitRenderer(this)

        Recenter()

        this.panCleanup = InitPanHandler(this, {
            shouldStartPan: (worldCoordinate) => { return true; }
        }).cleanup;

        await this.loadSettings();


    }

    protected async onClose(): Promise<void> {
        this.panCleanup?.();
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

    // TODO: move into tree manager
    addNodeAt(x: number, y: number, extras?: Record<string, any>) /*: SkillNode */ {
        // Find a non-overlapping position for the new node
        //     const newPos = this.findNonOverlappingPositionForNewNode(x, y);
        //
        //     // Get default shape based on current style
        //     const selectedStyle = this.settings.style || 'default';
        //     const styleDef = SKILL_TREE_STYLES[selectedStyle];
        //     let defaultShape = styleDef?.nodeShape || 'circle';
        //     // Filter out 'star' as it's not a valid node shape (only style shape)
        //     if (defaultShape === 'star') {
        //         defaultShape = 'circle';
        //     }
        //
        //     return this.graph.addNode({
        //         id: Date.now() + Math.random(),
        //         x: newPos.x,
        //         y: newPos.y,
        //         state: 'unavailable',
        //         exp: 10,
        //         optional: false,
        //         checkpoint: false,
        //         treeLink: null,
        //         shape: defaultShape as 'circle' | 'square' | 'hexagon' | 'diamond',
        //         ...extras,
        //     });
        // }
    }

    // TODO: move into Modal(manager?)
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


    removeOutsideClickHandler() {
        if (this.modalOutsideListener) {
            document.removeEventListener('pointerdown', this.modalOutsideListener);
            this.modalOutsideListener = null;
        }
    }

    // TODO: does this make sense  to be here?
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

