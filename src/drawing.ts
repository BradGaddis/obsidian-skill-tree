import { nodeRadii, nodeRadius, fontSize } from "./renderer";
import { SkillNode } from "./skill_nodes/skill_node";
import { NodeShape } from "./skill_nodes/types";
import { SkillTreeView } from "./skilltreeview";
import { GetSelectedNodeId } from "./tree_manager";

let view: SkillTreeView;

export function InitDrawing(SkillTreeView: SkillTreeView) {
    view = SkillTreeView
}

export function drawOrthogonalArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineWidth: number) {
    const headLen = lineWidth * 2;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

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


    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw S-shaped line with 2 bends
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(corner1X, corner1Y);
    ctx.lineTo(corner2X, corner2Y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(y2 - corner2Y, x2 - corner2X);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
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
            case "in-progress":
            case "on-hold":
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


export function DrawCheckBox(n: SkillNode) {
    const context = view.context
    if (!context) return
    if (!n.userCompletable) return
    if (n.state !== 'in-progress') return

    let r = nodeRadii[n.id] || nodeRadius
    const minScreenSize = 14;
    const maxScreenSize = 24;
    const baseScreenSize = Math.min(maxScreenSize, Math.max(minScreenSize, r * 0.25));
    const checkboxSize = baseScreenSize / view.scale;

    // Calculate text position to place checkbox below text
    const lineHeight = fontSize / view.scale
    const isUnlinked = n.fileLink === ''
    const label = isUnlinked ? n.fileLink : n.fileLink || '' + ' [Unlinked]'
    const words = (label || '').split(/\s+/).filter(Boolean)
    const lines: string[] = []
    for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '))
    }
    const totalLines = lines.length + (isUnlinked ? 1 : 0)
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

    // if (n.state === 'complete') {
    //     context.strokeStyle = '#2e7d32';
    //     context.lineWidth = 2.5 / view.scale;
    //     context.lineCap = 'round';
    //     context.lineJoin = 'round';
    //     context.beginPath();
    //     context.moveTo(checkboxX + checkboxSize * 0.25, checkboxY + checkboxSize * 0.5);
    //     context.lineTo(checkboxX + checkboxSize * 0.45, checkboxY + checkboxSize * 0.7);
    //     context.lineTo(checkboxX + checkboxSize * 0.75, checkboxY + checkboxSize * 0.3);
    //     context.stroke();
    //     context.lineCap = 'butt';
    //     context.lineJoin = 'miter';
    // }
}
