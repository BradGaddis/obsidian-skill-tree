import { nodeRadii, nodeRadius } from "src/renderer";
import { SkillNode } from "src/skill_nodes/skill_node";
import { GetNodes } from "../tree_manager";

let view: any;

export function InitCollisionDetector(skillTreeView: any): void {
    view = skillTreeView;
}

export function isPositionOccupied(x: number, y: number, radius: number, excludeNodeId?: string | number): boolean {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (excludeNodeId && node.id === excludeNodeId) continue;
        const nodeRadius = nodeRadii[node.id] || (view?.settings?.nodeRadius ?? 40);
        const minDist = radius + nodeRadius + 10;
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < minDist * minDist) {
            return true;
        }
    }
    return false;
}

export function findNearestEmptyPosition(x: number, y: number, radius: number): { x: number, y: number } {
    const maxIterations = 50;
    
    if (!isPositionOccupied(x, y, radius)) {
        return { x: Math.round(x), y: Math.round(y) };
    }
    
    for (let i = 1; i <= maxIterations; i++) {
        const angleStep = (Math.PI * 2) / (i * 4);
        for (let j = 0; j < i * 4; j++) {
            const angle = j * angleStep;
            const dist = i * 30;
            const newX = x + Math.cos(angle) * dist;
            const newY = y + Math.sin(angle) * dist;
            if (!isPositionOccupied(newX, newY, radius)) {
                return { x: Math.round(newX), y: Math.round(newY) };
            }
        }
    }
    
    return { x: Math.round(x + 200), y: Math.round(y + 200) };
}

export function pushNodeFromCollision(targetX: number, targetY: number, draggingNode: SkillNode): { x: number, y: number } {
    const minMargin = 20;
    const maxIterations = 50;
    const nodes = GetNodes();
    const draggingRadius = nodeRadii[draggingNode.id] || (view?.settings?.nodeRadius ?? 40);

    let currentX = targetX;
    let currentY = targetY;

    for (let i = 0; i < maxIterations; i++) {
        let hasCollision = false;

        for (const otherNode of nodes.values()) {
            if (otherNode.id === draggingNode.id) continue;

            const otherRadius = nodeRadii[otherNode.id] || (view?.settings?.nodeRadius ?? 40);
            const minDistance = draggingRadius + otherRadius + minMargin;

            const dx = currentX - otherNode.x;
            const dy = currentY - otherNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                hasCollision = true;
                if (distance < 0.001) {
                    const angle = Math.random() * Math.PI * 2;
                    currentX = otherNode.x + Math.cos(angle) * minDistance;
                    currentY = otherNode.y + Math.sin(angle) * minDistance;
                } else {
                    const pushAngle = Math.atan2(dy, dx);
                    currentX = otherNode.x + Math.cos(pushAngle) * minDistance;
                    currentY = otherNode.y + Math.sin(pushAngle) * minDistance;
                }
                break;
            }
        }

        if (!hasCollision) {
            return { x: Math.round(currentX), y: Math.round(currentY) };
        }
    }

    return { x: Math.round(currentX), y: Math.round(currentY) };
}