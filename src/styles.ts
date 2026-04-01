
export const SKILL_TREE_STYLES = {
    'gamified': {
        name: 'Gamified',
        backgroundColor: '#1a1410',
        nodeColors: {
            complete: { fill: '#ffd700', stroke: '#ffaa00' },
            inProgress: { fill: '#6a5acd', stroke: '#4b0082' },
            onHold: { fill: '#ff4757', stroke: '#ff6b81' },
            unavailable: { fill: '#3a3a3a', stroke: '#2a2a2a' },
            optional: { fill: '#87ceeb', stroke: '#5fb0db' },
            error: { fill: '#dc143c', stroke: '#8b0000' }
        },
        edgeColor: '#ffd700',
        edgeGlow: true,
        nodeShape: 'hexagon',
        animated: true,
        edgeStyle: 'gradient'
    }
};
