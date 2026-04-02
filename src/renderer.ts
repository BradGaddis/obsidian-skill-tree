import { Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview";
import { modeToggleBtn, editModeOnlyButtons } from "./toolbar";
import { SKILLTREE_CANVAS_WRAP } from "./constants";
import { GetEdges, GetNodes } from "./tree-manager";
import { SkillNode } from "./skill_nodes/skill_node";
import { SKILL_TREE_STYLES } from "./styles";
import { NodeShape } from "./skill_nodes/types";
import { OptionalNode } from "./skill_nodes/optional_node";


let view: SkillTreeView
const dpr = window.devicePixelRatio || 1;

let nodeRadius: number = 36
let nodeRadii: Record<string | number, number> = {}
let allNodeRadii: Map<string | number, number> = new Map()

let clientW: number = 0
let clientH: number = 0
let leftWorld: number = 0
let rightWorld: number = 0
let topWorld: number = 0
let bottomWorld: number = 0
let cullMargin: number = 0


export function InitRenderer(skillTreeView: SkillTreeView) {
    view = skillTreeView
    SetupCanvas()
}

function SetupCanvas() {
    view.containerEl.style.display = 'flex';
    view.containerEl.style.flexDirection = 'column';
    view.containerEl.style.height = '100%';

    view.canvasWrap = view.containerEl.createEl('div', SKILLTREE_CANVAS_WRAP);
    view.canvasWrap.style.width = '100%';
    view.canvasWrap.style.flex = '1';
    view.canvasWrap.style.minHeight = '400px';
    view.canvasWrap.style.overflow = 'hidden';
    view.canvasWrap.style.position = 'relative';

    view.canvas = view.canvasWrap.createEl('canvas');
    view.canvas.style.width = '100%';
    view.canvas.style.height = '100%';

    const context = view.canvas.getContext('2d');
    if (!context) return;

    const rect = view.canvas.getBoundingClientRect();

    view.canvas.width = Math.round(rect.width * dpr);
    view.canvas.height = Math.round(rect.height * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.context = context;
}

export function UpdateToolbarUI(): void {
    switch (view.settings.mode) {
        case "edit":
            view.settings.mode = "edit"
            modeToggleBtn.textContent = 'Edit Mode';
            break;
        case "view":
            view.settings.mode = "view"
            modeToggleBtn.textContent = 'View Mode';
            break;
        default:
            new Notice("Somehow the toggle broke. Debugging needed...")
            break;
    }

    for (let button of editModeOnlyButtons) {
        button.style.display = view.settings.mode == "edit" ? 'inline-block' : 'none';
    };
}

export function Render(): void {
    if (!view.context || !view.canvas) return;
    const context = view.context;
    RenderWarningBanner();

    context.save();
    try {
        context.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, view.offset.x * dpr, view.offset.y * dpr);
    } catch (e) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.translate(view.offset.x, view.offset.y);
        context.scale(view.scale, view.scale);
    }


    const clientW = view.canvas.width / dpr;
    const clientH = view.canvas.height / dpr;
    leftWorld = (-view.offset.x) / view.scale;
    rightWorld = (clientW - view.offset.x) / view.scale;
    topWorld = (-view.offset.y) / view.scale;
    bottomWorld = (clientH - view.offset.y) / view.scale;
    cullMargin = 120 / view.scale;

    nodeRadius = view.settings.nodeRadius || 36;

    const nodeMap = GetNodes()

    RenderEdgeLines(nodeMap)

    RenderNodes(nodeMap)

    context.restore();
}


function RenderWarningBanner(padding: number = 2) {
    const context = view.context;
    const canvas = view.canvas;
    if (!context || !canvas) return;


    if (!view.isTasksPluginInstalled() || !view.isDataviewPluginInstalled()) {
        context.save();
        context.fillStyle = 'rgba(255, 193, 7, 0.9)';
        context.fillRect(-padding, -padding, canvas.width + padding * 2, canvas.height + padding * 2);
        context.fillStyle = '#000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(
            '⚠️ Tasks and Dataview plugins are required. Please install/enable both plugins to use all features.',
            canvas.width / 2,
            20
        );
        context.restore();
    }

}


function RenderTemporaryEdgeLine() {

}

