import { SkillNode } from "../nodes/skill_node";
import { GetNodes, NodeFromJSON, RemoveNode } from "../data/tree_manager";
import { App, TFile } from "obsidian";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { parseYamlFrontmatter } from "../types/utils";
import { view } from "../utils/globals";
import { linkedNodes } from "./linked_nodes";
import { handleMetadataChange } from "./metadata_sync";

const treeCreationCooldowns = new Map<string, number>();
const TREE_CREATE_COOLDOWN_MS = 2000;

function removeNodeFromNonTargetTrees(nodeId: string, targetTrees: string[]): void {
    for (const treeName of Object.keys(view.settings.trees)) {
        if (targetTrees.includes(treeName)) continue;
        const tree = view.settings.trees[treeName];
        if (!tree) continue;
        const idx = tree.nodes.findIndex((n: any) => n.id === nodeId);
        if (idx !== -1) tree.nodes.splice(idx, 1);
        if (treeName === view.settings.currentTreeName) RemoveNode(nodeId);
    }
}

export async function writeTreesToFrontmatter(app: App, file: TFile, targetTrees: string[]): Promise<void> {
    await app.fileManager.processFrontMatter(file, (fm) => {
        fm['skilltree-tree'] = targetTrees.length === 1 ? targetTrees[0] : targetTrees;
    });
}

export function ensureNodeInTree(treeName: string, nodeId: string, validated: any, file: TFile): SkillNode | null {
    let tree = view.settings.trees[treeName];
    if (!tree) {
        const now = Date.now();
        const lastCreate = treeCreationCooldowns.get(treeName) || 0;
        if (now - lastCreate >= TREE_CREATE_COOLDOWN_MS) {
            tree = { name: treeName, nodes: [], edges: [] };
            view.settings.trees[treeName] = tree;
            treeCreationCooldowns.set(treeName, now);
        }
    }

    if (!tree) return null;

    const isCurrentTree = treeName === view.settings.currentTreeName;
    const targetNodes = isCurrentTree ? GetNodes() : buildNodeMap(tree);
    const fileLink = file.path;

    let node = targetNodes?.get(nodeId) || findNodeByFileLink(targetNodes!, fileLink, nodeId);

    if (!node) {
        node = createNodeFromValidated(validated, nodeId, fileLink);
        targetNodes?.set(nodeId, node);
        addNodeToTreeData(tree, node);
        if (isCurrentTree) linkedNodes.set(fileLink, node);
    }

    return node;
}

function buildNodeMap(tree: any): Map<string, SkillNode> | null {
    if (!tree) return null;
    const nodes = new Map<string, SkillNode>();
    for (const nodeData of tree.nodes || []) {
        const node = NodeFromJSON(nodeData);
        if (node) nodes.set(node.id as string, node);
    }
    return nodes;
}

function findNodeByFileLink(nodes: Map<string | number | null, SkillNode>, fileLink: string, targetId: string): SkillNode | null {
    for (const [id, node] of nodes) {
        if (node.fileLink === fileLink && id !== targetId) {
            nodes.delete(id);
            nodes.set(targetId, node);
            node.id = targetId;
            return node;
        }
    }
    return null;
}

function createNodeFromValidated(validated: any, targetNodeId: string, fileLink: string): SkillNode {
    const nodeX = validated.x ?? 200;
    const nodeY = validated.y ?? 200;
    const exp = validated.exp ?? view.settings.defaultExp;

    const nodeData: any = {
        id: targetNodeId,
        x: nodeX,
        y: nodeY,
        state: 'unavailable',
        nodeTypeName: 'BaseNode',
        fileLink: fileLink,
        exp: exp
    };

    const node = NodeFromJSON(nodeData);
    if (!node) throw new Error('Failed to create node from validated data');
    return node;
}

function addNodeToTreeData(tree: any, node: SkillNode): void {
    const existingIdx = tree.nodes.findIndex((n: any) => n.id === node.id);
    if (existingIdx === -1) {
        tree.nodes.push({
            id: node.id,
            x: node.x,
            y: node.y,
            state: node.state,
            nodeTypeName: node.nodeTypeName,
            fileLink: node.fileLink,
            exp: node.exp
        });
    }
}

export async function handleFileChange(app: App, file: TFile): Promise<void> {
    if (!view.settings) return;

    const fileContent = await app.vault.read(file);
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
    const fm = frontmatterMatch && frontmatterMatch[1] ? parseYamlFrontmatter(frontmatterMatch[1]) : {};

    const validated = validateFrontmatter(fm);
    const currentTreeName = view.settings.currentTreeName;
    const targetNodeId = validated.skilltreeNode;
    const targetTrees = validated.skilltreeTrees;

    if (!targetNodeId) {
        // Don't remove node if frontmatter doesn't have skilltree-node - might be initial link
        return;
    }

    await writeTreesToFrontmatter(app, file, targetTrees);

    removeNodeFromNonTargetTrees(targetNodeId, targetTrees);

    for (const targetTreeName of targetTrees) {
        const node = ensureNodeInTree(targetTreeName, targetNodeId, validated, file);
        if (node && targetTreeName === currentTreeName) {
            await handleMetadataChange(node, file, validated);
        }
    }
}
