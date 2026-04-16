import { SkillNode } from "../nodes/skill_node";
import { GetNodes, NodeFromJSON, RemoveNode } from "../data/tree_manager";
import { App, TAbstractFile, TFile } from "obsidian";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { view } from "../utils/globals";
import { parseTasksFromNode } from "../data/task_parser";

let fileWatcherRef: any = null;
let deleteWatcherRef: any = null;
let modifiedWatcherRef: any = null;
let dataFileWatcherRef: any = null;

export let linkedNodes: Map<string, SkillNode> = new Map()

export function RefreshLinkedNodes(): void {
    linkedNodes.clear();
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (node.fileLink) {
            const filePath = node.fileLink.endsWith('.md') ? node.fileLink : node.fileLink + '.md';
            linkedNodes.set(filePath, node);
        }
    }
}

export function AddToLinkedNodes(filePath: string, node: SkillNode): void {
    const normalizedPath = filePath.endsWith('.md') ? filePath : filePath + '.md';
    linkedNodes.set(normalizedPath, node);
}

export function RemoveFromLinkedNodes(filePath: string): void {
    const normalizedPath = filePath.endsWith('.md') ? filePath : filePath + '.md';
    linkedNodes.delete(normalizedPath);
}

export function SetupFileWatchers(app: App = view.app): void {
    if (fileWatcherRef) {
        app.metadataCache.offref(fileWatcherRef);
    }

    if (deleteWatcherRef) {
        app.vault.offref(deleteWatcherRef);
    }

    if (modifiedWatcherRef) {
        app.vault.offref(modifiedWatcherRef);
    }

    const listener = async (file: TFile) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;

        const fm = app.metadataCache.getFileCache(file)?.frontmatter;

        const validated = validateFrontmatter(fm);

        const currentTreeName = view.settings.currentTreeName;

        if (!validated.skilltreeNode || validated.skilltreeTrees.length === 0) {
            const linkedNode = linkedNodes.get(file.path);
            if (linkedNode) {
                RemoveNode(linkedNode.id);
            }
            return;
        }

        const targetNodeId = validated.skilltreeNode;
        const targetTrees = validated.skilltreeTrees;

        const isInCurrentTree = targetTrees.includes(currentTreeName);

        for (const targetTreeName of targetTrees) {
            let targetNodes: Map<string | number | null, SkillNode>;
            let targetTree: any;
            let isCurrentTree = targetTreeName === currentTreeName;

            if (isCurrentTree) {
                targetNodes = GetNodes();
                targetTree = view.settings.trees[targetTreeName];
            } else {
                targetTree = view.settings.trees[targetTreeName];
                if (!targetTree) continue;
                targetNodes = new Map();
                for (const nodeData of targetTree.nodes || []) {
                    const node = NodeFromJSON(nodeData);
                    if (node) targetNodes.set(node.id, node);
                }
            }

            let node = targetNodes.get(targetNodeId);

            if (!node) {
                const nodeX = validated.x ?? 200;
                const nodeY = validated.y ?? 200;
                const exp = validated.exp ?? view.settings.defaultExp;
                const fileLink = file.path.replace(/\.md$/, '');

                node = NodeFromJSON({
                    id: targetNodeId,
                    x: nodeX,
                    y: nodeY,
                    state: 'unavailable',
                    nodeTypeName: 'BaseNode',
                    fileLink: fileLink,
                    exp: exp
                });

                if (!node) continue;

                targetNodes.set(targetNodeId, node);

                targetTree.nodes.push({
                    id: targetNodeId,
                    x: nodeX,
                    y: nodeY,
                    state: 'unavailable',
                    nodeTypeName: 'BaseNode',
                    fileLink: fileLink,
                    exp: exp
                } as any);

                if (isCurrentTree) {
                    linkedNodes.set(file.path, node);
                }
            }

            if (isInCurrentTree && isCurrentTree) {
                await handleMetadataChange(node, file, validated);
            }
        }
    };

    async function handleMetadataChange(node: SkillNode, file: TFile, validated: ReturnType<typeof validateFrontmatter>): Promise<void> {
        let updated = false;

        if (!node.fileLink) {
            node.fileLink = file.path.replace(/\.md$/, '');
            linkedNodes.set(file.path, node);
            updated = true;
        } else if (!linkedNodes.has(file.path)) {
            linkedNodes.set(file.path, node);
        }

        if (!node.userCompletable) {
            return;
        }

        if (validated.shape) {
            node.shape = validated.shape;
            updated = true;
        }
        if (validated.exp !== undefined) {
            node.exp = validated.exp;
            updated = true;
        }
        if (validated.x !== undefined) {
            node.x = validated.x;
            updated = true;
        }
        if (validated.y !== undefined) {
            node.y = validated.y;
            updated = true;
        }
        if (validated.displayText !== null) {
            node.displayText = validated.displayText || undefined;
            updated = true;
        }

        if (updated) {
            node.userModified = true;
            node.fromNote = false;
        }
    }

    const deleteListener = (file: TAbstractFile) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;

        linkedNodes.delete(file.path);

        const nodes = GetNodes();

        for (const node of nodes.values()) {
            if (!node.fileLink) continue;

            const nodeFilePath = node.fileLink.trim().endsWith('.md')
                ? node.fileLink.trim()
                : node.fileLink.trim() + '.md';

            if (nodeFilePath !== file.path) continue;

            node.fileLink = undefined;
            node.tasks = [];
            RemoveFromLinkedNodes(nodeFilePath);
        }
    };

    const modified = async (file: TAbstractFile) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
        if (!linkedNodes.has(file.path)) return;
        const node = linkedNodes.get(file.path);
        if (!node) return;
        const newTasks = await parseTasksFromNode(app, node);
        if (node.tasks === newTasks) return;
        node.tasks = newTasks;
    }

    modifiedWatcherRef = app.vault.on('modify', modified);
    fileWatcherRef = app.metadataCache.on('changed', listener);
    deleteWatcherRef = app.vault.on('delete', deleteListener);

    const dataFileListener = (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (file.path !== 'data.json') return;
        console.log("Project Data was changed");
    };

    dataFileWatcherRef = app.vault.on('modify', dataFileListener);
}

export function CleanupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.metadataCache.offref(fileWatcherRef);
        fileWatcherRef = null;
    }
    if (deleteWatcherRef) {
        view.app.vault.offref(deleteWatcherRef);
        deleteWatcherRef = null;
    }
    if (modifiedWatcherRef) {
        view.app.vault.offref(modifiedWatcherRef);
        modifiedWatcherRef = null;
    }
    if (dataFileWatcherRef) {
        view.app.vault.offref(dataFileWatcherRef);
        dataFileWatcherRef = null;
    }
}
