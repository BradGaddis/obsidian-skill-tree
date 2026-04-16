import { Coordinate } from "./types";

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
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

export function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy

    if (lenSq === 0) return Math.hypot(px - x1, py - y1)

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))

    const nearX = x1 + t * dx
    const nearY = y1 + t * dy

    return Math.hypot(px - nearX, py - nearY)
}
