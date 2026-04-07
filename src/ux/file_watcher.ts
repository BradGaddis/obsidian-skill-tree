import { SkillTreeView } from "src/skilltreeview";
import { GetNodes, LoadNodeTasks } from "../tree_manager";
import { SaveNodes } from "../recorder";
import { Render } from "../renderer";

let view: SkillTreeView;
let fileWatcherRef: any = null;

export function InitFileWatcher(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function SetupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.vault.offref(fileWatcherRef);
    }
    const listener = async (file: any) => {
        const normalizedPath = file.path;
        const nodes = GetNodes();

        for (const node of nodes.values()) {
            if (!node.fileLink) continue;

            let nodeFilePath = node.fileLink.trim();
            if (!nodeFilePath.endsWith('.md')) {
                nodeFilePath = nodeFilePath + '.md';
            }

            if (nodeFilePath === normalizedPath) {
                await LoadNodeTasks(node);
                await SaveNodes();
            }
        }

        Render();
    };
    fileWatcherRef = view.app.vault.on('modify', listener);
}

export function CleanupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.vault.offref(fileWatcherRef);
        fileWatcherRef = null;
    }
}
