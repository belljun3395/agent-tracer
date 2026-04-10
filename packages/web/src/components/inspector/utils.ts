import type { CompactRelation } from "@monitor/web-core";
export function toRelativePath(filePath: string, workspacePath?: string): string {
    if (!workspacePath) {
        return filePath;
    }
    const normalizedWorkspacePath = workspacePath.endsWith("/") ? workspacePath : `${workspacePath}/`;
    if (filePath.startsWith(normalizedWorkspacePath)) {
        return filePath.slice(normalizedWorkspacePath.length);
    }
    const withSlash = filePath.startsWith("/") ? filePath : `/${filePath}`;
    if (withSlash.startsWith(normalizedWorkspacePath)) {
        return withSlash.slice(normalizedWorkspacePath.length);
    }
    return filePath;
}
export function summarizePath(filePath: string, workspacePath?: string): string {
    const relative = toRelativePath(filePath, workspacePath);
    if (relative.length <= 42) {
        return relative;
    }
    const parts = relative.split("/");
    const shortened = parts.length > 3 ? parts.slice(-3).join("/") : relative;
    return shortened.length > 42 ? `…${shortened.slice(-(42 - 1))}` : shortened;
}
export function dirnameLabel(filePath: string, workspacePath?: string): string {
    const relative = toRelativePath(filePath, workspacePath);
    const segments = relative.split("/");
    if (segments.length <= 1) {
        return "Workspace root";
    }
    return segments.slice(0, -1).join("/");
}
export function summarizeDetailText(value: string, limit = 180): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `${normalized.slice(0, limit - 1)}…`;
}
export function compactRelationLabel(relation: CompactRelation): {
    label: string;
    tone: "warning" | "success" | "accent" | "neutral";
} | null {
    switch (relation) {
        case "before-compact": return { label: "pre-compact", tone: "warning" };
        case "after-compact": return { label: "post-compact", tone: "success" };
        case "across-compact": return { label: "across compact", tone: "accent" };
        case "no-compact": return null;
    }
}
