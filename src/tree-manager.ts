import { SkillEdge, SkillTreeData } from "./interfaces";
import { SaveNodes } from "./recorder";
import { CheckpointNode } from "./skill_nodes/checkpoint_node";
import { OptionalNode } from "./skill_nodes/optional_node";
import { RepeatingNode } from "./skill_nodes/repeating_node";
import { SkillNode } from "./skill_nodes/skill_node";
import { TaskNode } from "./skill_nodes/task_node";
import { TreeLinkNode } from "./skill_nodes/tree_link_node";
import { SkillTreeView } from "./skilltreeview";



// TODO refactor | cleanup

let view: SkillTreeView
let currentTree: SkillTreeData
let nodes: Map<string | number, SkillNode> = new Map();
let edges: SkillEdge[] = [];

export function GetNodes(): Map<string | number, SkillNode> {
    return nodes;
}

export function GetEdges(): SkillEdge[] {
    return edges;
}

export async function InitTreeManager(skillTreeView: SkillTreeView): Promise<void> {
    view = skillTreeView
    console.log("initializing tree manager")
    await LoadNodes()
}

export function GetTreesLinkingToCurrent(): string[] {
    const currentTreeName = view.settings.currentTreeName;
    const linkingTrees: string[] = [];

    for (const [treeName, tree] of Object.entries(view.settings.trees)) {
        if (treeName === currentTreeName) continue;

        const hasLinkToCurrent = tree.nodes?.some(n =>
            n.treeLink && (
                n.treeLink === currentTreeName ||
                (n.treeLink === '' && view.settings.currentTreeName === currentTreeName)
            )
        );

        if (hasLinkToCurrent) {
            linkingTrees.push(treeName);
        }
    }

    return linkingTrees;
}

export function GetTrees(): object {
    return view.settings.trees;
}

export function GetCurrentTree(): string {
    return view.settings.currentTreeName
}

export function GetTreeCount(): number {
    return Object.keys(view.settings.trees).length;
}

export async function DeleteTree(name: string) {
    const wasCurrentTree = view.settings.currentTreeName === name;

    // Delete the tree from settings - ensure it's actually removed
    if (view.settings.trees[name]) {
        delete view.settings.trees[name];
    }

    // Verify deletion
    if (view.settings.trees[name]) {
        console.error('Failed to delete tree:', name);
        return;
    }

    if (wasCurrentTree) {
        // Switch to first available tree (but don't save the deleted tree first)
        const remainingTrees = Object.keys(view.settings.trees);
        if (remainingTrees.length > 0) {
            const firstTree = remainingTrees[0];
            // Switch without saving the deleted tree
            view.settings.currentTreeName = firstTree;
            if (!view.settings.trees[firstTree]) {
                view.settings.trees[firstTree] = {
                    name: firstTree,
                    nodes: [],
                    edges: []
                };
            }
            // Load new tree
            await view.loadNodes();

            // Clean up file watchers for old nodes
            view._fileWatchers.forEach((watcher) => {
                view.app.vault.off('modify', watcher);
            });
            view._fileWatchers.clear();
            view._tasksCache.clear();

            // Reload tasks for new tree
            await view.loadAllNodeTasks();
        } else {
            // No trees left - create a default one
            view.settings.trees['default'] = {
                name: 'default',
                nodes: [],
                edges: []
            };
            view.settings.currentTreeName = 'default';
            await view.loadNodes();

            // Clean up file watchers
            view._fileWatchers.forEach((watcher) => {
                view.app.vault.off('modify', watcher);
            });
            view._fileWatchers.clear();
            view._tasksCache.clear();

            // Reload tasks
            await view.loadAllNodeTasks();
        }

        await view.plugin.saveSettings();
        view.requestRender();
    } else {
        // Not the current tree, just save settings
        await view.plugin.saveSettings();
    }
}



export function UpdateTreeSelector(select: HTMLSelectElement) {
    select.innerHTML = '';
    for (const treeName of Object.keys(view.settings.trees)) {
        const option = select.createEl('option', { text: treeName });
        option.value = treeName;
        // if (treeName === view.settings.currentTreeName) {
        //     option.selected = true;
        // }
    }
    const newTreeOption = select.createEl('option', { text: '+ New Tree...' });
    newTreeOption.value = '__NEW_TREE__';
}

export async function CreateTree(treeName: string) {

}

