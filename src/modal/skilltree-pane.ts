import { SkillTreeView } from "src/skilltreeview";
import { GetNodes, GetEdges } from "../tree-manager";
import { CenterOnNode, Render } from "../renderer";
import { SkillNode } from "src/skill_nodes/skill_node";

let view: SkillTreeView

export function InitNodeListModal(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function OpenOrphanedNodeListPane() {
    const container = view.canvasWrap || view.containerEl;
    if (!container) return;

    const nodes = Array.from(GetNodes().values());
    const edges = GetEdges();

    const orphanedNodes = nodes.filter(node => {
        const hasParent = edges.some(e => e.to === node.id);
        const hasChild = edges.some(e => e.from === node.id);
        return !hasParent && !hasChild;
    });

    const pane = container.createEl('div');
    pane.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;';

    const header = pane.createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);';

    const title = header.createEl('span', { text: 'Find Orphans' });
    title.style.cssText = 'font-weight:bold;font-size:14px;';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => pane.remove();

    const list = pane.createEl('ul');
    list.style.cssText = 'list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;';

    if (orphanedNodes.length === 0) {
        const li = list.createEl('li');
        li.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
        li.textContent = 'No orphaned nodes';
    } else {
        const sortedNodes = [...orphanedNodes].sort((a, b) => {
            const aLabel = a.fileLink || `[${a.id}]`;
            const bLabel = b.fileLink || `[${b.id}]`;
            return aLabel.localeCompare(bLabel);
        });

        for (const node of sortedNodes) {
            const li = list.createEl('li');
            li.style.cssText = 'padding:8px 12px;cursor:pointer;';
            li.textContent = node.fileLink || `[${node.id}]`;
            li.onclick = () => {
                CenterOnNode(node);
                Render();
                pane.remove();
            };
            li.onmouseenter = () => li.style.background = 'var(--background-modifier-hover)';
            li.onmouseleave = () => li.style.background = '';
        }
    }

    setTimeout(() => {
        const outsideClick = (e: MouseEvent) => {
            if (!pane.contains(e.target as Node)) {
                pane.remove();
                document.removeEventListener('click', outsideClick);
            }
        };
        document.addEventListener('click', outsideClick);
    }, 10);
}

export function openNodeListModal() {
    const container = view.canvasWrap || view.containerEl;
    if (!container) return;

    const nodes = Array.from(GetNodes().values());

    const pane = container.createEl('div');
    pane.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;';

    const header = pane.createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);';

    const title = header.createEl('span', { text: 'Jump to Node' });
    title.style.cssText = 'font-weight:bold;font-size:14px;';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => pane.remove();

    const searchContainer = pane.createEl('div');
    searchContainer.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--background-modifier-border);';

    const searchInput = searchContainer.createEl('input') as HTMLInputElement;
    searchInput.placeholder = 'Type to filter...';
    searchInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);color:var(--text-normal);box-sizing:border-box;';

    const list = pane.createEl('ul');
    list.style.cssText = 'list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;';

    const sortedNodes = [...nodes].sort((a, b) => {
        const aLabel = a.fileLink || `[${a.id}]`;
        const bLabel = b.fileLink || `[${b.id}]`;
        return aLabel.localeCompare(bLabel);
    });

    const renderList = (filter: string) => {
        list.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        const filteredNodes = sortedNodes.filter(node => {
            const label = node.fileLink || `[${node.id}]`;
            return label.toLowerCase().includes(lowerFilter);
        });

        if (filteredNodes.length === 0) {
            const li = list.createEl('li');
            li.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
            li.textContent = filter ? 'No matching nodes' : 'No nodes';
            return;
        }

        for (const node of filteredNodes) {
            const li = list.createEl('li');
            li.style.cssText = 'padding:8px 12px;cursor:pointer;';
            li.textContent = node.fileLink || `[${node.id}]`;
            li.onclick = () => {
                CenterOnNode(node);
                Render();
                pane.remove();
            };
            li.onmouseenter = () => li.style.background = 'var(--background-modifier-hover)';
            li.onmouseleave = () => li.style.background = '';
        }
    };

    searchInput.addEventListener('input', () => renderList(searchInput.value));

    renderList('');

    setTimeout(() => {
        searchInput.focus();
        const outsideClick = (e: MouseEvent) => {
            if (!pane.contains(e.target as Node)) {
                pane.remove();
                document.removeEventListener('click', outsideClick);
            }
        };
        document.addEventListener('click', outsideClick);
    }, 10);
}