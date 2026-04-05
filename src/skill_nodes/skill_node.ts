import { NodeState, NodeType, NodeShape } from "./types";
import { ISkillNode } from "./interfaces";
import { SkillTreeView } from "src/skilltreeview";
import { TFile } from "obsidian";
import { GetEdges, GetNodes, tasksCache } from "src/tree-manager";
import { STATS_MODAL_EXP_BADGE_DOM_EL_INFO, STATS_MODAL_ROW_DOM_EL_INFO } from "../constants"
import { OptionalNode } from "./optional_node";

// TODO: Maybe change to base skill node
export class SkillNode implements ISkillNode {
    readonly nodeTypeName: string = "BaseNode";

    // This should be allowed to change by anybody
    get userCompletable(): boolean {
        return true
    }

    id: string | number;
    x: number;
    y: number;
    state: NodeState;


    heldState: NodeState | null = null;
    exp: number;
    fileLink?: string;
    shape: NodeShape;
    canSkipOrphanUnavailable: boolean = false;

    to: SkillNode[] = [];
    from: SkillNode[] = [];

    constructor(data: Partial<ISkillNode> = {}) {
        this.id = data.id ?? crypto.randomUUID()
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.state = data.state ?? 'unavailable';
        this.heldState = data.heldState ?? null;
        this.exp = data.exp ?? 0;
        this.fileLink = data.fileLink;
        this.shape = data.shape ?? 'circle';
        this.canSkipOrphanUnavailable = data.canSkipOrphanUnavailable ?? false;
    }

    protected allNonOptionalFromsComplete(): boolean {
        for (let from of this.from) {
            if (from.nodeTypeName == "OptionalNode") {
                continue
            }
            if (from.state != "complete") {



                return false
            }
        }
        return true
    }

    updateRelationShips() {
        const edges = GetEdges();
        const nodes = GetNodes();

        this.from = edges
            .filter((e) => e.to === this.id)
            .map((e) => nodes.get(e.from as string | number))
            .filter((n): n is SkillNode => n !== undefined);

        this.to = edges
            .filter((e) => e.from === this.id)
            .map((e) => nodes.get(e.to as string | number))
            .filter((n): n is SkillNode => n !== undefined);
    }

    validateOrphanNode() {
        this.state = "unavailable"
    }

    validateStartNode() {
        if (this.userCompletable && this.state === "complete") {
            return
        }
        this.state = "in-progress"
    }

    validateIntermediateNode() {
        if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else if (this.allNonOptionalFromsComplete()) {
            // Only set to in-progress if not already complete (user manually marked it)
            if (this.state !== "complete") {
                this.state = "in-progress"
            }
        }
        else {
            this.state = "unavailable"
        }

    }


    validateEndNode() {
        if (this.hasUnavailableFroms()) {
            this.state = "unavailable"
        }
        else if (this.allNonOptionalFromsComplete()) {
            // Only set to in-progress if not already complete (user manually marked it)
            if (this.state !== "complete") {
                this.state = "in-progress"
            }
        }
        else {
            this.state = "unavailable"
        }

    }

    validate(): void {
        const nodeStructuralType = this.getStructuralType()


        switch (this.getStructuralType()) {
            case "orphaned":
                this.validateOrphanNode()
                break;
            case "start":
                this.validateStartNode()
                break;
            case "intermediate":
            case "end":
                this.validateEndNode()
                break;
        }
        this.cascadeTo()
    }

    getStructuralType(): NodeType {
        const to = this.to.length > 0;
        const from = this.from.length > 0;

        if (!to && !from) return 'orphaned';
        if (!from && to) return 'start';
        if (!to && from) return 'end';

        return 'intermediate';
    }

    getNodeType(): NodeType {
        return this.getStructuralType();
    }

    protected cascadeTo(): void {
        if (this.to.length == 0) {
            return
        }
        for (const to of this.to) {

            to.validate();
        }
    }

    protected hasUnavailableFroms(): boolean {
        return this.from.some(from => from.state === 'unavailable');
    }

    protected hasOnHoldFrom(): boolean {
        return this.to.some(from => from.state === 'on-hold');
    }

    protected hasRepeatingInProgressFrom(): boolean {
        return this.to.some(from => {
            // TODO: 
            // return from.repeating && from.state === 'in-progress';
        });
    }

    protected hasIncompleteFrom(): boolean {
        return this.to.some(child => {
            return child.state == 'in-progress';
        });
    }

    protected allFromsComplete(): boolean {
        return this.to.length > 0 && this.to.every(child => child.state === 'complete');
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

        if (!this.fileLink) {
            return
        }

        // TODO: factor out
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

                    }
                } else {
                    // this.showCreateFileModal(node);
                }
            } catch (err) {

            }
        });
    }

    // TODO: factor out
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

    async setEditModalContents(view: SkillTreeView, modal: HTMLElement) {
    }

}
