import { SkillNode } from "../nodes/skill_node";
import { RepeatingNode } from "../nodes/repeating_node";
import {
    edgeDragFrom,
    edgeDragTarget,
    draggingEdgeEndpoint,
    edgeDragSourcePos
} from "../handlers/interactions";
import {
    GetEdges,
    GetNodeByID,
    GetNodes,
    ValidateTreeState,
    SwitchTree,
    GetTreesWithIncompleteLinks
} from "../data/tree_manager";
import {
    formatExpFraction,
    getExpDisplayData
} from "../data/level_handler";
import { ExpDisplayData } from "../types/interfaces";
import { Coordinate } from "../types/types";
import { HandleCollision } from "../utils/collision";
import { view } from "../utils/globals";
import { skillTreeEvents, EVENTS } from "../utils/events";
import { DrawNodeShape, DrawOrthogonalArrow, DrawSelectedNode, DrawCheckBox, DrawSubLabel, Blend, TIMER_LABEL_FONT_SCALE, TIMER_LABEL_RADIUS_SCALE, TIMER_LABEL_PADDING_PX, DrawRoundedRect } from "./drawing";
import { escapeHtml } from "../utils/html_escape";

const dpr = window.devicePixelRatio || 1;

export let nodeRadii: Record<string | number, number> = {};
export let handleRadius: number;
export let timerLabelBounds: Map<string, { x: number; y: number; width: number; height: number }> = new Map();
export let levelPaneElement: HTMLElement | null = null;

let leftWorld: number = 0;
let rightWorld: number = 0;
let topWorld: number = 0;
let bottomWorld: number = 0;
let canvasWidth: number = 0;
let canvasHeight: number = 0;
let lockedTreeBanner: HTMLElement | null = null;

let latestUpdate: FrameRequestCallback

/**
 * Initializes the renderer by setting up the canvas, resize observer, and level pane.
 * Sets up event listeners for repeating node timer ticks to update timer labels.
 * @returns A cleanup function that removes event listeners (call on plugin unload)
 */
export function InitRenderer(): { cleanup: () => void } {
    SetupCanvas();
    const canvas = view.canvas;
    if (!canvas) return { cleanup: () => { } };
    view.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvasWidth = width;
            canvasHeight = height;
        }
        Update(true);
    });
    view.resizeObserver.observe(canvas);

    CreateLevelPane();

    if (view.settings.showLevelPane !== false) {
        ToggleLevelPane(true);
    }

    const handler = () => { RenderTimerLabels(); };
    window.addEventListener('repeating-node-timer-tick', handler);
    return {
        cleanup: () => {
            window.removeEventListener('repeating-node-timer-tick', handler);
        }
    };
}

/**
 * Triggers a render update for the skill tree canvas.
 * Uses requestAnimationFrame to batch updates for performance.
 * @param force - If true, immediately renders in the current frame without batching
 */
export function Update(force: boolean = false): void {
    if (force) {
        latestUpdate = UpdateInRAFID
        rafId = requestAnimationFrame(latestUpdate);
        rafId = null;
        return
    }
    if ((!latestUpdate || rafId)) {
        latestUpdate = UpdateInRAFID
        rafId = null;
        return;
    }
    rafId = requestAnimationFrame(latestUpdate);
}

/**
 * Recenters the view so all nodes are centered in the canvas.
 * Calculates the bounding box of all nodes and shifts them so the center
 * of the node cluster aligns with the canvas center. Resets scale to 1.
 */
export function Recenter() {
    view.scale = 1;
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
        node.x += offsetX;
        node.y += offsetY;
    }
    canvasWidth = (view.canvas?.width || 0) / dpr;
    canvasHeight = (view.canvas?.height || 0) / dpr;
    view.offset = { x: canvasWidth / 2, y: canvasHeight / 2 };
    Update(true)
}

/**
 * Centers the view on a specific node, positioning it in the middle of the canvas.
 * Adjusts the view offset based on the node's position and current scale.
 * @param node - The node to center the view on
 */
