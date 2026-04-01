import { SkillNode } from "./skill_node";

export class CheckpointNode extends SkillNode {
    readonly nodeTypeName = 'CheckpointNode';

    get optional(): boolean { return false; }
    get checkpoint(): boolean { return true; }
    get repeating(): boolean { return false; }
    get hasTasks(): boolean { return false; }
    get treeLink(): string | null { return null; }

    constructor(data: Partial<CheckpointNode> = {}) {
        super(data);
    }

    validate(): void {
        super.validate()
        if (this.allNonOptionalChildrenComplete()) {
            this.state = 'complete'
            this.cascadeToParents()
        }
    }

    static fromJSON(data: any): CheckpointNode {
        return new CheckpointNode(data);
    }
}
