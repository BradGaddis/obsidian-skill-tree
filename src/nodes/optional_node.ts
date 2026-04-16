import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";
import { LabelInfo } from "../types/interfaces";

export class OptionalNode extends SkillNode {
    shape: NodeShape = "circle"

    readonly nodeTypeName = 'OptionalNode';

    constructor(data: Partial<OptionalNode> = {}) {
        super(data);
        this.exp = 0
    }

    get userCompletable(): boolean {
        return false
    }

    get linkable(): boolean {
        return false
    }

    getDisplayLabel(): LabelInfo {
        return { label: this.displayText || "Optional", lines: [this.displayText || "Optional"] };
    }

    validate(): void {
        super.validate()
    }

    static fromJSON(data: any): OptionalNode {
        return new OptionalNode(data);
    }
}
