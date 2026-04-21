import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createSchema } from "~adapters/persistence/sqlite/schema/sqlite.schema.js";
import { createDuckDbAnalyticsService, type DuckDbAnalyticsService } from "./duckdb.analytics.service.js";
import { INITIAL_ANALYSIS_QUERIES } from "./duckdb.analytics.queries.js";

describe("DuckDbAnalyticsService", () => {
    const tempDirs: string[] = [];
    const services: DuckDbAnalyticsService[] = [];

    afterEach(() => {
        for (const service of services.splice(0)) {
            service.close();
        }
        for (const dir of tempDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("builds bronze, silver, and gold analytics tables from the current SQLite timeline schema", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tracer-analytics-"));
        tempDirs.push(dir);

        const sqlitePath = path.join(dir, "monitor.sqlite");
        seedSqliteMonitor(sqlitePath);

        const service = createDuckDbAnalyticsService({
            sqliteDatabasePath: sqlitePath,
            duckDbPath: path.join(dir, "analytics.duckdb"),
            archiveDir: path.join(dir, "archive"),
            portableDir: path.join(dir, "portable"),
            enabled: true,
            runOnStart: false,
            logger: { info: () => undefined, warn: () => undefined },
        });
        services.push(service);

        const result = await service.runOnce();

        expect(result.sourceTable).toBe("timeline_events_view");
        expect(result.bronzeEventCount).toBe(3);
        expect(result.taskSummaryCount).toBe(3);

        const [toolCall] = await service.queryRows<{ tool_name: string; outcome: string; duration_ms: number }>(
            "select tool_name, outcome, duration_ms::integer as duration_ms from fact_tool_calls order by tool_name",
        );
        expect(toolCall).toMatchObject({
            tool_name: "shell",
            outcome: "success",
            duration_ms: 125,
        });

        const [session] = await service.queryRows<{ outcome: string; duration_ms: number }>(
            "select outcome, duration_ms::integer as duration_ms from fact_sessions",
        );
        expect(session).toMatchObject({
            outcome: "success",
            duration_ms: 60_000,
        });

        const [primaryTask] = await service.queryRows<{
            title: string;
            raw_title: string;
            display_title: string;
            title_source: string;
            title_quality: string;
        }>("select title, raw_title, display_title, title_source, title_quality from dim_task where task_id = 'task-1'");
        expect(primaryTask).toEqual({
            title: "Fix the build",
            raw_title: "Codex CLI — project",
            display_title: "Fix the build",
            title_source: "first_user_prompt",
            title_quality: "derived",
        });

        const [backgroundTask] = await service.queryRows<{
            title: string;
            raw_title: string;
            display_title: string;
            title_source: string;
            title_quality: string;
        }>("select title, raw_title, display_title, title_source, title_quality from dim_task where task_id = 'task-2'");
        expect(backgroundTask).toEqual({
            title: "Explore: Fix the build",
            raw_title: "Subagent: Explore",
            display_title: "Explore: Fix the build",
            title_source: "parent_task",
            title_quality: "derived",
        });

        const [genericTask] = await service.queryRows<{
            title: string;
            raw_title: string;
            display_title: string;
            title_source: string;
            title_quality: string;
        }>("select title, raw_title, display_title, title_source, title_quality from dim_task where task_id = 'task-3'");
        expect(genericTask).toEqual({
            title: "Claude task (prompt not captured)",
            raw_title: "Claude Code — project",
            display_title: "Claude task (prompt not captured)",
            title_source: "runtime_fallback",
            title_quality: "generic",
        });

        for (const query of Object.values(INITIAL_ANALYSIS_QUERIES)) {
            await expect(service.queryRows(query)).resolves.toBeDefined();
        }

        expect(fs.existsSync(path.join(dir, "portable", "fact_sessions.parquet"))).toBe(true);
        expect(fs.existsSync(path.join(dir, "portable", "fact_turn_tokens.parquet"))).toBe(true);
        await expect(service.queryRows(
            `select count(*)::integer as count from read_parquet('${path.join(dir, "portable", "fact_sessions.parquet").replaceAll("'", "''")}')`,
        )).resolves.toEqual([{ count: 1 }]);
    });

    it("extracts tool target, failure, and per-turn token metadata from event payloads", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tracer-analytics-enriched-"));
        tempDirs.push(dir);

        const sqlitePath = path.join(dir, "monitor.sqlite");
        seedEnrichedSqliteMonitor(sqlitePath);

        const service = createDuckDbAnalyticsService({
            sqliteDatabasePath: sqlitePath,
            duckDbPath: path.join(dir, "analytics.duckdb"),
            archiveDir: path.join(dir, "archive"),
            portableDir: path.join(dir, "portable"),
            enabled: true,
            runOnStart: false,
            logger: { info: () => undefined, warn: () => undefined },
        });
        services.push(service);

        await service.runOnce();

        const toolRows = await service.queryRows<{
            tool_name: string;
            outcome: string;
            failed: boolean;
            file_path: string | null;
            command_text: string | null;
            command_description: string | null;
            call_target: string | null;
            is_interrupt: boolean;
            error_message: string | null;
        }>(
            "select tool_name, outcome, failed, file_path, command_text, command_description, call_target, is_interrupt, error_message from fact_tool_calls order by tool_name",
        );
        const byName = Object.fromEntries(toolRows.map((r) => [r.tool_name, r]));

        expect(byName["Read"]).toMatchObject({
            outcome: "success",
            failed: false,
            file_path: "/tmp/project/src/index.ts",
            call_target: "/tmp/project/src/index.ts",
        });
        expect(byName["Bash"]).toMatchObject({
            outcome: "success",
            command_text: "npm test",
            command_description: "Run tests",
            call_target: "npm test",
        });
        expect(byName["Edit"]).toMatchObject({
            outcome: "failure",
            failed: true,
            error_message: "permission denied",
            file_path: "/tmp/project/src/auth.ts",
        });

        const [summary] = await service.queryRows<{
            tool_call_count: number;
            tool_failure_count: number;
            tool_interrupt_count: number;
            max_turn_input_tokens: number;
            max_turn_output_tokens: number;
            sum_turn_input_tokens: number;
            sum_cache_read_tokens: number;
            max_cost_total_usd: number;
        }>(`
            select
              tool_call_count::integer as tool_call_count,
              tool_failure_count::integer as tool_failure_count,
              tool_interrupt_count::integer as tool_interrupt_count,
              max_turn_input_tokens::integer as max_turn_input_tokens,
              max_turn_output_tokens::integer as max_turn_output_tokens,
              sum_turn_input_tokens::integer as sum_turn_input_tokens,
              sum_cache_read_tokens::integer as sum_cache_read_tokens,
              max_cost_total_usd::double as max_cost_total_usd
            from fact_task_summary
            where task_id = 'task-rich'
        `);
        expect(summary).toBeDefined();
        expect(summary).toMatchObject({
            tool_call_count: 3,
            tool_failure_count: 1,
            max_turn_input_tokens: 1500,
            max_turn_output_tokens: 400,
            sum_turn_input_tokens: 2500,
            sum_cache_read_tokens: 300,
        });
        expect(summary!.max_cost_total_usd).toBeCloseTo(0.0123, 4);

        const turnTokens = await service.queryRows<{
            input_tokens: number;
            output_tokens: number;
            cache_read_tokens: number;
            cost_total_usd: number;
            model_id: string | null;
        }>(`
            select
              input_tokens::integer as input_tokens,
              output_tokens::integer as output_tokens,
              cache_read_tokens::integer as cache_read_tokens,
              cost_total_usd::double as cost_total_usd,
              model_id
            from fact_turn_tokens
            where task_id = 'task-rich'
            order by event_time_ms
        `);
        expect(turnTokens).toHaveLength(2);
        expect(turnTokens[0]).toMatchObject({
            input_tokens: 1000,
            output_tokens: 200,
            cache_read_tokens: 100,
            model_id: "claude-opus-4-7",
        });
        expect(turnTokens[1]).toMatchObject({
            input_tokens: 1500,
            output_tokens: 400,
            cache_read_tokens: 200,
        });
    });

    it("classifies Codex rollout tool calls from semantic subtype metadata", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tracer-analytics-subtypes-"));
        tempDirs.push(dir);

        const sqlitePath = path.join(dir, "monitor.sqlite");
        seedSubtypeSqliteMonitor(sqlitePath);

        const service = createDuckDbAnalyticsService({
            sqliteDatabasePath: sqlitePath,
            duckDbPath: path.join(dir, "analytics.duckdb"),
            archiveDir: path.join(dir, "archive"),
            portableDir: path.join(dir, "portable"),
            enabled: true,
            runOnStart: false,
            logger: { info: () => undefined, warn: () => undefined },
        });
        services.push(service);

        await service.runOnce();

        const rows = await service.queryRows<{ tool_name: string; tool_category: string; call_target: string | null }>(
            "select tool_name, tool_category, call_target from fact_tool_calls order by tool_name, tool_category",
        );

        expect(rows).toEqual([
            { tool_name: "apply_patch", tool_category: "file_edit", call_target: "/tmp/project/src/index.ts" },
            { tool_name: "web_search_call", tool_category: "web_fetch", call_target: "https://developers.openai.com/codex/hooks" },
            { tool_name: "web_search_call", tool_category: "web_search", call_target: "Codex hooks" },
        ]);
    });
});