export async function SwitchTree(treeName: string) {
    // // Save current tree
    // await SaveNodes();
    //
    // // Switch to new tree
    // view.settings.currentTreeName = treeName;
    // if (!view.settings.trees[treeName]) {
    //     view.settings.trees[treeName] = {
    //         name: treeName,
    //         nodes: [],
    //         edges: []
    //     };
    // }
    //
    // // Load new tree
    // await view.loadNodes();
    //
    // // Clean up file watchers for old nodes
    // view._fileWatchers.forEach((watcher) => {
    //     if (typeof watcher === 'function') {
    //         watcher();
    //     }
    // });
    // view._fileWatchers.clear();
    // view._tasksCache.clear();
    // view.nodeRadii = {};
    //
    // // Reload tasks for new tree
    // await view.loadAllNodeTasks();
    // // Recenter view on the new tree: center on nodes' bounding box or origin
    // try {
    //     if (view.canvas) {
    //         if (view.nodes && view.nodes.length > 0) {
    //             let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    //             for (const n of view.nodes) {
    //                 if (typeof n.x === 'number') {
    //                     minX = Math.min(minX, n.x);
    //                     maxX = Math.max(maxX, n.x);
    //                 }
    //                 if (typeof n.y === 'number') {
    //                     minY = Math.min(minY, n.y);
    //                     maxY = Math.max(maxY, n.y);
    //                 }
    //             }
    //             if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    //                 view.centerAndZoomOnPoint(0, 0, 1.0);
    //             } else {
    //                 const cx = (minX + maxX) / 2;
    //                 const cy = (minY + maxY) / 2;
    //                 // Default zoom to 1.0 for new tree view
    //                 view.centerAndZoomOnPoint(cx, cy, 1.0);
    //             }
    //         } else {
    //             view.centerAndZoomOnPoint(0, 0, 1.0);
    //         }
    //     }
    // } catch (e) {
    //     // ignore recenter errors
    // }
    //
    // await view.plugin.saveSettings();
    // vth.saveNodesiew.updateGoToLinkedBtnVisibility();
    // view.updateLinkedTreeBanner();
    // view.updateOrphanJumpBtnVisibility();
    // view.requestRender();
}

async function LoadNodes() {
    currentTree = view.settings.trees[view.settings.currentTreeName];

    if (currentTree) {
        console.log(`Loading current tree`)

        loadFromJSON(currentTree.nodes || [], currentTree.edges || []);
    } else {
        console.log("initializing tree")
        // Initialize if tree doesn't exist
        view.settings.trees[view.settings.currentTreeName] = {
            name: view.settings.currentTreeName,
            nodes: [],
            edges: []
        };
        await view.plugin.saveSettings();
    }
}

function loadFromJSON(nodesData: any[], edgesData: SkillEdge[]): void {
    console.log(`Node data: ${nodesData}`)
    nodes.clear();
    edges = [...edgesData];

    for (const data of nodesData) {
        console.log(`${data} being converted to JSON`)
        const node = NodeFromJSON(data);
        console.dir(`${node} loaded from`)
        if (!node) {
            return
        }
        if (!node.id) {
            node.id = crypto.randomUUID()
        }
        nodes.set(node.id, node);
        console.dir(`${node} loaded to map`)
    }

    rebuildRelationships();
}


function NodeFromJSON(data: any): any {
    console.log(`Attempting to load ${data}`)
    if (data.nodeType) {
        console.log(data.nodeType)
        switch (data.nodeType) {
            case "BaseNode":
            case "RegularNode": // TODO remove before release. This is old AI slop version. That refused to listen to me when I said other nodes should inherit
                return SkillNode.fromJSON(data)
            case 'CheckpointNode':
                return CheckpointNode.fromJSON(data);
            case 'TreeLinkNode':
                return TreeLinkNode.fromJSON(data);
            case 'RepeatingNode':
                return RepeatingNode.fromJSON(data);
            case 'TaskNode':
                return TaskNode.fromJSON(data);
            case 'OptionalNode':
                return OptionalNode.fromJSON(data);
            default:
                console.log("missed")
        }
    }
}

function rebuildRelationships(): void {
    clearRelationships();
    buildRelationshipsFromEdges();
}


function clearRelationships(): void {
    for (const node of nodes.values()) {
        node.children = [];
        node.parents = [];
    }
}


function buildRelationshipsFromEdges(): void {
    for (const edge of edges) {
        if (edge.from == null || edge.to == null) continue;
        const childNode = nodes.get(edge.from);
        const parentNode = nodes.get(edge.to);
        if (childNode && parentNode) {
            childNode.parents.push(parentNode);
            parentNode.children.push(childNode);
        }
    }
}
