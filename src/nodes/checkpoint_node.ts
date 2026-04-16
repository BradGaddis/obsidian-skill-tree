import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";
import { LabelInfo } from "../types/interfaces";

export class CheckpointNode extends SkillNode {
    shape: NodeShape = "star"

    readonly nodeTypeName = 'CheckpointNode';

    displayText: string | undefined = "Check Point"

    constructor(data: Partial<CheckpointNode> = {}) {
        super(data);
        this.exp = 0;
    }

    get userCompletable(): boolean {
        return false;
    }

    get linkable(): boolean {
        return false;
    }

    getDisplayLabel(): LabelInfo {
        return super.getDisplayLabel(this.displayText)
        // return { label: "Check Point", lines: ["Check Point"] };
    }

    validate(): void {
        super.validate()
        if (this.getStructuralType() != "orphaned") {
            if (this.allNonOptionalFromsComplete()) {
                this.state = 'complete'
                this.cascadeTo()
            }
        }
    }

    static fromJSON(data: any): CheckpointNode {
        return new CheckpointNode(data);
    }
}
