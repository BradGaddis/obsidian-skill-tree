import { nodeRadii, timerLabelBounds } from "./renderer";
import { RepeatingNode } from "../nodes/repeating_node";
import { SkillNode } from "../nodes/skill_node";
import { NodeShape } from "../nodes/types";
import { GetSelectedNodeId } from "../data/tree_manager";
import { view } from "../utils/globals";


// NOTE: I am not smart enough to have wrote any of this on my own lol

const EDGE_STRAIGHT_LINE_THRESHOLD = 2.5;

function WithShapePath(ctx: CanvasRenderingContext2D, fn: () => void): void {
    ctx.beginPath();
    fn();
    ctx.closePath();
}


export function ParseCSSColor(s: string) {
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
    if (m && m[1]) {
        const parts = m[1].split(',').map(p => parseFloat(p));
        return { r: parts[0], g: parts[1], b: parts[2] };
    }
    return null;
}


export function DrawOrthogonalArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineWidth: number, color: string, centerX?: number, centerY?: number) {
    const headLen = lineWidth * 2.5;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    const dx = x2 - x1;
    const dy = y2 - y1;
    const midSegmentLength = Math.abs(dx) >= Math.abs(dy) ? Math.abs(dy) : Math.abs(dx);
    const useStraightLine = midSegmentLength < EDGE_STRAIGHT_LINE_THRESHOLD;

    const arrowTipX = centerX ?? x2;
    const arrowTipY = centerY ?? y2;

    let corner2X: number, corner2Y: number;
    if (Math.abs(dx) >= Math.abs(dy)) {
        corner2X = midX;
        corner2Y = y2;
    } else {
        corner2X = x2;
        corner2Y = midY;
    }

    if (useStraightLine) {
        DrawStraightLine(ctx, x1, y1, x2, y2, headLen);
        DrawArrowHead(ctx, arrowTipX, arrowTipY, x1, y1, headLen, color);
    } else {
        DrawOrthogonalLine(ctx, x1, y1, x2, y2, midX, midY, headLen);
        DrawArrowHead(ctx, arrowTipX, arrowTipY, corner2X, corner2Y, headLen, color);
    }
}


function DrawStraightLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, headLen: number): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const baseX = x2 - headLen * Math.cos(angle);
    const baseY = y2 - headLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(baseX, baseY);
    ctx.stroke();
}


function DrawOrthogonalLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, midX: number, midY: number, headLen: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let corner1X: number, corner1Y: number;
    let corner2X: number, corner2Y: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
        corner1X = midX; corner1Y = y1;
        corner2X = midX; corner2Y = y2;
    } else {
        corner1X = x1; corner1Y = midY;
        corner2X = x2; corner2Y = midY;
    }

    const angle = Math.atan2(y2 - corner2Y, x2 - corner2X);
    const baseX = x2 - headLen * Math.cos(angle);
    const baseY = y2 - headLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(corner1X, corner1Y);
    ctx.lineTo(corner2X, corner2Y);
    ctx.lineTo(baseX, baseY);
    ctx.stroke();
}


function DrawArrowHead(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, refX: number, refY: number, headLen: number, color: string): void {
    const arrowHalfAngle = Math.PI / 6;
    const arrowAngle = Math.atan2(tipY - refY, tipX - refX);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - headLen * Math.cos(arrowAngle - arrowHalfAngle), tipY - headLen * Math.sin(arrowAngle - arrowHalfAngle));
    ctx.lineTo(tipX - headLen * Math.cos(arrowAngle + arrowHalfAngle), tipY - headLen * Math.sin(arrowAngle + arrowHalfAngle));
    ctx.closePath();
    ctx.fill();
}


export function DrawSelectedNode(node: SkillNode) {
    const context = view.context
    if (!context) return

    if (GetSelectedNodeId() === node.id) {
        switch (node.state) {
            case "complete":
            case "inProgress":
            case "onHold":
            default:
                context.strokeStyle = 'rgba(255,165,0,0.95)';
                break;
        }
    }

}


