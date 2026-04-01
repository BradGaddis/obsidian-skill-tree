import { SkillTreeView } from "./skilltreeview";
import { RequestRender, ComputeAllNodeRadii } from "./renderer";
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
        nodes: JSON.parse(JSON.stringify(view.nodes)),
        edges: JSON.parse(JSON.stringify(view.edges)),
    };
}

function ApplySnapshot(snap: any) {
    _suppressHistory = true;
    try {
        view.nodes = JSON.parse(JSON.stringify(snap.nodes || []));
        view.edges = JSON.parse(JSON.stringify(snap.edges || []));

        ComputeAllNodeRadii(); // TODO define to Renderer

        RequestRender();
    } finally { _suppressHistory = false; }
}


export async function SaveNodes() {
    try {
        const json = view.graph.toJSON();
        const currentTree = view.settings.trees[view.settings.currentTreeName];
        if (currentTree) {
            currentTree.nodes = JSON.parse(JSON.stringify(json.nodes));
            currentTree.edges = JSON.parse(JSON.stringify(json.edges));
        } else {
            view.settings.trees[view.settings.currentTreeName] = {
                name: view.settings.currentTreeName,
                nodes: JSON.parse(JSON.stringify(json.nodes)),
                edges: JSON.parse(JSON.stringify(json.edges))
            };
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
