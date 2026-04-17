import { SkillNode } from "../nodes/skill_node";
import { DEFAULT_NODE_DESCRIPTION } from "../types/constants";
import { TFile, WorkspaceLeaf } from "obsidian";
import { SkillModal } from "./skilltree_modal";
import { Update, CenterOnNode } from "../rendering/renderer";
import { SwitchTree, GetNodes } from "../data/tree_manager";
import { MarkdownRenderer } from "obsidian";
import { view } from "../utils/globals";
import { SkillTask } from "../types/interfaces";
import { toggleComplete, parseTasksFromNode } from "../data/task_parser";


export function SkillModalCreateExpBadge(el: HTMLElement, node: SkillNode) {
    const expBadge = el.createDiv();
    expBadge.addClass('skilltree-exp-badge');
    expBadge.textContent = `${node.exp} XP`;

    el.appendChild(expBadge);
}

function findOpenLeafForFile(app: any, filePath: string): WorkspaceLeaf | null {
    return app.workspace.getLeavesOfType("markdown").find((leaf: WorkspaceLeaf) => {
        const viewFile = (leaf.view as any)?.file;
        return viewFile?.path === filePath;
    }) || null;
}

export async function SkillModalOpenFileButton(node: SkillNode, container: HTMLElement) {

    const openBtn = container.createEl('button', { text: 'Open Note', cls: 'skill-tree-btn--go' });

    openBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!node.fileLink) return;

        const file = view.app.vault.getAbstractFileByPath(node.fileLink);
        if (!file || !(file instanceof TFile)) return;

        const existingLeaf = findOpenLeafForFile(view.app, node.fileLink);
        if (existingLeaf) {
            view.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
        } else {
            await view.app.workspace.openLinkText(node.fileLink, '', false);
        }
    });
}

export function SkillModalHeaderRight(modal: HTMLElement): HTMLElement {
    const headerRight = modal.createDiv();
    headerRight.style.display = 'flex';
    headerRight.style.flexDirection = 'column';
    headerRight.style.alignItems = 'flex-end';
    return headerRight
}

