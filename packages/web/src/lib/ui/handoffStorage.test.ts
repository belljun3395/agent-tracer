import { describe, expect, it } from "vitest";
import { getTaskDraftKey, loadHandoffDraft, saveHandoffDraft, type StorageLike } from "./handoffStorage.js";
class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();
    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}
describe("handoffStorage", () => {
    it("stores task-scoped memo and last copied prompt in session-scoped draft storage while keeping prefs reusable", () => {
        const prefsStorage = new MemoryStorage();
        const draftStorage = new MemoryStorage();
        saveHandoffDraft("task-1", {
            prefs: {
                format: "xml",
                mode: "full",
                purpose: "review",
                include: {
                    summary: true,
                    plans: true,
                    process: true,
                    files: false,
                    modifiedFiles: true,
                    todos: true,
                    violations: true,
                    questions: true
                }
            },
            memo: "follow up with server tests",
            lastCopiedText: "<task-context />",
            lastCopiedAt: "2026-03-28T00:00:00.000Z"
        }, { prefsStorage, draftStorage });
        const taskDraft = loadHandoffDraft("task-1", 0, { prefsStorage, draftStorage });
        const anotherTaskDraft = loadHandoffDraft("task-2", 0, { prefsStorage, draftStorage });
        expect(taskDraft.memo).toBe("follow up with server tests");
        expect(taskDraft.lastCopiedText).toBe("<task-context />");
        expect(taskDraft.prefs.format).toBe("xml");
        expect(taskDraft.prefs.purpose).toBe("review");
        expect(anotherTaskDraft.memo).toBe("");
        expect(anotherTaskDraft.lastCopiedText).toBeNull();
        expect(anotherTaskDraft.prefs.format).toBe("xml");
        expect(anotherTaskDraft.prefs.purpose).toBe("review");
        expect(prefsStorage.getItem(getTaskDraftKey("task-1"))).toBeNull();
        expect(draftStorage.getItem(getTaskDraftKey("task-1"))).not.toBeNull();
    });
    it("falls back safely when stored JSON is malformed", () => {
        const draftStorage = new MemoryStorage();
        draftStorage.setItem(getTaskDraftKey("task-1"), "{broken");
        const draft = loadHandoffDraft("task-1", 2, { draftStorage });
        expect(draft.memo).toBe("");
        expect(draft.lastCopiedText).toBeNull();
        expect(draft.prefs.purpose).toBe("continue");
        expect(draft.prefs.include.violations).toBe(true);
    });
});
