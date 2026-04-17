import { ExpDisplayData } from "../types/interfaces";
import { view } from "../utils/globals";

let cachedCurrentExp: number = 0;
let cachedAggregateExp: number = 0;


export function GetTotalExp(mode: 'current' | 'aggregate' | 'both' = 'current'): { current: number; aggregate: number; total: number } {
    if (mode === 'current') {
        return { current: cachedCurrentExp, aggregate: 0, total: 0 };
    } else if (mode === 'aggregate') {
        return {
            current: 0, aggregate: cachedAggregateExp, total: cachedAggregateExp
        };
    } else {
        return {
            current: cachedCurrentExp, aggregate: cachedAggregateExp, total: cachedAggregateExp
        };
    }
}


export function CalculateLevel(exp: number, multiplier: number = 1): number {
    return Math.max(0, Math.floor(Math.sqrt(Math.max(0, exp) / multiplier)));
}

export function GetExpForLevel(level: number): number {
    return level * level;
}

export function GetExpToNextLevel(currentExp: number): number {
    const currentLevel = CalculateLevel(currentExp);
    GetExpForLevel(currentLevel);
    const expForNext = GetExpForLevel(currentLevel + 1);
    return expForNext - currentExp;
}

export function calculateExpProgress(exp: number, level: number, multiplier: number): { expInLevel: number; expForNextLevel: number } {
    const expInLevel = exp - (level * level * multiplier);
    const expForNextLevel = (2 * level + 1) * multiplier;
    return { expInLevel, expForNextLevel };
}

export function formatExpFraction(exp: number, total: number): string {
    return `${exp} / ${total}`;
}

export function getExpDisplayData(): ExpDisplayData | null {
    if (!view?.settings) return null;

    const multiplier = view.settings.levelMultiplier || 1;
    const levelMode = view.settings.levelDisplayMode || 'current';
    const expMode = view.settings.expDisplayMode || 'current';

    const currentExp = view.settings.currentExp || 0;
    const totalExp = view.settings.totalExp || 0;
    const aggregateExp = view.settings.aggregateExp || 0;
    const aggregateTotalExp = view.settings.aggregateTotalExp || 0;

    const currentLevel = CalculateLevel(currentExp, multiplier);
    const aggregateLevel = CalculateLevel(aggregateExp, multiplier);

    const currentProgress = calculateExpProgress(currentExp, currentLevel, multiplier);
    const aggregateProgress = calculateExpProgress(aggregateExp, aggregateLevel, multiplier);

    return {
        multiplier,
        levelMode,
        expMode,
        currentExp,
        totalExp,
        aggregateExp,
        aggregateTotalExp,
        currentLevel,
        aggregateLevel,
        currentProgress,
        aggregateProgress,
    };
}