export function SkillModalHeaderRightRow(modal: HTMLElement): HTMLElement {
    const headerRight = modal.createDiv();
    headerRight.style.display = 'flex';
    headerRight.style.flexDirection = 'row';
    headerRight.style.gap = '8px';
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
        let descText = DEFAULT_NODE_DESCRIPTION;
        if (node.fileLink) {
            const file = view.plugin.app.vault.getAbstractFileByPath(node.fileLink);
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
    if (!canRenderTasks(node)) return;

    const tasksHeader = modal.createEl('h4', { text: 'Tasks' });
    tasksHeader.style.margin = '8px 20px 4px 20px';

    const tasksWrap = modal.createDiv();
    tasksWrap.style.margin = '0 20px 12px 20px';
    tasksWrap.addClass('skilltree-tasks-wrap');

    const { fileObj, targetPathForQuery } = getTaskFileInfo(node);
    if (!targetPathForQuery) return;

    const tasksBlock = buildTasksQuery(targetPathForQuery);
    if (view.isTasksPluginInstalled()) {
        await renderTasksQuery(tasksBlock, tasksWrap, fileObj);
    } else {
        await renderTasksFallback(node, node.tasks, tasksWrap, fileObj);
    }

}

function canRenderTasks(node: SkillNode): boolean {
    return !!(node.fileLink && node.tasks && node.tasks.length > 0);
}

function getTaskFileInfo(node: SkillNode): { fileObj: TFile | null; targetPathForQuery: string } {
    if (!node.fileLink) {
        return { fileObj: null, targetPathForQuery: '' };
    }

    const fileObj = view.app.vault.getAbstractFileByPath(node.fileLink) as TFile | null;
    const targetPathForQuery = fileObj?.path || node.fileLink;

    return { fileObj, targetPathForQuery };
}

function buildTasksQuery(targetPathForQuery: string): string {
    const safePath = String(targetPathForQuery).replace(/"/g, '\\"');
    return `\`\`\`tasks
filter by function task.path == "${safePath}"
short mode
group by priority
group by function task.heading != null ? task.heading : ""
hide backlink
show tree
\`\`\``;
}

async function renderTasksQuery(tasksBlock: string, tasksWrap: HTMLElement, fileObj: TFile | null): Promise<void> {
    try {
        const renderSource = fileObj ? fileObj.path : '';
        await (MarkdownRenderer as any).renderMarkdown(tasksBlock, tasksWrap, renderSource, view);
    } catch (e) {
        console.error('Failed to render tasks query:', e);
    }
}

async function renderTasksFallback(node: SkillNode, tasks: SkillTask[], tasksWrap: HTMLElement, fileObj: TFile | null): Promise<void> {
    tasksWrap.empty();

    const findTask = (tasks: SkillTask[], line: number): SkillTask | null => {
        for (const task of tasks) {
            if (task.line === line) return task;
            if (task.children) {
                const found = findTask(task.children, line);
                if (found) return found;
            }
        }
        return null;
    };

    const renderTask = (task: SkillTask, indent: number = 0): void => {
        const taskRow = tasksWrap.createDiv();
        taskRow.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 4px; margin-left: ${indent * 16}px;`;

        const checkbox = taskRow.createEl('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.status === 'x';
        checkbox.style.cursor = 'pointer';

        const textSpan = taskRow.createSpan();
        textSpan.textContent = task.text;
        textSpan.style.fontSize = '14px';
        if (task.status === 'x') {
            textSpan.style.textDecoration = 'line-through';
            textSpan.style.opacity = '0.6';
        }

        checkbox.onclick = async () => {
            const taskToToggle = findTask(node.tasks, task.line);
            if (!taskToToggle) return;
            await toggleComplete(taskToToggle, taskToToggle.status !== 'x', view.app);
            await new Promise(resolve => setTimeout(resolve, 50));
            const newTasks = await parseTasksFromNode(view.app, node);
            node.tasks = newTasks;
            await renderTasksFallback(node, node.tasks, tasksWrap, fileObj);
        };

        if (task.children && task.children.length > 0) {
            for (const child of task.children) {
                renderTask(child, indent + 1);
            }
        }
    };

    for (const task of tasks) {
        renderTask(task);
    }
}

export async function createStatsModal(node: SkillNode): Promise<HTMLElement> {
    SkillModal.closeAll();
    const modal = SkillModal.create();
    SkillModal.createContainer(modal, 'Skill Stats')
    SkillModal.createContent(modal);

    (modal as any).node = node;
    (modal as any).modalType = 'stats';

    const builder = statsModalContentBuilders[node.nodeTypeName] || buildDefaultStatsModalContent;
    await builder(node, modal);
    SkillModalFromSection(node, modal);

    SkillModal.createFooterContainer(modal)
    SkillModal.makeDraggable(modal, 'edit');
    SkillModal.installOutsideClickHandler();

    const viewInstance = (view as any);
    if (viewInstance.openModals) {
        viewInstance.openModals.set(node.id, { type: 'stats', element: modal });
    }

    return modal;
}

export async function refreshStatsModal(modal: HTMLElement, nodeId: string | number): Promise<void> {
    const node = GetNodes().get(nodeId);
    if (!node) {
        SkillModal.close(modal);
        return;
    }

    await createStatsModal(node);
}

export function SkillModalFromSection(node: SkillNode, modal: HTMLElement) {
    if (node.from.length > 0) {
        const fromSection = modal.createEl('div');
        fromSection.classList.add('skill-tree-modal-from-section');

        const fromLabel = fromSection.createEl('div', { text: 'From:' });
        fromLabel.classList.add('skill-tree-modal-from-label');

        const fromList = fromSection.createEl('div');
        fromList.classList.add('skill-tree-modal-from-list');

        for (const fromNode of node.from) {
            const link = fromList.createEl('button');
            link.classList.add('skill-tree-modal-from-link');
            link.textContent = fromNode.displayText || '';

            link.onclick = () => {
                CenterOnNode(fromNode);
                Update();
                SkillModal.close(modal);
            };
        }
    }
}

export async function buildSkillNodeModalContent(node: SkillNode, modal: HTMLElement) {
    const header = SkillModalHeader(modal)

    const titleText = node.fileLink ? (() => {
        let p = node.fileLink.trim();
        if (p.startsWith('/')) p = p.substring(1);
        const parts = p.split('/');
        let fname = parts[parts.length - 1] || p;
        if (fname.toLowerCase().endsWith('.md')) fname = fname.slice(0, -3);
        return fname;
    })() : (node.fileLink || 'Node');
    SkillModalSetHeaderText(header, titleText)
    const headerRight = SkillModalHeaderRight(header)
    SkillModalStatsSpan(modal)
    if (node.exp !== 0) {
        SkillModalCreateExpBadge(modal, node);
    }
    SkillModalDescription(node, modal)
    SkillModalTasks(node, modal)
    await SkillModalOpenFileButton(node, headerRight)
}

export async function buildTaskNodeModalContent(node: SkillNode, modal: HTMLElement) {
    const header = SkillModalHeader(modal);

    const completedTasks = node.tasks.filter(t => t.status === "x").length;
    const totalTasks = node.tasks.length;
    const completedExp = completedTasks * view.settings.defaultExp;
    const totalExpValue = totalTasks * view.settings.defaultExp;

    const titleText = `${completedTasks}/${totalTasks} tasks`;
    SkillModalSetHeaderText(header, titleText);

    const headerRight = SkillModalHeaderRight(header);
    SkillModalStatsSpan(modal);

    if (totalExpValue > 0) {
        const expBadge = modal.createDiv();
        expBadge.addClass('skilltree-exp-badge');
        expBadge.textContent = `${completedExp} / ${totalExpValue} XP`;
        headerRight.appendChild(expBadge);
    }

    SkillModalDescription(node, modal);
    SkillModalTasks(node, modal);
    await SkillModalOpenFileButton(node, headerRight);
}

export async function buildTreeLinkNodeModalContent(node: SkillNode, modal: HTMLElement) {
    const content = modal.children[1] as HTMLElement;

    const titleRow = content.createEl('div');
    titleRow.classList.add('skill-tree-stats-modal-title');
    titleRow.textContent = `Tree Link: ${(node as any).treeLink}`;

    const stateRow = content.createEl('div');
    stateRow.classList.add('skill-tree-stats-modal-row');
    stateRow.textContent = `State: ${node.state}`;

    const goToTreeBtn = content.createEl('button');
    goToTreeBtn.textContent = `Go to ${(node as any).treeLink || 'Tree'}`;
    goToTreeBtn.classList.add('skill-tree-btn', 'skill-tree-btn--go');
    goToTreeBtn.style.marginTop = '12px';

    goToTreeBtn.onclick = async () => {
        const header = modal.children[0] as HTMLElement;
        const closeBtn = header.querySelector('button');
        if (closeBtn) {
            closeBtn.click();
        }
        setTimeout(async () => {
            await SwitchTree((node as any).treeLink);
        }, 50);
    };
}

export async function buildDefaultStatsModalContent(node: SkillNode, modal: HTMLElement) {
    const header = SkillModalHeader(modal)
    SkillModalSetHeaderText(header, node.displayText || node.nodeTypeName)
    const headerRight = SkillModalHeaderRight(header)
    SkillModalStatsSpan(modal)
    if (node.exp !== 0) {
        SkillModalCreateExpBadge(modal, node);
    }
    await SkillModalOpenFileButton(node, headerRight)
}

export async function buildRepeatingNodeModalContent(node: SkillNode, modal: HTMLElement) {
    const repeatingNode = node as any;
    const repeatCount = repeatingNode.repeatCount || 0;
    const repeatMax = repeatingNode.repeatMax;
    const header = SkillModalHeader(modal);

    const titleText = node.fileLink ? (() => {
        let p = node.fileLink.trim();
        if (p.startsWith('/')) p = p.substring(1);
        const parts = p.split('/');
        let fname = parts[parts.length - 1] || p;
        if (fname.toLowerCase().endsWith('.md')) fname = fname.slice(0, -3);
        return fname;
    })() : (node.fileLink || 'Node');
    SkillModalSetHeaderText(header, titleText);

    const headerRight = SkillModalHeaderRight(header);
    SkillModalStatsSpan(modal);

    const infoShelf = modal.createDiv();
    infoShelf.style.display = 'flex';
    infoShelf.style.justifyContent = 'space-between';
    infoShelf.style.margin = '0 20px 8px 20px';

    const leftStack = infoShelf.createDiv();
    leftStack.style.display = 'flex';
    leftStack.style.flexDirection = 'column';
    leftStack.style.gap = '4px';

    if (node.exp !== 0) {
        const expBadge = leftStack.createDiv();
        expBadge.addClass('skilltree-exp-badge');
        expBadge.textContent = `${node.exp} XP`;
    }

    const repeatCountText = repeatMax ? `${repeatCount} / ${repeatMax}` : `${repeatCount}`;
    const repeatBadge = leftStack.createDiv();
    repeatBadge.addClass('skilltree-exp-badge');
    repeatBadge.textContent = `Repeats: ${repeatCountText}`;

    const cooldownMinutes = repeatingNode.repeatCooldownMinutes || 0;
    const cooldownHours = repeatingNode.repeatCooldownHours || 0;
    const cooldownDays = repeatingNode.repeatCooldownDays || 0;

    if (cooldownMinutes > 0 || cooldownHours > 0 || cooldownDays > 0) {
        const isOnCooldown = repeatingNode.isRepeatOnCooldown?.() || false;
        const rightStack = infoShelf.createDiv();
        rightStack.style.display = 'flex';
        rightStack.style.flexDirection = 'column';
        rightStack.style.alignItems = 'flex-end';

        const cooldownBadge = rightStack.createDiv();
        cooldownBadge.addClass('skilltree-exp-badge');

        if (isOnCooldown) {
            let cooldownParts: string[] = [];
            if (cooldownDays > 0) cooldownParts.push(`${cooldownDays}d`);
            if (cooldownHours > 0) cooldownParts.push(`${cooldownHours}h`);
            if (cooldownMinutes > 0) cooldownParts.push(`${cooldownMinutes}m`);
            cooldownBadge.textContent = `Cooldown: ${cooldownParts.join(' ')}`;
        } else {
            cooldownBadge.textContent = 'Cooldown: Ready';
            cooldownBadge.style.color = 'var(--text-accent)';
        }
    }

    SkillModalDescription(node, modal);
    SkillModalTasks(node, modal);
    await SkillModalOpenFileButton(node, headerRight);
}

const statsModalContentBuilders: Record<string, (node: SkillNode, modal: HTMLElement) => Promise<void>> = {
    'BaseNode': buildSkillNodeModalContent,
    'SkillNode': buildSkillNodeModalContent,
    'TaskNode': buildTaskNodeModalContent,
    'TreeLinkNode': buildTreeLinkNodeModalContent,
    'OptionalNode': buildSkillNodeModalContent,
    'RepeatingNode': buildRepeatingNodeModalContent,
    'CheckpointNode': buildSkillNodeModalContent,
    'TerminalNode': buildSkillNodeModalContent,
};

