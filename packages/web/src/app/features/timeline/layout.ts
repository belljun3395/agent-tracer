export interface NodeBounds {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export function areNodeBoundsEqual(current: Readonly<Record<string, NodeBounds>>, next: Readonly<Record<string, NodeBounds>>): boolean {
    const currentKeys = Object.keys(current);
    const nextKeys = Object.keys(next);
    if (currentKeys.length !== nextKeys.length) {
        return false;
    }
    for (const key of nextKeys) {
        const currentBounds = current[key];
        const nextBounds = next[key];
        if (!currentBounds || !nextBounds) {
            return false;
        }
        if (Math.abs(currentBounds.left - nextBounds.left) > 0.5 ||
            Math.abs(currentBounds.top - nextBounds.top) > 0.5 ||
            Math.abs(currentBounds.width - nextBounds.width) > 0.5 ||
            Math.abs(currentBounds.height - nextBounds.height) > 0.5) {
            return false;
        }
    }
    return true;
}