export function CenterOnNode(node: SkillNode) {
    if (!view.canvas) return;
    const canvasWidth = view.canvas.width / dpr;
    const canvasHeight = view.canvas.height / dpr;

    view.offset.x = canvasWidth / 2 - node.x * view.scale;
    view.offset.y = canvasHeight / 2 - node.y * view.scale;

    Update();
}

/**
 * Converts screen coordinates to world coordinates based on current view offset and scale.
 * @param screenCoords - The coordinates in screen space (pixels)
 * @returns The corresponding coordinates in world space
 */
export function screenToWorld(screenCoords: Coordinate) {
    return { x: (screenCoords.x - view.offset.x) / view.scale, y: (screenCoords.y - view.offset.y) / view.scale };
}

/**
 * Updates the position of the level pane to the specified coordinates.
 * Clamps the position to ensure the pane stays within the viewport bounds.
 * Saves the new position to plugin settings.
 * @param x - The desired left position
 * @param y - The desired top position
 */
export async function UpdateLevelPanePosition(x: number, y: number): Promise<void> {
    if (!levelPaneElement) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const paneWidth = levelPaneElement.offsetWidth;
    const paneHeight = levelPaneElement.offsetHeight;

    const minX = 0;
    const minY = 0;
    const maxX = viewportWidth - paneWidth;
    const maxY = viewportHeight - paneHeight;

    const clampedX = Math.max(minX, Math.min(x, maxX));
    const clampedY = Math.max(minY, Math.min(y, maxY));

    levelPaneElement.style.left = `${clampedX}px`;
    levelPaneElement.style.top = `${clampedY}px`;
    view.plugin.settings.levelPanePosition = { left: clampedX, top: clampedY };
    await view.plugin.saveSettings();
}

/**
 * Gets the current drag state of the level pane (used for drag handling).
 * @returns The level pane drag state object with isDragging, startX, startY, initialLeft, initialTop
 */
export function GetLevelPaneDragState() {
    return levelPaneDragState;
}

/**
 * Updates the level pane UI with current experience data.
 * Gets the latest exp display data and rebuilds the HTML content.
 * Does nothing if the level pane element doesn't exist.
 */
export function UpdateLevelPane() {
    if (!levelPaneElement) return;

    const data = getExpDisplayData();
    if (!data) return;

    levelPaneElement.innerHTML = FormatLevelPaneHtml(data);
}

/**
 * Toggles the visibility of the level pane.
 * @param visible - true to show the pane, false to hide
 */
export function ToggleLevelPane(visible: boolean) {
    if (!levelPaneElement) return;

    levelPaneElement.style.display = visible ? '' : 'none';
    if (visible) {
        UpdateLevelPane();
        UpdateStatusBar();
    }
}

/**
 * Sets up the banner that displays when the current tree is locked due to incomplete
 * prerequisite links from other trees. Updates the banner when nodes change or trees switch.
 * Listens to EVENTS.NODES_CHANGED and EVENTS.TREE_SWITCHED to refresh the banner.
 */
export function SetupLockedTreeBanner() {
    updateLockedTreeBanner();
    UpdateLevelPaneOnEvent();
    skillTreeEvents.on(EVENTS.NODES_CHANGED, () => {
        updateLockedTreeBanner();
        UpdateLevelPaneOnEvent();
    });
    skillTreeEvents.on(EVENTS.TREE_SWITCHED, () => {
        updateLockedTreeBanner();
        UpdateLevelPaneOnEvent();
    });
}

