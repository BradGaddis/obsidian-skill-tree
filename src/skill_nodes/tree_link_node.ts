import { SkillNode } from "./skill_node";
import { NodeShape } from "./types";
import { RecordSnapshot, SaveNodes } from "src/recorder";
import { Render } from "src/renderer";
import * as S from "../styles";
import { SkillTreeView } from "src/skilltreeview";
import { getView } from "src/ux/event_utils";
import { SwitchTree } from "src/tree_manager";

export class TreeLinkNode extends SkillNode {
    readonly nodeTypeName = 'TreeLinkNode';

    private _treeLink: string | null = null;
    linkedTreeComplete: boolean = false;

    shape: NodeShape = "diamond"


    set treeLink(value: string | null) {
        this._treeLink = value;
    }

    get userCompletable(): boolean {
        return false;
    }

    constructor(data: Partial<TreeLinkNode> = {}) {
        super(data);
        this._treeLink = data.treeLink ?? null;

        this.linkedTreeComplete = data.linkedTreeComplete ?? false;

        // this.colorOverride.unavailable = { fill: '#4a5568', stroke: '#718096' }
        // this.colorOverride.complete = { fill: '#9f7aea', stroke: '#805ad5' }
    }

    validate(): void {
        this.displayText = this.state == "complete" ? "Completed" : "In Progress"
        if (!this._treeLink) {
            this.state = "unavailable";
            super.validate();
            return;
        }

        const view = getView();

        const linkedTree = (view as any).settings?.trees?.[this._treeLink];
        if (!linkedTree || !linkedTree.nodes || linkedTree.nodes.length === 0) {
            this.state = "unavailable";
            super.validate();
            return;
        }

        const linkedNodes = linkedTree.nodes;
        let terminalComplete = false;

        for (const nodeData of linkedNodes) {
            if (nodeData.nodeType === 'TerminalNode' && nodeData.state === 'complete') {
                terminalComplete = true;
                break;
            }
        }

        if (terminalComplete) {
            this.linkedTreeComplete = true;
            this.state = "complete";
        } else {
            this.linkedTreeComplete = false;
            this.state = "unavailable";
        }

        super.validate();
    }

    getEditModalRows(view: SkillTreeView, content: HTMLElement): void {
        const row = content.createEl('div');
        row.style.cssText = S.FORM_ROW;

        const label = row.createEl('label');
        label.textContent = 'Link to tree:';
        label.style.cssText = S.FORM_LABEL;

        const select = row.createEl('select') as HTMLSelectElement;
        select.style.cssText = S.FORM_SELECT;

        const treeNames = Object.keys((view as any).settings?.trees || {});
        const currentLink = this._treeLink || '';
        for (const treeName of treeNames) {
            const option = select.createEl('option');
            option.value = treeName;
            option.textContent = treeName;
            if (treeName === currentLink) {
                option.selected = true;
            }
        }

        select.onchange = () => {
            this._treeLink = select.value || null;
            RecordSnapshot();
            SaveNodes();
            Render();
        };
    }

    async setStatsModalContents(view: SkillTreeView, modal: HTMLElement) {        
        const content = modal.children[1] as HTMLElement;
        
        const titleRow = content.createEl('div');
        titleRow.style.cssText = S.STATS_MODAL_TITLE;
        titleRow.textContent = `Tree Link: ${this._treeLink || 'None'}`;

        const stateRow = content.createEl('div');
        stateRow.style.cssText = S.STATS_MODAL_ROW;
        stateRow.textContent = `State: ${this.state}`;

        if (this._treeLink) {
            const linkedTree = (view as any).settings?.trees?.[this._treeLink];
            if (linkedTree?.nodes) {
                const hasTerminal = linkedTree.nodes.some((n: any) => n.nodeType === 'TerminalNode');
                const terminalComplete = linkedTree.nodes.some((n: any) => n.nodeType === 'TerminalNode' && n.state === 'complete');
                
                const linkStatusRow = content.createEl('div');
                linkStatusRow.style.cssText = S.STATS_MODAL_MUTED;
                linkStatusRow.textContent = `Linked tree has terminal: ${hasTerminal ? 'Yes' : 'No'}${hasTerminal ? ` (${terminalComplete ? 'Complete' : 'Incomplete'})` : ''}`;
            }
        }

        const header = modal.children[0] as HTMLElement;

        const headerRight = header.querySelector('.skill-tree-modal-header-right') || (() => {
            const div = header.createEl('div');
            div.className = 'skill-tree-modal-header-right';
            div.style.cssText = S.STATS_MODAL_HEADER_RIGHT;
            return div;
        })();

        const goToTreeBtn = headerRight.createEl('button');
        goToTreeBtn.textContent = `Go to ${this._treeLink || 'Tree'}`;
        goToTreeBtn.style.cssText = S.STATS_MODAL_GO_BUTTON;

        const treeLink = this._treeLink;
        goToTreeBtn.onclick = () => {
            if (!treeLink) return;

            const closeBtn = header.querySelector('button');
            if (closeBtn) {
                closeBtn.click();
            }

            setTimeout(async () => {
                await SwitchTree(treeLink);
            }, 50);
        };
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            treeLink: this.treeLink,
            linkedTreeComplete: this.linkedTreeComplete,
        };
    }

    static fromJSON(data: any): TreeLinkNode {
        return new TreeLinkNode(data);
    }
}