export function DrawNodeShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    shape: NodeShape
): void {
    switch (shape) {
        case 'hexagon':
            DrawHexagon(ctx, x, y, radius);
            break;
        case 'star':
            DrawStar(ctx, x, y, radius);
            break;
        case 'diamond':
            DrawDiamond(ctx, x, y, radius);
            break;
        case 'square':
            DrawSquare(ctx, x, y, radius);
            break;
        case 'repeat':
            DrawRepeat(ctx, x, y, radius);
            break;
        case 'tree':
            DrawTree(ctx, x, y, radius);
            break;
        case 'circle':
        default:
            WithShapePath(ctx, () => {
                ctx.arc(x, y, radius, 0, Math.PI * 2);
            });
            break;
    }
}


export function DrawRepeat(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    WithShapePath(ctx, () => {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2, true);
    });
}


export function DrawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    WithShapePath(ctx, () => {
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
    });
}


export function DrawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    WithShapePath(ctx, () => {
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius, y);
    });
}


export function DrawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number = 5): void {
    WithShapePath(ctx, () => {
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
    });
}


export function DrawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    WithShapePath(ctx, () => {
        const half = radius;
        ctx.rect(x - half, y - half, half * 2, half * 2);
    });
}


export function DrawTree(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    const TRUNK_WIDTH = 0.12;
    const TRUNK_HEIGHT = 0.5;
    const CANOPY_SPREAD = 0.8;
    const CANOPY_PEAK = 0.9;

    const trunkW = radius * TRUNK_WIDTH;
    const trunkH = radius * TRUNK_HEIGHT;
    const baseY = y + radius * 0.5;
    const topY = baseY - trunkH;
    const peakY = topY - radius * CANOPY_PEAK;
    const spread = radius * CANOPY_SPREAD;

    WithShapePath(ctx, () => {
        ctx.moveTo(x - trunkW, baseY);
        ctx.lineTo(x - trunkW, topY);

        ctx.bezierCurveTo(
            x - trunkW - radius * 0.15, topY - radius * 0.2,
            x - spread * 2, peakY + radius * 0.3,
            x - spread * 0.7, peakY + radius * 0.1
        );

        ctx.bezierCurveTo(
            x - spread * 0.1, peakY - radius * 0.3,
            x, peakY - radius * 0.1,
            x, peakY
        );

        ctx.bezierCurveTo(
            x, peakY - radius * 0.1,
            x + spread * 0.8, peakY - radius * 0.1,
            x + spread * 0.7, peakY + radius * 0.1
        );

        ctx.bezierCurveTo(
            x + spread * 2, peakY + radius * 0.3,
            x + trunkW + radius * 0.15, topY - radius * 0.2,
            x + trunkW, topY
        );

        ctx.lineTo(x + trunkW, baseY);

        ctx.lineTo(x + trunkW * 1.3, baseY + radius * 0.15);
        ctx.lineTo(x + trunkW * 1.9, baseY + radius * 0.08);
        ctx.lineTo(x, baseY + radius * 0.2);
        ctx.lineTo(x - trunkW * 1.9, baseY + radius * 0.10);
        ctx.lineTo(x - trunkW * 1.3, baseY + radius * 0.15);
    });
}


