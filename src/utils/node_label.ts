import { SkillNode } from "src/skill_nodes/skill_node";

export interface LabelInfo {
    label: string;
    lines: string[];
}

export function GetNodeLabelInfo(n: SkillNode): LabelInfo {
    let label = '';
    if (n.displayText && n.displayText.trim()) {
        label = n.displayText;
    } else if (n.fileLink) {
        const filename = n.fileLink.split('/').pop()?.replace('.md', '') || n.fileLink;
        label = filename;
    } else {
        label = '[unlinked]';
    }

    const words = (label || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
    }

    return { label, lines };
}
