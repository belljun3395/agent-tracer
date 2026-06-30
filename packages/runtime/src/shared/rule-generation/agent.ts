import { resolveMonitorBaseUrl } from "~shared/config/env.js";
import { monitorUserHeader } from "~shared/transport/transport.js";

const MCP_SERVER_NAME = "monitor-rule-gen";

interface RuleProposal {
    name: string;
    trigger?: { phrases: string[] };
    triggerOn?: "user" | "assistant";
    expect: {
        action?: "command" | "file-read" | "file-write" | "web";
        commandMatches?: string[];
        pattern?: string;
    };
    rationale: string;
}

export interface RunRuleGenerationOptions {
    taskId: string;
    jobId: string;
    workspacePath: string;
    apiKey?: string;
    model?: string;
    maxRules?: number;
    language?: string;
}

const LANGUAGE_DIRECTIVES: Record<string, string> = {
    auto: "Mirror the language of the task (Korean → Korean, English → English, etc.).",
    ko: "Write every rule name and rationale in Korean (한국어).",
    en: "Write every rule name and rationale in English.",
    ja: "Write every rule name and rationale in Japanese (日本語).",
    zh: "Write every rule name and rationale in Simplified Chinese (简体中文).",
};

function buildOutputSchema() {
    return {
        type: "object" as const,
        properties: {
            rules: {
                type: "array" as const,
                items: {
                    type: "object" as const,
                    properties: {
                        name: { type: "string" as const },
                        trigger: {
                            type: "object" as const,
                            properties: { phrases: { type: "array" as const, items: { type: "string" as const } } },
                        },
                        triggerOn: { type: "string" as const, enum: ["user", "assistant"] },
                        expect: {
                            type: "object" as const,
                            properties: {
                                action: { type: "string" as const },
                                commandMatches: { type: "array" as const, items: { type: "string" as const } },
                                pattern: { type: "string" as const },
                            },
                        },
                        rationale: { type: "string" as const },
                    },
                    required: ["name", "expect", "rationale"],
                },
            },
        },
        required: ["rules"],
    };
}