export function DrawCheckBox(n: SkillNode) {
    const context = view.context
    if (!context) return
    if (!n.userCompletable) return
    if (n.state !== 'inProgress') return

    let r = nodeRadii[n.id];
    if (r === undefined) {
        console.error(`nodeRadii missing for node ${n.id}`);
        return;
    }
    const minScreenSize = 14;
    const maxScreenSize = 24;
    const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25));
    const checkboxSize = baseScreenSize / view.scale;

    const lineHeight = view.settings.fontSize / view.scale

    const labelInfo = n.getDisplayLabel();
    const totalLines = labelInfo.lines.length + (labelInfo.label === '[unlinked]' ? 1 : 0)
    const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2
    const textBottomY = firstLineY + totalLines * lineHeight

    const checkboxX = n.x - checkboxSize / 2;
    const checkboxY = textBottomY + 4 / view.scale;

    context.strokeStyle = '#333';
    context.lineWidth = 2 / view.scale;
    context.beginPath();
    const checkboxRadius = checkboxSize * 0.15;
    context.moveTo(checkboxX + checkboxRadius, checkboxY);
    context.lineTo(checkboxX + checkboxSize - checkboxRadius, checkboxY);
    context.arcTo(checkboxX + checkboxSize, checkboxY, checkboxX + checkboxSize, checkboxY + checkboxRadius, checkboxRadius);
    context.lineTo(checkboxX + checkboxSize, checkboxY + checkboxSize - checkboxRadius);
    context.arcTo(checkboxX + checkboxSize, checkboxY + checkboxSize, checkboxX + checkboxSize - checkboxRadius, checkboxY + checkboxSize, checkboxRadius);
    context.lineTo(checkboxX + checkboxRadius, checkboxY + checkboxSize);
    context.arcTo(checkboxX, checkboxY + checkboxSize, checkboxX, checkboxY + checkboxSize - checkboxRadius, checkboxRadius);
    context.lineTo(checkboxX, checkboxY + checkboxRadius);

    context.arcTo(checkboxX, checkboxY, checkboxX + checkboxRadius, checkboxY, checkboxRadius);
    context.stroke();
}


export function DrawSubLabel(node: SkillNode, fillColor: string) {
    const context = view?.context;
    if (!context) return;

    if (node.nodeTypeName !== "RepeatingNode") return;

    const radius = nodeRadii[node.id];
    if (radius === undefined) {
        console.error(`nodeRadii missing for node ${node.id}`);
        return;
    }
    const labelWidth = radius * 2;
    const labelHeight = radius * 0.5;
    const padding = TIMER_LABEL_PADDING_PX / view.scale;
    const x = node.x;
    const y = node.y + radius + labelHeight / 2 + padding;

    DrawRepeatingNodeLabel(node as unknown as RepeatingNode, context, fillColor, x, y, labelWidth, labelHeight, padding);
}


function DrawRepeatingNodeLabel(node: RepeatingNode, context: CanvasRenderingContext2D, fillColor: string, x: number, y: number, labelWidth: number, labelHeight: number, padding: number) {
    if (!node.timerActive) return;

    const existingBounds = timerLabelBounds.get(String(node.id));

    if (existingBounds) {
        context.clearRect(existingBounds.x - 2, existingBounds.y - 2, existingBounds.width + 4, existingBounds.height + 4);
    }

    const cooldownMs = node.getCooldownMs?.();
    if (!cooldownMs || cooldownMs === 0) return;

    const text = node.getResetDisplayText?.() || '';

    context.save();
    context.font = `${labelHeight * TIMER_LABEL_FONT_SCALE}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const bgX = x - labelWidth / 2;
    const bgY = y - labelHeight / 2;

    context.fillStyle = fillColor;
    DrawRoundedRect(context, bgX, bgY, labelWidth, labelHeight, labelHeight * TIMER_LABEL_RADIUS_SCALE);
    context.fill();

    context.fillStyle = 'black';
    context.fillText(text, x, y);

    timerLabelBounds.set(String(node.id), {
        x: bgX - padding,
        y: bgY - padding,
        width: labelWidth + padding * 2,
        height: labelHeight + padding * 2
    });

    context.restore();
}


// NOTE: I am also not smart enough to have wrote this one my own
export function Blend(fromColor: string, toColor: string, t: number, a = 1) {
    try {
        const pa = ParseCSSColor(fromColor);
        const pb = ParseCSSColor(toColor);
        const ra = pa?.r ?? 255;
        const ga = pa?.g ?? 255;
        const ba = pa?.b ?? 255;
        const rb = pb?.r ?? 255;
        const gb = pb?.g ?? 255;
        const bb = pb?.b ?? 255;
        const r = Math.round(ra * (1 - t) + rb * t);
        const g = Math.round(ga * (1 - t) + gb * t);
        const b = Math.round(ba * (1 - t) + bb * t);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    } catch (ex) {
        return fromColor;
    }
};

export const TIMER_LABEL_FONT_SCALE = 0.35;
export const TIMER_LABEL_RADIUS_SCALE = 0.2;
export const TIMER_LABEL_PADDING_PX = 4;


export function DrawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
