import { SkillNode } from "./skill_node";

export class OptionalNode extends SkillNode {
    readonly nodeTypeName = 'OptionalNode';

    get userCompletable(): boolean {
        return false
    }

    constructor(data: Partial<OptionalNode> = {}) {
        super(data);
    }

    validate(): void {
        super.validate()
        // if (this.allNonOptionalFromsComplete()) {
        //     this.state = 'complete'
        //     this.cascadeFrom()
        // }
    }

    static fromJSON(data: any): OptionalNode {
        return new OptionalNode(data);
    }
}

