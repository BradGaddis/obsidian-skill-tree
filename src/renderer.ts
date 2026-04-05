import { Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview";
import { modeToggleBtn, editModeOnlyButtons } from "./toolbar";
import { SKILLTREE_CANVAS_WRAP } from "./constants";
import { GetEdges, GetNodes, GetSelectedNodeId } from "./tree-manager";
import { SkillNode } from "./skill_nodes/skill_node";
import { SKILL_TREE_STYLES } from "./styles";
import { edgeDragFrom, edgeDragTarget, draggingEdgeEndpoint, edgeDragSourcePos } from "./ux/click_event_handler";
import { SaveNodes } from "./recorder";
import { DrawNodeShape, drawOrthogonalArrow, DrawSelectedNode, InitDrawing } from "./drawing";
import { Coordinate } from "./types";


let view: SkillTreeView
const dpr = window.devicePixelRatio || 1;

export let nodeRadius: number
export let nodeRadii: Record<string | number, number> = {}
let allNodeRadii: Map<string | number, number> = new Map()

export let leftWorld: number = 0
export let rightWorld: number = 0
export let topWorld: number = 0
export let bottomWorld: number = 0
export let canvasWidth: number = 0
export let canvasHeight: number = 0

// TODO: implement these?
let lastTimeStamp: number = 0
export let frameDelta: number = 1
// let deltaEpsilon: number = .001
// let nodeBoundingBox: Coordinate // TODO: use for zooming and panning limits

let styleDef: typeof SKILL_TREE_STYLES['gamified'] | undefined;

// TODO: Make it an adjustable setting
const fontSize = 16

export let rafId: number | null = null;

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
    InitDrawing(view)
}

