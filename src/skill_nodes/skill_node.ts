import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode } from "./interfaces";
import { SkillTreeView } from "src/skilltreeview";
import { TFile } from "obsidian";

export class SkillNode implements ISkillNode {
    readonly nodeTypeName: string = "BaseNode";

    get userCompletable(): boolean {
        return false
    }

    id: string;
    x: number;
    y: number;
    state: NodeState;
    heldState: NodeState | null = null;
    exp: number;
    fileLink?: string;
    shape: NodeShape;
    canSkipOrphanUnavailable: boolean = false;

    children: SkillNode[] = [];
    parents: SkillNode[] = [];

    constructor(data: Partial<ISkillNode> = {}) {
        this.id = crypto.randomUUID()
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.state = data.state ?? 'unavailable';
        this.heldState = data.heldState ?? null;
        this.exp = data.exp ?? 0;
        this.fileLink = data.fileLink;
        this.shape = data.shape ?? 'circle';
        this.canSkipOrphanUnavailable = data.canSkipOrphanUnavailable ?? false;
    }

    protected allNonOptionalChildrenComplete(): boolean {
        return false;
        // const nonOptional = this.children.filter(c => !c.optional);
        // return nonOptional.length > 0 && nonOptional.every(c => c.state === 'complete');
    }

    validate(): void {
        const originalState = this.state;
        const nodeType = this.getStructuralType();

        console.log(`Validating ${this.id}: ${this.nodeTypeName} which is a ${nodeType} node. Current state is ${originalState}
                children: ${this.children.map(child => String(child.id) + ": " + String(child.state))}
                parents: ${this.parents.map(parent => String(parent.id) + ": " + String(parent.state))}`)

        if (nodeType === 'orphaned') {
            if (this.state !== 'unavailable') {
                console.log("Updating state to unavailable")
                this.state = 'unavailable';
                this.cascadeToParents();
                return;
            }
            return;
        }
        if (this.hasUnavailableChild()) {
            if (this.state !== 'unavailable') {
                console.log("updating state to unavailable")
                this.state = 'unavailable';
                this.cascadeToParents();
                return;
            }
            return;
        }
        const hasOnHoldChild = this.hasOnHoldChild();
        const hasRepeatingInProgressChild = this.hasRepeatingInProgressChild();

        if (this.state === 'on-hold') {
            console.log('looking for reasons to come off hold...');
            if (hasOnHoldChild || hasRepeatingInProgressChild) {
                return
            }
            if (!this.heldState) {
                console.log("held state should never be null if we are on-hold")
                return
            }
            console.log("restoring state. then revalidating...")
            this.state = this.heldState;
            this.heldState = null;
            this.validate()
            return;
        }

        if (hasOnHoldChild || hasRepeatingInProgressChild) {
            this.heldState = originalState;
            this.state = 'on-hold';
            this.cascadeToParents();
            return;
        }

        if (nodeType === 'root' && this.state !== 'complete') {
            this.state = 'in-progress';
            if (this.state !== originalState) {
                this.cascadeToParents();
                return;
            }
            return;
        }

        if (nodeType !== 'root' && this.children.length > 0) {
            // TODO:
            // const allNonOptionalComplete = this.children.every(c => c.optional || c.state === 'complete');
            // if (allNonOptionalComplete && this.state === 'unavailable') {
            //     this.state = 'in-progress';
            //     this.cascadeToParents();
            //     return;
            // }
        }
        if (this.hasIncompleteChild()) {
            console.log("found at least one in-progress child")
            this.state = 'unavailable'
            this.cascadeToParents();
            return;
        }
        this.cascadeToParents();
        return;
    }

    protected getStructuralType(): NodeType {
        const hasChildren = this.children.length > 0;
        const hasParents = this.parents.length > 0;

        if (!hasChildren && !hasParents) return 'orphaned';
        if (hasParents && !hasChildren) return 'root';
        if (hasChildren && !hasParents) return 'top';
        return 'intermediate';
    }

    getNodeType(): NodeType {
        return this.getStructuralType();
    }

    protected cascadeToParents(): void {
        if (this.parents.length == 0) {
            return
        }
        for (const parent of this.parents) {
            console.log(`${this.id} is cascading to parent ${parent.id} which is a ${parent.getStructuralType()} node. Current state is ${parent.state}
                  Parent ${parent.id} has children ${parent.children.map(child => String(child.id) + ": " + String(child.state))}`)
            parent.validate();
        }
    }

    protected hasUnavailableChild(): boolean {
        return this.children.some(child => child.state === 'unavailable');
    }