function seedSqliteMonitor(sqlitePath: string): void {
    const db = new BetterSqlite3(sqlitePath);
    try {
        createSchema(db);
        db.exec(`
            insert into tasks_current (
                id,
                title,
                slug,
                workspace_path,
                status,
                task_kind,
                parent_task_id,
                created_at,
                updated_at,
                cli_source
            ) values (
                'task-1',
                'Codex CLI — project',
                'investigate-failing-build',
                '/tmp/project',
                'completed',
                'primary',
                null,
                '2026-04-01T00:00:00.000Z',
                '2026-04-01T00:02:00.000Z',
                'codex'
            ),
            (
                'task-2',
                'Subagent: Explore',
                'subagent-explore',
                '/tmp/project',
                'completed',
                'background',
                'task-1',
                '2026-04-01T00:00:30.000Z',
                '2026-04-01T00:01:30.000Z',
                'codex'
            ),
            (
                'task-3',
                'Claude Code — project',
                'claude-code-project',
                '/tmp/project',
                'completed',
                'primary',
                null,
                '2026-04-01T00:04:00.000Z',
                '2026-04-01T00:05:00.000Z',
                'claude-plugin'
            );

            insert into sessions_current (
                id,
                task_id,
                status,
                summary,
                started_at,
                ended_at
            ) values (
                'session-1',
                'task-1',
                'completed',
                'done',
                '2026-04-01T00:00:00.000Z',
                '2026-04-01T00:01:00.000Z'
            );

            insert into timeline_events_view (
                id,
                task_id,
                session_id,
                kind,
                lane,
                title,
                body,
                metadata_json,
                classification_json,
                created_at
            ) values
            (
                'event-1',
                'task-1',
                'session-1',
                'user.message',
                'user',
                'Request',
                'Fix the build',
                '{}',
                '{}',
                '2026-04-01T00:00:01.000Z'
            ),
            (
                'event-2',
                'task-1',
                'session-1',
                'tool.used',
                'implementation',
                'shell',
                'npm test',
                '{"tool_name":"shell","duration_ms":125,"outcome":"success"}',
                '{}',
                '2026-04-01T00:00:02.000Z'
            ),
            (
                'event-3',
                'task-1',
                'session-1',
                'assistant.response',
                'implementation',
                'Done',
                'Build fixed',
                '{}',
                '{}',
                '2026-04-01T00:01:00.000Z'
            );

            insert into evaluations_current (
                task_id,
                scope_key,
                scope_kind,
                scope_label,
                rating,
                evaluated_at
            ) values (
                'task-1',
                'task',
                'task',
                'Whole task',
                'good',
                '2026-04-01T00:03:00.000Z'
            );

            insert into events (
                event_id,
                event_type,
                schema_ver,
                aggregate_id,
                session_id,
                actor,
                payload_json,
                event_time,
                recorded_at
            ) values (
                'legacy-event-1',
                'tool.invoked',
                1,
                'task-1',
                'session-1',
                'system',
                '{"tool_name":"legacy-shell"}',
                1770000000000,
                1770000000000
            );
        `);
    } finally {
        db.close();
    }
}

