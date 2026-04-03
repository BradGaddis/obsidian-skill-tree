import { Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview";
import { modeToggleBtn, editModeOnlyButtons } from "./toolbar";
import { SKILLTREE_CANVAS_WRAP } from "./constants";
import { GetEdges, GetNodes, GetSelectedNodeId } from "./tree-manager";
import { SkillNode } from "./skill_nodes/skill_node";
import { SKILL_TREE_STYLES } from "./styles";
import { NodeShape, NodeState } from "./skill_nodes/types";
import { OptionalNode } from "./skill_nodes/optional_node";
import { Coordinate } from "./types";


let view: SkillTreeView
const dpr = window.devicePixelRatio || 1;

export let nodeRadius: number
export let nodeRadii: Record<string | number, number> = {}
let allNodeRadii: Map<string | number, number> = new Map()

// let clientW: number = 0
// let clientH: number = 0
let leftWorld: number = 0
let rightWorld: number = 0
let topWorld: number = 0
let bottomWorld: number = 0
let cullMargin: number = 0
let canvasWidth: number = 0
let canvasHeight: number = 0
let worldCoordinates: Coordinate

let styleDef: typeof SKILL_TREE_STYLES['gamified'] | undefined;

// TODO: Make it an adjustable setting
const fontSize = 16

export function InitRenderer(skillTreeView: SkillTreeView) {
    view = skillTreeView
    nodeRadius = view.settings.nodeRadius
    SetupCanvas()
    const canvas = view.canvas;
    if (!canvas) return
    view.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            Render();
        }
    });
    view.resizeObserver.observe(canvas);
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

// TODO: factor in world origin, update all of the node coordinates
export function Recenter() {
    const nodes = Array.from(GetNodes().values());
    canvasWidth = (view.canvas?.width || 0) / dpr
    canvasHeight = (view.canvas?.height || 0) / dpr
    if (nodes.length > 0) {
        // Calculate center of all nodes
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        // Offset to center (assuming canvas is ~800px wide)
        view.offset = { x: canvasWidth / 2 - centerX, y: canvasHeight / 2 - centerY };
    }
    Render();
}

export function Render(): void {
    if (!view.context || !view.canvas) return;
    const context = view.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, view.canvas.width, view.canvas.height);

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

    nodeRadius = view.settings.nodeRadius

    const nodes = Array.from(GetNodes().values())


    styleDef = SKILL_TREE_STYLES[view.settings.style as keyof typeof SKILL_TREE_STYLES];

    allNodeRadii = new Map(
        nodes.map(n => [n.id, nodeRadii[n.id] || nodeRadius])
    );

    RenderNodes(nodes)

    RenderEdgeLines()

    if (view.settings.mode == "edit") {
        RenderNodeHandles(nodes);
    }

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
    const from = edgeDragFrom  // import from click.ts
    const target = edgeDragTarget
    if (!from || !target) return

    const context = view.context
    if (!context) return

    context.save()
    // TODO: deal with these magic numbers
    context.setLineDash([4 / view.scale, 4 / view.scale])
    context.strokeStyle = '#2563eb'
    context.lineWidth = 2 / view.scale
    context.beginPath()
    context.moveTo(from.hx, from.hy)
    context.lineTo(target.x, target.y)
    context.stroke()
    context.restore()
}

