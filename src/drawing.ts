import { nodeRadii, nodeRadius, fontSize } from "./renderer";
import { SkillNode } from "./skill_nodes/skill_node";
import { NodeShape } from "./skill_nodes/types";
import { SkillTreeView } from "./skilltreeview";
import { GetSelectedNodeId } from "./tree_manager";

let view: SkillTreeView;

export function InitDrawing(SkillTreeView: SkillTreeView) {
    view = SkillTreeView
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

export function drawOrthogonalArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineWidth: number, color: string) {
    const headLen = lineWidth * 2.5;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const arrowHalfAngle = Math.PI / 6;

    let corner1X: number, corner1Y: number;
    let corner2X: number, corner2Y: number;

    const dx = x2 - x1;
    const dy = y2 - y1;

    // If horizontal distance >= vertical, go horizontal first (S-shape)
    if (Math.abs(dx) >= Math.abs(dy)) {
        corner1X = midX; corner1Y = y1;
        corner2X = midX; corner2Y = y2;
    } else {
        corner1X = x1; corner1Y = midY;
        corner2X = x2; corner2Y = midY;
    }

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // Draw line, stopping at arrow base
    const angle = Math.atan2(y2 - corner2Y, x2 - corner2X);
    const baseX = x2 - headLen * Math.cos(angle);
    const baseY = y2 - headLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(corner1X, corner1Y);
    ctx.lineTo(corner2X, corner2Y);
    ctx.lineTo(baseX, baseY);
    ctx.stroke();

    // Draw arrowhead triangle on top
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - arrowHalfAngle), y2 - headLen * Math.sin(angle - arrowHalfAngle));
    ctx.lineTo(x2 - headLen * Math.cos(angle + arrowHalfAngle), y2 - headLen * Math.sin(angle + arrowHalfAngle));
    ctx.closePath();
    ctx.fill();
}




export function DrawSelectedNode(node: SkillNode) {
    const context = view.context
    if (!context) return

    if (GetSelectedNodeId() === node.id) {
        // TODO: fill out with specific states | add settings so users can change
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
            drawSquare(ctx, x, y, radius);
            break;
        case 'repeat': //TODO: make this something more reasonable
            drawRepeat(ctx, x, y, radius);
            break;
        case 'circle':
        default:
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.closePath();
            break;
    }
}

export function drawRepeat(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2, true);
    ctx.closePath();
}


export function DrawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
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


export function DrawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
}


export function DrawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number = 5): void {
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

export function drawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    const half = radius;
    ctx.rect(x - half, y - half, half * 2, half * 2);
    ctx.closePath();
}

export function DrawCheckBox(n: SkillNode) {
    const context = view.context
    if (!context) return
    if (!n.userCompletable) return
    if (n.state !== 'inProgress') return

    let r = nodeRadii[n.id] || nodeRadius
    const minScreenSize = 14;
    const maxScreenSize = 24;
    const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25));
    const checkboxSize = baseScreenSize / view.scale;

    // Calculate text position to place checkbox below text
    const lineHeight = fontSize / view.scale
    
    let label = '';
    if (n.displayText && n.displayText.trim()) {
        label = n.displayText;
    } else if (n.fileLink) {
        const filename = n.fileLink.split('/').pop()?.replace('.md', '') || n.fileLink;
        label = filename;
    } else {
        label = '[unlinked]';
    }
    
    const words = (label || '').split(/\s+/).filter(Boolean)
    const lines: string[] = []
    for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '))
    }
    const totalLines = lines.length + (label === '[unlinked]' ? 1 : 0)
    const firstLineY = n.y - ((totalLines - 1) * lineHeight) / 2
    const textBottomY = firstLineY + totalLines * lineHeight

    // Position checkbox below the text
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
