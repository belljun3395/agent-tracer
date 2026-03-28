import { describe, expect, it } from "vitest";

import {
  getTaskDraftKey,
  loadHandoffDraft,
  saveHandoffDraft,
  type StorageLike
} from "./handoffStorage.js";

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
  it("stores task-scoped memo and last copied prompt while keeping prefs reusable", () => {
    const storage = new MemoryStorage();

    saveHandoffDraft("task-1", {
      prefs: {
        format: "xml",
        mode: "full",
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
    }, storage);

    const taskDraft = loadHandoffDraft("task-1", 0, storage);
    const anotherTaskDraft = loadHandoffDraft("task-2", 0, storage);

    expect(taskDraft.memo).toBe("follow up with server tests");
    expect(taskDraft.lastCopiedText).toBe("<task-context />");
    expect(taskDraft.prefs.format).toBe("xml");
    expect(anotherTaskDraft.memo).toBe("");
    expect(anotherTaskDraft.lastCopiedText).toBeNull();
    expect(anotherTaskDraft.prefs.format).toBe("xml");
  });

  it("falls back safely when stored JSON is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(getTaskDraftKey("task-1"), "{broken");

    const draft = loadHandoffDraft("task-1", 2, storage);

    expect(draft.memo).toBe("");
    expect(draft.lastCopiedText).toBeNull();
    expect(draft.prefs.include.violations).toBe(true);
  });
});
