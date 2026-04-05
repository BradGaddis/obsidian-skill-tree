import { SkillNode } from "./skill_node";

export class OptionalNode extends SkillNode {
    readonly nodeTypeName = 'OptionalNode';

    get optional(): boolean { return true; }
    get checkpoint(): boolean { return false; }
    get repeating(): boolean { return false; }
    get hasTasks(): boolean { return false; }
    get treeLink(): string | null { return null; }

    constructor(data: Partial<OptionalNode> = {}) {
        super(data);
    }

    validate(): void {
        super.validate()
        if (this.allNonOptionalChildrenComplete()) {
            this.state = 'complete'
            this.cascadeTo()
        }
    }

    static fromJSON(data: any): OptionalNode {
        return new OptionalNode(data);
    }
}

