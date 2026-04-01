import { Notice } from "obsidian";
import { SkillTreeView } from "./skilltreeview";
import { modeToggleBtn, editModeOnlyButtons } from "./toolbar";
import { SKILLTREE_CANVAS_WRAP } from "./constants";
// import { Coordinate } from "./types";
import { GetEdges, GetNodes } from "./tree-manager";
import { SkillNode } from "./skill_nodes/skill_node";
import { SKILL_TREE_STYLES } from "./styles";


let view: SkillTreeView
const dpr = window.devicePixelRatio || 1;

// TODO do I really need these now as written?
let nodeRadius
let nodeRadii: Record<string | number, number> = {}
let allNodeRadii



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

// Function to update toolbar button visibility/states based on edit mode
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

// TODO refactor
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

    // TODO do I need this?

    // const clientW = view.canvas.width / dpr;
    // const clientH = view.canvas.height / dpr;
    // const leftWorld = (-view.offset.x) / view.scale;
    // const rightWorld = (clientW - view.offset.x) / view.scale;
    // const topWorld = (-view.offset.y) / view.scale;
    // const bottomWorld = (clientH - view.offset.y) / view.scale;
    // const cullMargin = 120 / view.scale;
    // const fastMode = (view.scale < 0.8) || (view.nodes.length > 200);


    const nodeMap = GetNodes()
    RenderEdgeLines(nodeMap)
    // const nodeRadius = view.settings.nodeRadius || 36;


    // const allNodeRadii = new Map(view.nodes.map(n => [n.id, view.nodeRadii[n.id] || nodeRadius]));
    //
    // const selectedStyle = view.settings.style || 'gamified';
    // const styleDef = SKILL_TREE_STYLES[selectedStyle];
    // const defaultShape = styleDef?.nodeShape || 'circle';

    // const edgeLineWidth = 24 / Math.max(0.3, view.scale);


    // const nodesWithTasks = new Set(view._tasksCache.keys());
    //
    // const showExpAsFraction = view.settings.showExpAsFraction;
    //
    // const editMode = view.settings.mode == "edit";
    //
    // //TODO implement somewhere
    // // const selectedNodeId = view.selectedNodeId;
    //
    // // const offsetX = view.offset.x;
    // // const offsetY = view.offset.y;
    //
    //
    // const nodeStateColorKeys = new Map<string | number, string>();
    // for (const n of view.nodes) {
    //     const state = n.state || 'in-progress';
    //     nodeStateColorKeys.set(n.id, state === 'complete' ? 'complete' : (state === 'unavailable' ? 'unavailable' : (state === 'on-hold' ? 'onHold' : 'inProgress')));
    // }
    //
    // // for (const e of view.edges) {
    // //     const a = nodeMap.get(e.from) || null;
    // //     const b = nodeMap.get(e.to) || null;
    // //     if (!a || !b) continue;
    // //
    // //     const rFrom = allNodeRadii.get(a.id) as number;
    // //     const rTo = allNodeRadii.get(b.id) as number;
    // //     let sx1 = a.x;
    // //     let sy1 = a.y;
    // //     if (e.fromSide) {
    // //         if (e.fromSide === 'top') { sx1 = a.x; sy1 = a.y - rFrom; }
    // //         if (e.fromSide === 'right') { sx1 = a.x + rFrom; sy1 = a.y; }
    // //         if (e.fromSide === 'bottom') { sx1 = a.x; sy1 = a.y + rFrom; }
    // //         if (e.fromSide === 'left') { sx1 = a.x - rFrom; sy1 = a.y; }
    // //     }
    // //     let sx2 = b.x;
    // //     let sy2 = b.y;
    // //     if (e.toSide) {
    // //         if (e.toSide === 'top') { sx2 = b.x; sy2 = b.y - rTo; }
    // //         if (e.toSide === 'right') { sx2 = b.x + rTo; sy2 = b.y; }
    // //         if (e.toSide === 'bottom') { sx2 = b.x; sy2 = b.y + rTo; }
    // //         if (e.toSide === 'left') { sx2 = b.x - rTo; sy2 = b.y; }
    // //     }
    // //     if (view.draggingEdgeEndpoint && view.draggingEdgeEndpoint.edgeId === e.id && view.tempEdgeTarget) {
    // //         if (view.draggingEdgeEndpoint.which === 'from') {
    // //             sx1 = view.tempEdgeTarget.x;
    // //             sy1 = view.tempEdgeTarget.y;
    // //         } else {
    // //             sx2 = view.tempEdgeTarget.x;
    // //             sy2 = view.tempEdgeTarget.y;
    // //         }
    // //     }
    // //     if (!e.fromSide || !e.toSide) {
    // //         const dx = sx2 - sx1;
    // //         const dy = sy2 - sy1;
    // //         const d = Math.hypot(dx, dy) || 1;
    // //         if (!e.fromSide) {
    // //             sx1 = a.x + (dx / d) * rFrom;
    // //             sy1 = a.y + (dy / d) * rFrom;
    // //         }
    // //         if (!e.toSide) {
    // //             sx2 = b.x - (dx / d) * rTo;
    // //             sy2 = b.y - (dy / d) * rTo;
    // //         }
    // //     }
    // //     try {
    // //         const bboxMinX = Math.min(sx1, sx2) - Math.max(rFrom, rTo) - cullMargin;
    // //         const bboxMaxX = Math.max(sx1, sx2) + Math.max(rFrom, rTo) + cullMargin;
    // //         const bboxMinY = Math.min(sy1, sy2) - Math.max(rFrom, rTo) - cullMargin;
    // //         const bboxMaxY = Math.max(sy1, sy2) + Math.max(rFrom, rTo) + cullMargin;
    // //         if (bboxMaxX < leftWorld || bboxMinX > rightWorld || bboxMaxY < topWorld || bboxMinY > bottomWorld) {
    // //             continue;
    // //         }
    // //     } catch (e) { }
    // //
    // //     context.save();
    // //
    // //     let edgeColor: string;
    // //     let edgeGlow = false;
    // //     const edgeStyle = styleDef?.edgeStyle || 'straight';
    // //
    // //     edgeGlow = false;
    // //     const isGamified = selectedStyle === 'gamified';
    // //
    // //     const useBezier = isGamified || showBezier;
    // //
    // //     const aKey = nodeStateColorKeys.get(a.id) || 'inProgress';
    // //     const bKey = nodeStateColorKeys.get(b.id) || 'inProgress';
    // //     const aState = a.state || 'in-progress';
    // //     const bState = b.state || 'in-progress';
    // //     const bothUnavailable = aState === 'unavailable' && bState === 'unavailable';
    // //     const bothComplete = aState === 'complete' && bState === 'complete';
    // //     const shouldAnimateEdge = false;
    // //
    // //     if (styleDef && styleDef.edgeColor && styleDef.edgeColor !== 'auto') {
    // //         edgeColor = styleDef.edgeColor;
    // //         edgeGlow = styleDef.edgeGlow || false;
    // //     } else {
    // //         edgeColor = chooseEdgeColor(view._cachedThemeColors?.accent, view._cachedThemeColors?.text, view._cachedThemeColors?.bg);
    // //     }
    // //
    // //     if (view.hoveredEdgeId !== null && view.hoveredEdgeId === e.id) {
    // //         edgeColor = view._cachedThemeColors?.accent || '#0066cc';
    // //         edgeGlow = true;
    // //     }
    // //
    // //     let fromNodeColor = edgeColor;
    // //     let toNodeColor = edgeColor;
    // //     try {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             fromNodeColor = (styleDef.nodeColors as any)[aKey]?.stroke || (styleDef.nodeColors as any)[aKey]?.fill || edgeColor;
    // //             toNodeColor = (styleDef.nodeColors as any)[bKey]?.stroke || (styleDef.nodeColors as any)[bKey]?.fill || edgeColor;
    // //         }
    // //     } catch (e) { }
    // //
    // //     if (view.hoveredEdgeId !== null && view.hoveredEdgeId === e.id) {
    // //         const accent = view._cachedThemeColors?.accent || edgeColor;
    // //         fromNodeColor = accent;
    // //         toNodeColor = accent;
    // //         edgeGlow = true;
    // //     }
    // //
    // //     const controls = computeBezierControls(sx1, sy1, sx2, sy2, e.fromSide, e.toSide, rFrom, rTo, isGamified);
    // //
    // //     const drawBezier = isGamified ? drawRigidBezierArrow : drawBezierArrow;
    // //
    // //     if (edgeGlow && styleDef?.animated && shouldAnimateEdge) {
    // //         const particleCount = 3;
    // //         const particleSpeed = view._animationTime * 0.002;
    // //         for (let i = 0; i < particleCount; i++) {
    // //             const particlePhase = (particleSpeed + i / particleCount) % 1;
    // //             const midX = sx1 + (sx2 - sx1) * particlePhase;
    // //             const midY = sy1 + (sy2 - sy1) * particlePhase;
    // //             context.beginPath();
    // //             context.fillStyle = edgeColor;
    // //             context.globalAlpha = 0.8;
    // //             context.arc(midX, midY, 3 / view.scale, 0, Math.PI * 2);
    // //             context.fill();
    // //             context.globalAlpha = 1.0;
    // //         }
    // //     }
    // //
    // //     if (useBezier || edgeStyle === 'gradient') {
    // //         const shouldUseGradient = edgeStyle === 'gradient' || (fromNodeColor !== toNodeColor);
    // //         if (shouldUseGradient) {
    // //             const gradient = context.createLinearGradient(sx1, sy1, sx2, sy2);
    // //             const blend = (cA: string, cB: string, t: number, a = 1) => {
    // //                 try {
    // //                     const pa = parseCSSColor(cA) || { r: 255, g: 255, b: 255 };
    // //                     const pb = parseCSSColor(cB) || { r: 255, g: 255, b: 255 };
    // //                     const r = Math.round(pa.r * (1 - t) + pb.r * t);
    // //                     const g = Math.round(pa.g * (1 - t) + pb.g * t);
    // //                     const b = Math.round(pa.b * (1 - t) + pb.b * t);
    // //                     return `rgba(${r}, ${g}, ${b}, ${a})`;
    // //                 } catch (ex) {
    // //                     return cA;
    // //                 }
    // //             };
    // //
    // //             gradient.addColorStop(0, fromNodeColor);
    // //             gradient.addColorStop(0.25, blend(fromNodeColor, toNodeColor, 0.25, 0.95));
    // //             gradient.addColorStop(0.5, blend(fromNodeColor, toNodeColor, 0.5, 0.85));
    // //             gradient.addColorStop(0.75, blend(fromNodeColor, toNodeColor, 0.75, 0.95));
    // //             gradient.addColorStop(1, toNodeColor);
    // //
    // //             context.lineWidth = edgeLineWidth;
    // //             context.strokeStyle = gradient;
    // //             context.fillStyle = edgeColor;
    // //             drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, edgeLineWidth);
    // //         }
    // //     } else {
    // //         if (edgeStyle === 'wavy' && edgeGlow && shouldAnimateEdge) {
    // //             const dx = sx2 - sx1;
    // //             const dy = sy2 - sy1;
    // //             const distance = Math.hypot(dx, dy);
    // //             const waveAmplitude = 8 / view.scale;
    // //             const waveFrequency = distance / 50;
    // //             const wavePhase = view._animationTime * 0.001;
    // //
    // //             context.beginPath();
    // //             context.moveTo(sx1, sy1);
    // //             const steps = Math.max(20, Math.floor(distance / 5));
    // //             for (let i = 1; i <= steps; i++) {
    // //                 const t = i / steps;
    // //                 const baseX = sx1 + dx * t;
    // //                 const baseY = sy1 + dy * t;
    // //                 const perpX = -dy / distance;
    // //                 const perpY = dx / distance;
    // //                 const waveOffset = Math.sin(waveFrequency * t * Math.PI * 2 + wavePhase) * waveAmplitude;
    // //                 context.lineTo(baseX + perpX * waveOffset, baseY + perpY * waveOffset);
    // //             }
    // //
    // //             context.lineWidth = edgeLineWidth;
    // //             context.strokeStyle = edgeColor;
    // //             context.stroke();
    // //
    // //             const angle = Math.atan2(dy, dx);
    // //             const headLen = edgeLineWidth * 2;
    // //             const p1x = sx2 - headLen * Math.cos(angle - Math.PI / 6);
    // //             const p1y = sy2 - headLen * Math.sin(angle - Math.PI / 6);
    // //             const p2x = sx2 - headLen * Math.cos(angle + Math.PI / 6);
    // //             const p2y = sy2 - headLen * Math.sin(angle + Math.PI / 6);
    // //             context.beginPath();
    // //             context.moveTo(sx2, sy2);
    // //             context.lineTo(p1x, p1y);
    // //             context.lineTo(p2x, p2y);
    // //             context.closePath();
    // //             context.fillStyle = edgeColor;
    // //             context.fill();
    // //         }
    // //     }
    // //     context.restore();
    // // }
    //
    // // let visibleNodes: SkillNode[];
    // // visibleNodes = view.nodes.filter(n => {
    // //     const r = view.nodeRadii[n.id] || nodeRadius;
    // //     return !(n.x + r < leftWorld - cullMargin || n.x - r > rightWorld + cullMargin ||
    // //         n.y + r < topWorld - cullMargin || n.y - r > bottomWorld + cullMargin);
    // // });
    // //
    // // const cachedTextColor = view._cachedThemeColors?.text || '#000';
    // //
    // // const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    // //
    // // for (const n of visibleNodes) {
    // //     const r = allNodeRadii.get(n.id) as number;
    // //
    // //     context.beginPath();
    // //
    // //     const hasFileLinkIssue = n.fileLink && !view.nodeFileHasCorrectId(n);
    // //
    // //     const nodeState = n.state || 'in-progress';
    // //
    // //     if (hasFileLinkIssue) {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             context.fillStyle = styleDef.nodeColors.error.fill;
    // //             context.strokeStyle = styleDef.nodeColors.error.stroke;
    // //         } else {
    // //             context.fillStyle = '#f44336';
    // //             context.strokeStyle = '#c62828';
    // //         }
    // //     } else if (n.optional) {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             context.fillStyle = styleDef.nodeColors.optional.fill;
    // //             context.strokeStyle = styleDef.nodeColors.optional.stroke;
    // //         } else {
    // //             context.fillStyle = '#87ceeb';
    // //             context.strokeStyle = '#5fb0db';
    // //         }
    // //     } else if (n.checkpoint) {
    // //         if (nodeState === 'complete') {
    // //             context.fillStyle = '#4caf50';
    // //             context.strokeStyle = '#2e7d32';
    // //         } else {
    // //             if (styleDef && styleDef.nodeColors) {
    // //                 context.fillStyle = styleDef.nodeColors.inProgress.fill;
    // //                 context.strokeStyle = styleDef.nodeColors.inProgress.stroke;
    // //             } else {
    // //                 context.fillStyle = '#ff9800';
    // //                 context.strokeStyle = '#e65100';
    // //             }
    // //         }
    // //     } else if (nodeState === 'complete') {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             context.fillStyle = styleDef.nodeColors.complete.fill;
    // //             context.strokeStyle = styleDef.nodeColors.complete.stroke;
    // //         } else {
    // //             context.fillStyle = '#FFD700';
    // //             context.strokeStyle = '#b8860b';
    // //         }
    // //     } else if (nodeState === 'on-hold') {
    // //         if (styleDef && styleDef.nodeColors && styleDef.nodeColors.onHold) {
    // //             context.fillStyle = styleDef.nodeColors.onHold.fill;
    // //             context.strokeStyle = styleDef.nodeColors.onHold.stroke;
    // //         } else {
    // //             context.fillStyle = '#ff6b6b';
    // //             context.strokeStyle = '#c92a2a';
    // //         }
    // //     } else if (nodeState === 'unavailable') {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             context.fillStyle = styleDef.nodeColors.unavailable.fill;
    // //             context.strokeStyle = styleDef.nodeColors.unavailable.stroke;
    // //         } else {
    // //             context.fillStyle = view._unavailableNodeColors!.fill;
    // //             context.strokeStyle = view._unavailableNodeColors!.stroke;
    // //         }
    // //     } else {
    // //         if (styleDef && styleDef.nodeColors) {
    // //             context.fillStyle = styleDef.nodeColors.inProgress.fill;
    // //             context.strokeStyle = styleDef.nodeColors.inProgress.stroke;
    // //         } else {
    // //             context.fillStyle = '#2b6';
    // //             context.strokeStyle = '#173';
    // //         }
    // //     }
    // //     context.lineWidth = 4 / view.scale;
    // //
    // //     const validShapes = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];
    // //     const effectiveShape = (n.shape && validShapes.includes(n.shape)) ? n.shape : defaultShape;
    // //     const isAnimated = false;
    // //     const isAnimating = false;
    // //
    // //     context.beginPath();
    // //     view.drawNodeShape(context, n.x, n.y, r, effectiveShape);
    // //     context.fill();
    // //
    // //     if (effectiveShape === 'repeat') {
    // //         let centerColor = '#ffffff';
    // //         if (nodeState === 'complete') {
    // //             centerColor = '#4caf50';
    // //         } else if (nodeState === 'in-progress') {
    // //             centerColor = '#ffcc80';
    // //         } else if (nodeState === 'on-hold') {
    // //             centerColor = '#e1bee7';
    // //         } else {
    // //             centerColor = '#e0e0e0';
    // //         }
    // //         context.beginPath();
    // //         context.arc(n.x, n.y, r * 0.55, 0, Math.PI * 2);
    // //         context.fillStyle = centerColor;
    // //         context.fill();
    // //     }
    // //
    // //     context.stroke();
    // //
    // //     if (isAnimated && nodeState === 'in-progress' && !hasFileLinkIssue) {
    // //         context.restore();
    // //     }
    // //
    // //     if (selectedNodeId === n.id) {
    // //         const pulseAmount = 8;
    // //         context.beginPath();
    // //         context.lineWidth = 4 / view.scale;
    // //         context.strokeStyle = 'rgba(255,165,0,0.95)';
    // //         const expandedR = r + (pulseAmount / view.scale);
    // //         view.drawNodeShape(context, n.x, n.y, expandedR, effectiveShape);
    // //         context.stroke();
    // //     }
    // //
    // //     if (n.repeating && n.showRepeatCount && n.repeatCount > 0) {
    // //         const badgeRadius = r * 0.35;
    // //         const badgeX = n.x + r * 0.7;
    // //         const badgeY = n.y - r * 0.7;
    // //
    // //         context.beginPath();
    // //         context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    // //         context.fillStyle = '#ffd700';
    // //         context.fill();
    // //         context.lineWidth = 2 / view.scale;
    // //         context.strokeStyle = '#cc9900';
    // //         context.stroke();
    // //
    // //         context.textAlign = 'center';
    // //         context.textBaseline = 'middle';
    // //         context.font = `bold ${10 / view.scale}px sans-serif`;
    // //         context.fillStyle = '#000';
    // //         const displayCount = n.repeatMax && n.repeatCount >= n.repeatMax
    // //             ? `${n.repeatCount}✓`
    // //             : `×${n.repeatCount}`;
    // //         context.fillText(displayCount, badgeX, badgeY);
    // //     }
    // //
    // //     if (n.repeating && nodeState === 'complete') {
    // //         const tempNode = n as any;
    // //         let cooldownText = '';
    // //
    // //         if (tempNode.getResetDisplayText) {
    // //             cooldownText = tempNode.getResetDisplayText();
    // //         }
    // //
    // //         if (!cooldownText && n.repeatCooldownHours) {
    // //             const now = Date.now();
    // //             if (!n.repeatLastCompleted) {
    // //                 n.repeatLastCompleted = now;
    // //                 n.repeatCount = 1;
    // //             }
    // //             const remaining = (n.repeatCooldownHours * 60 * 60 * 1000) - (now - n.repeatLastCompleted);
    // //             if (remaining > 0) {
    // //                 const hours = Math.floor(remaining / (60 * 60 * 1000));
    // //                 const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    // //                 const secs = Math.floor((remaining % (60 * 1000)) / 1000);
    // //                 if (hours > 0) {
    // //                     cooldownText = `Resets in: ${hours}h ${mins}m`;
    // //                 } else if (mins > 0) {
    // //                     cooldownText = `Resets in: ${mins}m`;
    // //                 } else {
    // //                     cooldownText = `Resets in: ${secs}s`;
    // //                 }
    // //             } else {
    // //                 n.repeatLastCompleted = now;
    // //                 n.repeatCount++;
    // //                 const hrs = n.repeatCooldownHours;
    // //                 if (hrs >= 24) {
    // //                     const days = Math.floor(hrs / 24);
    // //                     const remainingHours = hrs % 24;
    // //                     if (remainingHours > 0) {
    // //                         cooldownText = `Resets in: ${days}d ${remainingHours}h`;
    // //                     } else {
    // //                         cooldownText = `Resets in: ${days}d`;
    // //                     }
    // //                 } else if (hrs >= 1) {
    // //                     const mins = Math.round((hrs % 1) * 60);
    // //                     if (mins > 0) {
    // //                         cooldownText = `Resets in: ${Math.floor(hrs)}h ${mins}m`;
    // //                     } else {
    // //                         cooldownText = `Resets in: ${Math.floor(hrs)}h`;
    // //                     }
    // //                 } else {
    // //                     cooldownText = `Resets in: ${Math.round(hrs * 60)}m`;
    // //                 }
    // //             }
    // //         }
    // //
    // //         if (cooldownText) {
    // //             context.textAlign = 'center';
    // //             context.textBaseline = 'top';
    // //             context.font = `${9 / view.scale}px sans-serif`;
    // //             context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    // //             context.fillText(cooldownText, n.x, n.y + r + (4 / view.scale));
    // //         }
    // //     }
    // //
    // //     if (fastMode) {
    // //         continue;
    // //     }
    // //
    // //     context.textAlign = 'center';
    // //     context.font = `${14 / view.scale}px sans-serif`;
    // //
    // //     let labelTextColor = cachedTextColor;
    // //
    // //     if (n.checkpoint) {
    // //         labelTextColor = '#000';
    // //     }
    // //
    // //     let lines: string[] = [];
    // //     if (n.optional) {
    // //         lines = ['Optional Path'];
    // //     } else if (n.treeLink) {
    // //         lines = ['Tree Link', n.treeLink];
    // //     } else {
    // //         const exp = n.exp !== undefined ? n.exp : 0;
    // //         const words = (view.getNodeDisplayLabel(n) || '').split(/\s+/).filter(Boolean);
    // //         for (let i = 0; i < words.length; i += 4) {
    // //             lines.push(words.slice(i, i + 4).join(' '));
    // //         }
    // //         if (lines.length === 0) lines.push('');
    // //         if (exp > 0 || showExpAsFraction) {
    // //             lines[lines.length - 1] = `${lines[lines.length - 1]}`.trim();
    // //         }
    // //     }
    // //
    // //     let fileName = '';
    // //     let isUnlinked = false;
    // //     if (!n.optional && !n.checkpoint && !n.treeLink) {
    // //         if (n.fileLink) {
    // //             fileName = view.getNodeFileName(n);
    // //             isUnlinked = !view.isNodeFileLinked(n);
    // //         } else {
    // //             fileName = 'Right click to add note';
    // //             isUnlinked = true;
    // //         }
    // //     } else if (n.treeLink && n.fileLink) {
    // //         isUnlinked = !view.isNodeFileLinked(n);
    // //     }
    // //
    // //     const lineHeight = 16 / view.scale;
    // //     const totalLines = lines.length + (fileName ? 1 : 0) + (isUnlinked ? 1 : 0);
    // //     let firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2;
    // //
    // //     const taskListForHint = view._tasksCache.get(n.id) || [];
    // //     const incompleteCount = taskListForHint.filter((t: any) => !t.completed).length;
    // //     const hintHasTasks = taskListForHint.length > 0;
    // //     let showTaskHint = hintHasTasks && incompleteCount > 0;
    // //     if (n.optional || n.checkpoint) showTaskHint = false;
    // //     if (showTaskHint) {
    // //         firstLineY -= (lineHeight * 0.35);
    // //     }
    // //
    // //     const isGamifiedUnavailable = (selectedStyle === 'gamified' && nodeState === 'unavailable');
    // //
    // //     if (isGamifiedUnavailable) {
    // //         context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    // //         context.shadowBlur = 0;
    // //         context.shadowOffsetX = 1 / view.scale;
    // //         context.shadowOffsetY = 1 / view.scale;
    // //         context.fillStyle = 'rgba(200, 200, 200, 0.4)';
    // //     } else {
    // //         context.fillStyle = labelTextColor;
    // //     }
    // //
    // //     for (let i = 0; i < lines.length; i++) {
    // //         const text = lines[i];
    // //         const y = firstLineY + i * lineHeight;
    // //
    // //         if (isGamifiedUnavailable) {
    // //             context.save();
    // //             context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    // //             context.shadowBlur = 2 / view.scale;
    // //             context.shadowOffsetX = 1 / view.scale;
    // //             context.shadowOffsetY = 1 / view.scale;
    // //             context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    // //             context.fillText(text, n.x, y);
    // //             context.restore();
    // //
    // //             context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    // //             context.fillText(text, n.x, y);
    // //         } else {
    // //             context.fillText(text, n.x, y);
    // //         }
    // //     }
    // //
    // //     if (n.optional) {
    // //         try {
    // //             const iconScreenSize = 30;
    // //             const iconSize = iconScreenSize / view.scale;
    // //             const iconX = n.x;
    // //             const iconY = firstLineY + lines.length * lineHeight + (iconSize * 0.9);
    // //
    // //             context.save();
    // //             let bgColor = '#ffffff';
    // //             let strokeColor = labelTextColor;
    // //             try {
    // //                 if (styleDef && styleDef.nodeColors && (styleDef.nodeColors as any).optional) {
    // //                     bgColor = (styleDef.nodeColors as any).optional.fill || bgColor;
    // //                     strokeColor = (styleDef.nodeColors as any).optional.stroke || strokeColor;
    // //                 }
    // //             } catch (e) { }
    // //
    // //             context.beginPath();
    // //             context.fillStyle = bgColor;
    // //             context.strokeStyle = strokeColor;
    // //             context.lineWidth = 3 / view.scale;
    // //             context.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
    // //             context.fill();
    // //             context.stroke();
    // //
    // //             let textColor = '#fff';
    // //             try {
    // //                 const parsed = parseCSSColor(bgColor);
    // //                 if (parsed) {
    // //                     const lum = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b) / 255;
    // //                     textColor = lum > 0.55 ? '#111' : '#fff';
    // //                 }
    // //             } catch (e) { }
    // //
    // //             context.fillStyle = textColor;
    // //             context.font = `${Math.max(18 / view.scale, 14 / view.scale)}px sans-serif`;
    // //             context.textAlign = 'center';
    // //             context.textBaseline = 'middle';
    // //             context.fillText('?', iconX, iconY + (1 / view.scale));
    // //             context.restore();
    // //         } catch (e) { }
    // //     }
    // //
    // //     if (fileName) {
    // //         context.font = `${12 / view.scale}px sans-serif`;
    // //
    // //         if (isGamifiedUnavailable) {
    // //             context.save();
    // //             context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    // //             context.shadowBlur = 2 / view.scale;
    // //             context.shadowOffsetX = 1 / view.scale;
    // //             context.shadowOffsetY = 1 / view.scale;
    // //             context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    // //             const y = firstLineY + lines.length * lineHeight;
    // //             context.fillText(fileName, n.x, y);
    // //             context.restore();
    // //
    // //             context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    // //             context.fillText(fileName, n.x, y);
    // //
    // //             if (isUnlinked) {
    // //                 const unlinkedY = y + lineHeight;
    // //                 context.save();
    // //                 context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    // //                 context.shadowBlur = 2 / view.scale;
    // //                 context.shadowOffsetX = 1 / view.scale;
    // //                 context.shadowOffsetY = 1 / view.scale;
    // //                 context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    // //                 context.fillText('[unlinked]', n.x, unlinkedY);
    // //                 context.restore();
    // //                 context.fillStyle = 'rgba(255, 180, 100, 0.9)';
    // //                 context.fillText('[unlinked]', n.x, unlinkedY);
    // //             }
    // //         } else {
    // //             context.fillStyle = labelTextColor;
    // //             const y = firstLineY + lines.length * lineHeight;
    // //             context.fillText(fileName, n.x, y);
    // //
    // //             if (isUnlinked) {
    // //                 const unlinkedY = y + lineHeight;
    // //                 context.fillStyle = '#e67e22';
    // //                 context.fillText('[unlinked]', n.x, unlinkedY);
    // //             }
    // //         }
    // //
    // //         context.font = `${14 / view.scale}px sans-serif`;
    // //     }
    // //
    // //     if (showTaskHint) {
    // //         try {
    // //             let hint = 'Incomplete Tasks.';
    // //             let baseFontSize = 11 / view.scale;
    // //             const minFontSize = 8 / view.scale;
    // //             context.font = `${baseFontSize}px sans-serif`;
    // //
    // //             const maxWidth = Math.max((r * 2) - (12 / view.scale), 40 / view.scale);
    // //             let measured = context.measureText(hint).width;
    // //
    // //             while (measured > maxWidth && baseFontSize > minFontSize) {
    // //                 baseFontSize = Math.max(minFontSize, baseFontSize - 0.5 / view.scale);
    // //                 context.font = `${baseFontSize}px sans-serif`;
    // //                 measured = context.measureText(hint).width;
    // //             }
    // //
    // //             if (measured > maxWidth) {
    // //                 const avgChar = measured / hint.length;
    // //                 const maxChars = Math.max(3, Math.floor(maxWidth / avgChar) - 1);
    // //                 hint = hint.slice(0, maxChars) + '…';
    // //                 measured = context.measureText(hint).width;
    // //             }
    // //
    // //             const padX = 8 / view.scale;
    // //             const padY = 4 / view.scale;
    // //             const btnW = measured + padX * 2;
    // //             const btnH = baseFontSize + padY * 2;
    // //             const btnX = n.x - btnW / 2;
    // //             const btnY = firstLineY + lines.length * lineHeight + (fileName ? lineHeight : 0) + (6 / view.scale);
    // //
    // //             const accent = view._cachedThemeColors?.accent || '#2f7ae0';
    // //
    // //             const radius = Math.min(btnH / 2, 6 / view.scale);
    // //             context.beginPath();
    // //             context.moveTo(btnX + radius, btnY);
    // //             context.lineTo(btnX + btnW - radius, btnY);
    // //             context.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + radius, radius);
    // //             context.lineTo(btnX + btnW, btnY + btnH - radius);
    // //             context.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - radius, btnY + btnH, radius);
    // //             context.lineTo(btnX + radius, btnY + btnH);
    // //             context.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - radius, radius);
    // //             context.lineTo(btnX, btnY + radius);
    // //             context.arcTo(btnX, btnY, btnX + radius, btnY, radius);
    // //             context.closePath();
    // //
    // //             context.fillStyle = accent;
    // //             context.globalAlpha = 0.95;
    // //             context.fill();
    // //             context.globalAlpha = 1.0;
    // //
    // //             context.strokeStyle = 'rgba(0,0,0,0.12)';
    // //             context.lineWidth = 1 / view.scale;
    // //             context.stroke();
    // //
    // //             context.fillStyle = '#fff';
    // //             context.textBaseline = 'middle';
    // //             const textX = n.x;
    // //             const textY = btnY + btnH / 2;
    // //             context.fillText(hint, textX, textY);
    // //
    // //             context.fillStyle = labelTextColor;
    // //             context.textBaseline = 'alphabetic';
    // //         } catch (e) { }
    // //     }
    // //
    // //     if (n.checkpoint) {
    // //         try {
    // //             const iconScreenSize = 30;
    // //             const iconSize = iconScreenSize / view.scale;
    // //             const iconX = n.x;
    // //             const iconY = firstLineY + lines.length * lineHeight + (iconSize * 0.9);
    // //
    // //             context.save();
    // //             let bgColor = '#ffffff';
    // //             let strokeColor = '#000';
    // //             try {
    // //                 if (styleDef && styleDef.nodeColors && (styleDef.nodeColors as any).optional) {
    // //                     bgColor = (styleDef.nodeColors as any).optional.fill || bgColor;
    // //                 }
    // //             } catch (e) { }
    // //
    // //             context.beginPath();
    // //             context.fillStyle = bgColor;
    // //             context.strokeStyle = strokeColor;
    // //             context.lineWidth = 3 / view.scale;
    // //             context.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
    // //             context.fill();
    // //             context.stroke();
    // //
    // //             const flagTextColor = '#111';
    // //
    // //             context.fillStyle = flagTextColor;
    // //             context.font = `${Math.max(18 / view.scale, 14 / view.scale)}px sans-serif`;
    // //             context.textAlign = 'center';
    // //             context.textBaseline = 'middle';
    // //             context.fillText('🚩', iconX, iconY + (1 / view.scale));
    // //             context.restore();
    // //         } catch (e) { }
    // //     }
    // //
    // //     context.shadowBlur = 0;
    // //     context.shadowOffsetX = 0;
    // //     context.shadowOffsetY = 0;
    // //
    // //     const actualState = n.state || 'in-progress';
    // //     const nodeTasks = view._tasksCache.get(n.id) || [];
    // //     const hasTasks = nodeTasks.length > 0;
    // //
    // //     let textBottomY = firstLineY + (lines.length - 1) * lineHeight;
    // //     if (fileName) textBottomY += lineHeight;
    // //     if (isUnlinked) textBottomY += lineHeight;
    // //
    // //     const isManualCompletionNode = n.optional || n.checkpoint || n.treeLink;
    // //
    // //     if ((actualState === 'in-progress' || actualState === 'complete') && !hasTasks && !isManualCompletionNode) {
    // //         const minScreenSize = 14;
    // //         const maxScreenSize = 24;
    // //         const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25));
    // //         const checkboxSize = baseScreenSize / view.scale;
    // //
    // //         const nodeBottomEdge = n.y + r * 0.9;
    // //         let checkboxY = textBottomY + 6 / view.scale;
    // //
    // //         const checkboxBottomY = checkboxY + checkboxSize;
    // //         if (checkboxBottomY > nodeBottomEdge) {
    // //             checkboxY = nodeBottomEdge - checkboxSize;
    // //         }
    // //
    // //         const checkboxX = n.x - checkboxSize / 2;
    // //
    // //         context.strokeStyle = '#333';
    // //         context.lineWidth = 2 / view.scale;
    // //         context.beginPath();
    // //         const checkboxRadius = checkboxSize * 0.15;
    // //         context.moveTo(checkboxX + checkboxRadius, checkboxY);
    // //         context.lineTo(checkboxX + checkboxSize - checkboxRadius, checkboxY);
    // //         context.arcTo(checkboxX + checkboxSize, checkboxY, checkboxX + checkboxSize, checkboxY + checkboxRadius, checkboxRadius);
    // //         context.lineTo(checkboxX + checkboxSize, checkboxY + checkboxSize - checkboxRadius);
    // //         context.arcTo(checkboxX + checkboxSize, checkboxY + checkboxSize, checkboxX + checkboxSize - checkboxRadius, checkboxY + checkboxSize, checkboxRadius);
    // //         context.lineTo(checkboxX + checkboxRadius, checkboxY + checkboxSize);
    // //         context.arcTo(checkboxX, checkboxY + checkboxSize, checkboxX, checkboxY + checkboxSize - checkboxRadius, checkboxRadius);
    // //         context.lineTo(checkboxX, checkboxY + checkboxRadius);
    // //         context.arcTo(checkboxX, checkboxY, checkboxX + checkboxRadius, checkboxY, checkboxRadius);
    // //         context.stroke();
    // //
    // //         if (actualState === 'complete') {
    // //             context.strokeStyle = '#2e7d32';
    // //             context.lineWidth = 2.5 / view.scale;
    // //             context.lineCap = 'round';
    // //             context.lineJoin = 'round';
    // //             context.beginPath();
    // //             context.moveTo(checkboxX + checkboxSize * 0.25, checkboxY + checkboxSize * 0.5);
    // //             context.lineTo(checkboxX + checkboxSize * 0.45, checkboxY + checkboxSize * 0.7);
    // //             context.lineTo(checkboxX + checkboxSize * 0.75, checkboxY + checkboxSize * 0.3);
    // //             context.stroke();
    // //             context.lineCap = 'butt';
    // //             context.lineJoin = 'miter';
    // //         }
    // //
    // //         if (actualState === 'complete') {
    // //             const iconSize = 18 / view.scale;
    // //             const iconX = n.x + r - iconSize - 4 / view.scale;
    // //             const iconY = n.y - r + 4 / view.scale;
    // //
    // //             context.save();
    // //             context.translate(iconX, iconY);
    // //             context.fillStyle = '#4caf50';
    // //             context.beginPath();
    // //             context.arc(iconSize / 2, iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    // //             context.fill();
    // //             context.strokeStyle = '#fff';
    // //             context.fillStyle = '#fff';
    // //             context.lineWidth = 2.5 / view.scale;
    // //             context.lineCap = 'round';
    // //             context.lineJoin = 'round';
    // //             context.beginPath();
    // //             context.moveTo(iconSize * 0.25, iconSize * 0.5);
    // //             context.lineTo(iconSize * 0.45, iconSize * 0.7);
    // //             context.lineTo(iconSize * 0.75, iconSize * 0.3);
    // //             context.stroke();
    // //             context.restore();
    // //         }
    // //     }
    // //
    // //     if (editMode || selectedNodeId === n.id) {
    // //         const used = new Set<string>();
    // //         for (const ee of view.edges) {
    // //             if (ee.from === n.id && ee.fromSide) used.add(ee.fromSide);
    // //             if (ee.to === n.id && ee.toSide) used.add(ee.toSide);
    // //         }
    // //         const hs = 18 / view.scale;
    // //         context.strokeStyle = '#2563eb';
    // //         context.lineWidth = 2.5 / view.scale;
    // //         context.fillStyle = '#ffffff';
    // //         if (!used.has('top')) { context.beginPath(); context.arc(n.x, n.y - r, hs / 2, 0, Math.PI * 2); context.fill(); context.stroke(); }
    // //         if (!used.has('right')) { context.beginPath(); context.arc(n.x + r, n.y, hs / 2, 0, Math.PI * 2); context.fill(); context.stroke(); }
    // //         if (!used.has('bottom')) { context.beginPath(); context.arc(n.x, n.y + r, hs / 2, 0, Math.PI * 2); context.fill(); context.stroke(); }
    // //         if (!used.has('left')) { context.beginPath(); context.arc(n.x - r, n.y, hs / 2, 0, Math.PI * 2); context.fill(); context.stroke(); }
    // //     }
    // // }
    // //
    // // if (view.creatingEdgeFrom && view.tempEdgeTarget) {
    // //     const a = view.creatingEdgeFrom;
    // //     const ax = a.x;
    // //     const ay = a.y;
    // //     const bx = view.tempEdgeTarget.x;
    // //     const by = view.tempEdgeTarget.y;
    // //     const dx = bx - ax;
    // //     const dy = by - ay;
    // //     const d = Math.hypot(dx, dy) || 1;
    // //     const r = nodeRadius;
    // //     const sx1 = ax + (dx / d) * r;
    // //     const sy1 = ay + (dy / d) * r;
    // //     context.save();
    // //     context.setLineDash([4 / view.scale, 4 / view.scale]);
    // //     const tempColor = chooseEdgeColor(view._cachedThemeColors?.accent, view._cachedThemeColors?.text, view._cachedThemeColors?.bg);
    // //     const tempFromSide = view.creatingEdgeFromSide || view.getSideBetween(view.creatingEdgeFrom, { id: -1, x: bx, y: by, state: 'unavailable' });
    // //     const tempControls = computeBezierControls(sx1, sy1, bx, by, tempFromSide, null, r, 0);
    // //     const isGamifiedTemp = (view.settings.style || 'default') === 'gamified';
    // //     const useBezierTemp = isGamifiedTemp || view.settings.showBezier;
    // //     const drawBezierTemp = isGamifiedTemp ? drawRigidBezierArrow : drawBezierArrow;
    // //     context.lineWidth = 3 / view.scale;
    // //     context.strokeStyle = (tempColor === '#fff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.10)');
    // //     drawOrthogonalArrow(context, sx1, sy1, bx, by, 3 / view.scale);
    // //     context.lineWidth = 1 / view.scale;
    // //     context.strokeStyle = tempColor;
    // //     context.fillStyle = tempColor;
    // //     drawOrthogonalArrow(context, sx1, sy1, bx, by, 1 / view.scale);
    // //     context.restore();
    // // }
    // //
    // // context.restore();
    // //
    // // view.expOverlayRenderer.render(context);
    // //
    // // try {
    // //     if (view.canvas && typeof createImageBitmap === 'function') {
    // //         const prev = view.view._lastFrameBitmap;
    // //         createImageBitmap(view.canvas).then((bmp) => {
    // //             try {
    // //                 if (prev && typeof (prev as any).close === 'function') (prev as any).close();
    // //             } catch (e) { }
    // //             view.view._lastFrameBitmap = bmp;
    // //         }).catch(() => { });
    // //     }
    // // } catch (e) { }
    // //
    // // try {
    // //     if (view.view._nodeOverlay && view.view._nodeOverlay.classList.contains('open')) view.view.updateNodeOverlay();
    // // } catch (e) { }
    // // try {
    // //     view.view.updateNodeDropdown();
    // // } catch (e) { }
}


