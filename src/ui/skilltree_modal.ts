import { view } from "../utils/globals";
import { ModalDragHandler } from "./modal_drag_handler";
import { ModalButton } from "../types/interfaces";
import { MODAL_WIDTH, MODAL_HEIGHT, MODAL_DEFAULT_TOP_OFFSET, MODAL_CENTER_THRESHOLD } from "../types/constants";

function getSidebarWidth(): number {
    const rightSidebar = view.app.workspace.rightSplit;
    if (!rightSidebar) return 0;
    const sidebarEl = (rightSidebar as any).containerEl || (rightSidebar as any).el;
    return sidebarEl ? sidebarEl.getBoundingClientRect().width : 0;
}

function getContainerRect(): DOMRect {
    const container = view.canvasWrap || view.containerEl;
    return container.getBoundingClientRect();
}

function calculateModalDimensions(modal: HTMLElement): { width: number; height: number } {
    return { width: modal.offsetWidth || MODAL_WIDTH, height: modal.offsetHeight || MODAL_HEIGHT };
}

function applyPosition(modal: HTMLElement, left: number, top: number): void {
    modal.style.left = `${Math.round(left)}px`;
    modal.style.top = `${Math.round(top)}px`;
    modal.style.right = 'auto';
    modal.style.transform = 'none';
}

function getInitialPosition(key: string): { left: number; top: number } | null {
    const saved = view.plugin.settings.modalPositions?.[key];
    if (!saved || typeof saved.left !== 'number' || typeof saved.top !== 'number') return null;
    return { left: saved.left, top: saved.top };
}

function removeOutsideClickHandler(): void {
    if (view.modalOutsideListener) {
        document.removeEventListener('pointerdown', view.modalOutsideListener);
        document.removeEventListener('touchstart', view.modalOutsideListener);
        view.modalOutsideListener = null;
    }
}

export const SkillModal = {
    create(): HTMLElement {
        const modal = view.canvasWrap || view.containerEl;
        return modal.createEl('div', { cls: 'skill-tree-node-modal' });
    },

    createContainer(modal: HTMLElement, titleText: string): void {
        const container = view.canvasWrap || view.containerEl;
        modal.classList.add('skill-tree-modal');
        modal.style.position = 'absolute';

        const rect = container.getBoundingClientRect();
        const left = (rect.width / 2) - (MODAL_WIDTH / 2);
        const top = (rect.height / 2) - MODAL_DEFAULT_TOP_OFFSET;

        modal.style.left = `${Math.max(0, left)}px`;
        modal.style.top = `${Math.max(0, top)}px`;

        const header = modal.createEl('div');
        header.classList.add('skill-tree-modal-header');

        const title = header.createEl('span', { text: titleText });
        title.classList.add('skill-tree-modal-title');

        const closeBtn = header.createEl('button', { text: '×' });
        closeBtn.classList.add('skill-tree-modal-close');
        closeBtn.onclick = () => SkillModal.close(modal);
    },

    createContent(modal: HTMLElement): HTMLElement {
        const content = modal.createEl('div');
        content.classList.add('skill-tree-modal-content');
        return content;
    },

    makeDraggable(modal: HTMLElement, key: string): void {
        if (!view.plugin.settings.modalPositions) view.plugin.settings.modalPositions = {};
        modal.style.touchAction = 'none';

        const saved = getInitialPosition(key);
        if (!saved) {
            requestAnimationFrame(() => {
                const rect = getContainerRect();
                const dims = calculateModalDimensions(modal);
                applyPosition(modal, rect.width / 2 - dims.width / 2, rect.height / 2 - MODAL_DEFAULT_TOP_OFFSET);
            });
            const handler = new ModalDragHandler(modal, key);
            handler.attach();
            return;
        }

        const containerRect = getContainerRect();
        const sidebarWidth = getSidebarWidth();
        const dims = calculateModalDimensions(modal);

        const modalRight = containerRect.left + saved.left + dims.width;
        const isUnderSidebar = sidebarWidth > 0 && modalRight > window.innerWidth - sidebarWidth;
        const isOutOfBounds = saved.left > containerRect.width - dims.width || saved.top > containerRect.height - dims.height;

        let left = saved.left;
        let top = saved.top;

        if (isUnderSidebar || isOutOfBounds) {
            left = containerRect.width / 2 - dims.width / 2;
            top = containerRect.height / 2 - MODAL_DEFAULT_TOP_OFFSET;
        }

        if (Math.abs(left - containerRect.width / 2) < MODAL_CENTER_THRESHOLD) left = Math.max(0, left - dims.width / 2);
        if (Math.abs(top - containerRect.height / 2) < MODAL_CENTER_THRESHOLD) top = Math.max(0, top - dims.height / 2);

        applyPosition(modal, left, top);
        const handler = new ModalDragHandler(modal, key);
        handler.attach();
    },

    createFooterContainer(modal: HTMLElement): HTMLElement {
        const footer = modal.createEl('div');
        footer.classList.add('skill-tree-modal-footer');
        return footer;
    },

    createFooter(modal: HTMLElement, buttons: ModalButton[]): HTMLElement {
        const footer = modal.createEl('div');
        footer.classList.add('skill-tree-modal-footer');

        for (const btn of buttons) {
            const button = footer.createEl('button', { text: btn.text }) as HTMLButtonElement;

            if (btn.variant === 'danger') {
                button.classList.add('skill-tree-btn', 'skill-tree-btn--danger');
            } else if (btn.variant === 'primary') {
                button.classList.add('skill-tree-btn', 'skill-tree-btn--primary');
            } else {
                button.classList.add('skill-tree-btn', 'skill-tree-btn--secondary');
            }

            if (btn.disabled) button.disabled = true;
            button.onclick = btn.onClick;
        }

        return footer;
    },

    installOutsideClickHandler(): void {
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

                SkillModal.closeAll();
            } catch (err) { console.warn('[MODAL] Outside click check failed:', err); }
        };
        view.modalOutsideListener = listener;
        document.addEventListener('pointerdown', listener);
        document.addEventListener('touchstart', listener, { passive: true });
    },

    close(modal: HTMLElement): void {
        modal.remove();
        removeOutsideClickHandler();
    },

    closeAll(): void {
        try {
            if (view.containerEl) {
                const nodeModal = view.containerEl.querySelectorAll('.skill-tree-node-modal');
                nodeModal.forEach((n) => n.remove());
            }
            const bodyModals = document.querySelectorAll('.skill-tree-node-modal');
            bodyModals.forEach((n) => n.remove());
        } catch (err) { console.warn('[MODAL] closeAll failed:', err); }
        removeOutsideClickHandler();
    }
};
