
export function TestIsMobile(): boolean {
    return window.innerWidth <= 800;
}

export function GetLastIndex(arr: any): any {
    if (arr.length == 0) {
        return []
    }
    return arr[arr.length - 1]

}
