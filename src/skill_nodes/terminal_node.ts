import { SKILL_TREE_STYLES } from "src/styles";
import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";
import { GetNodes, RemoveNode } from "src/tree_manager";

export class TerminalNode extends SkillNode {
    readonly nodeTypeName = 'TerminalNode';

    shape: NodeShape = "star"

    get userCompletable(): boolean {
        return false
    }

    constructor(data: Partial<TerminalNode> = {}) {
        super(data);
        this.colorOverride.unavailable = { fill: '#2d2d2d', stroke: '#666666' }
        this.colorOverride.complete = { fill: '#ffd700', stroke: '#ff8c00' }
    }

    validate(): void {
        const structuralType = this.getStructuralType();
        if (structuralType !== 'end' && structuralType !== 'orphaned') {
            RemoveNode(this.id);
            return;
        }

        const nodes = GetNodes();
        for (const node of nodes.values()) {
            if (node.nodeTypeName === 'TerminalNode' && node.id !== this.id) {
                RemoveNode(this.id);
                return;
            }
        }

        super.validate();

        this.displayText = this.state == "complete" ? "Completed Tree" : "Tree In Progress"
    }

    validateEndNode(): void {
        if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else if (this.allNonOptionalFromsComplete()) {
            this.state = "complete"
        }
        else {
            this.state = "unavailable"
        }
    }

    static fromJSON(data: any): TerminalNode {
        return new TerminalNode(data);
    }
}