function seedEnrichedSqliteMonitor(sqlitePath: string): void {
    const db = new BetterSqlite3(sqlitePath);
    try {
        createSchema(db);
        runSeed(db, `
            insert into tasks_current (
                id,
                title,
                slug,
                workspace_path,
                status,
                task_kind,
                parent_task_id,
                created_at,
                updated_at,
                cli_source
            ) values (
                'task-rich',
                'Rich metadata task',
                'rich-metadata',
                '/tmp/project',
                'completed',
                'primary',
                null,
                '2026-04-10T00:00:00.000Z',
                '2026-04-10T00:05:00.000Z',
                'claude-plugin'
            );

            insert into sessions_current (
                id,
                task_id,
                status,
                summary,
                started_at,
                ended_at
            ) values (
                'session-rich',
                'task-rich',
                'completed',
                'done',
                '2026-04-10T00:00:00.000Z',
                '2026-04-10T00:04:00.000Z'
            );

            insert into timeline_events_view (
                id,
                task_id,
                session_id,
                kind,
                lane,
                title,
                body,
                metadata_json,
                classification_json,
                created_at
            ) values
            (
                'rich-1',
                'task-rich',
                'session-rich',
                'tool.used',
                'implementation',
                'Read',
                '',
                '{"tool_name":"Read","toolName":"Read","filePath":"/tmp/project/src/index.ts","relPath":"src/index.ts","duration_ms":50,"outcome":"success","toolUseId":"t1"}',
                '{}',
                '2026-04-10T00:00:10.000Z'
            ),
            (
                'rich-2',
                'task-rich',
                'session-rich',
                'terminal.command',
                'implementation',
                'Bash',
                'npm test',
                '{"tool_name":"Bash","toolName":"Bash","command":"npm test","description":"Run tests","duration_ms":1200,"outcome":"success","toolUseId":"t2"}',
                '{}',
                '2026-04-10T00:00:30.000Z'
            ),
            (
                'rich-3',
                'task-rich',
                'session-rich',
                'tool.used',
                'implementation',
                'Edit',
                '',
                '{"tool_name":"Edit","toolName":"Edit","filePath":"/tmp/project/src/auth.ts","relPath":"src/auth.ts","failed":true,"error":"permission denied","isInterrupt":false,"toolUseId":"t3"}',
                '{}',
                '2026-04-10T00:01:00.000Z'
            ),
            (
                'rich-4',
                'task-rich',
                'session-rich',
                'context.snapshot',
                'system',
                'StatusLine',
                '',
                '{"contextWindowInputTokens":1000,"contextWindowOutputTokens":200,"contextWindowCacheReadTokens":100,"contextWindowCacheCreationTokens":50,"contextWindowTotalTokens":50000,"contextWindowUsedPct":25,"contextWindowSize":200000,"costTotalUsd":0.0075,"modelId":"claude-opus-4-7"}',
                '{}',
                '2026-04-10T00:02:00.000Z'
            ),
            (
                'rich-5',
                'task-rich',
                'session-rich',
                'context.snapshot',
                'system',
                'StatusLine',
                '',
                '{"contextWindowInputTokens":1500,"contextWindowOutputTokens":400,"contextWindowCacheReadTokens":200,"contextWindowCacheCreationTokens":80,"contextWindowTotalTokens":52500,"contextWindowUsedPct":26,"contextWindowSize":200000,"costTotalUsd":0.0123,"modelId":"claude-opus-4-7"}',
                '{}',
                '2026-04-10T00:03:00.000Z'
            );
        `);
    } finally {
        db.close();
    }
}

