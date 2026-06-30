var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/shared/events/kinds.const.ts
var KIND, INGEST_ENDPOINTS;
var init_kinds_const = __esm({
  "src/shared/events/kinds.const.ts"() {
    "use strict";
    KIND = {
      toolUsed: "tool.used",
      terminalCommand: "terminal.command",
      planLogged: "plan.logged",
      actionLogged: "action.logged",
      verificationLogged: "verification.logged",
      ruleLogged: "rule.logged",
      thoughtLogged: "thought.logged",
      contextSaved: "context.saved",
      userMessage: "user.message",
      assistantResponse: "assistant.response",
      questionLogged: "question.logged",
      todoLogged: "todo.logged",
      agentActivityLogged: "agent.activity.logged",
      sessionEnded: "session.ended",
      instructionsLoaded: "instructions.loaded",
      tokenUsage: "token.usage",
      contextSnapshot: "context.snapshot",
      userPromptExpansion: "user.prompt.expansion",
      fileChanged: "file.changed",
      worktreeCreate: "worktree.create",
      worktreeRemove: "worktree.remove",
      permissionRequest: "permission.request",
      setupTriggered: "setup.triggered",
      monitorObserved: "monitor.observed"
    };
    INGEST_ENDPOINTS = {
      toolActivity: "/ingest/v1/timeline/tool-activity",
      workflow: "/ingest/v1/timeline/workflow",
      conversation: "/ingest/v1/timeline/conversation",
      coordination: "/ingest/v1/timeline/coordination",
      lifecycle: "/ingest/v1/timeline/lifecycle",
      telemetry: "/ingest/v1/timeline/telemetry"
    };
  }
});

