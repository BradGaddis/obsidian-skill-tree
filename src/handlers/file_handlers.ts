import { App, TAbstractFile, TFile } from "obsidian";
import { linkedNodes, RemoveFromLinkedNodes } from "./linked_nodes";
import { GetNodes } from "../data/tree_manager";
import { parseTasksFromNode } from "../data/task_parser";
import { skillTreeEvents, EVENTS } from "../utils/events";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { handleMetadataChange } from "./metadata_sync";
import { parseYamlFrontmatter } from "../types/utils";

export { handleFileChange } from "./node_helpers";

export function handleFileDelete(file: TAbstractFile): void {
    if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
    linkedNodes.delete(file.path);

    const nodes = GetNodes();

    for (const node of nodes.values()) {
        if (!node.fileLink) continue;
        if (node.fileLink !== file.path) continue;

        node.fileLink = undefined;
        node.tasks = [];
        RemoveFromLinkedNodes(file.path);
    }
}

export async function handleFileModify(app: App, file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
    if (!linkedNodes.has(file.path)) return;
    const node = linkedNodes.get(file.path);
    if (!node) return;

    const fileContent = await app.vault.read(file);
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch && frontmatterMatch[1]) {
        const fm = parseYamlFrontmatter(frontmatterMatch[1]);
        const validated = validateFrontmatter(fm);
        await handleMetadataChange(node, file, validated);
    }

    const newTasks = await parseTasksFromNode(app, node);
    if (node.tasks === newTasks) return;
    node.tasks = newTasks;
    skillTreeEvents.emit(EVENTS.NODE_UPDATED, node.id);
}

export function handleDataFileChange(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (file.path !== 'data.json') return;
    console.log("Project Data was changed");
}