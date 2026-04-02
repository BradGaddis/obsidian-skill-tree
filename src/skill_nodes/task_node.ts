import { SkillNode } from "./skill_node";

export class TaskNode extends SkillNode {
    readonly nodeTypeName = 'TaskNode';

    constructor(data: Partial<TaskNode> = {}) {
        super(data);
    }

    validate(): void {
        this.cascadeToParents()
        return;
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
        };
    }

    static fromJSON(data: any): TaskNode {
        return new TaskNode(data);
    }
}

