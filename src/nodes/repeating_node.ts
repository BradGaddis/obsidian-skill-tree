import { SkillNode } from "./skill_node";
import { RepeatResetMode } from "../types/types";
import { RecordSnapshot, SaveNodes } from "../data/recorder";
import { Update } from "../rendering/renderer";
import { settings } from "../utils/globals";
import { LabelInfo } from "types/interfaces";

export class RepeatingNode extends SkillNode {
    repeatCount: number = 0;
    repeatMax: number | undefined = undefined;
    repeatReset: RepeatResetMode = 'cooldown';
    repeatCooldownMinutes: number | undefined = undefined;
    repeatCooldownHours: number | undefined = undefined;
    repeatCooldownDays: number | undefined = undefined;
    repeatLastCompleted: number | null = null;
    repeatResetTime: number | null = null;
    showRepeatCount: boolean = false;
    timerActive: boolean;

    private timerId: number | null = null;

    readonly nodeTypeName = 'RepeatingNode';

    get linkable(): boolean { return false }

    constructor(data: Partial<RepeatingNode> = {}) {
        super(data);
        this.repeatCount = data.repeatCount ?? 0;
        this.repeatMax = data.repeatMax;
        this.repeatReset = data.repeatReset ?? 'cooldown';
        this.repeatCooldownMinutes = data.repeatCooldownMinutes;
        this.repeatCooldownHours = data.repeatCooldownHours;
        this.repeatCooldownDays = data.repeatCooldownDays;
        this.repeatLastCompleted = data.repeatLastCompleted ?? null;
        this.repeatResetTime = data.repeatResetTime ?? null;
        this.showRepeatCount = data.showRepeatCount ?? false;
        this.timerActive = data.timerActive ?? false
    }

    startTimer(): void {
        this.timerActive = true
        this.repeatLastCompleted = Date.now();
        this.repeatResetTime = null;
        this.startInterval();
    }

    private startInterval(): void {
        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return;

        this.timerId = window.setInterval(() => {
            if (this.shouldResetRepeat()) {
                this.autoReset();
            }
            this.emitTimerTick();
        }, 1000);
    }

    private emitTimerTick(): void {
        window.dispatchEvent(new CustomEvent('repeating-node-timer-tick', {
            detail: { nodeId: this.id }
        }));
    }

    stopTimer(): void {
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
        this.repeatLastCompleted = null;
        this.repeatResetTime = null;
        this.timerActive = false;
        Update()
    }

    getCooldownMs(): number {
        const minutes = this.repeatCooldownMinutes || 0;
        const hours = this.repeatCooldownHours || 0;
        const days = this.repeatCooldownDays || 0;
        return ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
    }

    shouldResetRepeat(): boolean {
        if ((this.repeatMax ?? 0) > 0 && this.repeatCount >= this.repeatMax!) return false;
        const now = Date.now();
        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return false;
        return (now - this.repeatLastCompleted!) >= cooldownMs;
    }

    isRepeatOnCooldown(): boolean {
        if (this.repeatCount === 0) return false;
        const max = this.repeatMax ?? 0;
        if (max > 0 && this.repeatCount >= max) return false;
        return !this.shouldResetRepeat();
    }

    getResetDisplayText(): string {
        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return 'Resets: --';
        if (!this.repeatLastCompleted) return 'Resets: --';

        const now = Date.now();
        const resetTime = this.repeatLastCompleted + cooldownMs;
        const remaining = resetTime - now;
        if (remaining <= 0) {
            return `Resets in: ${this.formatCooldownTime(cooldownMs)}`;
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

    private formatCooldownTime(cooldownMs: number): string {
        const totalHours = cooldownMs / (60 * 60 * 1000);
        if (totalHours >= 24) {
            const days = Math.floor(totalHours / 24);
            const remainingHours = totalHours % 24;
            if (remainingHours > 0) {
                return `${days}d ${remainingHours}h`;
            }
            return `${days}d`;
        }
        if (totalHours >= 1) {
            const mins = Math.round((totalHours % 1) * 60);
            if (mins > 0) {
                return `${Math.floor(totalHours)}h ${mins}m`;
            }
            return `${Math.floor(totalHours)}h`;
        }
        return `${Math.round(totalHours * 60)}m`;
    }


    autoReset(): void {
        if (this.state != "complete") {
            return
        }


        this.repeatCount++;
        this.exp = settings.defaultExp * (this.repeatCount + 1)
        this.state = 'inProgress';
        this.repeatLastCompleted = Date.now();
        this.stopTimer();
        Update()
    }

    getTimerLabelInfo(): { label: string, lines: string[] } | null {
        if (this.state === 'complete') return null;

        const cooldownMs = this.getCooldownMs();

        if (cooldownMs === 0) return null;

        const max = this.repeatMax ?? 0;
        if (this.isRepeatOnCooldown() || (max > 0 && this.repeatCount >= max)) {
            return {
                label: this.getResetDisplayText(),
                lines: [this.getResetDisplayText()]
            };
        }

        return null;
    }


    getDisplayLabel(): LabelInfo {
        return { label: this.displayText || "Repeating", lines: [this.displayText || "Repeating"] };
    }


    resetRepeatCount() {
        this.repeatCount = 0;
        this.exp = settings.defaultExp
        this.repeatLastCompleted = null;
        this.state = 'inProgress'
        this.repeatResetTime = null;
        RecordSnapshot();
        SaveNodes();
        Update();
    }

    cascadeTo(): void {
        if (this.to.length == 0) {
            return
        }

        for (const to of this.to) {
            to.validate();
        }
    }

    validate(): void {
        // this.calculateExpFromSources()
        super.validate()


        if (this.state === 'complete') {
            if (!this.timerActive) {
                this.startTimer();
                Update();
            } else if (this.timerId === null) {
                this.startInterval();
                Update();
            }
        } else {
            if (this.timerActive) {
                this.stopTimer();
            }
        }
    }

    toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            repeatCount: this.repeatCount,
            repeatMax: this.repeatMax,
            repeatReset: this.repeatReset,
            repeatCooldownMinutes: this.repeatCooldownMinutes,
            repeatCooldownHours: this.repeatCooldownHours,
            repeatCooldownDays: this.repeatCooldownDays,
            repeatLastCompleted: this.repeatLastCompleted,
            repeatResetTime: this.repeatResetTime,
            timerActive: this.timerActive,
            // timerId: this.timerId,

        };
    }

    static fromJSON(data: any): RepeatingNode {
        return new RepeatingNode(data);
    }

}
