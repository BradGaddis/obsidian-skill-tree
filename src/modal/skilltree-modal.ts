import { ModalStyleOptions } from "src/types";
import { DEFAULT_MODAL_STYLES } from "src/constants";
import { SkillTreeView } from "src/skilltreeview";
import { ensureModalInViewport } from "src/utils";

let view: SkillTreeView

export function InitSkillTreeModal(skillTreeView: SkillTreeView) {
    view = skillTreeView;
}

export function createSkillModal(): HTMLElement {
    const container = view.canvasWrap || view.containerEl;
    return container.createEl('div', { cls: 'skill-tree-node-modal' });
}

export function openSkillModal(modal: HTMLElement, options: ModalStyleOptions = {}): void {
    Object.assign(modal.style, {
        display: 'flex',
        ...DEFAULT_MODAL_STYLES,
        ...options,
    });
    modal.style.position = 'fixed';
    modal.style.zIndex = '9999';
}

export function closeSkillModal(view: SkillTreeView, modal: HTMLElement): void {
    modal.remove();
    view.removeOutsideClickHandler();
}

export function makeModalDraggable(view: SkillTreeView, modal: HTMLElement, key: string): void {
    if (!view.plugin.settings.modalPositions) view.plugin.settings.modalPositions = {};

    const applyPosition = (left: number, top: number) => {
        modal.style.left = `${Math.round(left)}px`;
        modal.style.top = `${Math.round(top)}px`;
        modal.style.right = 'auto';
        modal.style.transform = 'none';
    };

    const saved = view.plugin.settings.modalPositions[key];
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        const parent = modal.parentElement || document.body;
        const parentRect = parent.getBoundingClientRect();

        let left = saved.left;
        let top = saved.top;

        if (left > parentRect.right || top > parentRect.bottom) {
            left = Math.round(saved.left - parentRect.left);
            top = Math.round(saved.top - parentRect.top);
        }

        const w = modal.offsetWidth || 0;
        const h = modal.offsetHeight || 0;
        if (w && h && Math.abs(left - Math.round(parentRect.width / 2)) < 8) {
            left = Math.max(8, Math.round(left - w / 2));
        }
        if (w && h && Math.abs(top - Math.round(parentRect.height / 2)) < 8) {
            top = Math.max(8, Math.round(top - h / 2));
        }

        applyPosition(left, top);
    } else {
        requestAnimationFrame(() => {
            const rect = modal.getBoundingClientRect();
            applyPosition(
                Math.round(window.innerWidth / 2 - rect.width / 2),
                Math.round(window.innerHeight / 2 - rect.height / 2)
            );
        });
    }

    let dragging = false;
    let activePointerId: number | null = null;
    let initialLeft = 0;
    let initialTop = 0;
    let initialPointerX = 0;
    let initialPointerY = 0;

    modal.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
        if ((e as any).button !== undefined && (e as any).button !== 0) return;

        try {
            const target = e.target as Element | null;
            if (target) {
                const interactive = target.closest('input,textarea,select,button,a,[contenteditable="true"]');
                if (interactive) return;
            }
        } catch (err) { }

        dragging = true;
        activePointerId = e.pointerId;
        initialLeft = modal.offsetLeft || parseFloat(modal.style.left) || 0;
        initialTop = modal.offsetTop || parseFloat(modal.style.top) || 0;
        initialPointerX = e.clientX;
        initialPointerY = e.clientY;
        modal.style.transform = 'none';
        try { modal.setPointerCapture(e.pointerId); } catch (err) { }
        e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        const deltaX = e.clientX - initialPointerX;
        const deltaY = e.clientY - initialPointerY;
        const newLeft = Math.max(8, Math.round(initialLeft + deltaX));
        const newTop = Math.max(8, Math.round(initialTop + deltaY));
        modal.style.left = `${newLeft}px`;
        modal.style.top = `${newTop}px`;
        modal.style.right = 'auto';
        e.preventDefault();
    };

    const onPointerUp = async (e: PointerEvent) => {
        if (!dragging) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        dragging = false;
        activePointerId = null;
        try { modal.releasePointerCapture(e.pointerId); } catch (e) { }
        try {
            const parent = modal.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const rect = modal.getBoundingClientRect();
            view.plugin.settings.modalPositions![key] = { left: Math.round(rect.left - parentRect.left), top: Math.round(rect.top - parentRect.top) };
        } catch (err) {
            view.plugin.settings.modalPositions![key] = { left: Math.round(modal.getBoundingClientRect().left), top: Math.round(modal.getBoundingClientRect().top) };
        }
        try { await view.plugin.saveSettings(); } catch (e) { }
    };

    const onPointerCancel = (e: PointerEvent) => {
        if (!dragging) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        dragging = false;
        activePointerId = null;
        try { modal.releasePointerCapture(e.pointerId); } catch (e) { }
    };

    modal.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of Array.from(m.removedNodes)) {
                if (node === modal) {
                    modal.removeEventListener('pointerdown', onPointerDown);
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    observer.disconnect();
                }
            }
        }
    });
    if (modal.parentElement) {
        observer.observe(modal.parentElement, { childList: true });
    }

    requestAnimationFrame(() => {
        ensureModalInViewport(modal);
    });
}

export function installOutsideClickHandler(modalEl: HTMLElement) {
    if (view.modalOutsideListener) return;
    const listener = (ev: Event) => {
        try {
            const target = ev.target as Node | null;
            if (!target) return;
            const openModals = Array.from(document.querySelectorAll('.skill-tree-node-modal')) as HTMLElement[];
            if (openModals.length === 0) return;
            for (const m of openModals) {
                if (m.contains(target)) return;
            }
            view.closeAllModals();
            view.removeOutsideClickHandler();
        } catch (e) { }
    };
    view.modalOutsideListener = listener;
    document.addEventListener('pointerdown', listener);
}

export interface ModalButton {
    text: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
}

export function createModalFooter(modal: HTMLElement, buttons: ModalButton[]): HTMLElement {
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    
    const footer = modal.createEl('div');
    footer.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--background-modifier-border);background:var(--background-secondary);flex-shrink:0;margin-top:auto;';
    
    for (const btn of buttons) {
        const button = footer.createEl('button', { text: btn.text }) as HTMLButtonElement;
        
        if (btn.variant === 'danger') {
            button.style.cssText = 'padding:8px 16px;background:none;border:1px solid var(--text-error);color:var(--text-error);border-radius:4px;cursor:pointer;';
        } else if (btn.variant === 'primary') {
            button.style.cssText = 'padding:8px 16px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;cursor:pointer;';
        } else {
            button.style.cssText = 'padding:8px 16px;background:var(--background-secondary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;';
        }
        
        if (btn.disabled) button.disabled = true;
        
        button.onclick = btn.onClick;
    }
    
    return footer;
}