export function updateLockedTreeBanner() {
    if (!view.canvasWrap) return;

    const linkingWithIncomplete = GetTreesWithIncompleteLinks();

    if (linkingWithIncomplete.length === 0) {
        if (lockedTreeBanner) {
            lockedTreeBanner.remove();
            lockedTreeBanner = null;
        }
        return;
    }

    if (!lockedTreeBanner) {
        lockedTreeBanner = view.canvasWrap.createEl('div');
        lockedTreeBanner.classList.add('skill-tree-locked-banner');
    }

    const treeNames = linkingWithIncomplete.map((t: { treeName: string; nodeCount: number }) => {
        const safeTreeName = escapeHtml(t.treeName);
        const linkText = t.nodeCount === 1 ? safeTreeName : `${safeTreeName} (${t.nodeCount})`;
        return `<a href="#" class="tree-link skill-tree-locked-banner-link" data-tree="${safeTreeName}">${linkText}</a>`;
    });

    lockedTreeBanner.innerHTML = `
        <span style="color: var(--text-muted, #888);">This tree is locked. Complete prerequisite skills in:</span>
        ${treeNames.join(', ')}
    `;

    lockedTreeBanner.querySelectorAll('.tree-link').forEach(link => {
        (link as HTMLElement).onclick = async (e) => {
            e.preventDefault();
            const treeName = (link as HTMLElement).dataset.tree;
            if (treeName) {
                await SwitchTree(treeName);
                updateLockedTreeBanner();
                Update();
            }
        };
    });
}

let rafId: number | null = null;
let levelPaneDragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

/**
 * Calculates the display radius of a node based on its label text.
 * Measures the width of each line in the node's display label and computes
 * a radius large enough to contain the text with padding.
 * @param node - The node to calculate radius for
 * @param context - The canvas 2D rendering context (for text measuring)
 * @returns The calculated radius in world units
 */
function CalculateNodeRadius(node: SkillNode, context: CanvasRenderingContext2D): number {
    const { lines } = node.getDisplayLabel();

    context.font = `${view.settings.fontSize / view.scale}px sans-serif`;

    let maxWidth = 0;

    for (const line of lines) {
        const width = context.measureText(line).width;
        maxWidth = Math.max(width, maxWidth);
    }
    const padding = 36 / view.scale;
    const textBasedRadius = maxWidth / 2;

    return Math.min(
        Math.max(view.settings.minNodeRadius, textBasedRadius),
        view.settings.maxNodeRadius) + padding;
}

function CreateLevelPane() {
    if (!view?.canvasWrap || !view?.settings) return;

    levelPaneElement = view.canvasWrap.createEl('div');
    levelPaneElement.classList.add('skill-tree-level-pane');
    levelPaneElement.style.display = 'none';

    const savedPos = view.plugin.settings.levelPanePosition;
    if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
        levelPaneElement.style.left = `${savedPos.left}px`;
        levelPaneElement.style.top = `${savedPos.top}px`;
    }

    UpdateLevelPane();
}

