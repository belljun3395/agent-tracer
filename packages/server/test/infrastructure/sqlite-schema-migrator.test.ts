import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createSchema } from "../../src/infrastructure/sqlite/sqlite-schema.js";
import { createSqliteMonitorPorts } from "../../src/infrastructure/sqlite/index.js";

describe("sqlite runtimeSource backfill", () => {
  let tempDir: string | null = null;
  let closePorts: (() => void) | null = null;

  afterEach(() => {
    closePorts?.();
    closePorts = null;

    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("backfills task runtimeSource from bindings first and event metadata second", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-runtime-source-"));
    const databasePath = path.join(tempDir, "monitor.sqlite");
    const seedDb = new BetterSqlite3(databasePath);

    createSchema(seedDb);

    seedDb.prepare(`
      insert into monitoring_tasks (
        id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
        background_task_id, created_at, updated_at, last_session_started_at, cli_source
      ) values (
        @id, @title, @slug, null, 'running', 'primary', null, null,
        null, @createdAt, @updatedAt, @updatedAt, null
      )
    `).run({
      id: "task-claude",
      title: "Claude Code - agent-tracer",
      slug: "claude-task",
      createdAt: "2026-03-20T08:00:00.000Z",
      updatedAt: "2026-03-20T08:00:00.000Z"
    });

    seedDb.prepare(`
      insert into monitoring_tasks (
        id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
        background_task_id, created_at, updated_at, last_session_started_at, cli_source
      ) values (
        @id, @title, @slug, null, 'completed', 'primary', null, null,
        null, @createdAt, @updatedAt, @updatedAt, null
      )
    `).run({
      id: "task-opencode",
      title: "OpenCode - agent-tracer",
      slug: "opencode-task",
      createdAt: "2026-03-20T08:05:00.000Z",
      updatedAt: "2026-03-20T08:05:00.000Z"
    });

    seedDb.prepare(`
      insert into runtime_session_bindings (
        runtime_source, runtime_session_id, task_id, monitor_session_id, created_at, updated_at
      ) values (
        'claude-hook', 'runtime-1', 'task-claude', null, '2026-03-20T08:00:00.000Z', '2026-03-20T08:01:00.000Z'
      )
    `).run();

    seedDb.prepare(`
      insert into timeline_events (
        id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
      ) values (
        'event-1', 'task-opencode', null, 'user.message', 'user', 'OpenCode request', null,
        @metadata, '{"lane":"user","tags":[],"matches":[]}', '2026-03-20T08:05:10.000Z'
      )
    `).run({
      metadata: JSON.stringify({ source: "opencode-plugin" })
    });

    seedDb.close();

    const ports = createSqliteMonitorPorts({ databasePath });
    closePorts = ports.close;

    const claudeTask = await ports.tasks.findById("task-claude");
    const opencodeTask = await ports.tasks.findById("task-opencode");

    expect(claudeTask?.runtimeSource).toBe("claude-hook");
    expect(opencodeTask?.runtimeSource).toBe("opencode-plugin");
  });
});
