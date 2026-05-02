export function normalizeWorkspacePath(path: string): string {
    return path.replace(/\/+/g, "/").replace(/\/$/, "").trim();
}
