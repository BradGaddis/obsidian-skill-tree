import { SkillTreeView } from "src/skilltreeview";
import { SkillTreeData } from "src/interfaces";
import { GetNodes, GetEdges } from "../tree-manager";
import { SaveNodes } from "../recorder";
import { Render } from "../renderer";

let view: SkillTreeView;

export function InitJSONEditor(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function RefreshJsonEditor(): void {
    if (!view) return;
    if (view._jsonTextarea) {
        const treeData: SkillTreeData = {
            name: view.settings.currentTreeName,
            nodes: Array.from(GetNodes().values()),
            edges: GetEdges()
        };
        view._jsonTextarea.value = JSON.stringify(treeData, null, 2);
    }
}