function RenderEdgeLines() {
    const edgeLineWidth = 24 / Math.max(0.3, view.scale);

    const nodeMap = GetNodes()

    const context = view.context
    if (!context) {
        return;
    }

    for (const e of GetEdges()) {
        console.log(e)
        if (!e.from || !e.to) {
            continue;
        }

        const a = nodeMap.get(String(e.from)) || null;
        console.log(a)
        const b = nodeMap.get(e.to) || null;
        console.log(b)

        if (!a || !b) {
            console.log("no connections found | TODO clear to's and from's | ID mismatchs likely")
            continue;
        }

        console.log("found node from edge")

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

        // TODO: refactor and remove view non-sense
        // let edgeGlow = false;
        // const edgeStyle = styleDef?.edgeStyle || 'straight';

        // edgeGlow = false;

        // const isGamified = true //selectedStyle === 'gamified';

        // const showBezier = view.settings.showBezier;
        // const useBezier = isGamified || showBezier;

        // const nodeStateColorKeys = new Map<string | number, string>();

        // const aState = a.state || 'in-progress';
        // const bState = b.state || 'in-progress';

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

// TODO: check culling. Not a problem while debugging very small trees
function RenderNodes(nodes: SkillNode[]) {
    const context = view.context
    if (!context) return

    const visibleNodes = nodes.filter(n => {

        // TODO: Handle radius globally to align shape with text
        //
        const r = nodeRadii[n.id] || nodeRadius
        return !(n.x + r < leftWorld - cullMargin || n.x - r > rightWorld + cullMargin ||
            n.y + r < topWorld - cullMargin || n.y - r > bottomWorld + cullMargin)
    })


    const selectedStyle = view.settings.style || 'default'
    const styleDef = SKILL_TREE_STYLES[selectedStyle as keyof typeof SKILL_TREE_STYLES]


    for (const n of visibleNodes) {
        const r = allNodeRadii.get(n.id) as number;

        DrawNode(n, r);

        // TODO: fix this logic to determine if a file is ACTUALLY linked
        let isUnlinked: boolean = n.fileLink == '';
        const lines = SetupLabelLines(n, isUnlinked)
        RenderNodeLabel(n, lines, isUnlinked)
    }
}

function DrawNode(node: SkillNode, radius: number) {

    const context = view.context
    if (!context) return

    FillNodeState(node);
    context.beginPath();
    drawNodeShape(context, node.x, node.y, radius, node.shape);
    DrawSelectedNode(node)
    context.fill();
    context.stroke();
}

function DrawSelectedNode(node: SkillNode) {
    const context = view.context
    if (!context) return

    if (GetSelectedNodeId() === node.id) {
        // TODO: fill out with specific states | add settings so users can change
        switch (node.state) {
            case "complete":
            case "in-progress":
            case "on-hold":
            default:
                context.strokeStyle = 'rgba(255,165,0,0.95)';
                break;
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

function FillNodeState(n: SkillNode) {

    const context = view.context
    if (!context || !styleDef) return

    const nodeState = n.state
    // TODO: handle extra-type cases
    switch (nodeState) {
        case "complete":
            context.fillStyle = styleDef.nodeColors.complete.fill;
            context.strokeStyle = styleDef.nodeColors.complete.stroke;
            break;
        case "in-progress":
            context.fillStyle = styleDef.nodeColors.inProgress.fill;
            context.strokeStyle = styleDef.nodeColors.inProgress.stroke;
            break;
        case "on-hold":
            context.fillStyle = styleDef.nodeColors.onHold.fill;
            context.strokeStyle = styleDef.nodeColors.onHold.stroke;
            break;
        default:
            context.fillStyle = styleDef.nodeColors.unavailable.fill;
            context.strokeStyle = styleDef.nodeColors.unavailable.stroke;
            break;
    }

}

function SetupLabelLines(n: SkillNode, isUnlinked: boolean): string[] {
    const context = view.context
    if (!context) return []

    // TODO: test this when I can actuall add a link again
    let label = isUnlinked ? n.fileLink : n.fileLink || '' + ' [Unlinked]';



    let lines: string[] = [];
    const words = (label || '').split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
    }
    return lines
}

function RenderNodeLabel(n: SkillNode, lines: string[], isUnlinked: boolean) {
    const context = view.context
    if (!context) return


    const lineHeight = fontSize / view.scale;
    const totalLines = lines.length + (isUnlinked ? 1 : 0);

    // The lines starts drawing here
    let firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        const y = firstLineY + i * lineHeight;

        context.save();
        context.font = `${fontSize / view.scale}px sans-serif`;
        context.shadowColor = 'rgba(0, 0, 0, 0.6)';
        context.shadowBlur = 2 / view.scale;
        context.shadowOffsetX = 1 / view.scale;
        context.shadowOffsetY = 1 / view.scale;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        // context.fillText(text, n.x, n.y);
        // context.restore();


        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillText(text, n.x, y);
    }

    context.textAlign = 'center';
}


function RenderNodeHandles(nodes: SkillNode[]) {
    const context = view.context
    if (!context) return

    const handleRadius = view.settings.handleRadius / view.scale / dpr

    // TODO: allow the user to change the css of the handles
    for (let node of nodes) {
        context.strokeStyle = '#2563eb';
        context.lineWidth = 2.5 / view.scale;
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(node.x, node.y - nodeRadius, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x + nodeRadius, node.y, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x, node.y + nodeRadius, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x - nodeRadius, node.y, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
    }
}

export function CenterOnNode(node: SkillNode) {
    if (!view.canvas) return;
    const canvasWidth = view.canvas.width / dpr;
    const canvasHeight = view.canvas.height / dpr;

    // Calculate offset to center the node
    view.offset.x = canvasWidth / 2 - node.x * view.scale;
    view.offset.y = canvasHeight / 2 - node.y * view.scale;

    Render();
}

