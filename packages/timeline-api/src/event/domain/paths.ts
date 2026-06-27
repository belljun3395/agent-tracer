export function normalizeFilePath(filePath: string, workspacePath?: string): string {
    const cleaned = filePath.replace(/\/+/g, "/").replace(/\/$/, "").trim();
    if (cleaned.startsWith("/")) {
        return cleaned;
    }
    if (workspacePath) {
        const base = workspacePath.replace(/\/+/g, "/").replace(/\/$/, "");
        return `${base}/${cleaned}`;
    }
    return cleaned;
}