export async function runRuleGeneration(opts: RunRuleGenerationOptions): Promise<void> {
    const baseUrl = resolveMonitorBaseUrl();
    const userHeaders = monitorUserHeader();
    const jsonHeaders = { ...userHeaders, "Content-Type": "application/json" };

    const maxRules = opts.maxRules ?? 5;
    const language = opts.language ?? "auto";
    const langDirective = LANGUAGE_DIRECTIVES[language] ?? LANGUAGE_DIRECTIVES["auto"]!;

    const systemPromptAppend = `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

Tools available:
  - ${MCP_SERVER_NAME}__get_task_events(taskId, limit?) : slim event log (kind, title, body). Default limit=50 — call once with limit=50 to get an overview.
  - ${MCP_SERVER_NAME}__list_rules(scope?)              : existing rules — call once to avoid duplicates.

Efficient workflow (max 5 tool calls total):
  1. get_task_events(taskId, 50) — scan the event types and titles to understand what work was done.
  2. list_rules() — check existing rules.
  3. Immediately produce 3-5 rules based on what you observed. Do NOT read workspace files unless you already know the exact filename you need.

Rules are not blockers. They describe what to EXPECT a future agent doing similar work to do.

Each rule has:
  - name     : short imperative (under 60 chars)
  - trigger  : { phrases: string[] }  -- optional; user message that triggers this check
  - triggerOn: "user" | "assistant"   -- optional
  - expect   : at least one of: action, commandMatches, pattern
  - rationale: 1 short sentence (under 200 chars)

Guidelines:
  - Prefer commandMatches (literal commands) over pattern (regex).
  - Lean into patterns specific to THIS task.
  - Output exactly 3-5 rules.

Output language: ${langDirective}

Return JSON conforming to the provided schema immediately after your tool calls.`;

    const userPrompt = `Task ID: ${opts.taskId}\nWorkspace: ${opts.workspacePath}\n\nPropose up to ${maxRules} rules for task ${opts.taskId}.`;

    const allowedTools = [
        "Read", "Glob", "Grep",
        `${MCP_SERVER_NAME}__get_task_events`,
        `${MCP_SERVER_NAME}__list_rules`,
    ];

    let resultRules: RuleProposal[] = [];
    let modelUsed = opts.model ?? "claude-sonnet-4-6";
    let costUsd: number | null = null;
    let numTurns: number | null = null;
    let usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number } | null = null;
    let errorMsg: string | null = null;
    const startedAt = Date.now();

    try {
        // Dynamic import — claude-agent-sdk is an optional dependency
        const sdk = await import("@anthropic-ai/claude-agent-sdk");
        const { query, createSdkMcpServer, tool } = sdk;
        const { z } = await import("zod");

        const mcpServer = createSdkMcpServer({
            name: MCP_SERVER_NAME,
            tools: [
                tool(
                    "get_task_events",
                    "Get the chronological event sequence for a task (tool calls, shell commands, file edits). Returns slim records (kind, title, body truncated to 200 chars). Use a small limit first to get a high-level overview.",
                    { taskId: z.string(), limit: z.number().int().min(1).max(100).optional() },
                    async ({ taskId, limit }: { taskId: string; limit?: number | undefined }) => {
                        const resolvedLimit = limit ?? 50;
                        const resp = await fetch(
                            `${baseUrl}/api/v1/events?taskId=${encodeURIComponent(taskId)}&limit=${resolvedLimit}`,
                            { headers: userHeaders },
                        );
                        const raw = await resp.json() as { data?: { kind: string; title?: string; body?: string }[] };
                        const events = Array.isArray(raw?.data) ? raw.data : [];
                        const slim = events.map((e) => ({
                            kind: e.kind,
                            title: e.title ?? "",
                            body: typeof e.body === "string" ? e.body.slice(0, 200) : "",
                        }));
                        return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
                    },
                ),
                tool(
                    "list_rules",
                    "List existing rules (name + trigger) to avoid duplicates.",
                    { scope: z.enum(["global", "task"]).optional().default("global") },
                    async ({ scope }: { scope?: string }) => {
                        const resp = await fetch(
                            `${baseUrl}/api/v1/rules?scope=${scope ?? "global"}`,
                            { headers: userHeaders },
                        );
                        const data = await resp.json() as { rules?: { name: string; trigger?: unknown }[] };
                        const rules = Array.isArray(data?.rules) ? data.rules : [];
                        const slim = rules.map((r) => ({ name: r.name, trigger: r.trigger ?? null }));
                        return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
                    },
                ),
            ],
        });

        const q = query({
            prompt: userPrompt,
            options: {
                cwd: opts.workspacePath,
                model: opts.model ?? "claude-sonnet-4-6",
                allowedTools,
                tools: allowedTools,
                maxTurns: 15,
                mcpServers: { [MCP_SERVER_NAME]: mcpServer },
                systemPrompt: {
                    type: "preset" as const,
                    preset: "claude_code" as const,
                    append: systemPromptAppend,
                    excludeDynamicSections: true,
                },
                outputFormat: { type: "json_schema" as const, schema: buildOutputSchema() },
                env: {
                    ...process.env,
                    ...(opts.apiKey ? { ANTHROPIC_API_KEY: opts.apiKey } : {}),
                    MONITOR_TASK_ORIGIN: "server-sdk",
                },
                permissionMode: "bypassPermissions" as const,
                allowDangerouslySkipPermissions: true,
                strictMcpConfig: true,
                includePartialMessages: false,
            },
        });

        for await (const msg of q) {
            if (msg.type === "result") {
                costUsd = msg.total_cost_usd;
                numTurns = msg.num_turns;
                if (msg.usage) {
                    usage = {
                        inputTokens: msg.usage.input_tokens,
                        outputTokens: msg.usage.output_tokens,
                        cacheReadTokens: msg.usage.cache_read_input_tokens,
                        cacheCreationTokens: msg.usage.cache_creation_input_tokens,
                    };
                }
                if (msg.subtype === "success" && msg.structured_output) {
                    const output = msg.structured_output as { rules?: unknown[] };
                    resultRules = (Array.isArray(output.rules) ? output.rules : []) as RuleProposal[];
                } else if (msg.subtype !== "success") {
                    const errors = "errors" in msg && Array.isArray(msg.errors) ? msg.errors : [];
                    errorMsg = `${msg.subtype}${errors.length > 0 ? `: ${(errors as string[]).join("; ")}` : ""}`;
                }
                break;
            }
        }
    } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - startedAt;

    if (errorMsg) {
        await fetch(`${baseUrl}/api/v1/rules/generate/${opts.jobId}/fail`, {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({ error: errorMsg }),
        }).catch(() => {});
        return;
    }

    await fetch(`${baseUrl}/api/v1/rules/generate/${opts.jobId}/proposals`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
            rules: resultRules.slice(0, maxRules),
            modelUsed,
            durationMs,
            costUsd,
            numTurns,
            usage,
        }),
    }).catch(() => {});
}
