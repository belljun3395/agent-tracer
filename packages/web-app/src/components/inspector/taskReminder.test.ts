import { describe, expect, it } from "vitest";
import { parseTaskReminderItems } from "./taskReminder.js";

describe("parseTaskReminderItems", () => {
    it("parses a direct array payload", () => {
        expect(parseTaskReminderItems([
            {
                id: "todo-1",
                subject: "Ship inspector tooltips",
                status: "in_progress",
                blocks: ["qa"],
                blockedBy: ["design-review"],
            },
        ])).toEqual([
            {
                id: "todo-1",
                subject: "Ship inspector tooltips",
                status: "in_progress",
                blocks: ["qa"],
                blockedBy: ["design-review"],
            },
        ]);
    });

    it("parses a JSON-encoded array string", () => {
        expect(parseTaskReminderItems(JSON.stringify([
            {
                subject: "Check reminder payload",
                status: "pending",
            },
        ]))).toEqual([
            {
                subject: "Check reminder payload",
                status: "pending",
            },
        ]);
    });

    it("parses wrapped object payloads and single-string dependency fields", () => {
        expect(parseTaskReminderItems({
            content: [
                {
                    subject: "Unblock overview card",
                    blockedBy: "task-42",
                    blocks: "task-43",
                },
            ],
        })).toEqual([
            {
                subject: "Unblock overview card",
                blockedBy: ["task-42"],
                blocks: ["task-43"],
            },
        ]);
    });
});
