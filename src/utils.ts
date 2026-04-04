import { Coordinate } from "./types";

export function TestIsMobile(): boolean {
    return window.innerWidth <= 800;
}

export function GetLastIndex(arr: any): any {
    if (arr.length == 0) {
        return []
    }
    return arr[arr.length - 1]
}

export function ensureModalInViewport(modal: HTMLElement): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = modal.offsetWidth || 340;
    const modalHeight = modal.offsetHeight || 200;

    const maxWidth = Math.min(modalWidth, viewportWidth - 20);
    if (modalWidth > viewportWidth - 20) {
        modal.style.width = `${maxWidth}px`;
    }

    let left = parseInt(modal.style.left) || 0;
    let top = parseInt(modal.style.top) || 0;

    const padding = 10;
    left = Math.max(padding, Math.min(left, viewportWidth - maxWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - modalHeight - padding));

    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
}


export function distanceTo(a: Coordinate, b: Coordinate): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
}
