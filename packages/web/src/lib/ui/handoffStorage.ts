import type { HandoffMode } from "../insights.js";
export type HandoffFormat = "plain" | "markdown" | "xml" | "system-prompt";
export interface HandoffPrefs {
    format: HandoffFormat;
    mode: HandoffMode;
    include: {
        summary: boolean;
        plans: boolean;
        process: boolean;
        files: boolean;
        modifiedFiles: boolean;
        todos: boolean;
        violations: boolean;
        questions: boolean;
    };
}
export interface HandoffDraft {
    readonly prefs: HandoffPrefs;
    readonly memo: string;
    readonly lastCopiedText: string | null;
    readonly lastCopiedAt: string | null;
}
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export const DEFAULT_HANDOFF_PREFS: HandoffPrefs = {
    format: "markdown",
    mode: "compact",
    include: {
        summary: true,
        plans: true,
        process: true,
        files: true,
        modifiedFiles: true,
        todos: true,
        violations: true,
        questions: false
    }
};
const PREFS_STORAGE_KEY = "agent-tracer.handoff-prefs";
const DRAFT_STORAGE_PREFIX = "agent-tracer.handoff-draft.v1";
export function loadHandoffDraft(taskId: string | undefined, violationCount: number, storage = getLocalStorage()): HandoffDraft {
    const fallbackPrefs = {
        ...DEFAULT_HANDOFF_PREFS,
        include: {
            ...DEFAULT_HANDOFF_PREFS.include,
            violations: violationCount > 0
        }
    };
    const globalPrefs = parsePrefs(storage?.getItem(PREFS_STORAGE_KEY));
    const taskDraft = taskId ? parseDraft(storage?.getItem(getTaskDraftKey(taskId))) : null;
    return {
        prefs: {
            ...fallbackPrefs,
            ...(globalPrefs ?? {}),
            ...(taskDraft?.prefs ?? {}),
            include: {
                ...fallbackPrefs.include,
                ...(globalPrefs?.include ?? {}),
                ...(taskDraft?.prefs?.include ?? {})
            }
        },
        memo: taskDraft?.memo ?? "",
        lastCopiedText: taskDraft?.lastCopiedText ?? null,
        lastCopiedAt: taskDraft?.lastCopiedAt ?? null
    };
}
export function saveHandoffDraft(taskId: string | undefined, draft: HandoffDraft, storage = getLocalStorage()): void {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(draft.prefs));
        if (taskId) {
            storage.setItem(getTaskDraftKey(taskId), JSON.stringify(draft));
        }
    }
    catch {
        void 0;
    }
}
export function getTaskDraftKey(taskId: string): string {
    return `${DRAFT_STORAGE_PREFIX}:${taskId}`;
}
function getLocalStorage(): StorageLike | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return window.localStorage;
}
function parsePrefs(raw?: string | null): Partial<HandoffPrefs> | null {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as Partial<HandoffPrefs>;
    }
    catch {
        return null;
    }
}
function parseDraft(raw?: string | null): Partial<HandoffDraft> | null {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as Partial<HandoffDraft>;
    }
    catch {
        return null;
    }
}