function RenderTimerLabels(): void {
    if (!view.context) return;
    const context = view.context;

    for (const [nodeId] of timerLabelBounds) {
        const node = GetNodes().get(nodeId);
        if (!node || node.nodeTypeName !== 'RepeatingNode') continue;

        const repeatingNode = node as RepeatingNode;
        const text = repeatingNode.getResetDisplayText?.() || '';
        if (!text) continue;

        const radius = nodeRadii[node.id];
        if (radius === undefined) {
            console.error(`nodeRadii missing for node ${node.id}`);
            continue;
        }
        const labelWidth = radius * 2;
        const labelHeight = radius * 0.5;
        const padding = TIMER_LABEL_PADDING_PX / view.scale;

        const x = node.x;
        const y = node.y + radius + labelHeight / 2 + padding;

        context.save();
        context.font = `${labelHeight * TIMER_LABEL_FONT_SCALE}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const bgX = x - labelWidth / 2;
        const bgY = y - labelHeight / 2;

        context.fillStyle = node.colorOverride[node.state].fill;
        DrawRoundedRect(context, bgX, bgY, labelWidth, labelHeight, labelHeight * TIMER_LABEL_RADIUS_SCALE);
        context.fill();

        context.fillStyle = 'black';
        context.fillText(text, x, y);
        context.restore();
    }
}

function FillNodeState(n: SkillNode) {
    const context = view.context;
    if (!context) return;
    const style = n.colorOverride;

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
            break;
        default:
            context.fillStyle = style.unavailable.fill;
            context.strokeStyle = style.unavailable.stroke;
            break;
    }
}

function FormatLevelPaneHtml(data: ExpDisplayData): string {
    const barProgress = data.levelMode === 'aggregate' ? data.aggregateProgress : data.currentProgress;
    const barPercent = (barProgress.expInLevel / barProgress.expForNextLevel) * 100;

    const expProgress = data.currentLevel === 0 && data.currentExp === 0
        ? 'Start earning XP!'
        : `${data.currentProgress.expInLevel} / ${data.currentProgress.expForNextLevel} XP`;

    const totalXpLabel = data.expMode === 'both'
        ? `Current: ${formatExpFraction(data.currentExp, data.totalExp)} | All: ${formatExpFraction(data.aggregateExp, data.aggregateTotalExp)}`
        : data.expMode === 'aggregate'
            ? formatExpFraction(data.aggregateExp, data.aggregateTotalExp)
            : formatExpFraction(data.currentExp, data.totalExp);

    const levelHeader = data.levelMode === 'both'
        ? `Current ${data.currentLevel + 1} | All ${data.aggregateLevel + 1}`
        : data.levelMode === 'aggregate'
            ? `All ${data.aggregateLevel + 1}`
            : `Current ${data.currentLevel + 1}`;

    // Escape user-controlled tree name to prevent XSS
    const safeTreeName = escapeHtml(view.settings.currentTreeName);

    return `
        <div>
            <div class="skill-tree-level-pane-title">Current Tree: ${safeTreeName}</div>
            <div class="skill-tree-level-pane-level">${levelHeader}</div>
            <div class="skill-tree-level-pane-progress">
                <div class="skill-tree-level-pane-progress-fill" style="width: ${barPercent}%"></div>
            </div>
            <div class="skill-tree-level-pane-exp">${expProgress}</div>
            <div class="skill-tree-level-pane-exp">Total XP Available: ${totalXpLabel}</div>
        </div>
    `;
}

function FormatStatusBarText(data: ExpDisplayData): string {
    if (data.expMode === 'both') {
        return `Current: Lv ${data.currentLevel + 1} (${data.currentExp} XP) | Available: (${data.currentExp}/${data.totalExp} XP, ${data.aggregateExp}/${data.aggregateTotalExp} XP)`;
    } else if (data.expMode === 'aggregate') {
        return `Available: (${data.aggregateExp}/${data.aggregateTotalExp} XP)`;
    } else {
        return `Current: Lv ${data.currentLevel + 1} (${data.currentExp} XP) | Available: (${data.currentExp}/${data.totalExp} XP)`;
    }
}

function RenderEdgeLines() {
    const edgeLineWidth = 24 / Math.max(0.3, view.scale);
    const nodeMap = GetNodes();
    const context = view.context;

    if (!context) {
        return;
    }

    for (const e of GetEdges()) {
        let sx1: number, sy1: number;

        if (e.fromX !== undefined && e.fromY !== undefined) {
            sx1 = e.fromX;
            sy1 = e.fromY;
        } else if (e.from) {
            const a = nodeMap.get(e.from as string | number);
            if (!a) continue;
            sx1 = a.x;
            sy1 = a.y;
            const rFrom = nodeRadii[a.id];
            if (rFrom === undefined) {
                console.error(`nodeRadii missing for node ${a.id}`);
                continue;
            }
            if (e.fromSide === 'top') sy1 -= rFrom;
            else if (e.fromSide === 'right') sx1 += rFrom;
            else if (e.fromSide === 'bottom') sy1 += rFrom;
            else if (e.fromSide === 'left') sx1 -= rFrom;
        } else {
            continue;
        }

        let sx2: number, sy2: number;
        let toCenterX: number | undefined, toCenterY: number | undefined;
        if (e.toX !== undefined && e.toY !== undefined) {
            sx2 = e.toX;
            sy2 = e.toY;
        } else if (e.to) {
            const b = nodeMap.get(e.to as string | number);
            if (!b) continue;
            toCenterX = b.x;
            toCenterY = b.y;
            sx2 = b.x;
            sy2 = b.y;
            const rTo = nodeRadii[b.id];
            if (rTo === undefined) {
                console.error(`nodeRadii missing for node ${b.id}`);
                continue;
            }
            if (e.toSide === 'top') sy2 -= rTo;
            else if (e.toSide === 'right') sx2 += rTo;
            else if (e.toSide === 'bottom') sy2 += rTo;
            else if (e.toSide === 'left') sx2 -= rTo;
        } else {
            continue;
        }

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

        const edgeColor = '#ffd700';

        if (!Number.isFinite(sx1) || !Number.isFinite(sy1) || !Number.isFinite(sx2) || !Number.isFinite(sy2)) {
            continue;
        }

        const gradient = context.createLinearGradient(sx1, sy1, sx2, sy2);

        const fromNode = GetNodeByID(e.from);
        const fromState = fromNode?.state;

        const toNode = GetNodeByID(e.to);
        const toState = toNode?.state;

        const fromNodeColor = fromState ? fromNode?.colorOverride[fromState].fill : undefined;
        const toNodeColor = toState ? toNode?.colorOverride[toState].fill : undefined;

        if (fromNodeColor && toNodeColor) {
            gradient.addColorStop(0, fromNodeColor);
            if (fromNodeColor !== toNodeColor) {
                gradient.addColorStop(0.5, Blend(fromNodeColor, toNodeColor, 0.75, 1));
            }
            gradient.addColorStop(1, toNodeColor);
        }

        context.lineWidth = edgeLineWidth;
        context.strokeStyle = fromNodeColor && toNodeColor ? gradient : edgeColor;

        context.beginPath();

        DrawOrthogonalArrow(context, sx1, sy1, sx2, sy2, edgeLineWidth, toNodeColor || fromNodeColor || edgeColor, toCenterX, toCenterY);

        context.restore();
    }
}

function RenderNode(node: SkillNode, radius: number) {
    const context = view.context;
    if (!context) return;

    FillNodeState(node);

    context.beginPath();

    DrawNodeShape(context, node.x, node.y, radius, node.shape);
    DrawSelectedNode(node);

    context.fill();
    context.stroke();

    if (node.nodeTypeName === "RepeatingNode") {
        const fromState = node.state;
        const fromNodeColor = node.colorOverride[fromState].fill;
        DrawSubLabel(node, fromNodeColor);
    }
}

function RenderNodeHandles(nodes: SkillNode[]) {
    const context = view.context;
    if (!context) return;

    handleRadius = view.settings.handleRadius / view.scale * dpr;

    for (const node of nodes) {
        if (node.nodeTypeName === 'TerminalNode') continue;
        context.lineWidth = 2.5 / view.scale;
        const nodeRadius = nodeRadii[node.id];
        if (nodeRadius === undefined) {
            console.error(`nodeRadii missing for node ${node.id}`);
            continue;
        }
        const r = nodeRadius + context.lineWidth * 2;
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

function RenderNodeLabel(n: SkillNode, lines: string[]) {
    const context = view.context;
    if (!context) return;

    const lineHeight = view.settings.fontSize / view.scale;
    const totalLines = lines.length;

    let firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        if (text === undefined) {
            console.error(`Line ${i} is undefined in RenderNodeLabel`);
            continue;
        }
        const y = firstLineY + i * lineHeight;

        context.save();
        context.font = `${view.settings.fontSize / view.scale}px sans-serif`;
        context.shadowColor = 'rgba(0, 0, 0, 0.6)';
        context.shadowBlur = 2 / view.scale;
        context.shadowOffsetX = 1 / view.scale;
        context.shadowOffsetY = 1 / view.scale;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillText(text, n.x, y);
    }

    context.textAlign = 'center';
}

function RenderNodes(nodes: SkillNode[]) {
    const context = view.context;
    if (!context) return;

    for (const n of nodes) {
        const r = nodeRadii[n.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${n.id}`);
            continue;
        }
        RenderNode(n, r);

        DrawCheckBox(n);

        const { lines } = n.getDisplayLabel();

        RenderNodeLabel(n, lines);
    }
}

