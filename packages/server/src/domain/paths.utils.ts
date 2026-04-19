const PROJECT_ROOTED_PREFIXES: readonly string[] = [
    "src/",
    "packages/",
    ".claude/",
    "test/",
    "tests/",
    "docs/",
    "node_modules/",
    "dist/",
    "build/",
    "public/",
    "scripts/",
];

export function extractPathLikeTokens(text: string): readonly string[] {
    const matches = new Set<string>();

    function addCandidate(raw: string | undefined, options?: { trusted?: boolean }): void {
        const candidate = raw?.trim();
        if (!candidate) return;
        const trusted = options?.trusted === true;
        if (trusted ? looksLikePath(candidate) : looksLikePathStrict(candidate)) {
            matches.add(candidate);
        }
    }

    const stripped = text.replace(/```[\s\S]*?```/g, "");
    const backtickRegex = /`([^`\n]+)`/g;
    for (const match of stripped.matchAll(backtickRegex)) {
        addCandidate(match[1], { trusted: true });
    }
    const atPathRegex = /@([A-Za-z0-9_./-]+\/?)/g;
    for (const match of stripped.matchAll(atPathRegex)) {
        addCandidate(match[1], { trusted: true });
    }
    const plainPathRegex = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]*/g;
    for (const match of stripped.matchAll(plainPathRegex)) {
        addCandidate(match[0]);
    }

    return [...matches];
}

export function looksLikePath(value: string): boolean {
    if (/[\n\r]/.test(value)) return false;
    if (value.length > 260) return false;
    if (/\s/.test(value)) return false;
    if (/[=(){};,\x5b\x5d<>!?#&|+*^~"']/.test(value)) return false;
    return /[/\\]/.test(value) || /\.[a-z0-9]{1,15}$/i.test(value) || /^\.[a-z0-9]/i.test(value);
}

export function looksLikePathStrict(value: string): boolean {
    if (!looksLikePath(value)) return false;
    if (!/\//.test(value)) return true;

    if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
        return true;
    }
    if (PROJECT_ROOTED_PREFIXES.some((prefix) => value.startsWith(prefix))) {
        return true;
    }
    if (/^\.[a-z0-9]/i.test(value)) {
        return true;
    }

    const segments = value.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) return false;
    const lastSegment = segments[segments.length - 1] ?? "";
    if (/\.[a-z0-9]{1,15}$/i.test(lastSegment)) {
        return true;
    }
    if (segments.every((segment) => /^[A-Z][A-Za-z0-9]*$/.test(segment))) {
        return false;
    }
    if (segments.every((segment) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(segment))) {
        return false;
    }

    return true;
}

export function isDirectoryPath(pathValue: string): boolean {
    if (pathValue.endsWith("/")) {
        return true;
    }
    const lastSegment = pathValue.split("/").filter(Boolean).at(-1) ?? "";
    if (/^\.[a-z0-9]/i.test(lastSegment)) {
        const afterDot = lastSegment.slice(1);
        return !(
            afterDot.length <= 3
            || afterDot.includes(".")
            || /(?:rc|ignore|config|lock|keep|list|sum|sig)$/i.test(afterDot)
        );
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

export function filePathsInDirectory(
    dirPath: string,
    filePaths: readonly string[],
    workspacePath?: string,
): readonly string[] {
    const normalizedDir = normalizeFilePath(dirPath, workspacePath);
    const dirSuffix = toPathSuffix(normalizedDir);
    return filePaths.filter((filePath) => {
        const normalizedFile = normalizeFilePath(filePath, workspacePath);
        const fileSuffix = toPathSuffix(normalizedFile);
        if (fileSuffix === dirSuffix || normalizedFile === normalizedDir) {
            return true;
        }
        return fileSuffix.startsWith(`${dirSuffix}/`) || normalizedFile.startsWith(`${normalizedDir}/`);
    });
}

function toPathSuffix(pathValue: string): string {
    return pathValue.replace(/^\/+/, "");
}
