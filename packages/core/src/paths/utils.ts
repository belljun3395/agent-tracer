/**
 * Known project-rooted directory prefixes that provide strong evidence a token is a file path.
 */
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

/**
 * Extracts path-like references from free-form text so downstream code can link them.
 */
export function extractPathLikeTokens(text: string): readonly string[] {
    const matches = new Set<string>();

    /**
     * Deduplicates valid path candidates after lightweight normalization.
     */
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

/**
 * Heuristically decides whether a token is likely intended to represent a file path.
 *
 * This is the looser check: any `/`, `\`, a file extension, or dotfile-style token passes.
 * Suitable for tokens that already carry strong evidence of being a path (e.g. wrapped in
 * backticks or prefixed with `@`).
 */
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

/**
 * Stricter variant of {@link looksLikePath} used for untrusted tokens (plain-text regex matches).
 *
 * Rejects slash-separated identifiers that are merely PascalCase pairs like `PostToolUse/Explore`
 * unless at least one of the following is true:
 * - Last segment has a lowercase file extension like `.ts` or `.md`.
 * - The token begins with a known project-rooted prefix (`src/`, `packages/`, ...).
 * - The token starts with `./`, `../`, or `/`.
 * - The token is a dotfile/dotted directory such as `.github/workflows/ci.yml`.
 */
export function looksLikePathStrict(value: string): boolean {
    if (!looksLikePath(value)) return false;
    // If there is no slash, rely on the base heuristic (file extension or dotfile).
    if (!/\//.test(value)) return true;

    if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
        return true;
    }
    if (PROJECT_ROOTED_PREFIXES.some((prefix) => value.startsWith(prefix))) {
        return true;
    }
    // Dotfile / dot-directory roots (e.g. `.github/workflows/ci.yml`).
    if (/^\.[a-z0-9]/i.test(value)) {
        return true;
    }
    const segments = value.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) return false;
    const lastSegment = segments[segments.length - 1] ?? "";
    if (/\.[a-z0-9]{1,15}$/i.test(lastSegment)) {
        return true;
    }
    // Reject tokens where every segment looks like a PascalCase identifier with no extension
    // (e.g. `PostToolUse/Explore`, `TaskCreate/TaskUpdate`, `Foo/Bar`).
    const allPascalCase = segments.every((segment) => /^[A-Z][A-Za-z0-9]*$/.test(segment));
    if (allPascalCase) {
        return false;
    }
    // Reject generic slash-separated lowercase identifiers without any other evidence
    // (e.g. `does/not/exist/probe`).
    const allBareIdentifiers = segments.every((segment) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(segment));
    if (allBareIdentifiers) {
        return false;
    }
    return true;
}

/**
 * Guesses whether the provided path string points to a directory rather than a file.
 */
export function isDirectoryPath(path: string): boolean {
    if (path.endsWith("/")) {
        return true;
    }
    const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
    if (/^\.[a-z0-9]/i.test(lastSegment)) {
        const afterDot = lastSegment.slice(1);
        return !(afterDot.length <= 3 ||
            afterDot.includes(".") ||
            /(?:rc|ignore|config|lock|keep|list|sum|sig)$/i.test(afterDot));

    }
    return !/\.[a-z0-9]{1,15}$/i.test(lastSegment);
}

/**
 * Normalizes a file path and resolves relative paths against an optional workspace root.
 */
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

/**
 * Compares two path references while tolerating absolute-vs-relative differences.
 */
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

/**
 * Filters a file list down to entries that live inside a target directory.
 */
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

/**
 * Removes a leading slash so path suffix comparisons can ignore absolute roots.
 */
function toPathSuffix(p: string): string {
    return p.replace(/^\/+/, "");
}
