import { Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview";
import { modeToggleBtn, editModeOnlyButtons } from "./toolbar";
import { SKILLTREE_CANVAS_WRAP } from "./constants";
import { GetEdges, GetNodeByID, GetNodes, GetTotalExp, CalculateLevel, ValidateTreeState } from "./tree_manager";
import { SkillNode } from "./skill_nodes/skill_node";
import { SKILL_TREE_STYLES, LEVEL_PANE_CONTAINER, LEVEL_PANE_TITLE, LEVEL_PANE_LEVEL, LEVEL_PANE_PROGRESS_BG, LEVEL_PANE_PROGRESS_FILL, LEVEL_PANE_EXP } from "./styles";
import { edgeDragFrom, edgeDragTarget, draggingEdgeEndpoint, edgeDragSourcePos, getIsDraggingEdge, getFloatingEdge, hitNode, isDragging } from "./ux/event_utils";
import { DrawNodeShape, drawOrthogonalArrow, DrawSelectedNode, InitDrawing, DrawCheckBox, parseCSSColor as parseColor, DrawSubLabel } from "./drawing";
import { Coordinate } from "./types";
import { GetNodeLabelInfo } from "./utils/node_label";
import { HandleCollision } from "./utils/collision";


let view: SkillTreeView
export { view }
const dpr = window.devicePixelRatio || 1;

export let nodeRadius: number
export let nodeRadii: Record<string | number, number> = {}
export let handleRadius: number
let allNodeRadii: Map<string | number, number> = new Map()
export let timerLabelBounds: Map<string, { x: number, y: number, width: number, height: number }> = new Map()

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
export const fontSize = 16

function updateTimerLabel() {
    if (!view.context) return;
    const context = view.context;

    for (const [nodeId] of timerLabelBounds) {
        const nodes = GetNodes();
        const node = nodes.get(nodeId);

        if (!node || node.nodeTypeName !== 'RepeatingNode') continue;

        const repeatingNode = node as import('./skill_nodes/repeating_node').RepeatingNode;
        const text = repeatingNode.getResetDisplayText?.() || '';
        if (!text) continue;

        const radius = nodeRadii[node.id] || nodeRadius;
        const labelWidth = radius * 2;
        const labelHeight = radius * 0.5;
        const padding = 4 / view.scale;

        const x = node.x;
        const y = node.y + radius + labelHeight / 2 + padding;

        context.save();
        context.font = `${(labelHeight * 0.35)}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const bgX = x - labelWidth / 2;
        const bgY = y - labelHeight / 2;

        const fillColor = node.colorOverride[node.state].fill;
        context.fillStyle = fillColor;
        const radiusPx = labelHeight * 0.2;
        context.beginPath();
        context.moveTo(bgX + radiusPx, bgY);
        context.lineTo(bgX + labelWidth - radiusPx, bgY);
        context.quadraticCurveTo(bgX + labelWidth, bgY, bgX + labelWidth, bgY + radiusPx);
        context.lineTo(bgX + labelWidth, bgY + labelHeight - radiusPx);
        context.quadraticCurveTo(bgX + labelWidth, bgY + labelHeight, bgX + labelWidth - radiusPx, bgY + labelHeight);
        context.lineTo(bgX + radiusPx, bgY + labelHeight);
        context.quadraticCurveTo(bgX, bgY + labelHeight, bgX, bgY + labelHeight - radiusPx);
        context.lineTo(bgX, bgY + radiusPx);
        context.quadraticCurveTo(bgX, bgY, bgX + radiusPx, bgY);
        context.closePath();
        context.fill();

        context.fillStyle = 'black';
        context.fillText(text, x, y);
        context.restore();
    }
}

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

    CreateLevelPane();
    if (view.settings.showLevelPane !== false) {
        ToggleLevelPane(true);
    }

    window.addEventListener('repeating-node-timer-tick', () => {
        updateTimerLabel();
    });
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

    if (node.nodeTypeName == "RepeatingNode") {

        const fromState = node.state
        const fromNodeColor = node.colorOverride[fromState].fill
        DrawSubLabel(node, fromNodeColor)
    }
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


function calculateNodeRadius(node: SkillNode, context: CanvasRenderingContext2D): number {
    const label = node.fileLink?.replace(/\.md$/, '') || '[Unlinked]';
    const words = label.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
    }

    context.font = `${fontSize / view.scale}px sans-serif`;
    let maxWidth = 0;
    for (const line of lines) {
        const width = context.measureText(line).width;
        if (width > maxWidth) maxWidth = width;
    }

    const padding = 16 / view.scale;
    const textBasedRadius = (maxWidth / 2) + padding;

    return Math.max(nodeRadius, textBasedRadius);
}


function UpdateInRAFID() {

    frameDelta = Date.now() - lastTimeStamp

    timerLabelBounds.clear();

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
    handleRadius = view.settings.handleRadius / view.scale / dpr

    const nodes = Array.from(GetNodes().values())

    // Clear and recalculate radii for all nodes based on text width
    nodeRadii = {};
    for (const node of nodes) {
        nodeRadii[node.id] = calculateNodeRadius(node, context);
    }

    styleDef = SKILL_TREE_STYLES[view.settings.style as keyof typeof SKILL_TREE_STYLES];

    allNodeRadii = new Map(
        nodes.map(n => [n.id, nodeRadii[n.id] || nodeRadius])
    );


    ValidateTreeState(nodes);

    HandleCollision()
    RenderEdgeLines()
    RenderNodes(nodes)
    RenderTemporaryEdgeLine()
    if (view.settings.mode == "edit") {
        RenderNodeHandles(nodes);
    }

    context.restore();
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
            const rFrom = nodeRadii[a.id] || nodeRadius;
            if (e.fromSide === 'top') sy1 -= rFrom;
            else if (e.fromSide === 'right') sx1 += rFrom;
            else if (e.fromSide === 'bottom') sy1 += rFrom;
            else if (e.fromSide === 'left') sx1 -= rFrom;
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
            const rTo = nodeRadii[b.id] || nodeRadius;
            if (e.toSide === 'top') sy2 -= rTo;
            else if (e.toSide === 'right') sx2 += rTo;
            else if (e.toSide === 'bottom') sy2 += rTo;
            else if (e.toSide === 'left') sx2 -= rTo;
        }
        else {
            continue; // No end position available
        }

        // Override endpoint position if view edge is being dragged
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
            // edgeColor = '#666';
            edgeColor = '#ffd700';
        }


        // TODO: implement against nodes
        const gradient = context.createLinearGradient(sx1, sy1, sx2, sy2);

        const fromNode = GetNodeByID(e.from)
        const fromState = fromNode?.state

        const toNode = GetNodeByID(e.to)
        const toState = toNode?.state


        const fromNodeColor = fromState ? fromNode?.colorOverride[fromState].fill : undefined
        const toNodeColor = toState ? toNode?.colorOverride[toState].fill : undefined

        const blend = (cA: string, cB: string, t: number, a = 1) => {
            try {
                const pa = parseColor(cA) || { r: 255, g: 255, b: 255 };
                const pb = parseColor(cB) || { r: 255, g: 255, b: 255 };
                const r = Math.round(pa.r * (1 - t) + pb.r * t);
                const g = Math.round(pa.g * (1 - t) + pb.g * t);
                const b = Math.round(pa.b * (1 - t) + pb.b * t);
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            } catch (ex) {
                return cA;
            }
        };


        if (fromNodeColor && toNodeColor) {

            gradient.addColorStop(0, fromNodeColor);
            // gradient.addColorStop(0.25, blend(fromNodeColor, toNodeColor, 0.25, 0.95));
            // gradient.addColorStop(0.5, blend(fromNodeColor, toNodeColor, 0.5, 0.5));
            // gradient.addColorStop(0.5, blend(fromNodeColor, toNodeColor, 0.5, 0.5));
            // gradient.addColorStop(0.75, blend(fromNodeColor, toNodeColor, 0.75, 0.95));
            // gradient.addColorStop(0.75, blend(fromNodeColor, toNodeColor, 0.75, 0.95));
            gradient.addColorStop(1, toNodeColor);
        }


        context.lineWidth = edgeLineWidth;
        context.strokeStyle = fromNodeColor && toNodeColor ? gradient : edgeColor;

        context.beginPath();

        // TODO: add settings so user can choose to draw straight or Orthogonal
        drawOrthogonalArrow(context, sx1, sy1, sx2, sy2, edgeLineWidth, toNodeColor || fromNodeColor);

        context.restore();
    }

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
        DrawCheckBox(n);

        // TODO: fix view logic to determine if a file is ACTUALLY linked
        const lines = SetupLabelLines(n)

        RenderNodeLabel(n, lines)
    }
}

function FillNodeState(n: SkillNode) {

    const context = view.context
    if (!context || !styleDef) return

    const style = n.colorOverride

    // TODO: handle extra-type cases
    switch (n.state) {
        case "complete":
            context.fillStyle = style.complete.fill;
            context.strokeStyle = style.complete.stroke;
            break;
        case "inProgress":
            context.fillStyle = style.inProgress.fill;
            context.strokeStyle = style.inProgress.stroke;
            break;
        case "onHold":
            context.fillStyle = style.onHold.fill;
            context.strokeStyle = style.onHold.stroke;
            break;
        case "error":
            context.fillStyle = style.error.fill;
            context.strokeStyle = style.error.stroke;
        default:
            context.fillStyle = style.unavailable.fill;
            context.strokeStyle = style.unavailable.stroke;
            break;
    }

}

function SetupLabelLines(n: SkillNode): string[] {
    const context = view.context
    if (!context) return []

    const labelInfo = GetNodeLabelInfo(n);
    return labelInfo.lines;
}

function RenderNodeLabel(n: SkillNode, lines: string[]) {
    const context = view.context
    if (!context) return


    const lineHeight = fontSize / view.scale;
    const totalLines = lines.length;

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

    handleRadius = view.settings.handleRadius / view.scale / dpr

    // TODO: allow the user to change the css of the handles
    for (let node of nodes) {
        if (node.nodeTypeName === 'TerminalNode') continue;
        context.lineWidth = 2.5 / view.scale;
        const r = (nodeRadii[node.id] || nodeRadius) + context.lineWidth * 2;
        context.strokeStyle = '#2563eb';
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(node.x, node.y - r, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x + r, node.y, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x, node.y + r, handleRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(node.x - r, node.y, handleRadius, 0, Math.PI * 2);
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

// TODO: maybe move into render module
export function worldToScreen(worldCoords: Coordinate) {
    return { x: worldCoords.x * view.scale + view.offset.x, y: worldCoords.y * view.scale + view.offset.y };
}

// TODO: maybe move into render module
export function screenToWorld(screenCoords: Coordinate) {
    return { x: (screenCoords.x - view.offset.x) / view.scale, y: (screenCoords.y - view.offset.y) / view.scale };
}

// ============================================================================
// Level Pane
// ============================================================================

let levelPaneElement: HTMLElement | null = null;
let levelPaneDragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

export function CreateLevelPane() {
    if (!view.canvasWrap) return;

    levelPaneElement = view.canvasWrap.createEl('div');
    levelPaneElement.style.cssText = LEVEL_PANE_CONTAINER;
    levelPaneElement.style.display = 'none';

    const savedPos = (view.plugin.settings as any).levelPanePosition;
    if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
        levelPaneElement.style.left = `${savedPos.left}px`;
        levelPaneElement.style.top = `${savedPos.top}px`;
    }

    levelPaneElement.addEventListener('mousedown', (e) => {
        if (!levelPaneElement) return;
        levelPaneDragState.isDragging = true;
        levelPaneDragState.startX = e.clientX;
        levelPaneDragState.startY = e.clientY;
        levelPaneDragState.initialLeft = levelPaneElement.offsetLeft;
        levelPaneDragState.initialTop = levelPaneElement.offsetTop;
        levelPaneElement.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!levelPaneDragState.isDragging || !levelPaneElement) return;
        const dx = e.clientX - levelPaneDragState.startX;
        const dy = e.clientY - levelPaneDragState.startY;
        levelPaneElement.style.left = `${levelPaneDragState.initialLeft + dx}px`;
        levelPaneElement.style.top = `${levelPaneDragState.initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        if (!levelPaneDragState.isDragging || !levelPaneElement) return;
        levelPaneDragState.isDragging = false;
        if (levelPaneElement) {
            levelPaneElement.style.cursor = 'move';
            (view.plugin.settings as any).levelPanePosition = {
                left: levelPaneElement.offsetLeft,
                top: levelPaneElement.offsetTop
            };
            view.plugin.saveSettings();
        }
    });

    UpdateLevelPane();
}

export function UpdateLevelPane() {
    if (!levelPaneElement) return;

    const mode = view.settings.levelDisplayMode || 'current';
    const expData = GetTotalExp(mode);

    const currentExp = expData.current;
    const aggregateExp = expData.aggregate;
    const currentLevel = CalculateLevel(currentExp);
    const aggregateLevel = CalculateLevel(aggregateExp);

    const expForCurrentLevel = currentLevel * currentLevel;
    const expForNextLevel = (currentLevel + 1) * (currentLevel + 1);
    const expInCurrentLevel = currentExp - expForCurrentLevel;
    const expNeededForNext = expForNextLevel - expForCurrentLevel;

    const progressPercent = expNeededForNext > 0 ? (expInCurrentLevel / expNeededForNext) * 100 : 100;

    let html = '';

    if (mode === 'both') {
        html = `
            <div style="${LEVEL_PANE_TITLE}">Level (Current Tree)</div>
            <div style="${LEVEL_PANE_LEVEL}">Lv ${currentLevel}</div>
            <div style="${LEVEL_PANE_PROGRESS_BG}">
                <div style="${LEVEL_PANE_PROGRESS_FILL}; width: ${Math.min(100, progressPercent)}%"></div>
            </div>
            <div style="${LEVEL_PANE_EXP}">${currentExp} / ${expForNextLevel} XP</div>
            <div style="margin-top: 12px; ${LEVEL_PANE_TITLE}">Level (All Trees)</div>
            <div style="${LEVEL_PANE_LEVEL}">Lv ${aggregateLevel}</div>
            <div style="${LEVEL_PANE_PROGRESS_BG}">
                <div style="${LEVEL_PANE_PROGRESS_FILL}; width: 100%"></div>
            </div>
            <div style="${LEVEL_PANE_EXP}">${aggregateExp} XP Total</div>
        `;
    } else {
        const displayExp = mode === 'aggregate' ? aggregateExp : currentExp;
        const displayLevel = mode === 'aggregate' ? aggregateLevel : currentLevel;

        html = `
            <div style="${LEVEL_PANE_TITLE}">Level</div>
            <div style="${LEVEL_PANE_LEVEL}">Lv ${displayLevel}</div>
            <div style="${LEVEL_PANE_PROGRESS_BG}">
                <div style="${LEVEL_PANE_PROGRESS_FILL}; width: ${Math.min(100, progressPercent)}%"></div>
            </div>
            <div style="${LEVEL_PANE_EXP}">${displayExp} XP</div>
        `;
    }

    levelPaneElement.innerHTML = html;

    // Update status bar
    const expMode = view.settings.expDisplayMode || 'current';
    const expModeData = GetTotalExp(expMode);
    const displayExpCurrent = expModeData.current;
    const displayExpAggregate = expModeData.aggregate;
    const displayLevelCurrent = CalculateLevel(displayExpCurrent);
    const displayLevelAggregate = CalculateLevel(displayExpAggregate);

    let statusBarText = '';
    if (expMode === 'both') {
        statusBarText = `Lv ${currentLevel} | ${currentExp} XP (All: ${aggregateExp})`;
    } else if (expMode === 'aggregate') {
        statusBarText = `Lv ${displayLevelAggregate} | ${displayExpAggregate} XP`;
    } else {
        statusBarText = `Lv ${displayLevelCurrent} | ${displayExpCurrent} XP`;
    }

    if (view.plugin && (view.plugin as any).updateStatusBar) {
        (view.plugin as any).updateStatusBar(statusBarText);
    }
}

export function ToggleLevelPane(visible: boolean) {
    if (!levelPaneElement) return;
    levelPaneElement.style.display = visible ? '' : 'none';
    if (visible) {
        UpdateLevelPane();
    }
}


