import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode } from "./interfaces";
import { SkillTask } from "../interfaces";
import { SkillTreeView } from "src/skilltreeview";
import { AddNode, GetEdges, GetNodeByID, GetNodes, RemoveNode, ReplaceNode } from "src/tree_manager";
import { SkillModalDescription as SkillModalStatsDescription, SkillModalHeaderRight, SkillModalOpenFileButton, SkillModalStatsSpan, SkillModalHeader, SkillModalSetHeaderText, SkillModalTasks } from "src/modal/skilltree_stats_modal";
import { SKILL_TREE_STYLES } from "src/styles";

// TODO: Maybe change to base skill node
export class SkillNode implements ISkillNode {
    readonly nodeTypeName: string = "BaseNode";

    // This should be allowed to change by anybody
    get userCompletable(): boolean {
        return true
    }

    id: string | number;
    x: number;
    y: number;
    state: NodeState;


    heldState: NodeState | null = null;
    previousState: NodeState | null = null
    exp: number;
    fileLink?: string;
    shape: NodeShape;
    colorOverride: typeof SKILL_TREE_STYLES.gamified.nodeColors = { ...SKILL_TREE_STYLES.gamified.nodeColors };

    to: SkillNode[] = [];
    from: SkillNode[] = [];
    canSkipOrphanUnavailable: boolean = false;
    tasks: SkillTask[] = [];

    constructor(data: Partial<ISkillNode> = {}) {
        this.id = data.id ?? crypto.randomUUID()
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.state = data.state ?? 'unavailable';
        this.heldState = data.heldState ?? null;
        this.exp = data.exp ?? 0;
        this.fileLink = data.fileLink;
        this.shape = data.shape ?? 'circle';
        this.colorOverride = data.colorOverride ?? { ...SKILL_TREE_STYLES.gamified.nodeColors };
    }

    protected allNonOptionalFromsComplete(): boolean {
        for (let from of this.from) {
            if (from.nodeTypeName == "OptionalNode") {
                continue
            }
            if (from.state != "complete") {



                return false
            }
        }
        return true
    }

    updateRelationShips() {
        const edges = GetEdges();
        const nodes = GetNodes();

        this.from = edges
            .filter((e) => e.to === this.id)
            .map((e) => nodes.get(e.from as string | number))
            .filter((n): n is SkillNode => n !== undefined);

        this.to = edges
            .filter((e) => e.from === this.id)
            .map((e) => nodes.get(e.to as string | number))
            .filter((n): n is SkillNode => n !== undefined);
    }

    validateOrphanNode() {
        this.state = "unavailable"
    }

    validateStartNode() {
        if (this.userCompletable && this.state === "complete") {
            return
        }

        this.state = "in-progress"
    }

    validateIntermediateNode() {
        if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else if (this.allNonOptionalFromsComplete()) {
            // Only set to in-progress if not already complete (user manually marked it)
            if (this.state !== "complete") {
                this.state = "in-progress"
            }
        }
        else {
            this.state = "unavailable"
        }

    }


    validateEndNode() {
        if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else if (this.allNonOptionalFromsComplete()) {
            // Only set to in-progress if not already complete (user manually marked it)
            if (this.state !== "complete") {
                this.state = "in-progress"
            }
        }
        else {
            this.state = "unavailable"
        }

    }

    private static validating = new Set<string | number>();


    async validateHasTasks() {
        if (!this.tasks || this.tasks.length === 0) return

        const { TaskNode } = await import("./task_node");

        const toNodes = [...this.to];
        const fromNodes = [...this.from];

        const newTaskNode = new TaskNode(this as any);

        newTaskNode.to = toNodes;
        newTaskNode.from = fromNodes;
        newTaskNode.previousType = this.nodeTypeName

        ReplaceNode(this.id, newTaskNode)

    }

    validate(): void {

        if (SkillNode.validating.has(this.id)) return;

        this.validateHasTasks()

        SkillNode.validating.add(this.id);


        switch (this.getStructuralType()) {
            case "orphaned":
                this.validateOrphanNode()
                break;
            case "start":
                this.validateStartNode()
                break;
            case "intermediate":
            case "end":
                this.validateEndNode()
                break;
        }

        this.cascadeTo()

        SkillNode.validating.delete(this.id);
    }

    getStructuralType(): NodeType {
        const to = this.to.length > 0;
        const from = this.from.length > 0;

        if (!to && !from) return 'orphaned';
        if (!from && to) return 'start';
        if (!to && from) return 'end';

        return 'intermediate';
    }

    getNodeType(): NodeType {
        return this.getStructuralType();
    }

    cascadeTo(): void {
        if (this.to.length == 0) {
            return
        }
        for (const to of this.to) {
            to.validate();
        }
    }

    protected informFromNodes(): void {
        if (this.from.length == 0) {
            return
        }
        // TODO: Grab info from 'from' nodes to populate stats modal
        // for (const from of this.from) {
        //     from.validate();
        // }
    }

    protected hasUnavailableFroms(): boolean {
        return this.from.some(from => from.state === 'unavailable');
    }

    protected hasOnHoldFrom(): boolean {
        return this.to.some(from => from.state === 'on-hold');
    }

    protected hasRepeatingInProgressFrom(): boolean {
        return this.to.some(from => {
            // TODO: 
            // return from.repeating && from.state === 'in-progress';
        });
    }

    protected allFromsComplete(): boolean {
        return this.to.length > 0 && this.to.every(child => child.state === 'complete');
    }

    protected canBeComplete(): boolean {
        return true;
    }

    toJSON(): Record<string, any> {
        return {
            nodeType: this.nodeTypeName,
            id: this.id,
            x: this.x,
            y: this.y,
            state: this.state,
            heldState: this.heldState,
            previousState: this.previousState,
            exp: this.exp,
            fileLink: this.fileLink,
            shape: this.shape,
            tasks: this.tasks,
            colorOverride: this.colorOverride,
        };
    }

    static fromJSON(data: any): SkillNode {
        return new SkillNode(data)
    }

    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement) {
        const header = SkillModalHeader(modal)

        // Title: prefer the node's filename (no directories or .md); fallback to display label
        const titleText = this.fileLink ? (() => {
            let p = this.fileLink.trim();
            // drop any leading slash
            if (p.startsWith('/')) p = p.substring(1);
            const parts = p.split('/');
            let fname = parts[parts.length - 1] || p;
            if (fname.toLowerCase().endsWith('.md')) fname = fname.slice(0, -3);
            return fname;
        })() : (this.fileLink || 'Node');
        SkillModalSetHeaderText(header, titleText)
        const headerRight = SkillModalHeaderRight(header)
        SkillModalStatsSpan(modal)
        SkillModalStatsDescription(this, modal)
        SkillModalTasks(this, modal)
        await SkillModalOpenFileButton(this, headerRight)
    }

}
