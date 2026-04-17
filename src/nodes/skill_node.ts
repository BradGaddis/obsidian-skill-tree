import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode, LabelInfo } from "../types/interfaces";
import { SkillTask, SkillEdge } from "../types/interfaces";
import { GetEdges, GetNodes, RemoveEdge, IsCurrentTreeLocked, PromoteToTaskNode } from "../data/tree_manager";
import { NODE_COLORS, WORDS_PER_LINE, UNLINKED_LABEL } from "../types/constants";
import { view } from "../utils/globals";
import { SaveNodes } from "../data/recorder";


export class SkillNode implements ISkillNode {
    id: string | number;
    x: number;
    y: number;

    shape: NodeShape = "hexagon"
    displayText: string | undefined;
    fileLink?: string;
    _state: NodeState = "unavailable";
    heldState: NodeState | null = null;
    exp: number;
    accumulatedExp: number;
    totalExp: number;
    colorOverride: typeof NODE_COLORS = { ...NODE_COLORS };

    to: SkillNode[] = [];
    from: SkillNode[] = [];
    tasks: SkillTask[] = [];

    private _prevState: NodeState = this._state
    _userModified: boolean = false;
    _fromNote: boolean = false;

    readonly nodeTypeName: string = "BaseNode";

    getEditModalRows?(content: HTMLElement): void;
    getStatsModalRows?(content: HTMLElement): void;

    set state(val: NodeState) {
        if (val == this._prevState) {
            return
        }
        this._prevState = val
        this._state = val
        SaveNodes()
    }

    get state() {
        return this._state
    }

    get userModified(): boolean { return this._userModified; }
    set userModified(val: boolean) { this._userModified = val; }

    get fromNote(): boolean { return this._fromNote; }
    set fromNote(val: boolean) { this._fromNote = val; }

    get userCompletable(): boolean {
        return true
    }

    get linkable(): boolean { return true }

    get onlyTo(): boolean { return false }
    get onlyFrom(): boolean { return false }

    constructor(data: Partial<ISkillNode> = {}) {
        this.id = data.id ?? crypto.randomUUID()
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.state = data.state ?? 'unavailable';
        this.heldState = data.heldState ?? null;
        this.exp = data.exp ?? view.settings.defaultExp;
        this.fileLink = data.fileLink;
        this.shape = data.shape ?? 'hexagon';
        this.colorOverride = data.colorOverride ?? { ...NODE_COLORS };
        this.displayText = data.displayText ?? '';
        this.accumulatedExp = data.accumulatedExp ?? 0
        this.totalExp = data.totalExp ?? 0
    }

    //TODO: finish this tomorrow
    getDisplayLabel(): LabelInfo {
        let label: string = ''

        label = this.displayText ?? ''

        if (this.fileLink && !this.displayText) {
            this.displayText = this.fileLink.split('/').pop()?.replace('.md', '') || label;
        }


        const words = (label || '').split(/\s+/).filter(Boolean);

        const lines: string[] = [];

        for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
            lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '));
        }

        if (this.linkable && !this.fileLink) {
            lines.push(UNLINKED_LABEL)
        }

        return { label, lines };
    }

    protected allNonOptionalFromsComplete(): boolean {
        const firstFrom = this.from[0];
        if (this.from.length == 1 && firstFrom && firstFrom.nodeTypeName === "OptionalNode") return true
        return !this.from.some(n => n.nodeTypeName !== "OptionalNode" && n.state !== "complete")
    }

    updateRelationShips(edge?: SkillEdge) {
        if (this.state == "error" || !this.id) {
            let edges = GetEdges().filter(e => e.from == this.id || e.to == this.id)
            for (let edge of edges) {
                RemoveEdge(edge.id);
            }
            this.from = []
            this.to = []
            return
        }

        // When called WITHOUT an edge, do FULL rebuild
        if (!edge) {
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
            return
        }

        if (edge.to === this.id) {
            const fromNode = GetNodes().get(edge.from as string | number);
            if (fromNode && !this.from.includes(fromNode)) {
                this.from.push(fromNode);
            }
        }
        if (edge.from === this.id) {
            const toNode = GetNodes().get(edge.to as string | number);
            if (toNode && !this.to.includes(toNode)) {
                this.to.push(toNode);
            }
        }

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

        this.state = "inProgress"
    }

    protected calculateExpFromSources() {
        this.accumulatedExp = 0;
        this.totalExp = 0;

        for (const from of this.from) {
            this.totalExp += from.totalExp;
            if (from.state === "complete") {
                this.accumulatedExp += from.accumulatedExp;
            }
        }

        // Add this node's own exp value (its "worth")
        this.totalExp += this.exp;
        if (this.state === "complete") {
            this.accumulatedExp += this.exp;
        }
    }



    validateEndNode() {
        if (this.allNonOptionalFromsComplete() && this.userCompletable) {
            // Only set to in-progress if not already complete (user manually marked it)
            if (this.state !== "complete") {
                this.state = "inProgress"
            }
        }

        else if (this.allNonOptionalFromsComplete()) {
            this.state = "complete"
        }
        else if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else {
            this.state = "unavailable"
        }

    }

    private static validating = new Set<string | number>();



    validate(): void {
        this.calculateExpFromSources();
        if (IsCurrentTreeLocked()) {
            this.state = "unavailable"
            return
        }
        if (this.state == "error") {
            return
        }
        const hasBlockingFrom = this.hasOnHoldFrom() || this.hasRepeatingInProgressFrom();

        if (hasBlockingFrom && this.state != "onHold") {
            this.heldState = this.state
            this.state = "onHold"
            this.cascadeTo()
            return
        }

        if (this.state === "onHold" && !this.heldState) {
            this.state = "error"
            this.cascadeTo()
            return
        }

        if (this.state === "onHold") {
            this.state = this.heldState!
            this.heldState = null
            this.validate()
            return
        }

        if (SkillNode.validating.has(this.id)) return;
        SkillNode.validating.add(this.id);

        PromoteToTaskNode(this);

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

    protected hasUnavailableFroms(): boolean {
        return this.from.some(from => from.state === 'unavailable');
    }

    protected hasOnHoldFrom(): boolean {
        return this.from.some(from => from.state === 'onHold');
    }

    protected hasRepeatingInProgressFrom(): boolean {
        return this.from.some(from => {
            return from.nodeTypeName === "RepeatingNode" && from.state === 'inProgress';
        })
    }

    protected allFromsComplete(): boolean {
        return this.to.length > 0 && this.to.every(child => child.state === 'complete');
    }

    protected canBeComplete(): boolean {
        return true;
    }

    toJSON(): Record<string, any> {
        return {
            nodeTypeName: this.nodeTypeName,
            id: this.id,
            x: this.x,
            y: this.y,
            state: this.state,
            heldState: this.heldState,
            exp: this.exp,
            fileLink: this.fileLink,
            shape: this.shape,
            tasks: this.tasks,
            colorOverride: this.colorOverride,
            displayText: this.displayText,
            accumulatedExp: this.accumulatedExp
        };
    }

    static fromJSON(data: any): SkillNode {
        return new SkillNode(data)
    }

}

