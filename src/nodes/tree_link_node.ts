import { SkillNode } from "./skill_node";
import { NodeShape, NodeState } from "./types";
import { LabelInfo } from "../types/interfaces";
import { view } from "../utils/globals";

export class TreeLinkNode extends SkillNode {
    treeLink: string = '';
    linkedTreeComplete: boolean = false;

    shape: NodeShape = "diamond"
    terminalState: NodeState = "unavailable"

    readonly nodeTypeName = 'TreeLinkNode';

    constructor(data: Partial<TreeLinkNode> = {}) {
        super(data);
        this.treeLink = data.treeLink ?? '';
        this.exp = 0;
        this.linkedTreeComplete = data.linkedTreeComplete ?? false;
    }

    displayText: string | undefined = `Linked Skill Tree ${this.treeLink}`

    get linkable(): boolean {
        return false
    }

    get userCompletable(): boolean {
        return false;
    }

    getDisplayLabel(): LabelInfo {
        const label = this.state === "complete" ? "Completed" : "In Progress";
        return { label, lines: [label] };
    }

    validateEndNode(): void {
        if (this.allNonOptionalFromsComplete()) {
            this.state = "inProgress"
        }
        else if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else {
            this.state = "unavailable"
        }

        if (this.terminalState == "complete") {
            this.state = "complete"
        }
    }

    validate(): void {
        super.validate();

        if (!view.settings.trees?.[this.treeLink]) {
            this.cascadeTo();
            return;
        }

        const linkedTree = view.settings.trees[this.treeLink];
        if (!linkedTree) {
            this.cascadeTo();
            return;
        }
        const nodes = linkedTree.nodes;

        if (!nodes) {
            this.cascadeTo();
            return;
        }

        const linkedTerminalNode = nodes.find(
            (node: any) => node.nodeTypeName === "TerminalNode"
        );

        if (!linkedTerminalNode) {
            console.error("didn't find the terminal node")
            this.cascadeTo()
            return
        }

        this.terminalState = linkedTerminalNode.state;
    }

    getStatsModalRows(content: HTMLElement): void {
        const stateRow = content.createEl('div');
        stateRow.classList.add('skill-tree-stats-modal-row');
        stateRow.textContent = `State: ${this.state}`;
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            treeLink: this.treeLink,
            linkedTreeComplete: this.linkedTreeComplete,
        };
    }

    static fromJSON(data: any): TreeLinkNode {
        return new TreeLinkNode(data);
    }
}
