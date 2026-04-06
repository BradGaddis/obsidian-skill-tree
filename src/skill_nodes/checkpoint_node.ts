import { SkillNode } from "./skill_node";

export class CheckpointNode extends SkillNode {
    readonly nodeTypeName = 'CheckpointNode';

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
