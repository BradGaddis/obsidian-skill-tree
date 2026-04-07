import { SkillNode } from "./skill_node";
import { RepeatResetMode } from "src/types";

export class RepeatingNode extends SkillNode {
    readonly nodeTypeName = 'RepeatingNode';

    get optional(): boolean { return false; }
    get checkpoint(): boolean { return false; }
    get repeating(): boolean { return true; }
    get hasTasks(): boolean { return false; }
    get treeLink(): string | null { return null; }

    repeatCount: number = 0;
    repeatMax: number | undefined = undefined;
    repeatReset: RepeatResetMode = 'cooldown';
    repeatCooldownHours: number | undefined = undefined;
    repeatLastCompleted: number | null = null;
    repeatResetTime: number | null = null;
    showRepeatCount: boolean = false;

    constructor(data: Partial<RepeatingNode> = {}) {
        super(data);
        this.repeatCount = data.repeatCount ?? 0;
        this.repeatMax = data.repeatMax;
        this.repeatReset = data.repeatReset ?? 'cooldown';
        this.repeatCooldownHours = data.repeatCooldownHours;
        this.repeatLastCompleted = data.repeatLastCompleted ?? null;
        this.repeatResetTime = data.repeatResetTime ?? null;
        this.showRepeatCount = data.showRepeatCount ?? false;
    }

    shouldResetRepeat(): boolean {
        if (this.repeatCount === 0) return false;
        if (this.repeatMax !== undefined && this.repeatCount >= this.repeatMax) return false;
        const now = Date.now();
        if (!this.repeatCooldownHours) return false;
        const cooldownMs = this.repeatCooldownHours * 60 * 60 * 1000;
        return (now - this.repeatLastCompleted!) >= cooldownMs;
    }

    isRepeatOnCooldown(): boolean {
        if (this.repeatCount === 0) return false;
        if (this.repeatMax !== undefined && this.repeatCount >= this.repeatMax) return false;
        return !this.shouldResetRepeat();
    }

    getResetDisplayText(): string {
        if (!this.repeatCooldownHours) return 'Resets: --';
        const now = Date.now();
        if (!this.repeatLastCompleted) {
            this.repeatLastCompleted = now;
            this.repeatCount = 1;
        }
        const cooldownMs = this.repeatCooldownHours * 60 * 60 * 1000;
        const resetTime = this.repeatLastCompleted + cooldownMs;
        const remaining = resetTime - now;
        if (remaining <= 0) {
            return `Resets in: ${this.formatCooldownTime(this.repeatCooldownHours)}`;
        }
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        const secs = Math.floor((remaining % (60 * 1000)) / 1000);
        if (hours > 0) {
            return `Resets in: ${hours}h ${mins}m`;
        }
        if (mins > 0) {
            return `Resets in: ${mins}m`;
        }
        return `Resets in: ${secs}s`;
    }

    private formatCooldownTime(hours: number): string {
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            if (remainingHours > 0) {
                return `${days}d ${remainingHours}h`;
            }
            return `${days}d`;
        }
        if (hours >= 1) {
            const mins = Math.round((hours % 1) * 60);
            if (mins > 0) {
                return `${Math.floor(hours)}h ${mins}m`;
            }
            return `${Math.floor(hours)}h`;
        }
        return `${Math.round(hours * 60)}m`;
    }

    handleRepeatComplete(): void {
        this.repeatCount++;
        this.repeatLastCompleted = Date.now();
        this.repeatResetTime = null;
    }

    resetRepeat(): void {
        this.state = 'inProgress';
    }

    validate(): void {
        super.validate()
        if (this.shouldResetRepeat() && this.state !== 'onHold') {
            this.state = 'inProgress'
            this.informFromNodes()
        }
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            repeatCount: this.repeatCount,
            repeatMax: this.repeatMax,
            repeatReset: this.repeatReset,
            repeatCooldownHours: this.repeatCooldownHours,
            repeatLastCompleted: this.repeatLastCompleted,
            repeatResetTime: this.repeatResetTime,
        };
    }

    static fromJSON(data: any): RepeatingNode {
        return new RepeatingNode(data);
    }
}
