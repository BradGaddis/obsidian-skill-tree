import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "src/skill_nodes/skill_node";
import { GetNodes, LoadNodeTasks } from "../tree_manager";
import { SaveNodes } from "../recorder";
import { Render } from "../renderer";
import { TFile } from "obsidian";

let view: SkillTreeView;
let fileWatcherRef: any = null;

export function InitFileWatcher(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function SetupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.metadataCache.offref(fileWatcherRef);
    }

    const listener = async (file: TFile) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith('.md')) return;

        const normalizedPath = file.path;
        const nodes = GetNodes();
        const affectedNodes: SkillNode[] = [];

        for (const node of nodes.values()) {
            if (!node.fileLink) continue;

            let nodeFilePath = node.fileLink.trim();
            if (!nodeFilePath.endsWith('.md')) {
                nodeFilePath = nodeFilePath + '.md';
            }

            if (nodeFilePath === normalizedPath) {
                affectedNodes.push(node);
            }
        }

        if (affectedNodes.length === 0) return;

        for (const node of affectedNodes) {
            await LoadNodeTasks(node);
        }

        await SaveNodes();
        Render();
    };

    fileWatcherRef = view.app.metadataCache.on('changed', listener);
}

export function CleanupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.metadataCache.offref(fileWatcherRef);
        fileWatcherRef = null;
    }
}