// src/shared/routing/ingest.routing.ts
function resolveIngestEndpoint(kind) {
  if (TOOL_ACTIVITY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.toolActivity;
  if (WORKFLOW_KIND_SET.has(kind)) return INGEST_ENDPOINTS.workflow;
  if (CONVERSATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.conversation;
  if (COORDINATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.coordination;
  if (LIFECYCLE_KIND_SET.has(kind)) return INGEST_ENDPOINTS.lifecycle;
  if (TELEMETRY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.telemetry;
  return INGEST_ENDPOINTS.workflow;
}
var TOOL_ACTIVITY_EVENT_KINDS, WORKFLOW_EVENT_KINDS, CONVERSATION_EVENT_KINDS, COORDINATION_EVENT_KINDS, LIFECYCLE_EVENT_KINDS, TELEMETRY_EVENT_KINDS, RUNTIME_INGEST_EVENT_KINDS, TOOL_ACTIVITY_KIND_SET, WORKFLOW_KIND_SET, CONVERSATION_KIND_SET, COORDINATION_KIND_SET, LIFECYCLE_KIND_SET, TELEMETRY_KIND_SET;
var init_ingest_routing = __esm({
  "src/shared/routing/ingest.routing.ts"() {
    "use strict";
    init_kinds_const();
    TOOL_ACTIVITY_EVENT_KINDS = [KIND.toolUsed, KIND.terminalCommand, KIND.monitorObserved];
    WORKFLOW_EVENT_KINDS = [
      KIND.planLogged,
      KIND.actionLogged,
      KIND.verificationLogged,
      KIND.ruleLogged,
      KIND.thoughtLogged,
      KIND.contextSaved,
      KIND.contextSnapshot,
      KIND.userPromptExpansion,
      KIND.permissionRequest,
      KIND.worktreeCreate,
      KIND.worktreeRemove,
      KIND.setupTriggered,
      KIND.fileChanged
    ];
    CONVERSATION_EVENT_KINDS = [KIND.userMessage, KIND.assistantResponse, KIND.questionLogged, KIND.todoLogged];
    COORDINATION_EVENT_KINDS = [KIND.agentActivityLogged];
    LIFECYCLE_EVENT_KINDS = [KIND.sessionEnded, KIND.instructionsLoaded];
    TELEMETRY_EVENT_KINDS = [KIND.tokenUsage];
    RUNTIME_INGEST_EVENT_KINDS = [
      ...TOOL_ACTIVITY_EVENT_KINDS,
      ...WORKFLOW_EVENT_KINDS,
      ...CONVERSATION_EVENT_KINDS,
      ...COORDINATION_EVENT_KINDS,
      ...LIFECYCLE_EVENT_KINDS,
      ...TELEMETRY_EVENT_KINDS
    ];
    TOOL_ACTIVITY_KIND_SET = new Set(TOOL_ACTIVITY_EVENT_KINDS);
    WORKFLOW_KIND_SET = new Set(WORKFLOW_EVENT_KINDS);
    CONVERSATION_KIND_SET = new Set(CONVERSATION_EVENT_KINDS);
    COORDINATION_KIND_SET = new Set(COORDINATION_EVENT_KINDS);
    LIFECYCLE_KIND_SET = new Set(LIFECYCLE_EVENT_KINDS);
    TELEMETRY_KIND_SET = new Set(TELEMETRY_EVENT_KINDS);
  }
});

// src/shared/semantics/tags.ts
function extractStr(meta, key) {
  const v = meta[key];
  return typeof v === "string" ? v : void 0;
}
function extractTagValue(meta, key) {
  const v = meta[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : void 0;
}
function extractBool(meta, key) {
  return meta[key] === true;
}
function extractStrArray(meta, key) {
  const v = meta[key];
  if (!Array.isArray(v)) return [];
  return v.filter((e) => typeof e === "string");
}
function normalizeTag(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildTagsFromMetadata(meta) {
  const tags = /* @__PURE__ */ new Set();
  const add = (tag) => tags.add(tag);
  const str = (key) => extractStr(meta, key);
  const strArr = (key) => extractStrArray(meta, key);
  const bool = (key) => extractBool(meta, key);
  const ruleId = str("ruleId");
  if (ruleId) add(`rule:${normalizeTag(ruleId)}`);
  const ruleStatus = str("ruleStatus");
  if (ruleStatus) add(`rule-status:${normalizeTag(ruleStatus)}`);
  const verificationStatus = str("verificationStatus");
  if (verificationStatus) add(`verification:${normalizeTag(verificationStatus)}`);
  const severity = str("severity");
  if (severity) add(`severity:${normalizeTag(severity)}`);
  const rulePolicy = str("rulePolicy");
  if (rulePolicy) add(`policy:${normalizeTag(rulePolicy)}`);
  const ruleOutcome = str("ruleOutcome");
  if (ruleOutcome) add(`outcome:${normalizeTag(ruleOutcome)}`);
  const asyncTaskId = str("asyncTaskId");
  if (asyncTaskId) add("async-task");
  const asyncStatus = str("asyncStatus");
  if (asyncStatus) add(`async:${normalizeTag(asyncStatus)}`);
  const asyncAgent = str("asyncAgent");
  if (asyncAgent) add(`agent:${normalizeTag(asyncAgent)}`);
  const asyncCategory = str("asyncCategory");
  if (asyncCategory) add(`category:${normalizeTag(asyncCategory)}`);
  const activityType = str("activityType");
  if (activityType) add(`activity:${normalizeTag(activityType)}`);
  const subtypeKey = str("subtypeKey");
  if (subtypeKey) add(`subtype:${normalizeTag(subtypeKey)}`);
  const subtypeGroup = str("subtypeGroup");
  if (subtypeGroup) add(`subtype-group:${normalizeTag(subtypeGroup)}`);
  const entityType = str("entityType");
  if (entityType) add(`entity:${normalizeTag(entityType)}`);
  const toolFamily = str("toolFamily");
  if (toolFamily) add(`tool-family:${normalizeTag(toolFamily)}`);
  const operation = str("operation");
  if (operation) add(`operation:${normalizeTag(operation)}`);
  const sourceTool = str("sourceTool");
  if (sourceTool) add(`source-tool:${normalizeTag(sourceTool)}`);
  const importance = extractTagValue(meta, "importance");
  if (importance) add(`importance:${normalizeTag(importance)}`);
  const agentName = str("agentName");
  if (agentName) add(`agent:${normalizeTag(agentName)}`);
  const skillName = str("skillName");
  if (skillName) add(`skill:${normalizeTag(skillName)}`);
  const ruleSource = str("ruleSource");
  if (ruleSource) add(`source:${normalizeTag(ruleSource)}`);
  const questionId = str("questionId");
  if (questionId) add("question");
  const questionPhase = str("questionPhase");
  if (questionPhase) add(`question:${normalizeTag(questionPhase)}`);
  const todoId = str("todoId");
  if (todoId) add("todo");
  const todoState = str("todoState");
  if (todoState) add(`todo:${normalizeTag(todoState)}`);
  const modelName = str("modelName");
  if (modelName) add(`model:${normalizeTag(modelName)}`);
  const modelProvider = str("modelProvider");
  if (modelProvider) add(`provider:${normalizeTag(modelProvider)}`);
  const mcpServer = str("mcpServer");
  if (mcpServer) add(`mcp:${normalizeTag(mcpServer)}`);
  const mcpTool = str("mcpTool");
  if (mcpTool) add(`mcp-tool:${normalizeTag(mcpTool)}`);
  const relationType = str("relationType");
  if (relationType) add(`relation:${normalizeTag(relationType)}`);
  if (bool("compactEvent")) add("compact");
  const compactPhase = str("compactPhase");
  if (compactPhase) add(`compact:${normalizeTag(compactPhase)}`);
  const compactEventType = str("compactEventType");
  if (compactEventType) add(`compact:${normalizeTag(compactEventType)}`);
  for (const s of strArr("compactSignals")) add(`compact:${normalizeTag(s)}`);
  return [...tags];
}
function withTags(meta) {
  return { ...meta, tags: buildTagsFromMetadata(meta) };
}
var init_tags = __esm({
  "src/shared/semantics/tags.ts"() {
    "use strict";
  }
});

// src/shared/config/env.ts
var env_exports = {};
__export(env_exports, {
  resolveClaudeProjectDir: () => resolveClaudeProjectDir,
  resolveCodexProjectDir: () => resolveCodexProjectDir,
  resolveMonitorBaseUrl: () => resolveMonitorBaseUrl,
  resolveMonitorTransportConfig: () => resolveMonitorTransportConfig,
  resolveRuntimeLoggingConfig: () => resolveRuntimeLoggingConfig
});
function resolveMonitorBaseUrl(env = process.env) {
  const explicit = (env.MONITOR_BASE_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const port = parseInt(env.MONITOR_PORT ?? "", 10) || 3847;
  const host = (env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
  return `http://${host}:${port}`;
}
function resolveMonitorTransportConfig(env = process.env) {
  const taskIdOverride = (env.MONITOR_TASK_ID ?? "").trim();
  const taskTitleOverride = (env.MONITOR_TASK_TITLE ?? "").trim();
  const rawOrigin = (env.MONITOR_TASK_ORIGIN ?? "").trim();
  const taskOriginOverride = rawOrigin === "user" || rawOrigin === "server-sdk" ? rawOrigin : void 0;
  return {
    baseUrl: resolveMonitorBaseUrl(env),
    requestTimeoutMs: 2e3,
    taskIdOverride: taskIdOverride || void 0,
    taskTitleOverride: taskTitleOverride || void 0,
    taskOriginOverride
  };
}
function resolveRuntimeLoggingConfig(env = process.env) {
  return {
    enabled: env.NODE_ENV === "development"
  };
}
function resolveClaudeProjectDir(env = process.env) {
  return (env.CLAUDE_PROJECT_DIR ?? "").trim() || process.cwd();
}
function resolveCodexProjectDir(env = process.env) {
  return (env.CODEX_PROJECT_DIR ?? "").trim() || process.cwd();
}
var init_env = __esm({
  "src/shared/config/env.ts"() {
    "use strict";
  }
});

// src/shared/util/ulid.ts
import { randomBytes } from "node:crypto";
function encodeTime(timeMs) {
  let value = Math.floor(timeMs);
  let output = "";
  for (let i = 0; i < 10; i++) {
    output = ENCODING[value % 32] + output;
    value = Math.floor(value / 32);
  }
  return output;
}
function encodeRandom() {
  const bytes = randomBytes(10);
  let bits = 0;
  let bitLength = 0;
  let output = "";
  for (const byte of bytes) {
    bits = bits << 8 | byte;
    bitLength += 8;
    while (bitLength >= 5 && output.length < 16) {
      const index = bits >> bitLength - 5 & 31;
      output += ENCODING[index];
      bitLength -= 5;
    }
  }
  while (output.length < 16) {
    output += ENCODING[randomBytes(1)[0] & 31];
  }
  return output;
}
function generateUlid(timeMs = Date.now()) {
  return `${encodeTime(timeMs)}${encodeRandom()}`;
}
function ensureEventId(event) {
  return event.id ? event : { ...event, id: generateUlid() };
}
var ENCODING;
var init_ulid = __esm({
  "src/shared/util/ulid.ts"() {
    "use strict";
    ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  }
});

// src/shared/transport/transport.ts
var transport_exports = {};
__export(transport_exports, {
  monitorUserHeader: () => monitorUserHeader,
  postEvent: () => postEvent2,
  postJson: () => postJson2,
  postTaggedEvent: () => postTaggedEvent2,
  readStdinJson: () => readStdinJson2
});
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unwrapApiEnvelope2(value) {
  if (isRecord4(value) && value["ok"] === true && "data" in value) {
    return value["data"];
  }
  return value;
}
function resolveApiBase() {
  const explicit = (process.env.MONITOR_BASE_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const port = parseInt(process.env.MONITOR_PORT ?? "", 10) || 3847;
  const host = (process.env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim();
  return `http://${host}:${port}`;
}
async function readStdinJson2() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  return isRecord4(parsed) ? parsed : {};
}
function monitorUserHeader() {
  const email = process.env["MONITOR_USER_EMAIL"]?.trim();
  return email ? { "X-User-Email": email } : {};
}
async function postJson2(pathname, body) {
  const response = await fetch(`${resolveApiBase()}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...monitorUserHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2e3)
  });
  if (!response.ok) {
    throw new Error(`Monitor request failed: ${pathname} (${response.status})`);
  }
  const text = await response.text();
  return unwrapApiEnvelope2(text ? JSON.parse(text) : {});
}
async function postEvent2(events) {
  const groups = /* @__PURE__ */ new Map();
  for (const event of events) {
    const stamped = ensureEventId(event);
    const endpoint = resolveIngestEndpoint(stamped.kind);
    const group = groups.get(endpoint) ?? [];
    group.push(stamped);
    groups.set(endpoint, group);
  }
  await Promise.all(
    [...groups.entries()].map(([endpoint, batch]) => postJson2(endpoint, { events: batch }))
  );
}
async function postTaggedEvent2(event) {
  await postEvent2([{ ...event, metadata: withTags(event.metadata) }]);
}
var init_transport = __esm({
  "src/shared/transport/transport.ts"() {
    "use strict";
    init_ingest_routing();
    init_tags();
    init_ulid();
  }
});

// src/shared/rule-generation/runner.ts
var runner_exports = {};
__export(runner_exports, {
  runRuleGeneration: () => runRuleGeneration
});
function buildOutputSchema() {
  return {
    type: "object",
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            trigger: {
              type: "object",
              properties: { phrases: { type: "array", items: { type: "string" } } }
            },
            triggerOn: { type: "string", enum: ["user", "assistant"] },
            expect: {
              type: "object",
              properties: {
                action: { type: "string" },
                commandMatches: { type: "array", items: { type: "string" } },
                pattern: { type: "string" }
              }
            },
            rationale: { type: "string" }
          },
          required: ["name", "expect", "rationale"]
        }
      }
    },
    required: ["rules"]
  };
}
async function runRuleGeneration(opts) {
  const baseUrl = resolveMonitorBaseUrl();
  const userHeaders = monitorUserHeader();
  const jsonHeaders = { ...userHeaders, "Content-Type": "application/json" };
  const maxRules = opts.maxRules ?? 5;
  const language = opts.language ?? "auto";
  const langDirective = LANGUAGE_DIRECTIVES[language] ?? LANGUAGE_DIRECTIVES["auto"];
  const systemPromptAppend = `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

You have tools to query domain data:
  - ${MCP_SERVER_NAME}__get_task_events(taskId, limit?) : full chronological event sequence (kind, title, body, metadata). Use this to understand what the agent did step-by-step.
  - ${MCP_SERVER_NAME}__list_rules(scope?)              : existing rules with name and trigger \u2014 call this to avoid duplicates.

You also have Read/Glob/Grep to inspect workspace files (e.g., read package.json to confirm real script names).

Suggested workflow:
  1. Call get_task_events to see the full event sequence and identify recurring patterns.
  2. Call list_rules to check what rules already exist.
  3. Optionally Read package.json (or equivalent manifest) to verify actual command names.
  4. Propose rules grounded in what you observed.

Propose 3-5 rules that would catch whether a future agent doing similar work performed it correctly. Rules are matched against tool-call events \u2014 they describe what to expect, not what is forbidden.

Rules are not blockers. severity is always "info".

Each rule has:
  - name           : short imperative (under 60 chars)
  - trigger        : { phrases: string[] }  -- optional
  - triggerOn      : "user" | "assistant"   -- optional
  - expect         : at least one of: action, commandMatches, pattern
  - rationale      : 1 short sentence (under 200 chars)

Guidelines:
  - Prefer commandMatches over regex when you know the literal command.
  - Lean into task-specific patterns rather than generic habits.
  - Quality over quantity: 3-5 rules.

Output language: ${langDirective}
  - This applies ONLY to name and rationale fields.
  - Keep trigger.phrases, commandMatches, and pattern as literal strings.

Return JSON conforming to the provided schema.`;
  const userPrompt = `Task ID: ${opts.taskId}
Workspace: ${opts.workspacePath}

Propose up to ${maxRules} rules for task ${opts.taskId}.`;
  const allowedTools = [
    "Read",
    "Glob",
    "Grep",
    `${MCP_SERVER_NAME}__get_task_events`,
    `${MCP_SERVER_NAME}__list_rules`
  ];
  let resultRules = [];
  let modelUsed = opts.model ?? "claude-sonnet-4-6";
  let costUsd = null;
  let numTurns = null;
  let usage = null;
  let errorMsg = null;
  const startedAt = Date.now();
  try {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const { query, createSdkMcpServer, tool } = sdk;
    const { z } = await import("zod");
    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      tools: [
        tool(
          "get_task_events",
          "Get the chronological event sequence for a task (tool calls, shell commands, file edits).",
          { taskId: z.string(), limit: z.number().int().min(1).max(300).optional() },
          async ({ taskId, limit }) => {
            const resolvedLimit = limit ?? 200;
            const resp = await fetch(
              `${baseUrl}/api/v1/events?taskId=${encodeURIComponent(taskId)}&limit=${resolvedLimit}`,
              { headers: userHeaders }
            );
            const data = await resp.json();
            return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
          }
        ),
        tool(
          "list_rules",
          "List existing rules (name + trigger) to avoid duplicates.",
          { scope: z.enum(["global", "task"]).optional().default("global") },
          async ({ scope }) => {
            const resp = await fetch(
              `${baseUrl}/api/v1/rules?scope=${scope ?? "global"}`,
              { headers: userHeaders }
            );
            const data = await resp.json();
            const rules = Array.isArray(data?.rules) ? data.rules : [];
            const slim = rules.map((r) => ({ name: r.name, trigger: r.trigger ?? null }));
            return { content: [{ type: "text", text: JSON.stringify(slim, null, 2) }] };
          }
        )
      ]
    });
    const q = query({
      prompt: userPrompt,
      options: {
        cwd: opts.workspacePath,
        model: opts.model ?? "claude-sonnet-4-6",
        allowedTools,
        tools: allowedTools,
        maxTurns: 8,
        mcpServers: { [MCP_SERVER_NAME]: mcpServer },
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: systemPromptAppend,
          excludeDynamicSections: true
        },
        outputFormat: { type: "json_schema", schema: buildOutputSchema() },
        env: {
          ...process.env,
          ...opts.apiKey ? { ANTHROPIC_API_KEY: opts.apiKey } : {},
          MONITOR_TASK_ORIGIN: "server-sdk"
        },
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        strictMcpConfig: true,
        includePartialMessages: false
      }
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
            cacheCreationTokens: msg.usage.cache_creation_input_tokens
          };
        }
        if (msg.subtype === "success" && msg.structured_output) {
          const output = msg.structured_output;
          resultRules = Array.isArray(output.rules) ? output.rules : [];
        } else if (msg.subtype !== "success") {
          const errors = "errors" in msg && Array.isArray(msg.errors) ? msg.errors : [];
          errorMsg = `${msg.subtype}${errors.length > 0 ? `: ${errors.join("; ")}` : ""}`;
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
      body: JSON.stringify({ error: errorMsg })
    }).catch(() => {
    });
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
      usage
    })
  }).catch(() => {
  });
}
var MCP_SERVER_NAME, LANGUAGE_DIRECTIVES;
var init_runner = __esm({
  "src/shared/rule-generation/runner.ts"() {
    "use strict";
    init_env();
    init_transport();
    MCP_SERVER_NAME = "monitor-rule-gen";
    LANGUAGE_DIRECTIVES = {
      auto: "Mirror the language of the task (Korean \u2192 Korean, English \u2192 English, etc.).",
      ko: "Write every rule name and rationale in Korean (\uD55C\uAD6D\uC5B4).",
      en: "Write every rule name and rationale in English.",
      ja: "Write every rule name and rationale in Japanese (\u65E5\u672C\u8A9E).",
      zh: "Write every rule name and rationale in Simplified Chinese (\u7B80\u4F53\u4E2D\u6587)."
    };
  }
});

// src/claude-code/hooks/util/paths.const.ts
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
var CLAUDE_RUNTIME_SOURCE = "claude-plugin";
var TRANSCRIPT_CURSOR_DIR = `${PROJECT_DIR}/.claude/.transcript-cursors`;

// src/claude-code/hooks/lib/runtime.ts
import * as path2 from "node:path";

// src/shared/hook-runtime/hook-log.ts
import * as fs from "node:fs";

// src/shared/util/utils.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toTrimmedString(value, maxLength) {
  const next = typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" ? String(value).trim() : "";
  if (!maxLength || next.length <= maxLength) return next;
  return next.slice(0, maxLength);
}

// src/shared/hook-runtime/hook-log.ts
var DEFAULT_REDACT_KEYS = ["tool_response", "transcript_path"];
function createHookLogger(config) {
  const redactKeys = new Set(config.payloadRedactKeys ?? DEFAULT_REDACT_KEYS);
  const appendLog = (line) => {
    if (!config.enabled) return;
    try {
      fs.appendFileSync(config.logFile, line + "\n");
    } catch {
    }
  };
  const log = (hookName, message, data) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
    const logData = data ? { timestamp: (/* @__PURE__ */ new Date()).toISOString(), ...data } : { timestamp: (/* @__PURE__ */ new Date()).toISOString() };
    const line = `[${ts}][HOOK:${hookName}] ${message} ${JSON.stringify(logData)}`;
    if (config.enabled) {
      process.stderr.write(line + "\n");
    }
    appendLog(line);
  };
  const logPayload = (hookName, payload) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
    const rest = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!redactKeys.has(key)) rest[key] = value;
    }
    if (isRecord(rest["tool_input"])) {
      rest["tool_input"] = Object.fromEntries(
        Object.entries(rest["tool_input"]).map(
          ([k, v]) => typeof v === "string" && v.length > 200 ? [k, v.slice(0, 200) + "\u2026"] : [k, v]
        )
      );
    }
    const line = `[${ts}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`;
    appendLog(line);
  };
  return { log, logPayload };
}

// src/shared/errors/monitor.ts
var MonitorRequestError = class extends Error {
  status;
  pathname;
  code;
  details;
  constructor(init) {
    super(init.message);
    this.name = "MonitorRequestError";
    this.status = init.status;
    this.pathname = init.pathname;
    this.code = init.code;
    this.details = init.details;
  }
};

// src/shared/hook-runtime/transport.ts
init_ingest_routing();
init_tags();
init_env();
init_ulid();

// src/shared/hook-runtime/local-daemon.ts
import * as crypto from "node:crypto";
import * as fs2 from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
var DAEMON_HOME_DIRNAME = ".agent-tracer";
var DAEMON_SOCKET_FILENAME = "daemon.sock";
var DAEMON_LOG_FILENAME = "daemon.log";
var DAEMON_HOME_MODE = 448;
var SOCKET_CONNECT_TIMEOUT_MS = 100;
var SOCKET_IDLE_TIMEOUT_MS = 200;
var DAEMON_SPAWN_DEADLINE_MS = 1e3;
var DAEMON_SPAWN_POLL_INTERVAL_MS = 25;
function resolveDaemonHomeLayout(env = process.env) {
  const explicitSocket = (env.AGENT_TRACER_DAEMON_SOCKET ?? "").trim();
  const home = env.HOME && env.HOME.trim() ? env.HOME : os.homedir();
  const homeDir = path.join(home, DAEMON_HOME_DIRNAME);
  const socketPath = explicitSocket ? explicitSocket : path.join(homeDir, DAEMON_SOCKET_FILENAME);
  const logPath = path.join(homeDir, DAEMON_LOG_FILENAME);
  return { homeDir, socketPath, logPath };
}
function ensureDaemonHome(layout = resolveDaemonHomeLayout()) {
  fs2.mkdirSync(layout.homeDir, { recursive: true, mode: DAEMON_HOME_MODE });
  try {
    fs2.chmodSync(layout.homeDir, DAEMON_HOME_MODE);
  } catch {
  }
}
function shouldUseLocalDaemon(env = process.env) {
  if (env.AGENT_TRACER_DAEMON_CHILD === "1") return false;
  const mode = (env.MONITOR_TRANSPORT ?? "direct").trim().toLowerCase();
  return mode === "daemon" || mode === "local-daemon" || mode === "uds";
}
var UUID_NAMESPACE = "agent-tracer/v1";
function uuidFromSeed(seed) {
  const hash = crypto.createHash("sha1").update(UUID_NAMESPACE).update("\0").update(seed).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = bytes[6] & 15 | 80;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function localEnsureResult(body) {
  const input = isRecord2(body) ? body : {};
  const runtimeSource = typeof input.runtimeSource === "string" ? input.runtimeSource : "runtime";
  const runtimeSessionId = typeof input.runtimeSessionId === "string" ? input.runtimeSessionId : "unknown";
  const taskId = typeof input.taskId === "string" && input.taskId.trim() ? input.taskId.trim() : uuidFromSeed(`task:${runtimeSource}:${runtimeSessionId}`);
  const sessionId = uuidFromSeed(`session:${runtimeSource}:${runtimeSessionId}`);
  return { taskId, sessionId, taskCreated: false, sessionCreated: false };
}
function runtimeRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}
function daemonEntryPath() {
  return path.join(runtimeRoot(), "src/shared/hook-runtime/local-daemon-entry.ts");
}
function tsxBinPath() {
  let current = runtimeRoot();
  for (; ; ) {
    const candidate = path.join(current, "node_modules/.bin/tsx");
    if (fs2.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return void 0;
    current = parent;
  }
}
function maybeStartDaemon(layout) {
  if (process.env.AGENT_TRACER_DAEMON_AUTOSTART === "0") return;
  const isBun = Boolean(globalThis.Bun) || Boolean(process.versions.bun);
  let executable;
  let args;
  if (isBun) {
    executable = process.execPath;
    args = [daemonEntryPath()];
  } else {
    const tsx = tsxBinPath();
    if (!tsx) return;
    executable = tsx;
    args = ["--tsconfig", path.join(runtimeRoot(), "tsconfig.json"), daemonEntryPath()];
  }
  ensureDaemonHome(layout);
  let logFd;
  try {
    logFd = fs2.openSync(layout.logPath, "a");
  } catch {
  }
  const child = spawn(executable, args, {
    detached: true,
    stdio: logFd !== void 0 ? ["ignore", logFd, logFd] : "ignore",
    env: {
      ...process.env,
      AGENT_TRACER_DAEMON_CHILD: "1",
      AGENT_TRACER_DAEMON_SOCKET: layout.socketPath
    }
  });
  child.unref();
  if (logFd !== void 0) {
    try {
      fs2.closeSync(logFd);
    } catch {
    }
  }
}
function writeMessage(socketPath, message) {
  return new Promise((resolve2, reject) => {
    const socket = net.createConnection(socketPath);
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      socket.destroy();
      if (err) reject(err);
      else resolve2();
    };
    const connectTimer = setTimeout(
      () => finish(new Error("daemon connect timeout")),
      SOCKET_CONNECT_TIMEOUT_MS
    );
    socket.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => finish(new Error("daemon socket idle timeout")));
    socket.once("error", finish);
    socket.once("connect", () => {
      clearTimeout(connectTimer);
      socket.end(`${JSON.stringify(message)}
`, () => finish());
    });
  });
}
async function enqueueDaemonMessage(message) {
  const layout = resolveDaemonHomeLayout();
  try {
    await writeMessage(layout.socketPath, message);
    return;
  } catch (err) {
    const code = err.code;
    if (code !== "ENOENT" && code !== "ECONNREFUSED") {
      throw err;
    }
  }
  maybeStartDaemon(layout);
  const deadline = Date.now() + DAEMON_SPAWN_DEADLINE_MS;
  let lastError;
  while (Date.now() < deadline) {
    await new Promise((resolve2) => setTimeout(resolve2, DAEMON_SPAWN_POLL_INTERVAL_MS));
    try {
      await writeMessage(layout.socketPath, message);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("failed to enqueue daemon message");
}

// src/shared/hook-runtime/transport.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseEnvelope(body) {
  if (!isRecord3(body) || body["ok"] !== false) return void 0;
  const error = body["error"];
  if (!isRecord3(error)) return void 0;
  const code = error["code"];
  const message = error["message"];
  if (typeof code !== "string" || typeof message !== "string") return void 0;
  const details = "details" in error ? error["details"] : void 0;
  return {
    ok: false,
    error: { code, message, ...details !== void 0 ? { details } : {} }
  };
}
function unwrapApiEnvelope(value) {
  if (isRecord3(value) && value["ok"] === true && "data" in value) {
    return value["data"];
  }
  return value;
}
function createMonitorTransport(config = resolveMonitorTransportConfig(), options = {}) {
  async function postJson3(pathname, body) {
    if (!options.forceDirect && shouldUseLocalDaemon()) {
      const localResult = pathname === "/ingest/v1/sessions/ensure" ? localEnsureResult(body) : void 0;
      await enqueueDaemonMessage({
        type: "postJson",
        pathname,
        body,
        ...localResult ? { localResult } : {}
      });
      return localResult ?? {};
    }
    const email = process.env["MONITOR_USER_EMAIL"]?.trim();
    const response = await fetch(`${config.baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...email ? { "X-User-Email": email } : {}
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const envelope = parseEnvelope(parsed);
      throw new MonitorRequestError({
        status: response.status,
        pathname,
        message: envelope?.error.message ?? `Monitor request failed: ${pathname} (${response.status})`,
        ...envelope?.error.code !== void 0 ? { code: envelope.error.code } : {},
        ...envelope?.error.details !== void 0 ? { details: envelope.error.details } : {}
      });
    }
    return unwrapApiEnvelope(parsed);
  }
  async function postEvent3(events) {
    const groups = /* @__PURE__ */ new Map();
    for (const event of events) {
      const stamped = ensureEventId(event);
      const endpoint = resolveIngestEndpoint(stamped.kind);
      const group = groups.get(endpoint) ?? [];
      group.push(stamped);
      groups.set(endpoint, group);
    }
    await Promise.all(
      [...groups.entries()].map(([endpoint, batch]) => postJson3(endpoint, { events: batch }))
    );
  }
  async function postTaggedEvent3(event) {
    await postEvent3([{ ...event, metadata: withTags(event.metadata) }]);
  }
  async function postTaggedEvents2(events) {
    await postEvent3(events.map((event) => ({ ...event, metadata: withTags(event.metadata) })));
  }
  return { postJson: postJson3, postEvent: postEvent3, postTaggedEvent: postTaggedEvent3, postTaggedEvents: postTaggedEvents2 };
}

// src/shared/hook-runtime/create-runtime.ts
init_env();
function createHookRuntime(config) {
  const logger = createHookLogger({
    logFile: config.logFile,
    enabled: resolveRuntimeLoggingConfig().enabled
  });
  const transport = createMonitorTransport(config.monitor ?? resolveMonitorTransportConfig());
  return { logger, transport };
}

// src/claude-code/hooks/lib/runtime.ts
var claudeHookRuntime = createHookRuntime({
  logFile: path2.join(PROJECT_DIR, ".claude", "hooks.log")
});

// src/claude-code/hooks/util/paths.ts
import * as path3 from "node:path";
function defaultTaskTitle() {
  return `Claude Code \u2014 ${path3.basename(PROJECT_DIR)}`;
}

// src/shared/hook-runtime/stdin.ts
async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  return isRecord(parsed) ? parsed : {};
}

// src/claude-code/hooks/lib/transport/transport.ts
init_env();
var postJson = claudeHookRuntime.transport.postJson;
var postEvent = claudeHookRuntime.transport.postEvent;
var postTaggedEvent = claudeHookRuntime.transport.postTaggedEvent;
var postTaggedEvents = claudeHookRuntime.transport.postTaggedEvents;
async function ensureRuntimeSession(runtimeSessionId, title = defaultTaskTitle(), opts) {
  const transportConfig = resolveMonitorTransportConfig();
  const taskId = opts?.taskId ?? transportConfig.taskIdOverride;
  const effectiveTitle = transportConfig.taskTitleOverride ?? title;
  const origin = transportConfig.taskOriginOverride;
  return postJson("/ingest/v1/sessions/ensure", {
    ...taskId ? { taskId } : {},
    runtimeSource: CLAUDE_RUNTIME_SOURCE,
    runtimeSessionId,
    title: effectiveTitle,
    workspacePath: PROJECT_DIR,
    ...opts?.parentTaskId ? { parentTaskId: opts.parentTaskId } : {},
    ...opts?.parentSessionId ? { parentSessionId: opts.parentSessionId } : {},
    ...origin ? { origin } : {},
    ...opts?.resume === false ? { resume: false } : {}
  });
}

// src/shared/hook-runtime/validator.ts
function readString(raw, field) {
  return toTrimmedString(raw[field]);
}
function readOptionalString(raw, field) {
  const value = toTrimmedString(raw[field]);
  return value || void 0;
}

// src/shared/hooks/claude/payloads.ts
function readSessionBase(raw) {
  return {
    sessionId: readString(raw, "session_id"),
    cwd: readOptionalString(raw, "cwd"),
    transcriptPath: readOptionalString(raw, "transcript_path"),
    permissionMode: readOptionalString(raw, "permission_mode"),
    agentId: readOptionalString(raw, "agent_id"),
    agentType: readOptionalString(raw, "agent_type")
  };
}
function readSessionEnd(raw) {
  if (!readString(raw, "session_id")) {
    return { ok: false, reason: "missing session_id" };
  }
  return {
    ok: true,
    value: {
      payload: raw,
      ...readSessionBase(raw),
      reason: readOptionalString(raw, "reason")
    }
  };
}

// src/shared/hook-runtime/run-hook.ts
async function runHook(name, options) {
  const { logger, parse, handler } = options;
  const shouldLogPayload = options.logPayload ?? true;
  let raw;
  try {
    raw = await readStdinJson();
  } catch (err) {
    logger.log(name, "stdin_read_error", { error: errorMessage(err) });
    return;
  }
  if (shouldLogPayload) {
    logger.logPayload(name, raw);
  }
  const parsed = parse(raw);
  if (!parsed.ok) {
    logger.log(name, "skipped", { reason: parsed.reason });
    return;
  }
  try {
    await handler(parsed.value);
  } catch (err) {
    logger.log(name, "handler_error", {
      error: errorMessage(err),
      ...err instanceof Error && err.stack ? { stack: err.stack } : {}
    });
  }
}
function errorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

// src/claude-code/hooks/SessionEnd.ts
init_kinds_const();

// src/shared/events/lanes.const.ts
var LANE = {
  user: "user",
  exploration: "exploration",
  planning: "planning",
  implementation: "implementation",
  rule: "rule",
  questions: "questions",
  todos: "todos",
  background: "background",
  coordination: "coordination",
  telemetry: "telemetry"
};

// src/shared/semantics/evidence.ts
function provenEvidence(reason) {
  return { evidenceLevel: "proven", evidenceReason: reason };
}

// src/claude-code/hooks/PostToolUse/Todo/todo.state.ts
import * as path4 from "node:path";

// src/claude-code/hooks/util/json-file.store.ts
import * as fs3 from "node:fs";
function deleteJsonFile(filePath) {
  try {
    fs3.unlinkSync(filePath);
  } catch {
  }
}

// src/claude-code/hooks/PostToolUse/Todo/todo.state.ts
var TODO_STATE_DIR = `${PROJECT_DIR}/.claude/.todo-state`;
function statePath(sessionId) {
  return path4.join(TODO_STATE_DIR, `${sessionId}.json`);
}
function deleteTodoState(sessionId) {
  deleteJsonFile(statePath(sessionId));
}

// src/claude-code/hooks/SessionEnd.ts
function mapCompletionReason(reason) {
  return reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated";
}
function buildSessionEndedTitle(reason) {
  switch (reason) {
    case "prompt_input_exit":
      return "Session ended (user exit)";
    case "logout":
      return "Session ended (logout)";
    case "resume":
      return "Session ended (superseded by resume)";
    default:
      return `Session ended (${reason})`;
  }
}
await runHook("SessionEnd", {
  logger: claudeHookRuntime.logger,
  parse: readSessionEnd,
  handler: async (payload) => {
    const reason = payload.reason ?? "other";
    if (reason === "clear") return;
    const ids = await ensureRuntimeSession(payload.sessionId, void 0, { resume: false });
    await postJson("/ingest/v1/sessions/end", {
      runtimeSource: CLAUDE_RUNTIME_SOURCE,
      runtimeSessionId: payload.sessionId,
      summary: `Claude Code session ended (${reason})`,
      completionReason: mapCompletionReason(reason),
      ...reason === "prompt_input_exit" ? { completeTask: true } : {}
    });
    const metadata = {
      ...provenEvidence("Emitted by the SessionEnd hook."),
      reason,
      completionReason: mapCompletionReason(reason),
      source: "session-end",
      sessionEndedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...payload.transcriptPath ? { transcriptPath: payload.transcriptPath } : {},
      ...payload.permissionMode ? { permissionMode: payload.permissionMode } : {},
      ...payload.cwd ? { cwd: payload.cwd } : {}
    };
    await claudeHookRuntime.transport.postTaggedEvent({
      kind: KIND.sessionEnded,
      taskId: ids.taskId,
      sessionId: ids.sessionId,
      title: buildSessionEndedTitle(reason),
      body: `Claude Code session ended (${reason}).`,
      lane: LANE.user,
      metadata
    });
    deleteTodoState(payload.sessionId);
    if (reason === "prompt_input_exit") {
      void triggerRuleGeneration(ids.taskId, payload.cwd ?? PROJECT_DIR).catch(() => {
      });
    }
  }
});
async function triggerRuleGeneration(taskId, workspacePath) {
  let jobId;
  try {
    const resp = await postJson(`/api/v1/rules/generate?taskId=${encodeURIComponent(taskId)}`, {});
    jobId = resp.jobId;
  } catch {
    const { resolveMonitorBaseUrl: resolveMonitorBaseUrl2 } = await Promise.resolve().then(() => (init_env(), env_exports));
    const { monitorUserHeader: monitorUserHeader2 } = await Promise.resolve().then(() => (init_transport(), transport_exports));
    const resp = await fetch(
      `${resolveMonitorBaseUrl2()}/api/v1/rules/generate/latest?taskId=${encodeURIComponent(taskId)}`,
      { headers: monitorUserHeader2(), signal: AbortSignal.timeout(2e3) }
    );
    if (resp.ok) {
      const data = await resp.json();
      jobId = data?.data?.job?.id;
    }
  }
  if (!jobId) return;
  const { runRuleGeneration: runRuleGeneration2 } = await Promise.resolve().then(() => (init_runner(), runner_exports));
  await runRuleGeneration2({ taskId, jobId, workspacePath });
}
