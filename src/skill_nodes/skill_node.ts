import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode } from "./interfaces";
import { SkillTreeView } from "src/skilltreeview";
import { TFile } from "obsidian";
import { tasksCache } from "src/tree-manager";
import { STATS_MODAL_EXP_BADGE_DOM_EL_INFO, STATS_MODAL_ROW_DOM_EL_INFO } from "../constants"

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
            // TODO: 
            // return child.repeating && child.state === 'in-progress';
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
    // TODO: factor out styling
    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement) {

        // TODO: refactor this for user preference
        const selectedStyle = view.settings.style

        modal.style.border = '2px solid var(--interactive-accent)';
        modal.style.background = 'linear-gradient(135deg, var(--background-primary) 0%, rgba(255,255,255,0.02) 100%)';
        modal.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';


        // TODO: move into some modal header function
        const header = modal.createDiv();
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.margin = '0 20px 8px 20px';

        // Title: prefer the node's filename (no directories or .md); fallback to display label
        const titleText = this.fileLink ? (() => {
            let p = this.fileLink.trim();
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

        // TODO: refactor into seperate method and deal with this try/catch
        //
        // Description: read from frontmatter `skilltree-node-desc` if available
        try {
            let descText = 'no description';
            if (this.fileLink) {
                let normalizedPath = this.fileLink.trim();
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

        if (this.fileLink) {
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
                    let normalizedPath = this.fileLink!.trim();
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

    }
    // Show the node's XP worth instead of a level icon
    createExpBadge(el: HTMLElement) {
        const expBadge = el.createDiv(STATS_MODAL_EXP_BADGE_DOM_EL_INFO);
        expBadge.textContent = `${this.exp} XP`;
        expBadge.style.padding = '8px 12px';
        expBadge.style.borderRadius = '999px';
        expBadge.style.background = 'linear-gradient(90deg, rgba(100,150,255,0.95), rgba(80,120,240,0.9))';
        expBadge.style.color = '#fff';
        expBadge.style.fontWeight = '700';

        // Only show the stylized exp badge
        el.appendChild(expBadge);
    }

}
