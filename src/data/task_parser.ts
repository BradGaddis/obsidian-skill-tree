import { App, Notice, TFile } from "obsidian";
import { SkillTask } from "../types/interfaces";
import { LOOP_UPPER_LIMIT } from "../types/constants";
import { SkillNode } from "../nodes/skill_node";

const CHECKBOX_REGEX = /^\s*-\s+\[([ xX/])\]\s+(.+)$/;
const DATE_REGEX = /(🛫|⏳|📅)\s*(\d{4}-\d{2}-\d{2})/g;
const PRIORITY_REGEX = /(🔺|⏫|🔼|🔽|⏬)/;


function parseDate(dateStr: string): Date {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export async function parseTasksFromNode(app: App, node: SkillNode): Promise<SkillTask[]> {
    if (!node.fileLink) return [];

    const file = app.vault.getAbstractFileByPath(node.fileLink);
    if (!file || !(file instanceof TFile)) return [];

    try {
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        const rootSkillTasks: SkillTask[] = [];
        const stack: { task: SkillTask; indent: number }[] = [];
        let id = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === undefined) {
                console.error(`Line ${i} is undefined in parseTasksFromNode`);
                continue;
            }
            const match = line.match(CHECKBOX_REGEX);
            if (!match) continue;
            if (match[1] === undefined || match[2] === undefined) {
                console.error(`Match is missing required groups at line ${i}`);
                continue;
            }

            const status = match[1].toLowerCase() as ' ' | 'x' | '/';
            const text = match[2].trim();
            const currentIndent = line.search(/\S/);

            const dateMatches = [...text.matchAll(DATE_REGEX)];
            let scheduled = new Date(0);
            let due = new Date(0);
            let startDate = new Date(0);
            let cleanedText = text;

            for (const dateMatch of dateMatches) {
                const [fullMatch, emoji, dateStr] = dateMatch;
                if (emoji === undefined || dateStr === undefined) {
                    console.error('Date match is missing required groups');
                    continue;
                }
                const parsedDate = parseDate(dateStr);
                if (emoji === '⏳') {
                    scheduled = parsedDate;
                } else if (emoji === '📅') {
                    due = parsedDate;
                } else if (emoji === '🛫') {
                    startDate = parsedDate;
                }
                cleanedText = cleanedText.replace(fullMatch, '').trim();
            }

            const priorityMatch = cleanedText.match(PRIORITY_REGEX);
            let priority = 'normal';
            if (priorityMatch && priorityMatch[1] !== undefined) {
                const emoji = priorityMatch[1];
                priority = emoji === '🔺' ? 'highest'
                    : emoji === '⏫' ? 'high'
                        : emoji === '🔼' ? 'medium'
                            : emoji === '🔽' ? 'low'
                                : 'lowest';
                cleanedText = cleanedText.replace(emoji, '').trim();
            }

            const task: SkillTask = {
                id: id++,
                text: cleanedText,
                line: i + 1,
                originalTask: line,
                exp: 10,
                status,
                children: [],
                scheduled,
                due,
                startDate,
                filePath: file.path,
                recurring: false,
                priority
            };

            let safetyCounter = 0;
            while (
                stack.length > 0 &&
                safetyCounter < LOOP_UPPER_LIMIT
            ) {
                const top = stack[stack.length - 1];
                if (top === undefined || top.indent < currentIndent) {
                    break;
                }
                stack.pop();
                safetyCounter++;
            }

            if (stack.length === 0) {
                task.parent = undefined;
                rootSkillTasks.push(task);
            } else {
                const parentTask = stack[stack.length - 1];
                if (parentTask) {
                    task.parent = parentTask.task;
                    parentTask.task.children.push(task);
                }
            }

            stack.push({ task, indent: currentIndent });
        }

        return rootSkillTasks;
    } catch (err) {
        console.error(`[parseTasksFromNode] Error parsing tasks from file ${node.fileLink}:`, err);
        return [];
    }
}


function setChildrenStatus(task: SkillTask, status: ' ' | 'x' | '/'): void {
    task.status = status;
    for (const child of task.children) {
        setChildrenStatus(child, status);
    }
}

function propagateUp(task: SkillTask): void {
    let current: SkillTask | undefined = task.parent;
    let safetyCounter = 0;
    while (current) {
        if (safetyCounter >= LOOP_UPPER_LIMIT) break;
        safetyCounter++;
        const allComplete = current.children.every(child => child.status === 'x');
        const newStatus: ' ' | 'x' = allComplete ? 'x' : ' ';
        if (current.status !== newStatus) {
            current.status = newStatus;
        } else {
            break;
        }
        current = current.parent;
    }
}

function collectAffectedSkillTasks(task: SkillTask, tasks: Map<number, SkillTask>): void {
    tasks.set(task.id!, task);
    for (const child of task.children) {
        collectAffectedSkillTasks(child, tasks);
    }
}

export async function toggleComplete(task: SkillTask, complete: boolean, app: App): Promise<SkillTask> {
    const newStatus: ' ' | 'x' = complete ? 'x' : ' ';

    setChildrenStatus(task, newStatus);

    if (task.parent) {
        propagateUp(task.parent);
    }

    const affectedSkillTasks = new Map<number, SkillTask>();
    collectAffectedSkillTasks(task, affectedSkillTasks);

    let current = task.parent;
    let safetyCounter = 0;
    while (current) {
        if (safetyCounter >= LOOP_UPPER_LIMIT) break;
        safetyCounter++;
        if (!affectedSkillTasks.has(current.id!)) {
            affectedSkillTasks.set(current.id!, current);
        }
        current = current.parent;
    }

    const file = app.vault.getAbstractFileByPath(task.filePath) as TFile | null;
    if (file) {
        try {
            let content = await app.vault.read(file);
            const lines = content.split('\n');

            for (const affectedSkillTask of affectedSkillTasks.values()) {
                const lineIdx = affectedSkillTask.line - 1;
                if (lineIdx >= 0 && lineIdx < lines.length) {
                    const line = lines[lineIdx];
                    if (line !== undefined) {
                        lines[lineIdx] = line.replace(
                            /(-\s+\[)([ xX/])(\])/,
                            `$1${affectedSkillTask.status}$3`
                        );
                        affectedSkillTask.originalTask = lines[lineIdx];
                    }
                }
            }

            await app.vault.modify(file, lines.join('\n'));
        } catch (err) {
            console.error('[toggleComplete] Error modifying file:', task.filePath, err);
            new Notice('Failed to update task in file');
            // Revert the status changes since the file write failed
            const revertStatus: ' ' | 'x' = complete ? ' ' : 'x';
            setChildrenStatus(task, revertStatus);
            if (task.parent) {
                propagateUp(task.parent);
            }
        }
    }

    return task;
}
