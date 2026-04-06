import { App } from "obsidian";

export interface FuzzyResult {
    item: string;
    score: number;
}

export function getVaultFiles(app: App): string[] {
    return app.vault.getFiles()
        .filter(f => f.extension === 'md')
        .map(f => f.path)
        .sort();
}

export function fuzzyMatch(items: string[], query: string, limit = 10): FuzzyResult[] {
    if (!query) {
        return items.slice(0, limit).map(f => ({ item: f, score: 0 }));
    }
    
    const lowerQuery = query.toLowerCase();
    const results: FuzzyResult[] = [];
    
    for (const item of items) {
        const lowerItem = item.toLowerCase();
        let score = 0;
        
        if (lowerItem === lowerQuery) score = 1000;
        else if (lowerItem.startsWith(lowerQuery)) score = 500;
        else if (lowerItem.includes(lowerQuery)) score = 100;
        
        if (score > 0) results.push({ item, score });
    }
    
    return results
        .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
        .slice(0, limit);
}