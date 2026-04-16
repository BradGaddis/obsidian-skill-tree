import { view } from "../utils/globals";
import { clamp } from "../types/utils";

function getContainerRect(): DOMRect {
    const container = view.canvasWrap || view.containerEl;
    return container.getBoundingClientRect();
}

function calculateModalDimensions(modal: HTMLElement): { width: number; height: number } {
    return { width: modal.offsetWidth || 340, height: modal.offsetHeight || 200 };
}

function applyPosition(modal: HTMLElement, left: number, top: number): void {
    modal.style.left = `${Math.round(left)}px`;
    modal.style.top = `${Math.round(top)}px`;
    modal.style.right = 'auto';
    modal.style.transform = 'none';
}

function isInteractiveElement(target: Element | null): boolean {
    if (!target) return false;
    try {
        return !!target.closest('input,textarea,select,button,a,[contenteditable="true"]');
    } catch {
        return false;
    }
}

export class ModalDragHandler {
    private dragging = false;
    private activePointerId: number | null = null;
    private initialLeft = 0;
    private initialTop = 0;
    private initialPointerX = 0;
    private initialPointerY = 0;
    private modal: HTMLElement;
    private key: string;
    private handlers: { down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void };

    constructor(modal: HTMLElement, key: string) {
        this.modal = modal;
        this.key = key;
        this.handlers = {
            down: this.onPointerDown.bind(this),
            move: this.onPointerMove.bind(this),
            up: this.onPointerUp.bind(this),
            cancel: this.onPointerCancel.bind(this)
        };
    }

    private onPointerDown(e: PointerEvent): void {
        if ((e as any).button !== undefined && (e as any).button !== 0) return;
        if (isInteractiveElement(e.target as Element)) return;

        this.dragging = true;
        this.activePointerId = e.pointerId;
        this.initialLeft = parseFloat(this.modal.style.left) || 0;
        this.initialTop = parseFloat(this.modal.style.top) || 0;
        this.initialPointerX = e.clientX;
        this.initialPointerY = e.clientY;
        this.modal.style.transform = 'none';
        try { this.modal.setPointerCapture(e.pointerId); } catch (err) { console.warn('[MODAL] setPointerCapture failed:', err); }
        e.preventDefault();
    }

    private onPointerMove(e: PointerEvent): void {
        if (!this.dragging) return;
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

        const dims = calculateModalDimensions(this.modal);
        const rect = getContainerRect();
        const maxX = rect.width - dims.width;
        const maxY = rect.height - dims.height;

        const newLeft = clamp(this.initialLeft + e.clientX - this.initialPointerX, 0, maxX);
        const newTop = clamp(this.initialTop + e.clientY - this.initialPointerY, 0, maxY);
        applyPosition(this.modal, newLeft, newTop);
        e.preventDefault();
    }

    private async onPointerUp(e: PointerEvent): Promise<void> {
        if (!this.dragging) return;
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        this.dragging = false;
        this.activePointerId = null;
        try { this.modal.releasePointerCapture(e.pointerId); } catch (err) { console.warn('[MODAL] releasePointerCapture failed:', err); }

        const dims = calculateModalDimensions(this.modal);
        const rect = getContainerRect();
        const maxX = rect.width - dims.width;
        const maxY = rect.height - dims.height;
        const savedLeft = clamp(Math.round(rect.left), 0, maxX);
        const savedTop = clamp(Math.round(rect.top), 0, maxY);

        view.plugin.settings.modalPositions![this.key] = { left: savedLeft, top: savedTop };
        try { await view.plugin.saveSettings(); } catch (err) { console.warn('[MODAL] saveSettings failed:', err); }
    }

    private onPointerCancel(e: PointerEvent): void {
        if (!this.dragging) return;
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        this.dragging = false;
        this.activePointerId = null;
        try { this.modal.releasePointerCapture(e.pointerId); } catch (err) { console.warn('[MODAL] releasePointerCapture failed:', err); }
    }

    attach(): void {
        this.modal.addEventListener('pointerdown', this.handlers.down, { capture: true });
        window.addEventListener('pointermove', this.handlers.move, { passive: false });
        window.addEventListener('pointerup', this.handlers.up, { passive: false });
        window.addEventListener('pointercancel', this.handlers.cancel, { passive: false });

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of Array.from(m.removedNodes)) {
                    if (node === this.modal) {
                        this.detach();
                        observer.disconnect();
                    }
                }
            }
        });
        if (this.modal.parentElement) observer.observe(this.modal.parentElement, { childList: true });
    }

    detach(): void {
        this.modal.removeEventListener('pointerdown', this.handlers.down);
        window.removeEventListener('pointermove', this.handlers.move);
        window.removeEventListener('pointerup', this.handlers.up);
        window.removeEventListener('pointercancel', this.handlers.cancel);
    }
}