function seedSubtypeSqliteMonitor(sqlitePath: string): void {
    const db = new BetterSqlite3(sqlitePath);
    try {
        createSchema(db);
        runSeed(db, `
            insert into tasks_current (
                id,
                title,
                slug,
                workspace_path,
                status,
                task_kind,
                parent_task_id,
                created_at,
                updated_at,
                cli_source
            ) values (
                'task-subtype',
                'Subtype task',
                'subtype-task',
                '/tmp/project',
                'completed',
                'primary',
                null,
                '2026-04-10T00:00:00.000Z',
                '2026-04-10T00:05:00.000Z',
                'codex-cli'
            );

            insert into sessions_current (
                id,
                task_id,
                status,
                summary,
                started_at,
                ended_at
            ) values (
                'session-subtype',
                'task-subtype',
                'completed',
                'done',
                '2026-04-10T00:00:00.000Z',
                '2026-04-10T00:04:00.000Z'
            );

            insert into timeline_events_view (
                id,
                task_id,
                session_id,
                kind,
                lane,
                title,
                body,
                metadata_json,
                classification_json,
                created_at
            ) values
            (
                'subtype-1',
                'task-subtype',
                'session-subtype',
                'tool.used',
                'exploration',
                'Web search: Codex hooks',
                'Codex hooks',
                '{"toolName":"web_search_call","subtypeKey":"web_search","subtypeLabel":"Web search","toolFamily":"explore","operation":"search","entityType":"query","entityName":"Codex hooks","source":"codex-rollout","query":"Codex hooks"}',
                '{}',
                '2026-04-10T00:00:10.000Z'
            ),
            (
                'subtype-2',
                'task-subtype',
                'session-subtype',
                'tool.used',
                'exploration',
                'Web fetch: https://developers.openai.com/codex/hooks',
                'https://developers.openai.com/codex/hooks',
                '{"toolName":"web_search_call","subtypeKey":"web_fetch","subtypeLabel":"Web fetch","toolFamily":"explore","operation":"fetch","entityType":"url","entityName":"https://developers.openai.com/codex/hooks","source":"codex-rollout","webUrls":["https://developers.openai.com/codex/hooks"]}',
                '{}',
                '2026-04-10T00:00:20.000Z'
            ),
            (
                'subtype-3',
                'task-subtype',
                'session-subtype',
                'tool.used',
                'implementation',
                'Apply patch: index.ts',
                'Codex applied a patch touching /tmp/project/src/index.ts.',
                '{"toolName":"apply_patch","subtypeKey":"apply_patch","subtypeLabel":"Apply patch","toolFamily":"file","operation":"patch","entityType":"file","entityName":"/tmp/project/src/index.ts","source":"codex-rollout","filePath":"/tmp/project/src/index.ts","relPath":"/tmp/project/src/index.ts"}',
                '{}',
                '2026-04-10T00:00:30.000Z'
            );
        `);
    } finally {
        db.close();
    }
}

function runSeed(db: BetterSqlite3.Database, sql: string): void {
    db.exec(sql);
}
