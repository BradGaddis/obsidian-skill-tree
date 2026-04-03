import { ModalStyleOptions } from "src/types";
import { DEFAULT_MODAL_STYLES } from "src/constants";
import { SkillTreeView } from "src/skilltreeview";
import { ensureModalInViewport } from "src/utils";


export function createSkillModal(view: SkillTreeView): HTMLElement {
    const container = view.canvasWrap || view.containerEl;
    return container.createEl('div', { cls: 'skill-tree-node-modal' });
}

export function openSkillModal(modal: HTMLElement, options: ModalStyleOptions = {}): void {
    // view.closeAllModals();
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

    // Apply saved position if present. Positions are stored relative to the
    // modal's parent (usually `canvasWrap`). For older absolute values we
    // attempt to convert them into parent-relative coordinates.
    const saved = view.plugin.settings.modalPositions[key];
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        const parent = modal.parentElement || document.body;
        const parentRect = parent.getBoundingClientRect();

        // Start with saved values
        let left = saved.left;
        let top = saved.top;

        // If saved coordinates look like viewport coordinates (larger than parent's bounds),
        // convert them to parent-relative by subtracting parent origin.
        if (left > parentRect.right || top > parentRect.bottom) {
            left = Math.round(saved.left - parentRect.left);
            top = Math.round(saved.top - parentRect.top);
        }

        // If coordinates were previously stored as center coords, try to convert
        const w = modal.offsetWidth || 0;
        const h = modal.offsetHeight || 0;
        // If left/top appear to be near center (heuristic), convert to top-left
        if (w && h && Math.abs(left - Math.round(parentRect.width / 2)) < 8) {
            left = Math.max(8, Math.round(left - w / 2));
        }
        if (w && h && Math.abs(top - Math.round(parentRect.height / 2)) < 8) {
            top = Math.max(8, Math.round(top - h / 2));
        }

        applyPosition(left, top);
    } else {
        // No saved position - center the modal in the viewport
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

    // Prevent browser from hijacking touch gestures (scroll, nav, etc.)
    modal.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
        // Only respond to primary button
        if ((e as any).button !== undefined && (e as any).button !== 0) return;

        // If the pointerdown originated on an interactive/control element, don't start a drag.
        // prevents clicks on inputs, buttons, anchors, selects, textareas, or contenteditable
        // from initiating the modal move.
        try {
            const target = e.target as Element | null;
            if (target) {
                const interactive = target.closest('input,textarea,select,button,a,[contenteditable="true"]');
                if (interactive) return;
            }
        } catch (err) {
            // ignore
        }

        dragging = true;
        activePointerId = e.pointerId;
        // Store initial position and pointer position
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
        // Only respond to moves from the active pointer
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        // Move modal by the same amount the pointer moved
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
        // Persist top-left position relative to parent so it remains correct inside canvasWrap
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

    // Use capture so the modal gets the initial pointerdown before child elements
    modal.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });

    // Remove listeners when modal is removed
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

    // Ensure modal stays within viewport bounds
    requestAnimationFrame(() => {
        ensureModalInViewport(modal); //TODO get from skilltreeview
    });
}



