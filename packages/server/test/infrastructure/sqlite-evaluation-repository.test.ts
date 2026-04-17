import BetterSqlite3 from "better-sqlite3";
import { TaskId } from "@monitor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeEmbedding } from "../../src/infrastructure/embedding";
import { SqliteEvaluationRepository, createSchema } from "../../src/infrastructure/sqlite";
describe("sqlite evaluation repository search", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("returns semantic matches even without lexical overlap", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-semantic",
            title: "Refine config migration flow"
        });
        seedEvaluation(db, {
            taskId: "task-semantic",
            rating: "good",
            useCase: "environment variable refactor",
            outcomeNote: "Rename env readers and keep rollout safe",
            embedding: serializeEmbedding(new Float32Array([1, 0, 0])),
            embeddingModel: "fake-model"
        });
        seedEvent(db, {
            id: "event-semantic",
            taskId: "task-semantic",
            title: "Context saved",
            body: "Refine config migration flow before rollout."
        });
        const repository = new SqliteEvaluationRepository(db, {
            embed: async () => new Float32Array([1, 0, 0])
        });
        const results = await repository.searchSimilarWorkflows("housekeeping sweep", undefined, 5);
        expect(results).toHaveLength(1);
        expect(results[0]?.taskId).toBe("task-semantic");
        db.close();
    });
    it("falls back to lexical scoring and keeps rating or recency tie-breakers", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-good",
            title: "TypeScript cleanup"
        });
        seedTask(db, {
            id: "task-skip",
            title: "TypeScript cleanup backup"
        });
        seedEvaluation(db, {
            taskId: "task-good",
            rating: "good",
            useCase: "typescript refactor",
            approachNote: "Prefer guard clause exits in shared helpers",
            evaluatedAt: "2026-03-28T00:00:00.000Z",
            embedding: serializeEmbedding(new Float32Array([1, 0, 0])),
            embeddingModel: "fake-model"
        });
        seedEvaluation(db, {
            taskId: "task-skip",
            rating: "skip",
            useCase: "typescript refactor",
            approachNote: "Prefer guard clause exits in shared helpers",
            evaluatedAt: "2026-03-27T00:00:00.000Z"
        });
        seedEvent(db, {
            id: "event-good",
            taskId: "task-good",
            title: "Context saved",
            body: "Prefer guard clause exits while refactoring TypeScript code."
        });
        seedEvent(db, {
            id: "event-skip",
            taskId: "task-skip",
            title: "Context saved",
            body: "Prefer guard clause exits while refactoring TypeScript code."
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        const repository = new SqliteEvaluationRepository(db, {
            embed: async () => {
                throw new Error("query embedding failed");
            }
        });
        const results = await repository.searchSimilarWorkflows("typescript guard clause", undefined, 5);
        expect(results.map((result) => result.taskId)).toEqual(["task-good", "task-skip"]);
        expect(warn).toHaveBeenCalled();
        db.close();
    });
    it("searches workflow library summaries with semantic ranking", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-library-semantic",
            title: "Guard clause cleanup"
        });
        seedEvaluation(db, {
            taskId: "task-library-semantic",
            rating: "good",
            useCase: "typescript refactor",
            outcomeNote: "Flattened nested branches",
            embedding: serializeEmbedding(new Float32Array([0, 1, 0])),
            embeddingModel: "fake-model"
        });
        const repository = new SqliteEvaluationRepository(db, {
            embed: async () => new Float32Array([0, 1, 0])
        });
        const results = await repository.searchWorkflowLibrary("branch simplification", "good", 10);
        expect(results).toHaveLength(1);
        expect(results[0]?.taskId).toBe("task-library-semantic");
        expect(results[0]?.rating).toBe("good");
        db.close();
    });
    it("hydrates derived displayTitle for workflow summaries when the stored title is generic", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-library-display-title",
            title: "Claude Code - agent-tracer",
            workspacePath: "/tmp/agent-tracer"
        });
        seedEvaluation(db, {
            taskId: "task-library-display-title",
            rating: "good"
        });
        seedUserMessage(db, {
            id: "event-user-title",
            taskId: "task-library-display-title",
            body: "hi?"
        });
        const repository = new SqliteEvaluationRepository(db);
        const results = await repository.listEvaluations("good");
        expect(results).toHaveLength(1);
        expect(results[0]?.title).toBe("Claude Code - agent-tracer");
        expect(results[0]?.displayTitle).toBe("hi?");
        db.close();
    });
    it("returns saved workflow content overrides when available", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-workflow-content",
            title: "Claude Code - agent-tracer",
            workspacePath: "/tmp/agent-tracer"
        });
        seedEvaluation(db, {
            taskId: "task-workflow-content",
            rating: "good",
            workflowSnapshotJson: JSON.stringify({
                objective: "workflow content preview",
                originalRequest: "workflow content preview",
                outcomeSummary: "saved override",
                approachSummary: "manual snapshot edit",
                reuseWhen: null,
                watchItems: [],
                keyDecisions: ["persist override"],
                nextSteps: [],
                keyFiles: [],
                modifiedFiles: [],
                verificationSummary: null,
                searchText: "workflow content preview"
            }),
            workflowContext: "# Workflow: workflow content preview\n\n## Outcome\nsaved override"
        });
        seedUserMessage(db, {
            id: "event-user-content",
            taskId: "task-workflow-content",
            body: "workflow content preview"
        });
        const repository = new SqliteEvaluationRepository(db);
        const result = await repository.getWorkflowContent(TaskId("task-workflow-content"));
        expect(result?.source).toBe("saved");
        expect(result?.workflowSnapshot.outcomeSummary).toBe("saved override");
        expect(result?.workflowContext).toContain("saved override");
        db.close();
    });
    it("stores separate snapshot rows for task and turn scopes", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-scoped-evaluation",
            title: "Scoped workflow storage"
        });
        const repository = new SqliteEvaluationRepository(db);
        await repository.upsertEvaluation({
            taskId: TaskId("task-scoped-evaluation"),
            scopeKey: "task",
            scopeKind: "task",
            scopeLabel: "Whole task",
            turnIndex: null,
            rating: "good",
            useCase: "task snapshot",
            workflowTags: ["workflow"],
            outcomeNote: null,
            approachNote: null,
            reuseWhen: null,
            watchouts: null,
            evaluatedAt: "2026-03-28T00:00:00.000Z",
        });
        await repository.upsertEvaluation({
            taskId: TaskId("task-scoped-evaluation"),
            scopeKey: "turn:2",
            scopeKind: "turn",
            scopeLabel: "Turn 2",
            turnIndex: 2,
            rating: "good",
            useCase: "turn snapshot",
            workflowTags: ["workflow", "turn"],
            outcomeNote: null,
            approachNote: null,
            reuseWhen: null,
            watchouts: null,
            evaluatedAt: "2026-03-28T00:01:00.000Z",
        });
        const taskEvaluation = await repository.getEvaluation(TaskId("task-scoped-evaluation"), "task");
        const turnEvaluation = await repository.getEvaluation(TaskId("task-scoped-evaluation"), "turn:2");
        await repository.recordBriefingCopy(TaskId("task-scoped-evaluation"), "2026-03-28T00:02:00.000Z", "turn:2");
        const turnEvaluationAfterCopy = await repository.getEvaluation(TaskId("task-scoped-evaluation"), "turn:2");
        const summaries = await repository.listEvaluations("good");
        expect(taskEvaluation?.scopeKey).toBe("task");
        expect(turnEvaluation?.scopeKey).toBe("turn:2");
        expect(turnEvaluation?.scopeLabel).toBe("Turn 2");
        expect(turnEvaluationAfterCopy?.qualitySignals.briefingCopyCount).toBe(1);
        expect(taskEvaluation?.qualitySignals.briefingCopyCount).toBe(0);
        expect(summaries.map((summary) => summary.snapshotId)).toEqual([
            "task-scoped-evaluation#turn:2",
            "task-scoped-evaluation#task",
        ]);
        db.close();
    });
    it("creates playbooks and marks their source snapshots as promoted", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-playbook-source",
            title: "Knowledge promotion flow"
        });
        seedEvaluation(db, {
            taskId: "task-playbook-source",
            rating: "good"
        });
        const repository = new SqliteEvaluationRepository(db);
        const playbook = await repository.createPlaybook({
            title: "Promote reusable workflow",
            status: "active",
            whenToUse: "When a snapshot becomes a durable pattern",
            approach: "Start from the saved snapshot and refine the reusable parts.",
            keySteps: ["Review the snapshot", "Extract reusable steps"],
            watchouts: ["Do not overfit to a single task"],
            sourceSnapshotIds: ["task-playbook-source:v1"],
            tags: ["knowledge", "playbook"]
        });
        expect(playbook.status).toBe("active");
        expect(playbook.sourceSnapshotIds).toContain("task-playbook-source:v1");
        const summaries = await repository.listPlaybooks(undefined, "active", 10);
        expect(summaries).toHaveLength(1);
        expect(summaries[0]?.title).toBe("Promote reusable workflow");
        const evaluation = await repository.getEvaluation(TaskId("task-playbook-source"));
        expect(evaluation?.promotedTo).toBe(playbook.id);
        db.close();
    });
    it("saves and lists task briefings", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        seedTask(db, {
            id: "task-briefing-source",
            title: "Briefing persistence flow"
        });
        const repository = new SqliteEvaluationRepository(db);
        const saved = await repository.saveBriefing(TaskId("task-briefing-source"), {
            purpose: "continue",
            format: "markdown",
            memo: "Resume from tests",
            content: "# Briefing\nContinue from the failing tests",
            generatedAt: "2026-03-28T00:00:00.000Z"
        });
        expect(saved.taskId).toBe("task-briefing-source");
        const briefings = await repository.listBriefings(TaskId("task-briefing-source"));
        expect(briefings).toHaveLength(1);
        expect(briefings[0]?.content).toContain("Continue from the failing tests");
        db.close();
    });
});
function seedTask(db: BetterSqlite3.Database, input: {
    id: string;
    title: string;
    slug?: string;
    workspacePath?: string;
}): void {
    db.prepare(`
    insert into monitoring_tasks (
      id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
      background_task_id, created_at, updated_at, last_session_started_at, cli_source
    ) values (
      @id, @title, @slug, @workspacePath, 'completed', 'primary', null, null,
      null, '2026-03-28T00:00:00.000Z', '2026-03-28T00:00:00.000Z',
      '2026-03-28T00:00:00.000Z', 'claude-plugin'
    )
  `).run({
        id: input.id,
        title: input.title,
        slug: input.slug ?? input.id,
        workspacePath: input.workspacePath ?? null
    });
}
function seedEvaluation(db: BetterSqlite3.Database, input: {
    taskId: string;
    rating: "good" | "skip";
    useCase?: string;
    outcomeNote?: string;
    approachNote?: string;
    evaluatedAt?: string;
    embedding?: string;
    embeddingModel?: string;
    workflowSnapshotJson?: string;
    workflowContext?: string;
}): void {
    db.prepare(`
    insert into task_evaluations (
      task_id, rating, use_case, workflow_tags, outcome_note, approach_note, reuse_when,
      watchouts, version, promoted_to, reuse_count, last_reused_at, briefing_copy_count,
      workflow_snapshot_json, workflow_context, search_text, embedding, embedding_model, evaluated_at
    ) values (
      @taskId, @rating, @useCase, '["search"]', @outcomeNote, @approachNote, null,
      null, 1, null, 0, null, 0, @workflowSnapshotJson, @workflowContext, null, @embedding, @embeddingModel, @evaluatedAt
    )
  `).run({
        taskId: input.taskId,
        rating: input.rating,
        useCase: input.useCase ?? null,
        outcomeNote: input.outcomeNote ?? null,
        approachNote: input.approachNote ?? null,
        workflowSnapshotJson: input.workflowSnapshotJson ?? null,
        workflowContext: input.workflowContext ?? null,
        embedding: input.embedding ?? null,
        embeddingModel: input.embeddingModel ?? null,
        evaluatedAt: input.evaluatedAt ?? "2026-03-28T00:00:00.000Z"
    });
}
function seedEvent(db: BetterSqlite3.Database, input: {
    id: string;
    taskId: string;
    title: string;
    body: string;
}): void {
    db.prepare(`
    insert into timeline_events (
      id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
    ) values (
      @id, @taskId, null, 'context.saved', 'planning', @title, @body,
      '{}', '{"lane":"planning","tags":[],"matches":[]}', '2026-03-28T00:00:01.000Z'
    )
  `).run(input);
}
function seedUserMessage(db: BetterSqlite3.Database, input: {
    id: string;
    taskId: string;
    body: string;
}): void {
    db.prepare(`
    insert into timeline_events (
      id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
    ) values (
      @id, @taskId, null, 'user.message', 'user', 'User request', @body,
      '{"captureMode":"raw"}', '{"lane":"user","tags":[],"matches":[]}', '2026-03-28T00:00:01.000Z'
    )
  `).run(input);
}
