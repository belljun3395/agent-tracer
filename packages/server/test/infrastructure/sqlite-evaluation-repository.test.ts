import BetterSqlite3 from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { serializeEmbedding } from "../../src/infrastructure/embedding/index.js";
import { SqliteEvaluationRepository } from "../../src/infrastructure/sqlite/sqlite-evaluation-repository.js";
import { createSchema } from "../../src/infrastructure/sqlite/sqlite-schema.js";

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

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
});

function seedTask(db: BetterSqlite3.Database, input: {
  id: string;
  title: string;
}): void {
  db.prepare(`
    insert into monitoring_tasks (
      id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
      background_task_id, created_at, updated_at, last_session_started_at, cli_source
    ) values (
      @id, @title, @slug, null, 'completed', 'primary', null, null,
      null, '2026-03-28T00:00:00.000Z', '2026-03-28T00:00:00.000Z',
      '2026-03-28T00:00:00.000Z', 'codex-skill'
    )
  `).run({
    id: input.id,
    title: input.title,
    slug: input.id
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
}): void {
  db.prepare(`
    insert into task_evaluations (
      task_id, rating, use_case, workflow_tags, outcome_note, approach_note, reuse_when,
      watchouts, search_text, embedding, embedding_model, evaluated_at
    ) values (
      @taskId, @rating, @useCase, '["search"]', @outcomeNote, @approachNote, null,
      null, null, @embedding, @embeddingModel, @evaluatedAt
    )
  `).run({
    taskId: input.taskId,
    rating: input.rating,
    useCase: input.useCase ?? null,
    outcomeNote: input.outcomeNote ?? null,
    approachNote: input.approachNote ?? null,
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
