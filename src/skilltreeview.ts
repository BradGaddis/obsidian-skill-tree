import { ItemView, WorkspaceLeaf } from "obsidian";
import SkillTreePlugin from "./main";
import { VIEW_TYPE_SKILLTREE } from "./constants";
import { Coordinate } from "./types";
import { SkillTreeSettings } from "./main";
import { Graph } from "./graph";
import { SkillEdge, SkillTreeData } from "./interfaces";
import { SkillNode } from './skill_nodes/skill_node'
import { RecordSnapshot, SaveNodes, Undo } from "./recorder";
import { RequestRender } from "./renderer";
import { UpdateTreeSelector } from "./tree-manager";
import { InitToolBar } from "./toolbar";

export class SkillTreeView extends ItemView {
    canvas: HTMLCanvasElement | null = null;
    context: CanvasRenderingContext2D | null = null;
    canvasWrap: HTMLDivElement | null = null;
    resizeObserver: ResizeObserver | null = null;
    offset: Coordinate = { x: 0, y: 0 };
    scale = 1;
    graph: Graph = new Graph();
    plugin: SkillTreePlugin;
    _modeToggleButton: HTMLButtonElement | null = null;
    _goToLinkedBtn: HTMLButtonElement | null = null;
    _jsonTextarea: HTMLTextAreaElement | null = null;
    modalOutsideListener: ((e: Event) => void) | null = null;

    get settings(): SkillTreeSettings {
        return this.plugin.settings;
    }

    get nodes(): SkillNode[] {
        return this.graph.getAllNodes() as SkillNode[];
    }
    set nodes(val: SkillNode[]) {
        this.graph.nodes.clear();
        for (const n of val) {
            this.graph.nodes.set(n.id, SkillNode.fromJSON(n));
        }
    }

    get edges(): SkillEdge[] {
        return this.graph.edges as SkillEdge[];
    }
    set edges(val: SkillEdge[]) {
        this.graph.edges = val;
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


    async onOpen(): Promise<void> {
        InitToolBar(this)
    }

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





}

