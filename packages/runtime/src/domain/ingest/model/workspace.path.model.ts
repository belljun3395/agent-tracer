import * as path from "node:path";

/** 프로젝트 루트 아래가 아니면 원래 경로를 그대로 둔다. */
export function relativeProjectPath(projectDir: string, filePath: string): string {
    if (!filePath) return filePath;
    const relative = path.relative(projectDir, filePath);
    if (!relative) return "";
    const normalized = relative.split(path.sep).join("/");
    if (normalized === ".." || normalized.startsWith("../") || path.isAbsolute(relative)) return filePath;
    return normalized.replace(/^\/+/, "");
}

/** 프롬프트가 도착하기 전에 쓰는 임시 태스크 제목이다. */
export function defaultTaskTitle(projectDir: string): string {
    return `Claude Code — ${path.basename(projectDir)}`;
}
