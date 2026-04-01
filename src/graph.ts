
// import { BaseSkillNode, fromJSON, Edge, State, NodeType } from './node/node';

// export { BaseSkillNode, fromJSON, Edge, State, NodeType };
// export type SkillNode = BaseSkillNode;

import { SkillNode } from "./skill_nodes/skill_node";
import { SkillEdge } from "./interfaces";

export class Graph {
    nodes: Map<string | number, SkillNode> = new Map();
    edges: SkillEdge[] = [];
    //
    // addNode(data: Partial<BaseSkillNode> = {}): BaseSkillNode {
    //     const node = fromJSON(data as any);
    //     this.nodes.set(node.id, node);
    //     return node;
    // }
    //
    // removeNode(nodeId: string | number): void {
    //     this.edges = this.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    //     this.nodes.delete(nodeId);
    // }
    //
    // addEdge(from: string | number, to: string | number): Edge {
    //     const edge: Edge = {
    //         id: Date.now() + Math.random(),
    //         from,
    //         to,
    //     };
    //     this.edges.push(edge);
    //     this.rebuildRelationships();
    //     return edge;
    // }
    //
    // removeEdge(edgeId: number): void {
    //     this.edges = this.edges.filter(e => e.id !== edgeId);
    //     this.rebuildRelationships();
    // }
    //
    // getNode(nodeId: string | number): BaseSkillNode | undefined {
    //     return this.nodes.get(nodeId);
    // }
    //
    // findNode(nodeId: string | number): BaseSkillNode | undefined {
    //     return this.nodes.get(nodeId);
    // }
    //
    // findNodeBy(predicate: (node: BaseSkillNode) => boolean): BaseSkillNode | undefined {
    //     for (const node of this.nodes.values()) {
    //         if (predicate(node)) {
    //             return node;
    //         }
    //     }
    //     return undefined;
    // }
    //
    // getAllNodes(): BaseSkillNode[] {
    //     return Array.from(this.nodes.values());
    // }
    //
    // getChildren(nodeId: string | number): BaseSkillNode[] {
    //     const node = this.nodes.get(nodeId);
    //     return node ? node.children : [];
    // }
    //
    // getParents(nodeId: string | number): BaseSkillNode[] {
    //     const node = this.nodes.get(nodeId);
    //     return node ? node.parents : [];
    // }
    //
    // private clearRelationships(): void {
    //     for (const node of this.nodes.values()) {
    //         node.children = [];
    //         node.parents = [];
    //     }
    // }
    //
    // private buildRelationshipsFromEdges(): void {
    //     for (const edge of this.edges) {
    //         if (edge.from == null || edge.to == null) continue;
    //         const childNode = this.nodes.get(edge.from);
    //         const parentNode = this.nodes.get(edge.to);
    //         if (childNode && parentNode) {
    //             childNode.parents.push(parentNode);
    //             parentNode.children.push(childNode);
    //         }
    //     }
    // }
    //
    // rebuildRelationships(): void {
    //     this.clearRelationships();
    //     this.buildRelationshipsFromEdges();
    // }
    //
    // loadFromJSON(nodesData: any[], edgesData: Edge[]): void {
    //     this.nodes.clear();
    //     this.edges = [...edgesData];
    //
    //     for (const data of nodesData) {
    //         const node = fromJSON(data);
    //         this.nodes.set(node.id, node);
    //     }
    //
    //     this.rebuildRelationships();
    // }
    //
    // toJSON(): { nodes: any[]; edges: Edge[] } {
    //     return {
    //         nodes: this.getAllNodes().map(n => n.toJSON()),
    //         edges: [...this.edges],
    //     };
    // }
    //
    // getNodeType(nodeId: string | number): string {
    //     const node = this.nodes.get(nodeId);
    //     return node ? node.getNodeType() : 'unknown';
    // }
    //
    // isOrphaned(nodeId: string | number): boolean {
    //     return this.getNodeType(nodeId) === 'orphaned';
    // }
}
