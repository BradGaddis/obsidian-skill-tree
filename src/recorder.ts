import { SkillTreeView } from "./skilltreeview";
import { Render } from "./renderer";
import { GetNodes, GetEdges, SetNodesFromSnapshot, SetEdgesFromSnapshot } from "./tree_manager";
import { HISTORY_UPPER_BOUNDS } from "./constants";

let view: SkillTreeView
let historyPast: any[] = [];
let historyFuture: any[] = [];
let _suppressHistory: boolean = false;


export function InitRecorder(skillTreeView: SkillTreeView) {
    view = skillTreeView
}

export function Undo() {
    if (historyPast.length === 0) return;
    const cur = GetSnapshot();
    const prev = historyPast.pop() as any;
    if (prev) {
        historyFuture.push(cur);
        ApplySnapshot(prev);
        try { SaveNodes(); } catch (e) { }
    }
}


export function Redo() {
    if (historyFuture.length === 0) return;
    const cur = GetSnapshot();
    const next = historyFuture.pop() as any;
    if (next) {
        historyPast.push(cur);
        ApplySnapshot(next);
        try { SaveNodes(); } catch (e) { }
    }
}

function GetSnapshot() {
    return {
        nodes: JSON.parse(JSON.stringify(Array.from(GetNodes().values()))),
        edges: JSON.parse(JSON.stringify(GetEdges())),
    };
}

function ApplySnapshot(snap: any) {
    _suppressHistory = true;
    try {
        SetNodesFromSnapshot(snap.nodes);
        SetEdgesFromSnapshot(snap.edges);
        Render();
    } finally { _suppressHistory = false; }
}


export async function SaveNodes() {
    try {
        const currentTree = view.settings.trees[view.settings.currentTreeName];
        const nodeList = Array.from(GetNodes().values());
        const edges = GetEdges();
        if (currentTree) {
            currentTree.nodes = JSON.parse(JSON.stringify(nodeList));
            currentTree.edges = JSON.parse(JSON.stringify(edges));
        } else {
            view.settings.trees[view.settings.currentTreeName] = {
                name: view.settings.currentTreeName,
                nodes: JSON.parse(JSON.stringify(nodeList)),
                edges: JSON.parse(JSON.stringify(edges))
            };
        }
        
        for (const node of nodeList) {
            if (node.fileLink && node.userCompletable) {
                try {
                    const treeManager = await import("src/tree_manager");
                    if (treeManager.SyncNodeMetadataToFile) {
                        await treeManager.SyncNodeMetadataToFile(node);
                    }
                } catch (e) {
                    console.warn('[SAVE] Failed to sync metadata to note:', e);
                }
            }
        }
        
        await view.plugin.saveSettings();
    } catch (e) {
        console.error('[SAVE] saveNodes failed', e);
    }
}


export function RecordSnapshot() {
    if (_suppressHistory) return;
    try {
        const s = GetSnapshot();
        historyPast.push(s);
        historyFuture = [];
        // keep history bounded
        if (historyPast.length > HISTORY_UPPER_BOUNDS) historyPast.shift();
    } catch (e) { }
}
