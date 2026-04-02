import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode } from "./interfaces";

export class SkillNode implements ISkillNode {
    readonly nodeTypeName: string = "BaseNode";

    get userCompletable(): boolean {
        return false
    }

    id: string;
    x: number;
    y: number;
    state: NodeState;
    heldState: NodeState | null = null;
    exp: number;
    fileLink?: string;
    shape: NodeShape;
    canSkipOrphanUnavailable: boolean = false;

    children: SkillNode[] = [];
    parents: SkillNode[] = [];

    constructor(data: Partial<ISkillNode> = {}) {
        this.id = crypto.randomUUID()
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.state = data.state ?? 'unavailable';
        this.heldState = data.heldState ?? null;
        this.exp = data.exp ?? 0;
        this.fileLink = data.fileLink;
        this.shape = data.shape ?? 'circle';
        this.canSkipOrphanUnavailable = data.canSkipOrphanUnavailable ?? false;
    }

    protected allNonOptionalChildrenComplete(): boolean {
        return false;
        // const nonOptional = this.children.filter(c => !c.optional);
        // return nonOptional.length > 0 && nonOptional.every(c => c.state === 'complete');
    }

    validate(): void {
        const originalState = this.state;
        const nodeType = this.getStructuralType();

        console.log(`Validating ${this.id}: ${this.nodeTypeName} which is a ${nodeType} node. Current state is ${originalState}
                children: ${this.children.map(child => String(child.id) + ": " + String(child.state))}
                parents: ${this.parents.map(parent => String(parent.id) + ": " + String(parent.state))}`)

        if (nodeType === 'orphaned') {
            if (this.state !== 'unavailable') {
                console.log("Updating state to unavailable")
                this.state = 'unavailable';
                this.cascadeToParents();
                return;
            }
            return;
        }
        if (this.hasUnavailableChild()) {
            if (this.state !== 'unavailable') {
                console.log("updating state to unavailable")
                this.state = 'unavailable';
                this.cascadeToParents();
                return;
            }
            return;
        }
        const hasOnHoldChild = this.hasOnHoldChild();
        const hasRepeatingInProgressChild = this.hasRepeatingInProgressChild();

        if (this.state === 'on-hold') {
            console.log('looking for reasons to come off hold...');
            if (hasOnHoldChild || hasRepeatingInProgressChild) {
                return
            }
            if (!this.heldState) {
                console.log("held state should never be null if we are on-hold")
                return
            }
            console.log("restoring state. then revalidating...")
            this.state = this.heldState;
            this.heldState = null;
            this.validate()
            return;
        }

        if (hasOnHoldChild || hasRepeatingInProgressChild) {
            this.heldState = originalState;
            this.state = 'on-hold';
            this.cascadeToParents();
            return;
        }

        if (nodeType === 'root' && this.state !== 'complete') {
            this.state = 'in-progress';
            if (this.state !== originalState) {
                this.cascadeToParents();
                return;
            }
            return;
        }

        if (nodeType !== 'root' && this.children.length > 0) {
            // TODO
            // const allNonOptionalComplete = this.children.every(c => c.optional || c.state === 'complete');
            // if (allNonOptionalComplete && this.state === 'unavailable') {
            //     this.state = 'in-progress';
            //     this.cascadeToParents();
            //     return;
            // }
        }
        if (this.hasIncompleteChild()) {
            console.log("found at least one in-progress child")
            this.state = 'unavailable'
            this.cascadeToParents();
            return;
        }
        this.cascadeToParents();
        return;
    }

    protected getStructuralType(): NodeType {
        const hasChildren = this.children.length > 0;
        const hasParents = this.parents.length > 0;

        if (!hasChildren && !hasParents) return 'orphaned';
        if (hasParents && !hasChildren) return 'root';
        if (hasChildren && !hasParents) return 'top';
        return 'intermediate';
    }

    getNodeType(): NodeType {
        return this.getStructuralType();
    }

    protected cascadeToParents(): void {
        if (this.parents.length == 0) {
            return
        }
        for (const parent of this.parents) {
            console.log(`${this.id} is cascading to parent ${parent.id} which is a ${parent.getStructuralType()} node. Current state is ${parent.state}
                  Parent ${parent.id} has children ${parent.children.map(child => String(child.id) + ": " + String(child.state))}`)
            parent.validate();
        }
    }

    protected hasUnavailableChild(): boolean {
        return this.children.some(child => child.state === 'unavailable');
    }

    protected hasOnHoldChild(): boolean {
        return this.children.some(child => child.state === 'on-hold');
    }

    protected hasRepeatingInProgressChild(): boolean {
        return this.children.some(child => {
            return child.repeating && child.state === 'in-progress';
        });
    }

    protected hasIncompleteChild(): boolean {
        return this.children.some(child => {
            return child.state == 'in-progress';
        });
    }

    protected allChildrenComplete(): boolean {
        return this.children.length > 0 && this.children.every(child => child.state === 'complete');
    }

    protected canBeComplete(): boolean {
        return true;
    }

    toJSON(): Record<string, any> {
        return {
            nodeType: this.nodeTypeName,
            id: this.id,
            x: this.x,
            y: this.y,
            state: this.state,
            heldState: this.heldState,
            exp: this.exp,
            fileLink: this.fileLink,
            shape: this.shape,
            canSkipOrphanUnavailable: this.canSkipOrphanUnavailable,
        };
    }

    static fromJSON(data: any): SkillNode {
        return new SkillNode(data)
    }

    addChild(node: SkillNode) {
        this.children.push(node);
    }

    addParent(node: SkillNode) {
        this.parents.push(node);
    }

}

