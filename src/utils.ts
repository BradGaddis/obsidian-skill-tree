
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
    console.log("[DEBUG] ensureModalInViewport called");
    console.log("[DEBUG] ensureModalInViewport - modal.offsetWidth:", modal.offsetWidth, "modal.offsetHeight:", modal.offsetHeight);
    console.log("[DEBUG] ensureModalInViewport - modal.style.left:", modal.style.left, "modal.style.top:", modal.style.top);
    
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

    console.log("[DEBUG] ensureModalInViewport - computed left:", left, "top:", top);
    
    const padding = 10;
    left = Math.max(padding, Math.min(left, viewportWidth - maxWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - modalHeight - padding));

    console.log("[DEBUG] ensureModalInViewport - final left:", left, "top:", top);
    
    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
}