function RenderWarningBanner(padding: number = 2) {
    const context = view.context;
    const canvas = view.canvas;
    if (!context || !canvas) return;


    if (!view.isTasksPluginInstalled() || !view.isDataviewPluginInstalled()) {
        context.save();
        context.fillStyle = 'rgba(255, 193, 7, 0.9)';
        context.fillRect(-padding, -padding, canvas.width + padding * 2, canvas.height + padding * 2);
        // context.fillRect(0, 0, canvas.width, 40);
        context.fillStyle = '#000';
        // context.font = '14px sans-serif';
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

function RenderNodes() {

}

function RenderTemporaryEdgeLine() {

}

function RenderEdgeLines(nodeMap: Map<string | number, SkillNode>) {
    const edgeLineWidth = 24 / Math.max(0.3, view.scale);
    const nodes = GetNodes()

    const allNodeRadii = new Map(
        [...nodes.values()].map(n => [n.id, nodeRadii[n.id] || nodeRadius])
    );

    const selectedStyle: string = view.settings.style

    const styleDef = SKILL_TREE_STYLES[selectedStyle];

    // TODO setup settings default
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
        // TODO
        //
        // if (view.draggingEdgeEndpoint && view.draggingEdgeEndpoint.edgeId === e.id && view.tempEdgeTarget) {
        //     if (view.draggingEdgeEndpoint.which === 'from') {
        //         sx1 = view.tempEdgeTarget.x;
        //         sy1 = view.tempEdgeTarget.y;
        //     } else {
        //         sx2 = view.tempEdgeTarget.x;
        //         sy2 = view.tempEdgeTarget.y;
        //     }
        // }
        //
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
        // try {
        //     const bboxMinX = Math.min(sx1, sx2) - Math.max(rFrom, rTo) - cullMargin;
        //     const bboxMaxX = Math.max(sx1, sx2) + Math.max(rFrom, rTo) + cullMargin;
        //     const bboxMinY = Math.min(sy1, sy2) - Math.max(rFrom, rTo) - cullMargin;
        //     const bboxMaxY = Math.max(sy1, sy2) + Math.max(rFrom, rTo) + cullMargin;
        //     if (bboxMaxX < leftWorld || bboxMinX > rightWorld || bboxMaxY < topWorld || bboxMinY > bottomWorld) {
        //         continue;
        //     }
        // } catch (e) { }

        context.save();

        let edgeColor: string;
        let edgeGlow = false;
        const edgeStyle = styleDef?.edgeStyle || 'straight';

        edgeGlow = false;
        const isGamified = selectedStyle === 'gamified';

        const nodeStateColorKeys = new Map<string | number, string>();

        // TODO this was SUPPOSED to be removed...
        const showBezier = view.settings.showBezier;
        const useBezier = isGamified || showBezier;

        const aKey = nodeStateColorKeys.get(a.id) || 'inProgress';
        const bKey = nodeStateColorKeys.get(b.id) || 'inProgress';
        const aState = a.state || 'in-progress';
        const bState = b.state || 'in-progress';
        const bothUnavailable = aState === 'unavailable' && bState === 'unavailable';
        const bothComplete = aState === 'complete' && bState === 'complete';
        const shouldAnimateEdge = false;

        if (styleDef && styleDef.edgeColor && styleDef.edgeColor !== 'auto') {
            edgeColor = styleDef.edgeColor;
            // edgeGlow = styleDef.edgeGlow || false;
        } //else {
        //     edgeColor = chooseEdgeColor(view._cachedThemeColors?.accent, view._cachedThemeColors?.text, view._cachedThemeColors?.bg);
        // }

        // if (view.hoveredEdgeId !== null && view.hoveredEdgeId === e.id) {
        //     edgeColor = view._cachedThemeColors?.accent || '#0066cc';
        //     edgeGlow = true;
        // }

        let fromNodeColor = edgeColor;
        let toNodeColor = edgeColor;
        try {
            if (styleDef && styleDef.nodeColors) {
                fromNodeColor = (styleDef.nodeColors as any)[aKey]?.stroke || (styleDef.nodeColors as any)[aKey]?.fill || edgeColor;
                toNodeColor = (styleDef.nodeColors as any)[bKey]?.stroke || (styleDef.nodeColors as any)[bKey]?.fill || edgeColor;
            }
        } catch (e) { }

        // if (view.hoveredEdgeId !== null && view.hoveredEdgeId === e.id) {
        //     const accent = view._cachedThemeColors?.accent || edgeColor;
        //     fromNodeColor = accent;
        //     toNodeColor = accent;
        //     edgeGlow = true;
        // }

        const controls = computeBezierControls(sx1, sy1, sx2, sy2, e.fromSide, e.toSide, rFrom, rTo, isGamified);
        //
        const drawBezier = drawRigidBezierArrow;

        // if (edgeGlow && styleDef?.animated && shouldAnimateEdge) {
        //     const particleCount = 3;
        //     // const particleSpeed = view._animationTime * 0.002;
        //     for (let i = 0; i < particleCount; i++) {
        //         const particlePhase = (particleSpeed + i / particleCount) % 1;
        //         const midX = sx1 + (sx2 - sx1) * particlePhase;
        //         const midY = sy1 + (sy2 - sy1) * particlePhase;
        //         context.beginPath();
        //         context.fillStyle = edgeColor;
        //         context.globalAlpha = 0.8;
        //         context.arc(midX, midY, 3 / view.scale, 0, Math.PI * 2);
        //         context.fill();
        //         context.globalAlpha = 1.0;
        //     }
        // }

        if (edgeStyle === 'gradient') {
            const shouldUseGradient = edgeStyle === 'gradient' || (fromNodeColor !== toNodeColor);
            if (shouldUseGradient) {
                const gradient = context.createLinearGradient(sx1, sy1, sx2, sy2);
                const blend = (cA: string, cB: string, t: number, a = 1) => {
                    try {
                        const pa = parseCSSColor(cA) || { r: 255, g: 255, b: 255 };
                        const pb = parseCSSColor(cB) || { r: 255, g: 255, b: 255 };
                        const r = Math.round(pa.r * (1 - t) + pb.r * t);
                        const g = Math.round(pa.g * (1 - t) + pb.g * t);
                        const b = Math.round(pa.b * (1 - t) + pb.b * t);
                        return `rgba(${r}, ${g}, ${b}, ${a})`;
                    } catch (ex) {
                        return cA;
                    }
                };

                gradient.addColorStop(0, fromNodeColor);
                gradient.addColorStop(0.25, blend(fromNodeColor, toNodeColor, 0.25, 0.95));
                gradient.addColorStop(0.5, blend(fromNodeColor, toNodeColor, 0.5, 0.85));
                gradient.addColorStop(0.75, blend(fromNodeColor, toNodeColor, 0.75, 0.95));
                gradient.addColorStop(1, toNodeColor);

                context.lineWidth = edgeLineWidth;
                context.strokeStyle = gradient;
                context.fillStyle = edgeColor;
                drawBezier(context, sx1, sy1, controls.c1x, controls.c1y, controls.c2x, controls.c2y, sx2, sy2, edgeLineWidth);
            }
        }// else {
        //     if (edgeStyle === 'wavy' && edgeGlow && shouldAnimateEdge) {
        //         const dx = sx2 - sx1;
        //         const dy = sy2 - sy1;
        //         const distance = Math.hypot(dx, dy);
        //         const waveAmplitude = 8 / view.scale;
        //         const waveFrequency = distance / 50;
        //         const wavePhase = view._animationTime * 0.001;
        //
        //         context.beginPath();
        //         context.moveTo(sx1, sy1);
        //         const steps = Math.max(20, Math.floor(distance / 5));
        //         for (let i = 1; i <= steps; i++) {
        //             const t = i / steps;
        //             const baseX = sx1 + dx * t;
        //             const baseY = sy1 + dy * t;
        //             const perpX = -dy / distance;
        //             const perpY = dx / distance;
        //             const waveOffset = Math.sin(waveFrequency * t * Math.PI * 2 + wavePhase) * waveAmplitude;
        //             context.lineTo(baseX + perpX * waveOffset, baseY + perpY * waveOffset);
        //         }
        //
        //         context.lineWidth = edgeLineWidth;
        //         context.strokeStyle = edgeColor;
        //         context.stroke();
        //
        //         const angle = Math.atan2(dy, dx);
        //         const headLen = edgeLineWidth * 2;
        //         const p1x = sx2 - headLen * Math.cos(angle - Math.PI / 6);
        //         const p1y = sy2 - headLen * Math.sin(angle - Math.PI / 6);
        //         const p2x = sx2 - headLen * Math.cos(angle + Math.PI / 6);
        //         const p2y = sy2 - headLen * Math.sin(angle + Math.PI / 6);
        //         context.beginPath();
        //         context.moveTo(sx2, sy2);
        //         context.lineTo(p1x, p1y);
        //         context.lineTo(p2x, p2y);
        //         context.closePath();
        //         context.fillStyle = edgeColor;
        //         context.fill();
        //     }
        // }
        context.restore();
    }
}

function RenderNodeStates() {
}

function UpdateCoordinate() {

    const clientW = view.canvas.width / dpr;
    const clientH = view.canvas.height / dpr;
    const leftWorld = (-view.offset.x) / view.scale;
    const rightWorld = (clientW - view.offset.x) / view.scale;
    const topWorld = (-view.offset.y) / view.scale;
    const bottomWorld = (clientH - view.offset.y) / view.scale;
}




export function chooseEdgeColor(cachedAccent?: string, cachedText?: string, cachedBg?: string) {
    // Use cached values if provided
    if (cachedAccent) return cachedAccent;
    if (cachedText) return cachedText;
    if (cachedBg) {
        try {
            const parsed = parseCSSColor(cachedBg);
            if (parsed) {
                const lum = luminance(parsed);
                return lum < 0.5 ? '#fff' : '#000';
            }
        } catch (e) { }
    }
    return '#fff';
}


export function parseCSSColor(s: string) {
    s = s.trim();
    if (!s) return null;
    if (s.startsWith('#')) {
        const hex = s.slice(1);
        const bigint = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return { r, g, b };
    }
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const parts = m[1].split(',').map(p => parseFloat(p));
        return { r: parts[0], g: parts[1], b: parts[2] };
    }
    return null;
}


