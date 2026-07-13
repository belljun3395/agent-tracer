export function withDeadline<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([work, timeout]).finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
    });
}