function RenderEdgeLines(nodeMap: Map<string | number, SkillNode>) {
    const edgeLineWidth = 24 / Math.max(0.3, view.scale);
    const nodes = GetNodes()

    allNodeRadii = new Map(
        [...nodes.values()].map(n => [n.id, nodeRadii[n.id] || nodeRadius])
    );

    const selectedStyle: string = view.settings.style

    const styleDef = SKILL_TREE_STYLES[selectedStyle as keyof typeof SKILL_TREE_STYLES];

    const defaultShape = styleDef?.nodeShape || 'circle';

    const context = view.context
    if (!context) {
        return;
    }

    for (const e of GetEdges()) {
        console.log(e)
        if (!e.from || !e.to) {
            continue;
        }

        const a = nodeMap.get(e.from) || null;
        const b = nodeMap.get(e.to) || null;
        if (!a || !b) continue;

        const rFrom = allNodeRadii.get(a.id) as number;
        const rTo = allNodeRadii.get(b.id) as number;
        let sx1 = a.x;
        let sy1 = a.y;

        if (e.fromSide) {
            if (e.fromSide === 'top') { sx1 = a.x; sy1 = a.y - rFrom; }
            if (e.fromSide === 'right') { sx1 = a.x + rFrom; sy1 = a.y; }
            if (e.fromSide === 'bottom') { sx1 = a.x; sy1 = a.y + rFrom; }
            if (e.fromSide === 'left') { sx1 = a.x - rFrom; sy1 = a.y; }
        }
        let sx2 = b.x;
        let sy2 = b.y;
        if (e.toSide) {
            if (e.toSide === 'top') { sx2 = b.x; sy2 = b.y - rTo; }
            if (e.toSide === 'right') { sx2 = b.x + rTo; sy2 = b.y; }
            if (e.toSide === 'bottom') { sx2 = b.x; sy2 = b.y + rTo; }
            if (e.toSide === 'left') { sx2 = b.x - rTo; sy2 = b.y; }
        }

        if (!e.fromSide || !e.toSide) {
            const dx = sx2 - sx1;
            const dy = sy2 - sy1;
            const d = Math.hypot(dx, dy) || 1;
            if (!e.fromSide) {
                sx1 = a.x + (dx / d) * rFrom;
                sy1 = a.y + (dy / d) * rFrom;
            }
            if (!e.toSide) {
                sx2 = b.x - (dx / d) * rTo;
                sy2 = b.y - (dy / d) * rTo;
            }
        }

        context.save();

        let edgeColor: string;
        let edgeGlow = false;
        const edgeStyle = styleDef?.edgeStyle || 'straight';

        edgeGlow = false;
        const isGamified = selectedStyle === 'gamified';

        const showBezier = view.settings.showBezier;
        const useBezier = isGamified || showBezier;

        const nodeStateColorKeys = new Map<string | number, string>();

        const aState = a.state || 'in-progress';
        const bState = b.state || 'in-progress';

        if (styleDef && styleDef.edgeColor && styleDef.edgeColor !== 'auto') {
            edgeColor = styleDef.edgeColor;
        } else {
            edgeColor = '#666';
        }

        context.beginPath();
        context.strokeStyle = edgeColor;
        context.lineWidth = edgeLineWidth;
        context.moveTo(sx1, sy1);
        context.lineTo(sx2, sy2);
        context.stroke();

        const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
        const headLen = edgeLineWidth * 2;
        context.beginPath();
        context.moveTo(sx2, sy2);
        context.lineTo(sx2 - headLen * Math.cos(angle - Math.PI / 6), sy2 - headLen * Math.sin(angle - Math.PI / 6));
        context.lineTo(sx2 - headLen * Math.cos(angle + Math.PI / 6), sy2 - headLen * Math.sin(angle + Math.PI / 6));
        context.closePath();
        context.fillStyle = edgeColor;
        context.fill();

        context.restore();
    }
}

