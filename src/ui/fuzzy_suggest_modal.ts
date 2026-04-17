import { App, FuzzySuggestModal, FuzzyMatch } from "obsidian";
import { linkedNodes } from "../handlers/linked_nodes";
import { view } from "../utils/globals";
import { GetNodes, GetEdges } from "../data/tree_manager";
import { CenterOnNode, Update } from "../rendering/renderer";
import { SkillNode } from "../nodes/skill_node";


const CREATE_PREFIX = '➕ Create: ';


export class FolderSuggestionModal extends FuzzySuggestModal<string> {
    folders: string[];
    onChoose: (value: string) => void;

    constructor(app: App, folders: string[], onChoose: (value: string) => void) {
        super(app);
        this.folders = folders;
        this.onChoose = onChoose;
    }

    getItems(): string[] {
        return this.folders;
    }

    getItemText(item: string): string {
        return item === '' ? 'Root' : item;
    }

    onChooseItem(item: string, _evt: MouseEvent | KeyboardEvent): void {
        void _evt;
        this.close();
        this.onChoose(item);
    }

    getSuggestions(query: string): FuzzyMatch<string>[] {
        if (!query) {
            return this.folders.map((f) => ({ item: f } as unknown as FuzzyMatch<string>));
        }
        return super.getSuggestions(query);
    }
}


export class TreeSuggestModal extends FuzzySuggestModal<string> {
    private onSelect: (treeName: string) => void;
    private items?: string[];

    constructor(app: App, onSelect: (treeName: string) => void, items?: string[]) {
        super(app);
        this.onSelect = onSelect;
        this.items = items;
    }

    getItems(): string[] {
        if (this.items) {
            return this.items;
        }
        return Object.keys(view.settings.trees || {}).sort();
    }

    getItemText(treeName: string): string {
        return treeName;
    }

    onChooseItem(treeName: string): void {
        this.onSelect(treeName);
        this.close();
    }
}

export class VaultFileSuggestModal extends FuzzySuggestModal<string> {
    private onSelect: (path: string) => void;
    private onCreate: (path: string) => void;

    constructor(app: App, onSelect: (path: string) => void, onCreate?: (path: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.onCreate = onCreate ?? onSelect;
    }

    getItems(): string[] {
        const excludedPaths = new Set<string>();
        for (const n of linkedNodes.values()) {
            if (n.fileLink) {
                let path = n.fileLink;
                if (!path.endsWith('.md')) path = path + '.md';
                excludedPaths.add(path);
            }
        }

        const query = this.inputEl?.value?.trim() || '';

        const files = this.app.vault.getFiles()
            .filter(f => f.extension === 'md')
            .map(f => f.path)
            .filter(path => !excludedPaths.has(path))
            .sort();

        if (query && !files.some(f => f.toLowerCase().includes(query.toLowerCase()))) {
            const createPath = query.endsWith('.md') ? query : query + '.md';
            if (linkedNodes.has(createPath)) {
                return files;
            }
            return [CREATE_PREFIX + createPath, ...files];
        }

        return files;
    }

    getItemText(item: string): string {
        return item.replace(/\.md$/, '');
    }

    renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
        el.setText(this.getItemText(item.item));
        if (item.item.startsWith(CREATE_PREFIX)) {
            el.style.color = 'var(--interactive-accent)';
            el.style.fontWeight = 'bold';
        }
    }

    onChooseItem(item: string): void {
        if (item.startsWith(CREATE_PREFIX)) {
            const path = item.replace(CREATE_PREFIX, '');
            this.onCreate(path);
        } else {
            this.onSelect(item);
        }
        this.close();
    }

    onKeyDown(event: KeyboardEvent): boolean {
        if (event.key === 'Escape') {
            this.close();
            return true;
        }
        if (event.key === 'Enter') {
            const query = this.inputEl.value.trim();
            if (query) {
                const path = query.endsWith('.md') ? query.replace(/\.md$/, '') : query;
                this.onCreate(path);
            }
            this.close();
            return true;
        }
        return false;
    }
}


export class NodeSuggestModal extends FuzzySuggestModal<SkillNode> {
    constructor(app: App) {
        super(app);
    }

    getItems(): SkillNode[] {
        return Array.from(GetNodes().values());
    }

    getItemText(node: SkillNode): string {
        return node.displayText || '';
    }

    onChooseItem(node: SkillNode): void {
        CenterOnNode(node);
        Update();
        this.close();
    }
}


export class OrphanNodeSuggestModal extends FuzzySuggestModal<SkillNode> {
    constructor(app: App) {
        super(app);
    }

    getItems(): SkillNode[] {
        const nodes = Array.from(GetNodes().values());
        const edges = GetEdges();

        return nodes.filter(node => {
            const hasParent = edges.some(e => e.to === node.id);
            const hasChild = edges.some(e => e.from === node.id);
            return !hasParent && !hasChild;
        });
    }

    getItemText(node: SkillNode): string {
        return node.displayText || '';
    }

    onChooseItem(node: SkillNode): void {
        CenterOnNode(node);
        Update();
        this.close();
    }
}
