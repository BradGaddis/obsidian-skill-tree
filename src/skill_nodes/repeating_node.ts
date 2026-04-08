import { SkillNode } from "./skill_node";
import { RepeatResetMode } from "src/types";
import { SkillTreeView } from "src/skilltreeview";
import { RecordSnapshot, SaveNodes } from "src/recorder";
import { Render } from "src/renderer";
import * as S from "../styles";

export class RepeatingNode extends SkillNode {
    readonly nodeTypeName = 'RepeatingNode';

    private timerId: number | null = null;

    repeatCount: number = 0;
    repeatMax: number | undefined = undefined;
    repeatReset: RepeatResetMode = 'cooldown';
    timerActive: boolean = false;
    repeatCooldownMinutes: number | undefined = undefined;
    repeatCooldownHours: number | undefined = undefined;
    repeatCooldownDays: number | undefined = undefined;
    repeatLastCompleted: number | null = null;
    repeatResetTime: number | null = null;
    showRepeatCount: boolean = false;

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
    }

    startTimer(): void {
        this.stopTimer();
        this.timerActive = true
        this.repeatLastCompleted = Date.now();
        this.repeatCount++;
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
    }

    getCooldownMs(): number {
        const minutes = this.repeatCooldownMinutes || 0;
        const hours = this.repeatCooldownHours || 0;
        const days = this.repeatCooldownDays || 0;
        return ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
    }

    shouldResetRepeat(): boolean {
        if (this.repeatCount === 0) return false;
        if (this.repeatMax !== undefined && this.repeatCount >= this.repeatMax) return false;
        const now = Date.now();
        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return false;
        return (now - this.repeatLastCompleted!) >= cooldownMs;
    }

    isRepeatOnCooldown(): boolean {
        if (this.repeatCount === 0) return false;
        if (this.repeatMax !== undefined && this.repeatCount >= this.repeatMax) return false;
        return !this.shouldResetRepeat();
    }

    getResetDisplayText(): string {
        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return 'Resets: --';
        const now = Date.now();
        if (!this.repeatLastCompleted) {
            this.repeatLastCompleted = now;
            this.repeatCount = 1;
        }
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

    handleRepeatComplete(): void {
        this.repeatCount++;
        this.repeatLastCompleted = Date.now();
        this.repeatResetTime = null;
    }

    isTimerActive(): boolean {
        return this.repeatLastCompleted !== null;
    }

    resetRepeat(): void {
        this.state = 'inProgress';
    }

    autoReset(): boolean {
        if (this.shouldResetRepeat() && this.state !== 'onHold' && this.state !== 'complete') {
            this.state = 'inProgress';
            this.cascadeTo();
            Render()
            return true;
        }
        return false;
    }

    getTimerLabelInfo(): { label: string, lines: string[] } | null {
        if (this.state === 'complete') return null;

        const cooldownMs = this.getCooldownMs();
        if (cooldownMs === 0) return null;

        if (this.isRepeatOnCooldown() || (this.repeatMax !== undefined && this.repeatCount >= this.repeatMax)) {
            return {
                label: this.getResetDisplayText(),
                lines: [this.getResetDisplayText()]
            };
        }

        return null;
    }

    getEditModalRows(view: SkillTreeView, content: HTMLElement): void {
        const minutesRow = content.createEl('div');
        minutesRow.style.cssText = S.FORM_ROW;

        const minutesLabel = minutesRow.createEl('label');
        minutesLabel.textContent = 'Cooldown (minutes)';
        minutesLabel.style.cssText = S.FORM_LABEL;

        const minutesInput = minutesRow.createEl('input') as HTMLInputElement;
        minutesInput.type = 'number';
        minutesInput.min = '0';
        minutesInput.placeholder = '0';
        minutesInput.value = String(this.repeatCooldownMinutes || 0);
        minutesInput.style.cssText = S.FORM_INPUT;
        minutesInput.onchange = () => {
            this.repeatCooldownMinutes = parseInt(minutesInput.value, 10) || 0;
            RecordSnapshot();
            SaveNodes();
            Render();
        };

        const hoursRow = content.createEl('div');
        hoursRow.style.cssText = S.FORM_ROW;

        const hoursLabel = hoursRow.createEl('label');
        hoursLabel.textContent = 'Cooldown (hours)';
        hoursLabel.style.cssText = S.FORM_LABEL;

        const hoursInput = hoursRow.createEl('input') as HTMLInputElement;
        hoursInput.type = 'number';
        hoursInput.min = '0';
        hoursInput.placeholder = '0';
        hoursInput.value = String(this.repeatCooldownHours || 0);
        hoursInput.style.cssText = S.FORM_INPUT;
        hoursInput.onchange = () => {
            this.repeatCooldownHours = parseInt(hoursInput.value, 10) || 0;
            RecordSnapshot();
            SaveNodes();
            Render();
        };

        const daysRow = content.createEl('div');
        daysRow.style.cssText = S.FORM_ROW;

        const daysLabel = daysRow.createEl('label');
        daysLabel.textContent = 'Cooldown (days)';
        daysLabel.style.cssText = S.FORM_LABEL;

        const daysInput = daysRow.createEl('input') as HTMLInputElement;
        daysInput.type = 'number';
        daysInput.min = '0';
        daysInput.placeholder = '0';
        daysInput.value = String(this.repeatCooldownDays || 0);
        daysInput.style.cssText = S.FORM_INPUT;
        daysInput.onchange = () => {
            this.repeatCooldownDays = parseInt(daysInput.value, 10) || 0;
            RecordSnapshot();
            SaveNodes();
            Render();
        };

        const maxRow = content.createEl('div');
        maxRow.style.cssText = S.FORM_ROW;

        const maxLabel = maxRow.createEl('label');
        maxLabel.textContent = 'Max completions (optional)';
        maxLabel.style.cssText = S.FORM_LABEL;

        const maxInput = maxRow.createEl('input') as HTMLInputElement;
        maxInput.type = 'number';
        maxInput.min = '1';
        maxInput.placeholder = 'Unlimited';
        maxInput.value = this.repeatMax ? String(this.repeatMax) : '';
        maxInput.style.cssText = S.FORM_INPUT;
        maxInput.onchange = () => {
            this.repeatMax = maxInput.value ? parseInt(maxInput.value, 10) : undefined;
            RecordSnapshot();
            SaveNodes();
            Render();
        };

        const countRow = content.createEl('div');
        countRow.style.cssText = S.FORM_ROW;

        const countLabel = countRow.createEl('label');
        countLabel.textContent = `Repeat count: ${this.repeatCount}`;
        countLabel.style.cssText = 'font-size:14px;color:var(--text-muted);';

        const resetRow = content.createEl('div');
        resetRow.style.cssText = S.BTN_ROW;

        const resetBtn = resetRow.createEl('button', { text: 'Reset Repeat' });
        resetBtn.style.cssText = S.BTN_SECONDARY;
        resetBtn.onclick = () => {
            this.repeatCount = 0;
            this.repeatLastCompleted = null;
            this.repeatResetTime = null;
            RecordSnapshot();
            SaveNodes();
            Render();
        };
    }

    validate(): void {
        super.validate()

        if (this.state === 'complete') {
            if (!this.isTimerActive()) {
                this.startTimer();
                Render();
            } else if (this.timerId === null) {
                this.startInterval();
                Render();
            }
        } else {
            if (this.isTimerActive()) {
                this.stopTimer();
            }
        }

        if (this.shouldResetRepeat() && this.state !== 'onHold') {
            this.state = 'inProgress'
            this.cascadeTo()
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
        };
    }

    static fromJSON(data: any): RepeatingNode {
        return new RepeatingNode(data);
    }

}
