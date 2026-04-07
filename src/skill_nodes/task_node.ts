import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "./skill_node";
import { ReplaceNode } from "src/tree_manager";

export class TaskNode extends SkillNode {
    // TODO: remove this, as class alone defines the node type
    readonly nodeTypeName = 'TaskNode';
    previousType: string

    constructor(data: Partial<TaskNode> = {}) {
        super(data);
        this.previousType = data?.previousType ?? ""
    }

    validate(): void {
        if (!this.tasks || this.tasks.length === 0) {
            this.demoteToPreviousType();
        }
        this.cascadeTo()
    }

    async demoteToPreviousType(): Promise<void> {
        const treeModule = await import("src/tree_manager");
        const GetNodes = treeModule.GetNodes;
        const RemoveNode = treeModule.RemoveNode;
        const NodeFromJSON = treeModule.NodeFromJSON;

        const targetType = this.previousType || 'BaseNode';
        const toNodes = [...this.to];
        const fromNodes = [...this.from];

        const newNodeData = {
            ...this.toJSON(),
            nodeType: targetType
        };

        const newNode: SkillNode = NodeFromJSON(newNodeData);

        if (newNode) {
            newNode.to = toNodes;
            newNode.from = fromNodes;
            ReplaceNode(this.id, newNode)
        }
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

    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement) {
    }
}

