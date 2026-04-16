import { SkillTreeSettings } from "../types/interfaces";
import { SkillTreeView } from "../skilltreeview";

export let view: SkillTreeView
export let settings: SkillTreeSettings


export function SetSettings(val: SkillTreeSettings) {
    settings = val
}

export function SetView(val: SkillTreeView) {
    view = val
}

