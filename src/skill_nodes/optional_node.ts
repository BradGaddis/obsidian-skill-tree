import { SKILL_TREE_OPTIONAL_NODE_STYLE_OVERRIDE, SKILL_TREE_STYLES } from "src/styles";
import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";

export class OptionalNode extends SkillNode {
    readonly nodeTypeName = 'OptionalNode';

    shape: NodeShape = "square"
    displayText?: string | undefined = "Optional";

    get userCompletable(): boolean {
        return false
    }

    get linkable(): boolean {
        return false
    }

    constructor(data: Partial<OptionalNode> = {}) {
        super(data);
        this.colorOverride.unavailable = { fill: '#0525cd', stroke: '#4b0082' }

    }

    validate(): void {
        super.validate()
    }

    static fromJSON(data: any): OptionalNode {
        return new OptionalNode(data);
    }
}

