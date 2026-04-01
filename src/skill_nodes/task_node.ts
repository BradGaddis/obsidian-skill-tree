import { SkillNode } from "./skill_node";

export class TaskNode extends SkillNode {
    readonly nodeTypeName = 'TaskNode';

    get optional(): boolean { return false; }
    get checkpoint(): boolean { return false; }
    get repeating(): boolean { return false; }
    get hasTasks(): boolean { return true; }
    get treeLink(): string | null { return null; }

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

