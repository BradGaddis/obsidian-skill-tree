import { SkillNode } from "./skill_node";

export class TreeLinkNode extends SkillNode {
    readonly nodeTypeName = 'TreeLinkNode';

    private _treeLink: string | null = null;
    linkedTreeComplete: boolean = false;

    get optional(): boolean { return false; }
    get checkpoint(): boolean { return false; }
    get repeating(): boolean { return false; }
    get hasTasks(): boolean { return false; }
    get treeLink(): string | null { return this._treeLink; }

    constructor(data: Partial<TreeLinkNode> = {}) {
        super(data);
        this._treeLink = data.treeLink ?? null;
        this.linkedTreeComplete = data.linkedTreeComplete ?? false;
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            treeLink: this.treeLink,
            linkedTreeComplete: this.linkedTreeComplete,
        };
    }

    static fromJSON(data: any): TreeLinkNode {
        return new TreeLinkNode(data);
    }
}
