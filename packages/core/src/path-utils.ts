export function extractPathLikeTokens(text: string): readonly string[] {
    const matches = new Set<string>();
    function addCandidate(raw: string | undefined): void {
        const candidate = raw?.trim();
        if (candidate && looksLikePath(candidate)) {
            matches.add(candidate);
        }
    }
    const stripped = text.replace(/```[\s\S]*?```/g, "");
    const backtickRegex = /`([^`\n]+)`/g;
    for (const match of stripped.matchAll(backtickRegex)) {
        addCandidate(match[1]);
    }
    const atPathRegex = /@([A-Za-z0-9_./-]+\/?)/g;
    for (const match of stripped.matchAll(atPathRegex)) {
        addCandidate(match[1]);
    }
    const plainPathRegex = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]*/g;
    for (const match of stripped.matchAll(plainPathRegex)) {
        addCandidate(match[0]);
    }
    return [...matches];
}
export function looksLikePath(value: string): boolean {
    if (/[\n\r]/.test(value))
        return false;
    if (value.length > 260)
        return false;
    if (/\s/.test(value))
        return false;
    if (/[=(){};,\x5b\x5d<>!?#&|+*^~"']/.test(value))
        return false;
    return (/[/\\]/.test(value) ||
        /\.[a-z0-9]{1,15}$/i.test(value) ||
        /^\.[a-z0-9]/i.test(value));
}
export function isDirectoryPath(path: string): boolean {
    if (path.endsWith("/")) {
        return true;
    }
    const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
    if (/^\.[a-z0-9]/i.test(lastSegment)) {
        const afterDot = lastSegment.slice(1);
        if (afterDot.length <= 3 ||
            afterDot.includes(".") ||
            /(?:rc|ignore|config|lock|keep|list|sum|sig)$/i.test(afterDot)) {
            return false;
        }
        return true;
    }
    return !/\.[a-z0-9]{1,15}$/i.test(lastSegment);
}
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
export function matchFilePaths(mentionedPath: string, exploredPath: string, workspacePath?: string): boolean {
    const normalizedMentioned = normalizeFilePath(mentionedPath, workspacePath);
    const normalizedExplored = normalizeFilePath(exploredPath, workspacePath);
    if (normalizedMentioned === normalizedExplored) {
        return true;
    }
    const suffixA = toPathSuffix(normalizedMentioned);
    const suffixB = toPathSuffix(normalizedExplored);
    if (suffixA && suffixB) {
        return suffixA === suffixB
            || suffixB.endsWith(`/${suffixA}`)
            || suffixA.endsWith(`/${suffixB}`);
    }
    return false;
}
export function filePathsInDirectory(dirPath: string, filePaths: readonly string[], workspacePath?: string): readonly string[] {
    const normalizedDir = normalizeFilePath(dirPath, workspacePath);
    const dirSuffix = toPathSuffix(normalizedDir);
    return filePaths.filter((filePath) => {
        const normalizedFile = normalizeFilePath(filePath, workspacePath);
        const fileSuffix = toPathSuffix(normalizedFile);
        if (fileSuffix === dirSuffix || normalizedFile === normalizedDir) {
            return true;
        }
        return fileSuffix.startsWith(`${dirSuffix}/`)
            || normalizedFile.startsWith(`${normalizedDir}/`);
    });
}
function toPathSuffix(p: string): string {
    return p.replace(/^\/+/, "");
}