/**
 * Compute relative luminance of an RGB color in linear space.
 * @param param0 Object with `r`,`g`,`b` channels in 0-255 range.
 * @returns Luminance value in range 0..1.
 */
export function luminance({ r, g, b }: { r: number; g: number; b: number }) {
    const sr = r / 255; const sg = g / 255; const sb = b / 255;
    const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * linear(sr) + 0.7152 * linear(sg) + 0.0722 * linear(sb);
}



export function drawRigidBezierArrow(ctx: CanvasRenderingContext2D, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, lineWidth: number) {
    const headLen = lineWidth * 2;
    // Arrow head direction based on last segment (p2 -> p3)
    const dx = p3x - p2x;
    const dy = p3y - p2y;
    const angle = Math.atan2(dy, dx);
    const baseX = p3x - headLen * Math.cos(angle);
    const baseY = p3y - headLen * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(p0x, p0y);
    ctx.lineTo(p1x, p1y); // Sharp angle at first control point
    ctx.lineTo(p2x, p2y); // Sharp angle at second control point
    ctx.lineTo(baseX, baseY); // End at arrow base
    ctx.stroke();
    const pA1x = p3x - headLen * Math.cos(angle - Math.PI / 6);
    const pA1y = p3y - headLen * Math.sin(angle - Math.PI / 6);
    const pA2x = p3x - headLen * Math.cos(angle + Math.PI / 6);
    const pA2y = p3y - headLen * Math.sin(angle + Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(p3x, p3y);
    ctx.lineTo(pA1x, pA1y);
    ctx.lineTo(pA2x, pA2y);
    ctx.closePath();
    ctx.fill();
}



export function computeBezierControls(ax: number, ay: number, bx: number, by: number, fromSide: any, toSide: any, rFrom: number, rTo: number, rightAngles: boolean = false) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy) || 1;

    // For 90-degree angles, create slightly rounded L-shaped paths
    if (rightAngles) {
        const offset = Math.max(40, dist * 0.25); // Offset distance for 90-degree turns with rounding

        // Determine dominant direction and construct two corner points so that
        // the path goes: start -> cornerA -> cornerB -> end with both turns 90°.
        // We represent this using two control points c1 and c2 which will be
        // cornerA and cornerB respectively.
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        let c1x: number, c1y: number, c2x: number, c2y: number;
        if (absDx > absDy) {
            // Horizontal-first: move horizontally from source, then vertically, then horizontally into target
            const step = dx > 0 ? offset : -offset;
            c1x = ax + step;
            c1y = ay;
            c2x = ax + step;
            c2y = by;
        } else {
            // Vertical-first: move vertically from source, then horizontally, then vertically into target
            const step = dy > 0 ? offset : -offset;
            c1x = ax;
            c1y = ay + step;
            c2x = bx;
            c2y = ay + step;
        }

        return { c1x, c1y, c2x, c2y };
    }

    // Original smooth bezier logic for non-gamified styles
    const unitX = dx / dist;
    const unitY = dy / dist;

    // Perpendicular direction (rotated 90 degrees)
    const perpX = -unitY;
    const perpY = unitX;

    // Rounded offset for smooth corners
    // Use a larger fraction of distance to create rounded bends
    const tightOffset = Math.max(20, dist * 0.15);

    let c1x = ax, c1y = ay, c2x = bx, c2y = by;

    if (fromSide) {
        // When side is specified, use perpendicular offset to create sharp angle
        if (fromSide === 'top') {
            c1x = ax + perpX * tightOffset;
            c1y = ay - (rFrom + tightOffset * 0.5);
        }
        else if (fromSide === 'bottom') {
            c1x = ax + perpX * tightOffset;
            c1y = ay + (rFrom + tightOffset * 0.5);
        }
        else if (fromSide === 'left') {
            c1x = ax - (rFrom + tightOffset * 0.5);
            c1y = ay + perpY * tightOffset;
        }
        else if (fromSide === 'right') {
            c1x = ax + (rFrom + tightOffset * 0.5);
            c1y = ay + perpY * tightOffset;
        }
    } else {
        // No side specified - create sharp angle by moving perpendicular to main direction
        // Move a small distance along main direction, then perpendicular
        const alongDist = dist * 0.1; // Very close along the line
        const perpDist = tightOffset; // Perpendicular offset for sharp angle
        c1x = ax + unitX * alongDist + perpX * perpDist;
        c1y = ay + unitY * alongDist + perpY * perpDist;
    }

    if (toSide) {
        // When side is specified, use perpendicular offset to create sharp angle
        if (toSide === 'top') {
            c2x = bx + perpX * tightOffset;
            c2y = by - (rTo + tightOffset * 0.5);
        }
        else if (toSide === 'bottom') {
            c2x = bx + perpX * tightOffset;
            c2y = by + (rTo + tightOffset * 0.5);
        }
        else if (toSide === 'left') {
            c2x = bx - (rTo + tightOffset * 0.5);
            c2y = by + perpY * tightOffset;
        }
        else if (toSide === 'right') {
            c2x = bx + (rTo + tightOffset * 0.5);
            c2y = by + perpY * tightOffset;
        }
    } else {
        // No side specified - create sharp angle by moving perpendicular to main direction
        // Move a small distance along main direction (backwards), then perpendicular
        const alongDist = dist * 0.1; // Very close along the line
        const perpDist = tightOffset; // Perpendicular offset for sharp angle
        c2x = bx - unitX * alongDist + perpX * perpDist;
        c2y = by - unitY * alongDist + perpY * perpDist;
    }

    return { c1x, c1y, c2x, c2y };
}
