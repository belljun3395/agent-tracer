import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { TaskId } from "@monitor/core";
import { afterEach, describe, expect, it } from "vitest";
import { createSchema, createSqliteMonitorPorts } from "../../src/infrastructure/sqlite";
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
            id: "task-imported",
            title: "Claude Code - imported task",
            slug: "imported-task",
            createdAt: "2026-03-20T08:05:00.000Z",
            updatedAt: "2026-03-20T08:05:00.000Z"
        });
        seedDb.prepare(`
      insert into runtime_session_bindings (
        runtime_source, runtime_session_id, task_id, monitor_session_id, created_at, updated_at
      ) values (
        'claude-plugin', 'runtime-1', 'task-claude', null, '2026-03-20T08:00:00.000Z', '2026-03-20T08:01:00.000Z'
      )
    `).run();
        seedDb.prepare(`
      insert into timeline_events (
        id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
      ) values (
        'event-1', 'task-imported', null, 'user.message', 'user', 'Imported request', null,
        @metadata, '{"lane":"user","tags":[],"matches":[]}', '2026-03-20T08:05:10.000Z'
      )
    `).run({
            metadata: JSON.stringify({ source: "claude-plugin" })
        });
        seedDb.close();
        const ports = createSqliteMonitorPorts({ databasePath });
        closePorts = ports.close;
        const claudeTask = await ports.tasks.findById(TaskId("task-claude"));
        const importedTask = await ports.tasks.findById(TaskId("task-imported"));
        expect(claudeTask?.runtimeSource).toBe("claude-plugin");
        expect(importedTask?.runtimeSource).toBe("claude-plugin");
    });
    it("adds missing workflow search columns for existing evaluation tables", async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-evaluation-migration-"));
        const databasePath = path.join(tempDir, "monitor.sqlite");
        const seedDb = new BetterSqlite3(databasePath);
        seedDb.exec(`
      create table monitoring_tasks (
        id text primary key,
        title text not null,
        slug text not null,
        workspace_path text,
        status text not null,
        created_at text not null,
        updated_at text not null
      );
      create table task_evaluations (
        task_id text primary key references monitoring_tasks(id) on delete cascade,
        rating text not null,
        use_case text,
        workflow_tags text,
        outcome_note text,
        evaluated_at text not null
      );
      create table task_sessions (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        status text not null,
        summary text,
        started_at text not null,
        ended_at text
      );
      create table timeline_events (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        session_id text references task_sessions(id) on delete set null,
        kind text not null,
        lane text not null,
        title text not null,
        body text,
        metadata_json text not null,
        classification_json text not null,
        created_at text not null
      );
      create table runtime_session_bindings (
        runtime_source text not null,
        runtime_session_id text not null,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        monitor_session_id text,
        created_at text not null,
        updated_at text not null,
        primary key (runtime_source, runtime_session_id)
      );
      create table bookmarks (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        event_id text references timeline_events(id) on delete cascade,
        kind text not null,
        title text not null,
        note text,
        metadata_json text not null default '{}',
        created_at text not null,
        updated_at text not null
      );
    `);
        seedDb.close();
        const ports = createSqliteMonitorPorts({ databasePath });
        closePorts = ports.close;
        const inspectDb = new BetterSqlite3(databasePath, { readonly: true });
        const columns = inspectDb.pragma("table_info(task_evaluations)") as Array<{
            name: string;
        }>;
        expect(columns.some((column) => column.name === "scope_key")).toBe(true);
        expect(columns.some((column) => column.name === "scope_kind")).toBe(true);
        expect(columns.some((column) => column.name === "scope_label")).toBe(true);
        expect(columns.some((column) => column.name === "turn_index")).toBe(true);
        expect(columns.some((column) => column.name === "search_text")).toBe(true);
        expect(columns.some((column) => column.name === "workflow_snapshot_json")).toBe(true);
        expect(columns.some((column) => column.name === "workflow_context")).toBe(true);
        expect(columns.some((column) => column.name === "embedding")).toBe(true);
        expect(columns.some((column) => column.name === "embedding_model")).toBe(true);
        expect(columns.some((column) => column.name === "version")).toBe(true);
        expect(columns.some((column) => column.name === "promoted_to")).toBe(true);
        expect(columns.some((column) => column.name === "reuse_count")).toBe(true);
        expect(columns.some((column) => column.name === "last_reused_at")).toBe(true);
        expect(columns.some((column) => column.name === "briefing_copy_count")).toBe(true);
        const playbookColumns = inspectDb.pragma("table_info(playbooks)") as Array<{
            name: string;
        }>;
        expect(playbookColumns.some((column) => column.name === "title")).toBe(true);
        expect(playbookColumns.some((column) => column.name === "status")).toBe(true);
        const briefingColumns = inspectDb.pragma("table_info(briefings)") as Array<{
            name: string;
        }>;
        expect(briefingColumns.some((column) => column.name === "task_id")).toBe(true);
        expect(briefingColumns.some((column) => column.name === "content")).toBe(true);
        inspectDb.close();
    });
});
