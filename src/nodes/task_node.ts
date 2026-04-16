import { SkillNode } from "./skill_node";
import { DemoteFromTaskNode } from "../data/tree_manager";

export class TaskNode extends SkillNode {
    previousType: string

    readonly nodeTypeName = 'TaskNode';

    constructor(data: Partial<TaskNode> = {}) {
        super(data);
        this.previousType = data?.previousType ?? ""
    }

    get userCompletable(): boolean {
        return false
    }

    validate(): void {
        this.calculateExpFromSources()
        DemoteFromTaskNode(this);
        this.state = this.tasks.find(t => t.status !== "x") ? "inProgress" : "complete"
        this.cascadeTo()
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            previousType: this.previousType,
        };
    }

    static fromJSON(data: any): TaskNode {
        return new TaskNode(data);
    }
}