// TODO implement culling. Not a problem while debugging very small trees
function RenderNodes(nodeMap: Map<string | number, SkillNode>) {
    const context = view.context
    if (!context) return
    console.log("context exists")
    const allNodes = Array.from(nodeMap.values())
    const visibleNodes = allNodes//.filter(n => {
    //     const r = nodeRadii[n.id] || nodeRadius
    //     return !(n.x + r < leftWorld - cullMargin || n.x - r > rightWorld + cullMargin ||
    //         n.y + r < topWorld - cullMargin || n.y - r > bottomWorld + cullMargin)
    // })

    console.log(`visibleNodes: ${visibleNodes}`)

    const selectedStyle = view.settings.style || 'default'
    const styleDef = SKILL_TREE_STYLES[selectedStyle as keyof typeof SKILL_TREE_STYLES]


    for (const n of visibleNodes) {

        console.log(`${n.x} ${n.y}`)
        context.beginPath();
        const nodeState = n.state
        if (nodeState === 'complete') {
            console.log("is complete?")
            if (styleDef && styleDef.nodeColors) {
                context.fillStyle = styleDef.nodeColors.complete.fill;
                context.strokeStyle = styleDef.nodeColors.complete.stroke;
            } else {
                context.fillStyle = '#FFD700';
                context.strokeStyle = '#b8860b';
            }
        }
        else if (nodeState === 'on-hold') {
            if (styleDef && styleDef.nodeColors && styleDef.nodeColors.onHold) {
                context.fillStyle = styleDef.nodeColors.onHold.fill;
                context.strokeStyle = styleDef.nodeColors.onHold.stroke;
            } else {
                context.fillStyle = '#ff6b6b';
                context.strokeStyle = '#c92a2a';
            }
        } else if (nodeState === 'unavailable') {
            if (styleDef && styleDef.nodeColors) {
                context.fillStyle = styleDef.nodeColors.unavailable.fill;
                context.strokeStyle = styleDef.nodeColors.unavailable.stroke;
            } else {
                // context.fillStyle = this._unavailableNodeColors!.fill;
                // context.strokeStyle = this._unavailableNodeColors!.stroke;
            }
        }

        const r = allNodeRadii.get(n.id) as number;
        const defaultShape = styleDef?.nodeShape || 'circle';
        // TODO validate magic number is correct
        context.lineWidth = 4 / view.scale;

        const validShapes = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];
        // const effectiveShape = (n.shape && validShapes.includes(n.shape)) ? n.shape : defaultShape;

        context.beginPath();
        drawNodeShape(context, n.x, n.y, r, n.shape);
        context.fill();

        context.stroke();

        context.textAlign = 'center';
        context.font = `${14 / view.scale}px sans-serif`;
        let labelTextColor// = cachedTextColor;
        labelTextColor = '#000';
        let lines: string[] = [];

        // if (n.optional) {
        //     lines = ['Optional Path'];
        // } else if (n.treeLink) {
        //     lines = ['Tree Link', n.treeLink];
        // } else {
        //     const exp = n.exp !== undefined ? n.exp : 0;
        //     const words = (this.getNodeDisplayLabel(n) || '').split(/\s+/).filter(Boolean);
        //     for (let i = 0; i < words.length; i += 4) {
        //         lines.push(words.slice(i, i + 4).join(' '));
        //     }
        //     if (lines.length === 0) lines.push('');
        //     if (exp > 0 || showExpAsFraction) {
        //         lines[lines.length - 1] = `${lines[lines.length - 1]}`.trim();
        //     }
        // }
        //
        let fileName = n.fileLink
        let isUnlinked = false;

        if (!n.fileLink) {
            fileName = 'Right click to add note';
            isUnlinked = true;
        }
        const lineHeight = 16 / view.scale;
        const totalLines = lines.length + (fileName ? 1 : 0) + (isUnlinked ? 1 : 0);
        let firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;

        // const taskListForHint = this._tasksCache.get(n.id) || [];
        // const incompleteCount = taskListForHint.filter((t: any) => !t.completed).length;
        // const hintHasTasks = taskListForHint.length > 0;
        // let showTaskHint = hintHasTasks && incompleteCount > 0;
        // if (n.optional || n.checkpoint) showTaskHint = false;
        // if (showTaskHint) {
        //     firstLineY -= (lineHeight * 0.35);
        // }

        if (n instanceof OptionalNode) {
            const iconScreenSize = 30;
            const iconSize = iconScreenSize / view.scale;
        }
    }
}

function drawNodeShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    shape: NodeShape
): void {
    console.log("drawing it working?")
    switch (shape) {
        case 'hexagon':
            drawHexagon(ctx, x, y, radius);
            break;
        case 'star':
            drawStar(ctx, x, y, radius);
            break;
        case 'diamond':
            drawDiamond(ctx, x, y, radius);
            break;
        // case 'square':
        //     drawSquare(ctx, x, y, radius);
        //     break;
        // case 'repeat':
        //     drawRepeat(ctx, x, y, radius);
        //     break;
        case 'circle':
        default:
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.closePath();
            break;
    }
}



export function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }

    }
    ctx.closePath();
}


export function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
}


export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number = 5): void {
    ctx.beginPath();
    const outerRadius = radius;
    const innerRadius = radius * 0.5;
    for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
}
