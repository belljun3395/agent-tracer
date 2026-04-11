import type { HandoffMode, HandoffPurpose } from "@monitor/web-core";
export type HandoffFormat = "plain" | "markdown" | "xml" | "system-prompt" | "prompt";
export interface HandoffPrefs {
    format: HandoffFormat;
    mode: HandoffMode;
    purpose: HandoffPurpose;
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
interface HandoffStorages {
    readonly prefsStorage?: StorageLike;
    readonly draftStorage?: StorageLike;
}
export const DEFAULT_HANDOFF_PREFS: HandoffPrefs = {
    format: "markdown",
    mode: "compact",
    purpose: "continue",
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
export function loadHandoffDraft(taskId: string | undefined, violationCount: number, storages = getHandoffStorages()): HandoffDraft {
    const fallbackPrefs = {
        ...DEFAULT_HANDOFF_PREFS,
        include: {
            ...DEFAULT_HANDOFF_PREFS.include,
            violations: violationCount > 0
        }
    };
    const globalPrefs = parsePrefs(storages.prefsStorage?.getItem(PREFS_STORAGE_KEY));
    const taskDraft = taskId ? parseDraft(storages.draftStorage?.getItem(getTaskDraftKey(taskId))) : null;
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
export function saveHandoffDraft(taskId: string | undefined, draft: HandoffDraft, storages = getHandoffStorages()): void {
    if (!storages.prefsStorage && !storages.draftStorage) {
        return;
    }
    try {
        storages.prefsStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(draft.prefs));
        if (taskId && storages.draftStorage) {
            storages.draftStorage.setItem(getTaskDraftKey(taskId), JSON.stringify(draft));
        }
    }
    catch {
        void 0;
    }
}
export function getTaskDraftKey(taskId: string): string {
    return `${DRAFT_STORAGE_PREFIX}:${taskId}`;
}
function getHandoffStorages(): HandoffStorages {
    if (typeof window === "undefined") {
        return {};
    }
    return {
        prefsStorage: window.localStorage,
        draftStorage: window.sessionStorage
    };
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
