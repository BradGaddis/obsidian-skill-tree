import { nodeRadii, nodeRadius } from "./renderer";
import { SkillNode } from "./skill_nodes/skill_node";
import { NodeShape } from "./skill_nodes/types";
import { SkillTreeView } from "./skilltreeview";
import { GetSelectedNodeId } from "./tree-manager";

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
