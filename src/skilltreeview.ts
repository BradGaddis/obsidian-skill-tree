import { ItemView, Notice, Platform, WorkspaceLeaf } from "obsidian";
import SkillTreePlugin, { defaultSettings } from "./main";
import { VIEW_TYPE_SKILLTREE } from "./types/constants";

import { Coordinate, Mode } from "./types/types";
import { SkillTreeSettings } from "./types/interfaces";
import { InitRenderer, Recenter, Update } from "./rendering/renderer";
import { UpdateToolbarUI } from "./toolbar";
import { InitTreeManager } from "./data/tree_manager";
import { collapseBtn, floatingExpandBtn, InitToolBar, toolbar } from "./toolbar";


import { modeToggleBtn } from "./toolbar";

import { InitClickHandler } from "./handlers/click_event_handler";
import { skillTreeEvents, EVENTS } from "./utils/events";
import { InitTouchHandler } from "./handlers/touch_event_handler";

export class SkillTreeView extends ItemView {
    private uxCleanup: (() => void) | null = null;
    private renderCleanup: (() => void) | null = null;
    private modalEventCleanup: (() => void) | null = null;

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
    touchActive: boolean = false;

    selectedNodeId: string | null = null;
    _lastKnownNodeIds: Map<string, string | number> = new Map();

    openModals: Map<string | number, { type: 'stats' | 'edit', element: HTMLElement }> = new Map();

    getViewType(): string { return VIEW_TYPE_SKILLTREE; }
    getDisplayText(): string { return 'Skill Tree'; }

    constructor(leaf: WorkspaceLeaf, plugin: SkillTreePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    protected async onOpen(): Promise<void> {
        await InitTreeManager()
        InitToolBar()

        this.renderCleanup = InitRenderer().cleanup

        const handleNodeUpdate = async (nodeId: string | number) => {
            await this.refreshModalForNode(nodeId);
        };
        skillTreeEvents.on(EVENTS.NODE_UPDATED, handleNodeUpdate);
        this.modalEventCleanup = () => {
            skillTreeEvents.off(EVENTS.NODE_UPDATED, handleNodeUpdate);
        };

        if (Platform.isDesktop) {
            this.uxCleanup = InitClickHandler().cleanup
        }
        if (Platform.isMobile || Platform.isMobileApp) {
            const MOBILE_TOP_PADDING = '60px';
            toolbar.style.marginTop = MOBILE_TOP_PADDING
            collapseBtn.style.top += MOBILE_TOP_PADDING
            floatingExpandBtn.style.top = MOBILE_TOP_PADDING

            this.uxCleanup = InitTouchHandler().cleanup
        }
        Recenter()
        Update(true);
    }

    protected async onClose(): Promise<void> {
        this.uxCleanup?.();
        this.resizeObserver?.disconnect();
        this.renderCleanup?.();
        this.modalEventCleanup?.();
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
        Update();
    }


    isTasksPluginInstalled(): boolean {
        try {
            const tasksPlugin = (this.app as any).plugins?.plugins?.['obsidian-tasks-plugin'];
            return !!tasksPlugin;
        } catch (e) {
            return false;
        }
    }

    async refreshModalForNode(nodeId: string | number): Promise<void> {
        const modalInfo = this.openModals.get(nodeId);
        if (!modalInfo) return;

        if (modalInfo.type === 'stats') {
            const { refreshStatsModal } = await import('./ui/skilltree_stats_modal');
            await refreshStatsModal(modalInfo.element, nodeId);
        } else if (modalInfo.type === 'edit') {
            const { refreshEditModal } = await import('./ui/skilltree_edit_modal');
            refreshEditModal(modalInfo.element, nodeId);
        }
    }

}

