import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "src/skill_nodes/skill_node";
import { GetNodes, LoadNodeTasks, SyncNodeMetadataToFile } from "../tree_manager";
import { SaveNodes } from "../recorder";
import { Render } from "../renderer";
import { TFile } from "obsidian";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { NodeState } from "../skill_nodes/types";

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

        const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
        const validated = validateFrontmatter(fm);
        const treeName = view.settings.currentTreeName;

        for (const node of affectedNodes) {
            await LoadNodeTasks(node);

            if (!node.userCompletable) continue;
            if (!validated.skilltreeNode || !validated.skilltreeTree) continue;
            if (validated.skilltreeTree !== treeName) continue;
            if (validated.skilltreeNode !== String(node.id)) continue;

            if (!node.userModified) {
                if (validated.skilltreeState) {
                    node.state = validated.skilltreeState;
                    node.fromNote = true;
                }
                if (validated.shape) {
                    node.shape = validated.shape;
                }
                if (validated.exp !== undefined) {
                    node.exp = validated.exp;
                }
                if (validated.x !== undefined) {
                    node.x = validated.x;
                }
                if (validated.y !== undefined) {
                    node.y = validated.y;
                }

                node.userModified = true;
                node.fromNote = false;
            }
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
