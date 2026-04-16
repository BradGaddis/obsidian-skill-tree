import { GetNodes } from "../data/tree_manager";
import { LOOP_UPPER_LIMIT } from "../types/constants";
import { nodeRadii } from "../rendering/renderer";
import { SkillNode } from "../nodes/skill_node";
import { hitNode, isDragging } from "../handlers/interactions";


export function isPositionOccupied(x: number, y: number, radius: number, excludeNodeId?: string | number): boolean {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        if (excludeNodeId && node.id === excludeNodeId) continue;
        const nodeRadius = nodeRadii[node.id];
        if (nodeRadius === undefined) {
            console.error(`nodeRadii missing for node ${node.id}`);
            continue;
        }
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

function pushOtherNodesFromNode(draggingNode: SkillNode): void {
    const minMargin = 20;
    const nodes = GetNodes();
    const draggingRadius = nodeRadii[draggingNode.id];
    if (draggingRadius === undefined) {
        console.error(`nodeRadii missing for node ${draggingNode.id}`);
        return;
    }

    for (let iteration = 0; iteration < LOOP_UPPER_LIMIT; iteration++) {
        let anyMoved = false;

        for (const node of nodes.values()) {
            if (node.id === draggingNode.id) continue;

            const otherRadius = nodeRadii[node.id];
            if (otherRadius === undefined) {
                console.error(`nodeRadii missing for node ${node.id}`);
                continue;
            }
            const dx = node.x - draggingNode.x;
            const dy = node.y - draggingNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = draggingRadius + otherRadius + minMargin;

            if (dist < minDist && dist > 0) {
                const pushX = draggingNode.x + (dx / dist) * minDist;
                const pushY = draggingNode.y + (dy / dist) * minDist;
                const newX = Math.round(pushX);
                const newY = Math.round(pushY);

                if (node.x !== newX || node.y !== newY) {
                    node.x = newX;
                    node.y = newY;
                    anyMoved = true;
                }
            }
        }

        for (const node of nodes.values()) {
            if (node.id === draggingNode.id) continue;

            const otherRadius = nodeRadii[node.id];
            if (otherRadius === undefined) {
                console.error(`nodeRadii missing for node ${node.id}`);
                continue;
            }
            const otherNodes = GetNodes();

            for (const otherNode of otherNodes.values()) {
                if (otherNode.id === node.id || otherNode.id === draggingNode.id) continue;

                const otherNodeRadius = nodeRadii[otherNode.id];
                if (otherNodeRadius === undefined) {
                    console.error(`nodeRadii missing for node ${otherNode.id}`);
                    continue;
                }
                const dx = node.x - otherNode.x;
                const dy = node.y - otherNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = otherRadius + otherNodeRadius + minMargin;

                if (dist < minDist && dist > 0) {
                    const pushX = otherNode.x + (dx / dist) * minDist;
                    const pushY = otherNode.y + (dy / dist) * minDist;
                    const newX = Math.round(pushX);
                    const newY = Math.round(pushY);

                    if (node.x !== newX || node.y !== newY) {
                        node.x = newX;
                        node.y = newY;
                        anyMoved = true;
                    }
                }
            }
        }

        if (!anyMoved) break;
    }
}

function resolveOverlappingNodes(): void {
    const nodes = GetNodes();
    for (const node of nodes.values()) {
        const r = nodeRadii[node.id];
        if (r === undefined) {
            console.error(`nodeRadii missing for node ${node.id}`);
            continue;
        }
        if (isPositionOccupied(node.x, node.y, r, node.id)) {
            const newPos = findNearestEmptyPosition(node.x, node.y, r);
            node.x = newPos.x;
            node.y = newPos.y;
        }
    }
}

export function HandleCollision() {
    if (hitNode && isDragging) {
        pushOtherNodesFromNode(hitNode);
    } else {
        resolveOverlappingNodes();
    }
}
