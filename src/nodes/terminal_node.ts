import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";
import { LabelInfo } from "../types/interfaces";
import { GetNodes, RemoveNode, nodes } from "../data/tree_manager";
import { SaveNodes } from "../data/recorder";
import { view } from "../utils/globals";

export class TerminalNode extends SkillNode {
    totalExp: number

    shape: NodeShape = "tree"

    readonly nodeTypeName = 'TerminalNode';
    displayText: string = "Final Skill In Tree"

    constructor(data: Partial<TerminalNode> = {}) {
        super(data);
        this.exp = 0;
        this.totalExp = data.totalExp ?? 0
    }

    get userCompletable(): boolean {
        return false
    }

    get onlyFrom(): boolean { return true }

    getDisplayLabel(): LabelInfo {
        const label = this.state === "complete" ? "Completed Tree" : "Tree In Progress";
        return { label, lines: [label] };
    }

    private recalculateAggregateExp() {
        let aggregateExp = 0;
        let aggregateTotalExp = 0;

        for (const treeName of Object.keys(view.settings.trees)) {
            const treeData = view.settings.trees[treeName];
            if (!treeData?.nodes) continue;

            const terminalNode = treeData.nodes.find(
                (n: any) => n.nodeTypeName === "TerminalNode"
            );

            if (terminalNode) {
                aggregateExp += terminalNode.accumulatedExp || 0;
                aggregateTotalExp += terminalNode.totalExp || 0;
            }
        }

        view.settings.aggregateExp = aggregateExp;
        view.settings.aggregateTotalExp = aggregateTotalExp;
    }

    validate(): void {
        this.accumulatedExp = 0
        this.totalExp = 0

        if (!nodes.has(this.id)) {
            nodes.set(this.id, this);
        }

        super.validate();
        for (const treeName of Object.keys(view.settings.trees)) {
            const treeData = view.settings.trees[treeName];
            if (!treeData?.nodes) continue;

            const storedTerm = treeData.nodes.find(
                (n: any) => n.nodeTypeName === "TerminalNode"
            );
            if (storedTerm) {
                const inMemTerm = nodes.get(`terminal-${treeName}`);
                const inMemAcc = inMemTerm?.accumulatedExp;
                const inMemTot = inMemTerm?.totalExp;

                if (inMemAcc !== undefined) storedTerm.accumulatedExp = inMemAcc;
                if (inMemTot !== undefined) storedTerm.totalExp = inMemTot;
            }
        }

        view.plugin.settings.currentExp = this.accumulatedExp
        view.plugin.settings.totalExp = this.totalExp

        this.recalculateAggregateExp();

        const structuralType = this.getStructuralType();

        if (structuralType !== 'end' && structuralType !== 'orphaned') {
            RemoveNode(this.id);
            return;
        }

        const nodeList = GetNodes();
        for (const node of nodeList.values()) {
            if (node.nodeTypeName === 'TerminalNode' && node.id !== this.id) {
                RemoveNode(this.id);
                return;
            }
        }

        SaveNodes()
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            accumulatedExp: this.accumulatedExp,
            totalExp: this.totalExp,
        };
    }

    static fromJSON(data: any): TerminalNode {
        return new TerminalNode(data);
    }
}
