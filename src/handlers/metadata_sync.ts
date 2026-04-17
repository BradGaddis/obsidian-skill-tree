import { SkillNode } from "../nodes/skill_node";
import { Notice, TFile } from "obsidian";
import { validateFrontmatter } from "../utils/frontmatter_validator";
import { skillTreeEvents, EVENTS } from "../utils/events";
import { Update } from "../rendering/renderer";
import { linkedNodes } from "./linked_nodes";

export async function handleMetadataChange(node: SkillNode, file: TFile, validated: ReturnType<typeof validateFrontmatter>): Promise<void> {
    try {
        let updated = false;

        if (!node.fileLink) {
            node.fileLink = file.path;
            linkedNodes.set(file.path, node);
            updated = true;
        } else if (!linkedNodes.has(file.path)) {
            linkedNodes.set(file.path, node);
        }

        if (validated.x !== undefined) {
            node.x = validated.x;
            updated = true;
        }
        if (validated.y !== undefined) {
            node.y = validated.y;
            updated = true;
        }
        if (validated.shape) {
            node.shape = validated.shape;
            updated = true;
        }

        if (validated.displayText !== null) {
            node.displayText = validated.displayText || undefined;
            updated = true;
        }

        if (!node.userCompletable) {
            return;
        }

        if (validated.exp !== undefined) {
            node.exp = validated.exp;
            updated = true;
        }

        if (updated) {
            node.userModified = true;
            node.fromNote = false;
            skillTreeEvents.emit(EVENTS.NODE_UPDATED, node.id);
            Update();
        }
    } catch (err) {
        console.error('[handleMetadataChange] Error processing metadata change:', err);
        new Notice('Failed to update node from file metadata');
    }
}