export function DrawNode(node: SkillNode, radius: number) {
    const context = view.context
    if (!context) return

    FillNodeState(node);
    context.beginPath();
    DrawNodeShape(context, node.x, node.y, radius, node.shape);
    DrawSelectedNode(node)
    context.fill();
    context.stroke();
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


// TODO: move some amount with RAF for stylistic reasons
export function Recenter(delta: number = 1) {
    const nodes = Array.from(GetNodes().values());
    if (nodes.length === 0) return;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const offsetX = -centerX;
    const offsetY = -centerY;

    for (const node of nodes) {
        node.x += offsetX
        node.y += offsetY
    }
    canvasWidth = (view.canvas?.width || 0) / dpr;
    canvasHeight = (view.canvas?.height || 0) / dpr;
    view.offset = { x: canvasWidth / 2, y: canvasHeight / 2 };
    Render();
}


// DEPRECATED
// export function Recenter2() {
//     const nodes = Array.from(GetNodes().values());
//     canvasWidth = (view.canvas?.width || 0) / dpr
//     canvasHeight = (view.canvas?.height || 0) / dpr
//     if (nodes.length > 0) {
//         // Calculate center of all nodes
//         const xs = nodes.map(n => n.x);
//         const ys = nodes.map(n => n.y);
//         const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
//         const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
//         console.log(centerX, centerY)
//         // Offset to center (assuming canvas is ~800px wide)
//         view.offset = { x: canvasWidth / 2 - centerX, y: canvasHeight / 2 - centerY };
//     }
//     Render();
// }


function UpdateInRAFID() {

    frameDelta = Date.now() - lastTimeStamp


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

    nodeRadius = view.settings.nodeRadius

    const nodes = Array.from(GetNodes().values())


    styleDef = SKILL_TREE_STYLES[view.settings.style as keyof typeof SKILL_TREE_STYLES];

    allNodeRadii = new Map(
        nodes.map(n => [n.id, nodeRadii[n.id] || nodeRadius])
    );


    for (let node of nodes) {
        node.validate()
    }

    // TODO: interlock these so nodes from nodes draw over the line and to nodes draw behind before line 
    RenderNodes(nodes)
    RenderEdgeLines()
    RenderTemporaryEdgeLine()
    if (view.settings.mode == "edit") {
        RenderNodeHandles(nodes);
    }

    context.restore();

    SaveNodes()
    rafId = null
}


export function Render(): void {
    if (rafId) {
        return
    }
    rafId = requestAnimationFrame(
        UpdateInRAFID
    );
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
        // Determine sx1, sy1 (start position)
        let sx1: number, sy1: number;

        // Priority 1: Use coordinate overrides if present
        if (e.fromX !== undefined && e.fromY !== undefined) {
            sx1 = e.fromX;
            sy1 = e.fromY;
        }
        // Priority 2: Use from node
        else if (e.from) {
            const a = nodeMap.get(e.from as string | number);
            if (!a) continue;
            sx1 = a.x;
            sy1 = a.y;
            if (e.fromSide === 'top') sy1 -= nodeRadius;
            else if (e.fromSide === 'right') sx1 += nodeRadius;
            else if (e.fromSide === 'bottom') sy1 += nodeRadius;
            else if (e.fromSide === 'left') sx1 -= nodeRadius;
        }
        else {
            continue; // No start position available
        }

        // Determine sx2, sy2 (end position)
        let sx2: number, sy2: number;

        // Priority 1: Use coordinate overrides if present
        if (e.toX !== undefined && e.toY !== undefined) {
            sx2 = e.toX;
            sy2 = e.toY;
        }
        // Priority 2: Use to node
        else if (e.to) {
            const b = nodeMap.get(e.to as string | number);
            if (!b) continue;
            sx2 = b.x;
            sy2 = b.y;
            if (e.toSide === 'top') sy2 -= nodeRadius;
            else if (e.toSide === 'right') sx2 += nodeRadius;
            else if (e.toSide === 'bottom') sy2 += nodeRadius;
            else if (e.toSide === 'left') sx2 -= nodeRadius;
        }
        else {
            continue; // No end position available
        }

        // Override endpoint position if this edge is being dragged
        if (draggingEdgeEndpoint && draggingEdgeEndpoint.edgeId === e.id && edgeDragSourcePos) {
            if (draggingEdgeEndpoint.which === 'from') {
                sx1 = edgeDragSourcePos.x;
                sy1 = edgeDragSourcePos.y;
            } else {
                sx2 = edgeDragSourcePos.x;
                sy2 = edgeDragSourcePos.y;
            }
        }

        context.save();

        let edgeColor: string;


        if (styleDef && styleDef.edgeColor && styleDef.edgeColor !== 'auto') {
            edgeColor = styleDef.edgeColor;
        } else {
            edgeColor = '#666';
        }

        context.beginPath();
        context.strokeStyle = edgeColor;
        context.lineWidth = edgeLineWidth;

        // TODO: add settings so user can choose to draw straight or Orthogonal
        drawOrthogonalArrow(context, sx1, sy1, sx2, sy2, edgeLineWidth);

        // context.moveTo(sx1, sy1);
        // context.lineTo(sx2, sy2);
        context.stroke();

        // const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
        // const headLen = edgeLineWidth * 2;
        // context.beginPath();
        // context.moveTo(sx2, sy2);
        // context.lineTo(sx2 - headLen * Math.cos(angle - Math.PI / 6), sy2 - headLen * Math.sin(angle - Math.PI / 6));
        // context.lineTo(sx2 - headLen * Math.cos(angle + Math.PI / 6), sy2 - headLen * Math.sin(angle + Math.PI / 6));
        // context.closePath();
        // context.fillStyle = edgeColor;
        // context.fill();

        context.restore();
    }
    //
    // // Render floating edge (one end follows mouse)
    // if (floatingEdge && edgeDragSourcePos) {
    //     const nodes = GetNodes()
    //
    //     // Get the node that the edge is from (if it exists)
    //     let sx1 = edgeDragSourcePos.x
    //     let sy1 = edgeDragSourcePos.y
    //     let sx2 = edgeDragSourcePos.x
    //     let sy2 = edgeDragSourcePos.y
    //
    //     if (floatingEdge.from) {
    //         const fromNode = nodes.get(floatingEdge.from as string | number)
    //         if (fromNode) {
    //             const rFrom = nodeRadii[fromNode.id] || nodeRadius
    //             sx1 = fromNode.x
    //             sy1 = fromNode.y
    //             if (floatingEdge.fromSide === 'top') sy1 -= rFrom
    //             else if (floatingEdge.fromSide === 'right') sx1 += rFrom
    //             else if (floatingEdge.fromSide === 'bottom') sy1 += rFrom
    //             else if (floatingEdge.fromSide === 'left') sx1 -= rFrom
    //         }
    //     }
    //
    //     // The other end follows mouse
    //     sx2 = edgeDragSourcePos.x
    //     sy2 = edgeDragSourcePos.y
    //
    //     context.save()
    //     context.strokeStyle = '#2563eb'
    //     context.lineWidth = edgeLineWidth
    //     drawOrthogonalArrow(context, sx1, sy1, sx2, sy2, edgeLineWidth)
    //     context.restore()
    // }
}

// TODO: check culling. Not a problem while debugging very small trees
function RenderNodes(nodes: SkillNode[]) {
    const context = view.context
    if (!context) return

    const visibleNodes = nodes.filter(n => {

        // TODO: Handle radius globally to align shape with text
        const r = nodeRadii[n.id] || nodeRadius
        return !(n.x + r < leftWorld || n.x - r > rightWorld ||
            n.y + r < topWorld || n.y - r > bottomWorld)
    })


    const selectedStyle = view.settings.style || 'default'
    styleDef = SKILL_TREE_STYLES[selectedStyle as keyof typeof SKILL_TREE_STYLES]


    for (const n of visibleNodes) {
        // n.validate() // TODO: fix and implement
        const r = allNodeRadii.get(n.id) as number;

        DrawNode(n, r);

        // TODO: fix this logic to determine if a file is ACTUALLY linked
        let isUnlinked: boolean = n.fileLink == '';
        const lines = SetupLabelLines(n, isUnlinked)
        RenderNodeLabel(n, lines, isUnlinked)
    }
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


