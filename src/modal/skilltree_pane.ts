import { SkillTreeView } from "src/skilltreeview";
import { GetNodes, GetEdges } from "../tree_manager";
import { CenterOnNode, Render } from "../renderer";
import { SkillNode } from "src/skill_nodes/skill_node";
import * as S from "../styles";

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
    pane.style.cssText = S.MODAL_CONTAINER_PANE;

    const header = pane.createEl('div');
    header.style.cssText = S.MODAL_HEADER_NOGRAB;

    const title = header.createEl('span', { text: 'Find Orphans' });
    title.style.cssText = S.MODAL_TITLE;

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = S.MODAL_CLOSE_BTN;
    closeBtn.onclick = () => pane.remove();

    const list = pane.createEl('ul');
    list.style.cssText = S.LIST_CONTAINER;

    if (orphanedNodes.length === 0) {
        const li = list.createEl('li');
        li.style.cssText = S.LIST_ITEM_EMPTY;
        li.textContent = 'No orphaned nodes';
    } else {
        const sortedNodes = [...orphanedNodes].sort((a, b) => {
            const aLabel = a.fileLink || `[${a.id}]`;
            const bLabel = b.fileLink || `[${b.id}]`;
            return aLabel.localeCompare(bLabel);
        });

        for (const node of sortedNodes) {
            const li = list.createEl('li');
            li.style.cssText = S.LIST_ITEM;
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
    pane.style.cssText = S.MODAL_CONTAINER_PANE;

    const header = pane.createEl('div');
    header.style.cssText = S.MODAL_HEADER_NOGRAB;

    const title = header.createEl('span', { text: 'Jump to Node' });
    title.style.cssText = S.MODAL_TITLE;

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = S.MODAL_CLOSE_BTN;
    closeBtn.onclick = () => pane.remove();

    const searchContainer = pane.createEl('div');
    searchContainer.style.cssText = S.SEARCH_CONTAINER;

    const searchInput = searchContainer.createEl('input') as HTMLInputElement;
    searchInput.placeholder = 'Type to filter...';
    searchInput.style.cssText = S.SEARCH_INPUT;

    const list = pane.createEl('ul');
    list.style.cssText = S.LIST_CONTAINER;

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
            li.style.cssText = S.LIST_ITEM_EMPTY;
            li.textContent = filter ? 'No matching nodes' : 'No nodes';
            return;
        }

        for (const node of filteredNodes) {
            const li = list.createEl('li');
            li.style.cssText = S.LIST_ITEM;
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