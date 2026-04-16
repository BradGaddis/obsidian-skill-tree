import { Update } from "../rendering/renderer";
import { GetCurrentTreeData, GetNodes, GetEdges, SetNodes, SetEdges } from "./tree_manager";
import { HISTORY_UPPER_BOUNDS } from "../types/constants";
import { skillTreeEvents, EVENTS } from "../utils/events";
import { view } from "../utils/globals";

let historyPast: any[] = [];
let historyFuture: any[] = [];
let _suppressHistory: boolean = false;



export function Undo() {
    if (historyPast.length === 0) return;
    const cur = GetSnapshot();
    const prev = historyPast.pop() as any;
    if (prev) {
        historyFuture.push(cur);

        // If snapshot is from a different tree, switch to it first and clear history
        if (prev.treeName !== view.settings.currentTreeName) {
            view.settings.currentTreeName = prev.treeName;
            historyPast = [];  // Clear history when switching trees
            historyFuture = [];
        }

        const success = ApplySnapshot(prev, view.settings.currentTreeName);
        if (success) {
            try { SaveNodes(); } catch (e) { console.warn('[RECORDER] SaveNodes failed:', e); }
        }
    }
}


export function Redo() {
    if (historyFuture.length === 0) return;
    const cur = GetSnapshot();
    const next = historyFuture.pop() as any;
    if (next) {
        historyPast.push(cur);

        // If snapshot is from a different tree, switch to it first and clear history
        if (next.treeName !== view.settings.currentTreeName) {
            view.settings.currentTreeName = next.treeName;
            historyPast = [];  // Clear history when switching trees
            historyFuture = [];
        }

        const success = ApplySnapshot(next, view.settings.currentTreeName);
        if (success) {
            try { SaveNodes(); } catch (e) { console.warn('[RECORDER] SaveNodes failed:', e); }
        }
    }
}

function GetSnapshot() {
    return {
        treeName: view.settings.currentTreeName,
        nodes: JSON.parse(JSON.stringify(Array.from(GetNodes().values()))),
        edges: JSON.parse(JSON.stringify(GetEdges())),
    };
}

function ApplySnapshot(snap: any, targetTreeName?: string): boolean {
    // If target tree specified and different from snapshot tree, can't restore
    if (targetTreeName && snap.treeName !== targetTreeName) {
        return false;
    }

    _suppressHistory = true;
    try {
        SetNodes(snap.nodes);
        SetEdges(snap.edges);
        Update();
        return true;
    } finally { _suppressHistory = false; }
}


export async function SaveNodes() {
    try {
        const currentTree = GetCurrentTreeData();
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
                    const treeManager = await import("../data/tree_manager");
                    if (treeManager.SyncNodeMetadataToFile) {
                        await treeManager.SyncNodeMetadataToFile(node);
                    }
                } catch (e) {
                    console.warn('[SAVE] Failed to sync metadata to note:', e);
                }
            }
        }

        await view.plugin.saveSettings();
        skillTreeEvents.emit(EVENTS.NODES_CHANGED);
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
    } catch (e) { console.warn('[RECORDER] GetSnapshot failed:', e); }
}

export function ClearHistory() {
    historyPast = [];
    historyFuture = [];
}
