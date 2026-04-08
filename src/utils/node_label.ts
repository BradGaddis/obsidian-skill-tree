import { SkillNode } from "../skill_nodes/skill_node";

const WORDS_PER_LINE = 2;
const UNLINKED_LABEL = ' [Unlinked]';

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
    }

    const words = (label || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];

    for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
        lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '));
    }

    if (!n.fileLink && n.linkable) {
        lines.push(UNLINKED_LABEL)
    }

    return { label, lines };
}
