export function normalizeFilePaths(filePaths: readonly string[] | undefined): readonly string[] {
    if (!filePaths || filePaths.length === 0) {
        return [];
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const filePath of filePaths) {
        const trimmed = filePath.trim();
        if (!trimmed || seen.has(trimmed)) {
            continue;
        }
        seen.add(trimmed);
        normalized.push(trimmed);
    }
    return normalized;
}
