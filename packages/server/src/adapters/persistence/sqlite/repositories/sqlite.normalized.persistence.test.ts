import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDatabase } from "../shared/drizzle.db.js";
import { createSchema } from "../schema/sqlite.schema.js";
import { SqliteTaskRepository } from "./sqlite.task.repository.js";
import { SqliteEventRepository } from "./sqlite.event.repository.js";
import { SqliteEvaluationRepository } from "./sqlite.evaluation.repository.js";
import { SqlitePlaybookRepository } from "./sqlite.playbook.repository.js";

describe("normalized SQLite persistence", () => {
    let client: BetterSqlite3.Database;
    let taskRepository: SqliteTaskRepository;
    let eventRepository: SqliteEventRepository;
    let evaluationRepository: SqliteEvaluationRepository;
    let playbookRepository: SqlitePlaybookRepository;

    beforeEach(() => {
        client = new BetterSqlite3(":memory:");
        createSchema(client);
        const db = createSqliteDatabase(client);
        taskRepository = new SqliteTaskRepository(db);
        eventRepository = new SqliteEventRepository(db);
        evaluationRepository = new SqliteEvaluationRepository(db);
        playbookRepository = new SqlitePlaybookRepository(db);
    });

    afterEach(() => {
        client.close();
    });

    it("stores task hierarchy and event metadata in normalized tables while preserving read shape", async () => {
        const now = "2026-04-24T00:00:00.000Z";
        await taskRepository.upsert({
            id: "root-task",
            title: "Root task",
            slug: "root-task",
            status: "running",
            taskKind: "primary",
            createdAt: now,
            updatedAt: now,
        });
        await taskRepository.upsert({
            id: "child-task",
            title: "Child task",
            slug: "child-task",
            status: "running",
            taskKind: "background",
            parentTaskId: "root-task",
            parentSessionId: "root-session",
            backgroundTaskId: "root-task",
            createdAt: now,
            updatedAt: now,
        });

        await eventRepository.insert({
            id: "event-1",
            taskId: "child-task",
            kind: "tool.used",
            lane: "implementation",
            title: "Edited file",
            metadata: {
                subtypeKey: "tool.shell",
                subtypeLabel: "Shell",
                subtypeGroup: "tool",
                toolFamily: "terminal",
                toolName: "Shell",
                filePaths: ["src/app.ts"],
                relPath: ".claude/rules/project.md",
                parentEventId: "event-0",
                relatedEventIds: ["event-2"],
                relationType: "implements",
                relationLabel: "implements plan",
                asyncTaskId: "async-1",
                asyncStatus: "completed",
                tags: ["runtime-tag"],
                inputTokens: 12,
                outputTokens: 4,
                cacheReadTokens: 2,
                model: "gpt-test",
                promptId: "prompt-1",
                stopReason: "stop",
                todoId: "todo-1",
                todoState: "completed",
                autoReconciled: true,
            },
            classification: {
                lane: "implementation",
                tags: ["classification-tag"],
                matches: [],
            },
            createdAt: now,
        });

        const child = await taskRepository.findById("child-task");
        expect(child).toMatchObject({
            parentTaskId: "root-task",
            parentSessionId: "root-session",
            backgroundTaskId: "root-task",
        });
        expect(client.prepare("select relation_kind from task_relations where task_id = ? order by relation_kind").all("child-task")).toEqual([
            { relation_kind: "background" },
            { relation_kind: "parent" },
            { relation_kind: "spawned_by_session" },
        ]);

        const event = await eventRepository.findById("event-1");
        expect(event?.metadata).toMatchObject({
            subtypeKey: "tool.shell",
            subtypeLabel: "Shell",
            subtypeGroup: "tool",
            toolFamily: "terminal",
            toolName: "Shell",
            filePath: ".claude/rules/project.md",
            relPath: ".claude/rules/project.md",
            parentEventId: "event-0",
            relatedEventIds: ["event-2"],
            relationType: "implements",
            asyncTaskId: "async-1",
            asyncStatus: "completed",
            tags: ["classification-tag", "runtime-tag"],
            inputTokens: 12,
            outputTokens: 4,
            cacheReadTokens: 2,
            cacheCreateTokens: 0,
            model: "gpt-test",
            promptId: "prompt-1",
            stopReason: "stop",
            todoId: "todo-1",
            todoState: "completed",
            autoReconciled: true,
        });
        expect(event?.classification.tags).toEqual(["classification-tag", "runtime-tag"]);
        expect(client.prepare("select count(*) as count from event_tags where event_id = ?").get("event-1")).toEqual({ count: 2 });
        expect(client.prepare("select extras_json from timeline_events_view where id = ?").get("event-1")).toEqual({ extras_json: "{}" });
    });

    it("stores evaluations, playbooks, and embeddings through normalized workflow tables", async () => {
        const now = "2026-04-24T00:00:00.000Z";
        await taskRepository.upsert({
            id: "workflow-task",
            title: "Workflow task",
            slug: "workflow-task",
            status: "completed",
            taskKind: "primary",
            createdAt: now,
            updatedAt: now,
        });
        await evaluationRepository.upsertEvaluation({
            taskId: "workflow-task",
            scopeKey: "task",
            scopeKind: "task",
            scopeLabel: "Whole task",
            turnIndex: null,
            rating: "good",
            useCase: "Reuse for workflow checks",
            workflowTags: ["workflow", "sqlite"],
            outcomeNote: "Worked",
            approachNote: "Normalize first",
            reuseWhen: "Similar persistence work",
            watchouts: "Keep API shape",
            evaluatedAt: now,
        });

        const evaluation = await evaluationRepository.getEvaluation("workflow-task");
        expect(evaluation).toMatchObject({
            taskId: "workflow-task",
            workflowTags: ["workflow", "sqlite"],
            qualitySignals: {
                reuseCount: 0,
                briefingCopyCount: 0,
                manualRating: "good",
            },
        });
        expect(client.prepare("select count(*) as count from evaluations_core").get()).toEqual({ count: 1 });
        expect(client.prepare("select count(*) as count from evaluation_contents").get()).toEqual({ count: 1 });
        expect(client.prepare("select scope, entity_id from search_documents where scope = 'evaluation'").all()).toEqual([
            { scope: "evaluation", entity_id: "workflow-task#task" },
        ]);

        const playbook = await playbookRepository.createPlaybook({
            title: "Normalize persistence",
            status: "active",
            whenToUse: "When SQLite tables get too wide",
            prerequisites: ["Existing tests pass"],
            approach: "Split core and child tables",
            keySteps: ["Create core", "Move arrays"],
            watchouts: ["Keep read API stable"],
            sourceSnapshotIds: ["workflow-task#task"],
            tags: ["sqlite", "workflow"],
        });

        expect(playbook).toMatchObject({
            title: "Normalize persistence",
            status: "active",
            prerequisites: ["Existing tests pass"],
            keySteps: ["Create core", "Move arrays"],
            sourceSnapshotIds: ["workflow-task#task"],
            tags: ["sqlite", "workflow"],
        });
        expect(client.prepare("select count(*) as count from playbook_steps where playbook_id = ?").get(playbook.id)).toEqual({ count: 4 });
        expect(client.prepare("select count(*) as count from playbook_tags where playbook_id = ?").get(playbook.id)).toEqual({ count: 2 });
        expect(client.prepare("select count(*) as count from evaluation_promotions where playbook_id = ?").get(playbook.id)).toEqual({ count: 1 });
        expect(client.prepare("select scope, entity_id from search_documents where scope = 'playbook'").all()).toEqual([
            { scope: "playbook", entity_id: playbook.id },
        ]);
    });
});
