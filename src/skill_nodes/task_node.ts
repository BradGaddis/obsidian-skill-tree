import { SkillTreeView } from "src/skilltreeview";
import { SkillNode } from "./skill_node";
import { tasksCache } from "src/tree-manager";

export class TaskNode extends SkillNode {
    // TODO: remove this, as class alone defines the node type
    readonly nodeTypeName = 'TaskNode';

    constructor(data: Partial<TaskNode> = {}) {
        super(data);
    }

    validate(): void {
        this.cascadeToParents()
        return;
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
        };
    }

    static fromJSON(data: any): TaskNode {
        return new TaskNode(data);
    }

    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement) {


        try {
            const tasks = tasksCache.get(this.id) || [];
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter((t: any) => !!t.completed).length;
            //
            //     // Level calculation (simple sqrt mapping for visible progression)
            //     const level = Math.max(0, Math.floor(Math.sqrt(this.exp)));
            //     const levelBase = level * level;
            //     const nextLevelExp = (level + 1) * (level + 1);
            //     const needed = nextLevelExp - levelBase;
            //     const gained = Math.max(0, this.exp - levelBase);
            //     const levelProgress = needed > 0 ? Math.round((gained / needed) * 100) : 100;
            //     const percent = levelProgress;
            //
            //
            //     const row = modal.createDiv(STATS_MODAL_ROW_DOM_EL_INFO);
            //
            //     row.style.display = 'flex';
            //     row.style.alignItems = 'center';
            //     row.style.gap = '12px';
            //     row.style.margin = '8px 20px 12px 20px';
            //
            //     createExpBadge(row)
            //
            //     modal.appendChild(row);
            //
            //     // TODO: refactor into task nodes...
            //     // If the node has tasks, show a simple tasks progress bar (completed/total)
            //     try {
            //         const taskList = tasksCache.get(this.id) || [];
            //         const totalTasks = taskList.length;
            //         if (totalTasks > 0) {
            //             const taskProgressWrap = modal.createDiv({ cls: 'task-progress-wrap' });
            //             taskProgressWrap.style.margin = '8px 20px 12px 20px';
            //             const label = taskProgressWrap.createDiv({ text: '' });
            //             label.style.fontSize = '12px';
            //             label.style.marginBottom = '6px';
            //
            //             const bar = taskProgressWrap.createDiv({ cls: 'task-progress-bar' });
            //             bar.style.width = '100%';
            //             bar.style.height = '10px';
            //             bar.style.background = 'rgba(255,255,255,0.06)';
            //             bar.style.borderRadius = '999px';
            //             bar.style.overflow = 'hidden';
            //
            //             const inner = taskProgressWrap.createDiv({ cls: 'task-progress-inner' });
            //             inner.style.height = '100%';
            //             inner.style.width = `0%`;
            //             inner.style.background = 'linear-gradient(90deg, var(--interactive-accent), #ffd36b)';
            //             inner.style.transition = 'width 200ms ease';
            //
            //             bar.appendChild(inner);
            //             taskProgressWrap.appendChild(bar);
            //             modal.appendChild(taskProgressWrap);
            //
            //             // Poll to keep the task progress up-to-date while modal is open
            //             const update = () => {
            //                 try {
            //                     const tasksNow = tasksCache.get(this.id) || [];
            //                     const total = tasksNow.length;
            //                     const completed = tasksNow.filter((t: any) => !!t.completed).length;
            //                     if (total > 0) {
            //                         const pctNow = Math.round((completed / total) * 100);
            //                         inner.style.width = `${pctNow}%`;
            //                         label.textContent = `Tasks: ${completed} / ${total}`;
            //                     } else {
            //                         inner.style.width = `0%`;
            //                         label.textContent = 'Tasks: 0 / 0';
            //                     }
            //                 } catch (e) { }
            //             };
            //             update();
            //             const intervalId = setInterval(() => {
            //                 if (!document.body.contains(modal)) {
            //                     clearInterval(intervalId);
            //                     return;
            //                 }
            //                 update();
            //             }, 800);
            //         }
            //     } catch (e) { }
            // } catch (e) {
            // ignore gamified UI failures

            // Requirements tree
            //     const reqHeader = modal.createEl('h4', { text: 'Requirements' });
            //         reqHeader.style.margin = '8px 20px 4px 20px';
            //
            //     const container = modal.createDiv();
            //         container.style.margin = '0 20px 12px 20px';
            //
            //     // Helper: resolve direct children of a node
            //         return this.edges
            //             .filter((e) => e.to === id && e.from !== null)
            //             .map((e) => this.nodes.find((n) => n.id === e.from))
            //             .filter((n): n is SkillNode => !!n);
            //     };
            //
            //     const children = childrenOf(node.id);
            //     const nodeTasksForNotice = this._tasksCache.get(node.id) || [];
            //     const hasTasksForNode = nodeTasksForNotice.length > 0;
            //
            //     // If all direct children are optional and the node has no tasks,
            //     // show only an explanatory note and skip listing the children.
            //     if(!hasTasksForNode && children.length > 0 && children.every((c) => c.optional)) {
            //     const note = container.createDiv({ cls: 'optional-children-note' });
            //     note.textContent = 'Note: This node only has optional paths. Complete at least one optional path to activate this node.';
            //     note.style.margin = '6px 0';
            //     note.style.padding = '8px 10px';
            //     note.style.borderLeft = '3px solid var(--interactive-accent)';
            //     note.style.background = 'rgba(0,0,0,0.02)';
            //     note.style.color = 'var(--text-muted)';
            // } else {
            //     // Otherwise render the normal child list (or 'None')
            //     if (children.length === 0) {
            //         container.createEl('div', { text: 'None' });
            //     }
            //
            //     const ul = container.createEl('ul');
            //     ul.style.margin = '4px 0 0 12px';
            //     ul.style.paddingLeft = '12px';
            //
            //     for (const child of children) {
            //         const li = ul.createEl('li');
            //         li.style.marginBottom = '6px';
            //         const childLabel = li.createEl('span', { text: this.getNodeDisplayLabel(child) || 'Node' });
            //
            //         // grandchildren
            //         const grandchildren = childrenOf(child.id);
            //         if (grandchildren.length > 0) {
            //             const subUl = li.createEl('ul');
            //             subUl.style.margin = '4px 0 0 12px';
            //             subUl.style.paddingLeft = '12px';
            //             for (const gc of grandchildren) {
            //                 const gLi = subUl.createEl('li');
            //                 gLi.style.marginBottom = '4px';
            //                 gLi.createEl('span', { text: this.getNodeDisplayLabel(gc) || 'Node' });
            //
            //                 // if this grandchild has deeper children, show ellipsis
            //                 const deeper = childrenOf(gc.id);
            //                 if (deeper.length > 0) {
            //                     const ell = gLi.createEl('div', { text: '...' });
            //                     ell.style.display = 'inline-block';
            //                     ell.style.marginLeft = '6px';
            //                     ell.style.opacity = '0.7';
            //                 }
            //             }
            //         }
            //     }
            // }
            //
            // // Tasks section: display a Tasks plugin query after Requirements (no Tasks button)
            // try {
            //     await this.getNodeTasks(node);
            //     if (this.isTasksPluginInstalled()) {
            //         const tasksHeader = modal.createEl('h4', { text: 'Tasks' });
            //         tasksHeader.style.margin = '8px 20px 4px 20px';
            //
            //
            //         const tasksWrap = modal.createDiv();
            //         tasksWrap.style.margin = '0 20px 12px 20px';
            //
            //         // Normalize and resolve the file path for the tasks query
            //         let sourcePath = '';
            //         if (node.fileLink) {
            //             sourcePath = node.fileLink.trim();
            //             if (sourcePath.startsWith('/')) sourcePath = sourcePath.substring(1);
            //         }
            //         let candidate = sourcePath;
            //         if (!candidate.endsWith('.md')) candidate = candidate + '.md';
            //         let fileObj = this.app.vault.getAbstractFileByPath(candidate) as TFile | null;
            //         if (!fileObj && sourcePath && !sourcePath.endsWith('.md')) {
            //             fileObj = this.app.vault.getAbstractFileByPath(sourcePath) as TFile | null;
            //         }
            //
            //         // Tasks plugin: build a query that filters by exact file path for this node
            //         let targetPathForQuery = '';
            //         if (node.fileLink) {
            //             targetPathForQuery = node.fileLink.trim();
            //             if (targetPathForQuery.startsWith('/')) targetPathForQuery = targetPathForQuery.substring(1);
            //         } else if (fileObj) {
            //             targetPathForQuery = fileObj.path;
            //         } else {
            //             targetPathForQuery = candidate;
            //         }
            //         if (!targetPathForQuery.endsWith('.md')) targetPathForQuery = targetPathForQuery + '.md';
            //         const safePath = String(targetPathForQuery).replace(/"/g, '\\"');
            //         const tasksBlock = `\`\`\`tasks
            // filter by function task.path == "${safePath}"
            // short mode
            // group by priority
            // group by function task.heading != null ? task.heading : ""
            // hide backlink
            // show tree
            // \`\`\``;
            //         try {
            //             const renderSource = fileObj ? fileObj.path : candidate;
            //             await (MarkdownRenderer as any).renderMarkdown(tasksBlock, tasksWrap, renderSource, this);
            //
            //             // Watch the rendered Tasks block for DOM changes (user toggling tasks via Tasks UI)
            //             // and refresh the node's tasks/state when changes occur.
            //             const debounce = (fn: (...args: any[]) => void, ms = 200) => {
            //                 let t: any = null;
            //                 return (...args: any[]) => {
            //                     if (t) clearTimeout(t);
            //                     t = setTimeout(() => fn(...args), ms);
            //                 };
            //             };
            //
            //             const refreshFromTasks = debounce(async () => {
            //                 try {
            //                     await this.getNodeTasks(node);
            //                     this.updateNodeStateFromTasks(node);
            //                     try { await this.saveNodes(); } catch (e) { }
            //                     this.requestRender();
            //                 } catch (e) { }
            //             }, 250);
            //
            //             try {
            //                 const mo = new MutationObserver(() => {
            //                     refreshFromTasks();
            //                 });
            //                 mo.observe(tasksWrap, { childList: true, subtree: true, attributes: true });
            //
            //                 // Register a modal-scoped file watcher so changes to the linked file
            //                 // immediately refresh Dataview/Tasks results for this node while the
            //                 // stats modal is open. Debounced refresh will call getNodeTasks + update.
            //                 try {
            //                     const watchPath = (fileObj ? fileObj.path : candidate) || '';
            //                     if (watchPath && !this._modalFileWatchers.has(node.id)) {
            //                         const vaultHandler = async (changedFile: TFile) => {
            //                             if (changedFile.path === watchPath) {
            //                                 refreshFromTasks();
            //                             }
            //                         };
            //                         const metaHandler = async (changedFile: TFile) => {
            //                             if (changedFile.path === watchPath) {
            //                                 refreshFromTasks();
            //                             }
            //                         };
            //                         const vaultRef = this.app.vault.on('modify', vaultHandler);
            //                         const metaRef = this.app.metadataCache.on('changed', metaHandler);
            //                         const cleanupModalWatchers = () => {
            //                             try { this.app.vault.offref(vaultRef); } catch (e) { }
            //                             try { this.app.metadataCache.offref(metaRef); } catch (e) { }
            //                         };
            //                         this._modalFileWatchers.set(node.id, cleanupModalWatchers);
            //                     }
            //                 } catch (e) {
            //                     // ignore watcher registration issues
            //                 }
            //
            //                 // Auto-clean when modal is removed from DOM
            //                 const cleanupChecker = setInterval(() => {
            //                     if (!document.body.contains(tasksWrap)) {
            //                         mo.disconnect();
            //                         try { clearInterval(cleanupChecker); } catch (e) { }
            //                         // Cleanup any modal-scoped watchers we created
            //                         try {
            //                             const cw = this._modalFileWatchers.get(node.id);
            //                             if (cw) {
            //                                 cw();
            //                                 this._modalFileWatchers.delete(node.id);
            //                             }
            //                         } catch (e) { }
            //                     }
            //                 }, 1000);
            //             } catch (e) {
            //                 // ignore observer failures
            //             }
            //         } catch (err) {
            //             const warn = modal.createDiv();
            //             warn.style.margin = '0 20px 12px 20px';
            //             warn.style.padding = '8px';
            //             warn.style.background = 'linear-gradient(180deg, rgba(255,222,0,0.04), transparent)';
            //             warn.style.border = '1px solid rgba(255,222,0,0.08)';
            //             warn.style.borderRadius = '4px';
            //             warn.textContent = 'Tasks plugin failed to render the query. Ensure the Tasks plugin is installed and enabled.';
            //         }
            //     } else {
            //         const warn = modal.createDiv();
            //         warn.style.margin = '0 20px 12px 20px';
            //         warn.style.padding = '8px';
            //         warn.style.background = 'linear-gradient(180deg, rgba(255,222,0,0.04), transparent)';
            //         warn.style.border = '1px solid rgba(255,222,0,0.08)';
            //         warn.style.borderRadius = '4px';
            //         warn.textContent = 'Tasks plugin is required to display tasks. Please install/enable the Tasks plugin.';
            //     }
        } catch (e) {
            // ignore any errors while attempting to render tasks
        }
    }
}