    protected hasOnHoldChild(): boolean {
        return this.children.some(child => child.state === 'on-hold');
    }

    protected hasRepeatingInProgressChild(): boolean {
        return this.children.some(child => {
            return child.repeating && child.state === 'in-progress';
        });
    }

    protected hasIncompleteChild(): boolean {
        return this.children.some(child => {
            return child.state == 'in-progress';
        });
    }

    protected allChildrenComplete(): boolean {
        return this.children.length > 0 && this.children.every(child => child.state === 'complete');
    }

    protected canBeComplete(): boolean {
        return true;
    }

    toJSON(): Record<string, any> {
        return {
            nodeType: this.nodeTypeName,
            id: this.id,
            x: this.x,
            y: this.y,
            state: this.state,
            heldState: this.heldState,
            exp: this.exp,
            fileLink: this.fileLink,
            shape: this.shape,
            canSkipOrphanUnavailable: this.canSkipOrphanUnavailable,
        };
    }

    static fromJSON(data: any): SkillNode {

        return new SkillNode(data)
    }

    addChild(node: SkillNode) {
        this.children.push(node);
    }

    addParent(node: SkillNode) {
        this.parents.push(node);
    }

    // MAJOR TODO:  fit this to node class
    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement, node: SkillNode) {
        const selectedStyle = view.settings.style || 'gamified';
        const isGamified = selectedStyle === 'gamified';

        if (isGamified) {
            modal.classList.add('gamified-modal');
            // slight visual tweak when gamified
            modal.style.border = '2px solid var(--interactive-accent)';
            modal.style.background = 'linear-gradient(135deg, var(--background-primary) 0%, rgba(255,255,255,0.02) 100%)';
            modal.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        }

        const header = modal.createDiv();
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.margin = '0 20px 8px 20px';
        // Title: prefer the node's filename (no directories or .md); fallback to display label
        const titleText = node.fileLink ? (() => {
            let p = node.fileLink.trim();
            // drop any leading slash
            if (p.startsWith('/')) p = p.substring(1);
            const parts = p.split('/');
            let fname = parts[parts.length - 1] || p;
            if (fname.toLowerCase().endsWith('.md')) fname = fname.slice(0, -3);
            return fname;
        })() : (this.fileLink || 'Node');
        header.createEl('h3', { text: titleText }).style.margin = '0';

        // Add note link in bottom right if there's a file link
        const headerRight = header.createDiv();
        headerRight.style.display = 'flex';
        headerRight.style.flexDirection = 'column';
        headerRight.style.alignItems = 'flex-end';

        modal.createEl('span', { text: 'Stats' }).style.fontWeight = '600';

        // Description: read from frontmatter `skilltree-node-desc` if available
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
            // ignore description failures
        }

        if (node.fileLink) {
            const openBtn = headerRight.createEl('button', { text: 'Open Note' });
            openBtn.style.fontSize = '12px';
            openBtn.style.color = 'var(--text-accent)';
            openBtn.style.background = 'transparent';
            openBtn.style.border = 'none';
            openBtn.style.cursor = 'pointer';
            openBtn.style.marginTop = '4px';
            openBtn.style.padding = '4px 6px';

            openBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    let normalizedPath = node.fileLink!.trim();
                    if (!normalizedPath.endsWith('.md')) normalizedPath = normalizedPath + '.md';
                    const file = view.app.vault.getAbstractFileByPath(normalizedPath);
                    if (file && file instanceof TFile) {
                        try {
                            // Mark that we should recenter when this view regains focus
                            // this._recenterOnFocus = true;
                            // await this.app.workspace.openLinkText(node.fileLink!, '', false);
                            // await this.updateFileFrontmatterWithNodeId(node.fileLink, node.id);
                        } catch (err) {
                            console.error('Failed to open note:', err);
                        }
                    } else {
                        // this.showCreateFileModal(node);
                    }
                } catch (err) {
                    console.error('Open Note click failed:', err);
                }
            });
        }

        // Gamified summary (level/progress)
        // try {
        //     const tasks = this._tasksCache.get(node.id) || [];
        //     const totalTasks = tasks.length;
        //     const completedTasks = tasks.filter((t: any) => !!t.completed).length;
        //
        //     // Level progression: level = floor(sqrt(exp)). Progress to next level uses square progression.
        //     const nodeExp = node.exp !== undefined ? node.exp : 10;
        //     const level = Math.max(0, Math.floor(Math.sqrt(nodeExp)));
        //     const levelBase = level * level;
        //     const nextLevelExp = (level + 1) * (level + 1);
        //     const needed = nextLevelExp - levelBase;
        //     const gained = Math.max(0, nodeExp - levelBase);
        //     const levelProgress = needed > 0 ? Math.round((gained / needed) * 100) : 100;
        //     const percent = levelProgress;
        //
        //     if (isGamified) {
        //         // Level calculation (simple sqrt mapping for visible progression)
        //         const nodeExp = node.exp !== undefined ? node.exp : 10;
        //         const level = Math.max(0, Math.floor(Math.sqrt(nodeExp)));
        //
        //         const gamifiedRow = modal.createDiv({ cls: 'gamified-stats-row' });
        //         gamifiedRow.style.display = 'flex';
        //         gamifiedRow.style.alignItems = 'center';
        //         gamifiedRow.style.gap = '12px';
        //         gamifiedRow.style.margin = '8px 20px 12px 20px';
        //
        //         // Show the node's XP worth instead of a level icon
        //         const expBadge = gamifiedRow.createDiv({ cls: 'gamified-exp-badge' });
        //         expBadge.textContent = `${nodeExp} XP`;
        //         expBadge.style.padding = '8px 12px';
        //         expBadge.style.borderRadius = '999px';
        //         expBadge.style.background = 'linear-gradient(90deg, rgba(100,150,255,0.95), rgba(80,120,240,0.9))';
        //         expBadge.style.color = '#fff';
        //         expBadge.style.fontWeight = '700';
        //
        //         // Only show the stylized exp badge
        //         gamifiedRow.appendChild(expBadge);
        //         modal.appendChild(gamifiedRow);
        //         // If the node has tasks, show a simple tasks progress bar (completed/total)
        //         try {
        //             const taskList = this._tasksCache.get(node.id) || [];
        //             const totalTasks = taskList.length;
        //             if (totalTasks > 0) {
        //                 const taskProgressWrap = modal.createDiv({ cls: 'task-progress-wrap' });
        //                 taskProgressWrap.style.margin = '8px 20px 12px 20px';
        //                 const label = taskProgressWrap.createDiv({ text: '' });
        //                 label.style.fontSize = '12px';
        //                 label.style.marginBottom = '6px';
        //
        //                 const bar = taskProgressWrap.createDiv({ cls: 'task-progress-bar' });
        //                 bar.style.width = '100%';
        //                 bar.style.height = '10px';
        //                 bar.style.background = 'rgba(255,255,255,0.06)';
        //                 bar.style.borderRadius = '999px';
        //                 bar.style.overflow = 'hidden';
        //
        //                 const inner = taskProgressWrap.createDiv({ cls: 'task-progress-inner' });
        //                 inner.style.height = '100%';
        //                 inner.style.width = `0%`;
        //                 inner.style.background = 'linear-gradient(90deg, var(--interactive-accent), #ffd36b)';
        //                 inner.style.transition = 'width 200ms ease';
        //
        //                 bar.appendChild(inner);
        //                 taskProgressWrap.appendChild(bar);
        //                 modal.appendChild(taskProgressWrap);
        //
        //                 // Poll to keep the task progress up-to-date while modal is open
        //                 const update = () => {
        //                     try {
        //                         const tasksNow = this._tasksCache.get(node.id) || [];
        //                         const total = tasksNow.length;
        //                         const completed = tasksNow.filter((t: any) => !!t.completed).length;
        //                         if (total > 0) {
        //                             const pctNow = Math.round((completed / total) * 100);
        //                             inner.style.width = `${pctNow}%`;
        //                             label.textContent = `Tasks: ${completed} / ${total}`;
        //                         } else {
        //                             inner.style.width = `0%`;
        //                             label.textContent = 'Tasks: 0 / 0';
        //                         }
        //                     } catch (e) { }
        //                 };
        //                 update();
        //                 const intervalId = setInterval(() => {
        //                     if (!document.body.contains(modal)) {
        //                         clearInterval(intervalId);
        //                         return;
        //                     }
        //                     update();
        //                 }, 800);
        //             }
        //         } catch (e) { }
        //     }
        // } catch (e) {
        // ignore gamified UI failures
    }

    // Requirements tree
    //     const reqHeader = modal.createEl('h4', { text: 'Requirements' });
    //         reqHeader.style.margin = '8px 20px 4px 20px';
    //
    //     const container = modal.createDiv();
    //         container.style.margin = '0 20px 12px 20px';
    //
    //     // Helper: resolve direct children of a node
    //     const childrenOf = (id: string | number) => {
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
    // } catch (e) {
    //     // ignore any errors while attempting to render tasks
    // }
    //     }
    //
}
//
