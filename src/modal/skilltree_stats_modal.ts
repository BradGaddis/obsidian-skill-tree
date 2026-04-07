import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "src/skill_nodes/skill_node";
import { STATS_MODAL_EXP_BADGE_DOM_EL_INFO } from "src/constants";
import { TFile } from "obsidian";
import { createSkillModal, openSkillModal, makeModalDraggable, closeSkillModal, installOutsideClickHandler, createModalFooter, closeAllModals } from "./skilltree_modal";
import { tasksCache, GetNodeTasks, LoadNodeTasks } from "../tree_manager";
import { Render } from "../renderer";
import { MarkdownRenderer } from "obsidian";

let view: SkillTreeView

export function InitStatsModal(view_: SkillTreeView) {
    view = view_;
}

export function SkillModalCreateExpBadge(el: HTMLElement, node: SkillNode) {
    const expBadge = el.createDiv(STATS_MODAL_EXP_BADGE_DOM_EL_INFO);
    expBadge.textContent = `${node.exp} XP`;
    expBadge.style.padding = '8px 12px';
    expBadge.style.borderRadius = '999px';
    expBadge.style.background = 'linear-gradient(90deg, rgba(100,150,255,0.95), rgba(80,120,240,0.9))';
    expBadge.style.color = '#fff';
    expBadge.style.fontWeight = '700';

    el.appendChild(expBadge);
}

export async function SkillModalOpenFileButton(node: SkillNode, container: HTMLElement) {

    const openBtn = container.createEl('button', { text: 'Open Note' });
    openBtn.style.fontSize = '12px';
    openBtn.style.color = 'var(--text-accent)';
    openBtn.style.background = 'transparent';
    openBtn.style.border = 'none';
    openBtn.style.cursor = 'pointer';
    openBtn.style.marginTop = '4px';
    openBtn.style.padding = '4px 6px';

    openBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!node.fileLink) return;
        await view.app.workspace.openLinkText(node.fileLink, '', false);
    });
}

export function SkillModalHeaderRight(modal: HTMLElement): HTMLElement {
    const headerRight = modal.createDiv();
    headerRight.style.display = 'flex';
    headerRight.style.flexDirection = 'column';
    headerRight.style.alignItems = 'flex-end';
    return headerRight
}

export function SkillModalSetHeaderText(header: HTMLElement, titleText: string) {
    header.createEl('h3', { text: titleText }).style.margin = '0';
}

export function SkillModalHeader(modal: HTMLElement): HTMLElement {
    const header = modal.createDiv();
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.margin = '0 20px 8px 20px';
    return header
}

export function SkillModalStatsSpan(modal: HTMLElement) {
    modal.createEl('span', { text: 'Stats' }).style.fontWeight = '600';
}

export function SkillModalDescription(node: SkillNode, modal: HTMLElement) {
    try {
        let descText = 'no description';
        if (node.fileLink) {
            let normalizedPath = node.fileLink.trim();
            if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1);
            if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
            const file = view.plugin.app.vault.getAbstractFileByPath(normalizedPath);
            if (file && file instanceof TFile) {
                const fm = view.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                const fmDesc = fm?.['skilltree-node-desc'];
                if (fmDesc && typeof fmDesc === 'string' && fmDesc.trim()) descText = fmDesc.trim();
            }
        }
        const descHeader = modal.createEl('h4', { text: 'Description' });
        descHeader.style.margin = '8px 20px 4px 20px';
        const descEl = modal.createDiv({ text: descText });
        descEl.style.margin = '0 20px 8px 20px';
        descEl.style.fontSize = '13px';
        descEl.style.color = 'var(--text-muted)';
    } catch (e) {
        // ignore description failures. Should be blank
    }

    if (!node.fileLink) {
        return
    }
}

export async function SkillModalTasks(node: SkillNode, modal: HTMLElement) {
    if (!node.fileLink || !node.tasks || node.tasks.length === 0) return;

    if (!view.isTasksPluginInstalled()) return;

    const tasksHeader = modal.createEl('h4', { text: 'Tasks' });
    tasksHeader.style.margin = '8px 20px 4px 20px';

    const tasksWrap = modal.createDiv();
    tasksWrap.style.margin = '0 20px 12px 20px';

    let sourcePath = node.fileLink.trim();
    if (sourcePath.startsWith('/')) sourcePath = sourcePath.substring(1);
    let candidate = sourcePath;
    if (!candidate.endsWith('.md')) candidate = candidate + '.md';
    let fileObj = view.app.vault.getAbstractFileByPath(candidate) as TFile | null;
    if (!fileObj && sourcePath && !sourcePath.endsWith('.md')) {
        fileObj = view.app.vault.getAbstractFileByPath(sourcePath) as TFile | null;
    }

    let targetPathForQuery = '';
    if (node.fileLink) {
        targetPathForQuery = node.fileLink.trim();
        if (targetPathForQuery.startsWith('/')) targetPathForQuery = targetPathForQuery.substring(1);
    } else if (fileObj) {
        targetPathForQuery = fileObj.path;
    } else {
        targetPathForQuery = candidate;
    }
    if (!targetPathForQuery.endsWith('.md')) targetPathForQuery = targetPathForQuery + '.md';
    const safePath = String(targetPathForQuery).replace(/"/g, '\\"');
    const tasksBlock = `\`\`\`tasks
filter by function task.path == "${safePath}"
short mode
group by priority
group by function task.heading != null ? task.heading : ""
hide backlink
show tree
\`\`\``;

    try {
        const renderSource = fileObj ? fileObj.path : candidate;
        await (MarkdownRenderer as any).renderMarkdown(tasksBlock, tasksWrap, renderSource, view);

        const debounce = (fn: (...args: any[]) => void, ms = 200) => {
            let t: any = null;
            return (...args: any[]) => {
                if (t) clearTimeout(t);
                t = setTimeout(() => fn(...args), ms);
            };
        };

        const refreshFromTasks = debounce(async () => {
            try {
                await LoadNodeTasks(node);
                Render();
            } catch (e) { }
        }, 200);

        const observer = new MutationObserver((mutations) => {
            refreshFromTasks();
        });
        observer.observe(tasksWrap, { childList: true, subtree: true });
    } catch (e) {
        console.error('Failed to render tasks query:', e);
    }
}

export function createStatsModal(view: SkillTreeView, node: SkillNode): HTMLElement {
    closeAllModals();
    const modal = createSkillModal();
    openBaseStatsModal(view, modal, node);
    return modal;
}

function openBaseStatsModal(view: SkillTreeView, modal: HTMLElement, node: SkillNode) {
    modal.style.cssText = 'position:fixed;width:340px;max-height:80vh;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;z-index:9999;display:flex;flex-direction:column;';

    const header = modal.createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;cursor:grab;';

    const title = header.createEl('span', { text: 'Node Info' });
    title.style.cssText = 'font-weight:bold;font-size:14px;';

    const closeBtn = header.createEl('button', { text: '×' });
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => closeSkillModal(view, modal);

    const content = modal.createEl('div');
    content.style.cssText = 'padding:12px 16px;overflow-y:auto;';

    modal.style.border = '2px solid var(--interactive-accent)';
    modal.style.background = 'linear-gradient(135deg, var(--background-primary) 0%, rgba(255,255,255,0.02) 100%)';
    modal.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';

    node.setStatsModalContents(view, modal)

    createModalFooter(modal, []);

    openSkillModal(modal)
    makeModalDraggable(view, modal, 'stats');

    installOutsideClickHandler(modal);
}
