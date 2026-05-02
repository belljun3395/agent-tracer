function isDirectoryPath(pathValue: string): boolean {
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

function matchFilePaths(mentionedPath: string, exploredPath: string, workspacePath?: string): boolean {
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

function filePathsInDirectory(
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
