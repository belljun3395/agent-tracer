/**
 * Extracts path-like references from free-form text so downstream code can link them.
 */
export declare function extractPathLikeTokens(text: string): readonly string[];
/**
 * Heuristically decides whether a token is likely intended to represent a file path.
 */
export declare function looksLikePath(value: string): boolean;
/**
 * Guesses whether the provided path string points to a directory rather than a file.
 */
export declare function isDirectoryPath(path: string): boolean;
/**
 * Normalizes a file path and resolves relative paths against an optional workspace root.
 */
export declare function normalizeFilePath(filePath: string, workspacePath?: string): string;
/**
 * Compares two path references while tolerating absolute-vs-relative differences.
 */
export declare function matchFilePaths(mentionedPath: string, exploredPath: string, workspacePath?: string): boolean;
/**
 * Filters a file list down to entries that live inside a target directory.
 */
export declare function filePathsInDirectory(dirPath: string, filePaths: readonly string[], workspacePath?: string): readonly string[];
//# sourceMappingURL=utils.d.ts.map