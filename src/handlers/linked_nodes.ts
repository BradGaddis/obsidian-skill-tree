import { SkillNode } from "../nodes/skill_node";
import { GetNodes } from "../data/tree_manager";

export let linkedNodes: Map<string, SkillNode> = new Map()

export function RefreshLinkedNodes(): void {
    linkedNodes.clear();
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (node.fileLink) {
            linkedNodes.set(node.fileLink, node);
        }
    }
}

export function AddToLinkedNodes(filePath: string, node: SkillNode): void {
    linkedNodes.set(filePath, node);
}

export function RemoveFromLinkedNodes(filePath: string): void {
    linkedNodes.delete(filePath);
}
