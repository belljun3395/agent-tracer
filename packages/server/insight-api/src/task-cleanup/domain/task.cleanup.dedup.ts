
export function dedupeByKindAndTask<
    T extends { readonly kind: string; readonly taskId: string },
>(items: readonly T[], knownTaskIds: ReadonlySet<string>): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
        if (!knownTaskIds.has(item.taskId)) continue;
        const key = `${item.kind}::${item.taskId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}
