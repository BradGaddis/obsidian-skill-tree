import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";

export class CheckpointNode extends SkillNode {
    readonly nodeTypeName = 'CheckpointNode';
    shape: NodeShape = "diamond"
    displayText?: string | undefined = "Check Point";

    get userCompletable(): boolean {
        return false
    }

    constructor(data: Partial<CheckpointNode> = {}) {
        super(data);
    }

    validate(): void {
        super.validate()
        // if (this.allNonOptionalFromsComplete()) {
        //     this.state = 'complete'
        //     this.cascadeFromNode()
        // }
    }

    static fromJSON(data: any): CheckpointNode {
        return new CheckpointNode(data);
    }
}
