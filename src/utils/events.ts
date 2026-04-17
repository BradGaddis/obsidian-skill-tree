type EventCallback = (...args: any[]) => void;

class EventEmitter {
    private events: Map<string, EventCallback[]> = new Map();

    on(event: string, callback: EventCallback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }

    off(event: string, callback: EventCallback) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event: string, ...args: any[]) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(...args));
        }
    }
}

export const skillTreeEvents = new EventEmitter();

export const EVENTS = {
    TREE_ADDED: 'tree:added',
    TREE_SWITCHED: 'tree:switched',
    TREE_DELETED: 'tree:deleted',
    NODES_CHANGED: 'nodes:changed',
    NODE_UPDATED: 'node:updated',
} as const;