function RenderTemporaryEdgeLine() {
    const from = edgeDragFrom;
    const target = edgeDragTarget;
    if (!from || !target) return;
    const context = view.context;
    if (!context) return;
    context.save();

    context.setLineDash([4 / view.scale, 4 / view.scale]);
    context.strokeStyle = '#2563eb';
    context.lineWidth = 2 / view.scale;
    context.beginPath();
    context.moveTo(from.hx, from.hy);
    context.lineTo(target.x, target.y);
    context.stroke();
    context.restore();
}

function SetupCanvas() {
    view.containerEl.style.display = 'flex';
    view.containerEl.style.flexDirection = 'column';
    view.containerEl.style.height = '100%';
    view.canvasWrap = view.containerEl.createEl('div');
    view.canvasWrap.addClass('skill-tree-canvas-wrap');
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

/**
 * The main render function executed via requestAnimationFrame.
 * Performs a complete frame render including:
 * 1. Clear canvas and set up transform based on pan/zoom
 * 2. Update node radii for all nodes
 * 3. Validate tree state (edge connections, collision detection)
 * 4. Calculate visible nodes (culling nodes outside viewport)
 * 5. Render edges, nodes, and temporary edge if dragging
 * 6. Render handles if in edit mode
 */
function UpdateInRAFID() {
    if (!view.context || !view.canvas) {
        return;
    }

    const context = view.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, view.canvas.width, view.canvas.height);

    context.save();

    try {
        context.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, view.offset.x * dpr, view.offset.y * dpr);
    } catch (e) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.translate(view.offset.x, view.offset.y);
        context.scale(view.scale, view.scale);
    }

    canvasWidth = (view.canvas?.width || 0) / dpr;
    canvasHeight = (view.canvas?.height || 0) / dpr;

    leftWorld = (-view.offset.x) / view.scale;
    rightWorld = (canvasWidth - view.offset.x) / view.scale;
    topWorld = (-view.offset.y) / view.scale;
    bottomWorld = (canvasHeight - view.offset.y) / view.scale;

    handleRadius = view.settings.handleRadius / view.scale;

    const nodes = Array.from(GetNodes().values());

    UpdateNodeRadii(nodes);
    ValidateTreeState(nodes);
    HandleCollision();

    const visibleNodes = nodes.filter(n => {
        const r = nodeRadii[n.id];
        if (r === undefined) {
            return false;
        }
        return !(n.x + r < leftWorld || n.x - r > rightWorld || n.y + r < topWorld || n.y - r > bottomWorld);
    });
    RenderEdgeLines();
    RenderNodes(visibleNodes);
    RenderTemporaryEdgeLine();

    if (view.settings.mode === "edit") {
        RenderNodeHandles(visibleNodes);
    }

    context.restore();
}

function UpdateNodeRadii(nodes: SkillNode[]) {
    const context = view.context;
    if (!context) return;
    nodeRadii = {};
    for (const node of nodes) {
        nodeRadii[node.id] = CalculateNodeRadius(node, context);
    }
}

function UpdateStatusBar(): void {
    const data = getExpDisplayData();
    if (!data) return;

    const statusBarText = FormatStatusBarText(data);

    if (view.plugin) {
        view.plugin.updateStatusBar(statusBarText);
    }
}

async function UpdateLevelPaneOnEvent() {
    if (!view?.settings) return;
    UpdateLevelPane();
    UpdateStatusBar();
}
