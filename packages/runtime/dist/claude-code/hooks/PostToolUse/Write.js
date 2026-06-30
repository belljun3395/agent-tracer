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
function truncateOutput(text, headChars, tailChars) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (text.length <= headChars + tailChars) {
    return { body: text, bytes, truncated: false };
  }
  const head = text.slice(0, headChars);
  const tail = text.slice(text.length - tailChars);
  const omitted = text.length - headChars - tailChars;
  return { body: `${head}
\u2026[${omitted} chars omitted]\u2026
${tail}`, bytes, truncated: true };
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

// src/shared/events/kinds.const.ts
var KIND = {
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
var INGEST_ENDPOINTS = {
  toolActivity: "/ingest/v1/timeline/tool-activity",
  workflow: "/ingest/v1/timeline/workflow",
  conversation: "/ingest/v1/timeline/conversation",
  coordination: "/ingest/v1/timeline/coordination",
  lifecycle: "/ingest/v1/timeline/lifecycle",
  telemetry: "/ingest/v1/timeline/telemetry"
};

// src/shared/routing/ingest.routing.ts
var TOOL_ACTIVITY_EVENT_KINDS = [KIND.toolUsed, KIND.terminalCommand, KIND.monitorObserved];
var WORKFLOW_EVENT_KINDS = [
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
var CONVERSATION_EVENT_KINDS = [KIND.userMessage, KIND.assistantResponse, KIND.questionLogged, KIND.todoLogged];
var COORDINATION_EVENT_KINDS = [KIND.agentActivityLogged];
var LIFECYCLE_EVENT_KINDS = [KIND.sessionEnded, KIND.instructionsLoaded];
var TELEMETRY_EVENT_KINDS = [KIND.tokenUsage];
var RUNTIME_INGEST_EVENT_KINDS = [
  ...TOOL_ACTIVITY_EVENT_KINDS,
  ...WORKFLOW_EVENT_KINDS,
  ...CONVERSATION_EVENT_KINDS,
  ...COORDINATION_EVENT_KINDS,
  ...LIFECYCLE_EVENT_KINDS,
  ...TELEMETRY_EVENT_KINDS
];
var TOOL_ACTIVITY_KIND_SET = new Set(TOOL_ACTIVITY_EVENT_KINDS);
var WORKFLOW_KIND_SET = new Set(WORKFLOW_EVENT_KINDS);
var CONVERSATION_KIND_SET = new Set(CONVERSATION_EVENT_KINDS);
var COORDINATION_KIND_SET = new Set(COORDINATION_EVENT_KINDS);
var LIFECYCLE_KIND_SET = new Set(LIFECYCLE_EVENT_KINDS);
var TELEMETRY_KIND_SET = new Set(TELEMETRY_EVENT_KINDS);
function resolveIngestEndpoint(kind) {
  if (TOOL_ACTIVITY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.toolActivity;
  if (WORKFLOW_KIND_SET.has(kind)) return INGEST_ENDPOINTS.workflow;
  if (CONVERSATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.conversation;
  if (COORDINATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.coordination;
  if (LIFECYCLE_KIND_SET.has(kind)) return INGEST_ENDPOINTS.lifecycle;
  if (TELEMETRY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.telemetry;
  return INGEST_ENDPOINTS.workflow;
}

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

// src/shared/config/env.ts
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

// src/shared/util/ulid.ts
import { randomBytes } from "node:crypto";
var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
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
  async function postJson2(pathname, body) {
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
  async function postTaggedEvent3(event) {
    await postEvent2([{ ...event, metadata: withTags(event.metadata) }]);
  }
  async function postTaggedEvents3(events) {
    await postEvent2(events.map((event) => ({ ...event, metadata: withTags(event.metadata) })));
  }
  return { postJson: postJson2, postEvent: postEvent2, postTaggedEvent: postTaggedEvent3, postTaggedEvents: postTaggedEvents3 };
}

// src/shared/hook-runtime/create-runtime.ts
function createHookRuntime(config) {
  const logger = createHookLogger({
    logFile: config.logFile,
    enabled: resolveRuntimeLoggingConfig().enabled
  });
  const transport = createMonitorTransport(config.monitor ?? resolveMonitorTransportConfig());
  return { logger, transport };
}

// src/claude-code/hooks/util/paths.const.ts
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
var CLAUDE_RUNTIME_SOURCE = "claude-plugin";
var TRANSCRIPT_CURSOR_DIR = `${PROJECT_DIR}/.claude/.transcript-cursors`;

// src/claude-code/hooks/lib/runtime.ts
var claudeHookRuntime = createHookRuntime({
  logFile: path2.join(PROJECT_DIR, ".claude", "hooks.log")
});

// src/claude-code/hooks/util/paths.ts
import * as path3 from "node:path";
function defaultTaskTitle() {
  return `Claude Code \u2014 ${path3.basename(PROJECT_DIR)}`;
}
function relativeProjectPath(filePath) {
  if (!filePath) return filePath;
  const relative2 = path3.relative(PROJECT_DIR, filePath);
  if (!relative2) return "";
  const normalizedRelative = relative2.split(path3.sep).join("/");
  if (normalizedRelative === ".." || normalizedRelative.startsWith("../") || path3.isAbsolute(relative2)) {
    return filePath;
  }
  return normalizedRelative.replace(/^\/+/, "");
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

// src/claude-code/hooks/Agent/session.ts
async function resolveBackgroundSessionIds(parentRuntimeSessionId, childRuntimeSessionId, childTitle, parentIds) {
  const resolvedParentIds = parentIds ?? await ensureRuntimeSession(parentRuntimeSessionId);
  return ensureRuntimeSession(childRuntimeSessionId, childTitle, {
    parentTaskId: resolvedParentIds.taskId,
    parentSessionId: resolvedParentIds.sessionId
  });
}
async function resolveSubagentSessionIds(parentSessionId, agentId, agentType) {
  const virtualId = `sub--${agentId}`;
  const title = agentType ? `Subagent: ${agentType}` : `Subagent: ${agentId}`;
  return resolveBackgroundSessionIds(parentSessionId, virtualId, title);
}
async function resolveEventSessionIds(sessionId, agentId, agentType) {
  if (agentId) {
    return resolveSubagentSessionIds(sessionId, agentId, agentType);
  }
  return ensureRuntimeSession(sessionId);
}

// src/shared/hook-runtime/validator.ts
function readString(raw, field) {
  return toTrimmedString(raw[field]);
}
function readOptionalString(raw, field) {
  const value = toTrimmedString(raw[field]);
  return value || void 0;
}
function readRecord(raw, field) {
  const value = raw[field];
  return isRecord(value) ? value : {};
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
function readToolBase(raw) {
  return {
    ...readSessionBase(raw),
    toolName: readString(raw, "tool_name"),
    toolInput: readRecord(raw, "tool_input"),
    toolUseId: readOptionalString(raw, "tool_use_id")
  };
}
function readPostToolUse(raw) {
  if (!readString(raw, "session_id")) {
    return { ok: false, reason: "missing session_id" };
  }
  return {
    ok: true,
    value: {
      payload: raw,
      ...readToolBase(raw),
      toolResponse: raw["tool_response"]
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

// src/claude-code/hooks/PostToolUse/_shared.ts
async function runPostToolUseHook(matcherName, handler) {
  await runHook(`PostToolUse/${matcherName}`, {
    logger: claudeHookRuntime.logger,
    parse: readPostToolUse,
    handler: async (payload) => {
      if (!payload.sessionId || !payload.toolName) return;
      const ids = await resolveEventSessionIds(
        payload.sessionId,
        payload.agentId,
        payload.agentType
      );
      await handler({ payload, ids });
    }
  });
}
var postTaggedEvent2 = claudeHookRuntime.transport.postTaggedEvent;
var postTaggedEvents2 = claudeHookRuntime.transport.postTaggedEvents;
var TOOL_RESULT_HEAD = 2048;
var TOOL_RESULT_TAIL = 2048;
function captureToolResultBody(value, options = {}) {
  const text = stringifyToolResult(value);
  if (text === void 0) return {};
  const matches = options.matchCounter?.(value, text);
  const trunc = truncateOutput(text, TOOL_RESULT_HEAD, TOOL_RESULT_TAIL);
  const out = {
    resultText: trunc.body,
    resultBytes: trunc.bytes
  };
  if (trunc.truncated) out["resultTruncated"] = true;
  if (typeof matches === "number" && Number.isFinite(matches)) out["resultMatches"] = matches;
  return out;
}
function stringifyToolResult(value) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value === "string") return value.length > 0 ? value : void 0;
  try {
    const json = JSON.stringify(value);
    return json && json !== "{}" && json !== "[]" ? json : void 0;
  } catch {
    return void 0;
  }
}

// src/claude-code/hooks/PostToolUse/_file.ops.ts
import * as path4 from "node:path";

// src/claude-code/hooks/util/utils.ts
function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

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

// src/shared/semantics/inference.file.ts
function inferFileToolSemantic(toolName, entityName) {
  const normalized = toolName.trim().toLowerCase();
  if (normalized.includes("patch")) {
    return baseFileSemantic("apply_patch", "Apply patch", "patch", toolName, entityName);
  }
  if (normalized.includes("delete") || normalized.includes("remove")) {
    return baseFileSemantic("delete_file", "Delete file", "delete", toolName, entityName);
  }
  if (normalized.includes("rename") || normalized.includes("move")) {
    return baseFileSemantic("rename_file", "Rename file", "rename", toolName, entityName);
  }
  if (normalized.includes("write") || normalized.includes("create")) {
    return baseFileSemantic("create_file", "Create file", "create", toolName, entityName);
  }
  return baseFileSemantic("modify_file", "Modify file", "modify", toolName, entityName);
}
function baseFileSemantic(subtypeKey, subtypeLabel, operation, sourceTool, entityName) {
  return {
    subtypeKey,
    subtypeLabel,
    subtypeGroup: "file_ops",
    toolFamily: "file",
    operation,
    entityType: "file",
    ...entityName ? { entityName } : {},
    sourceTool
  };
}

// src/shared/semantics/inference.util.ts
function buildSemanticMetadata(input) {
  return {
    subtypeKey: input.subtypeKey,
    subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
    ...input.subtypeGroup ? { subtypeGroup: input.subtypeGroup } : {},
    ...input.toolFamily ? { toolFamily: input.toolFamily } : {},
    ...input.operation ? { operation: input.operation } : {},
    ...input.entityType ? { entityType: input.entityType } : {},
    ...input.entityName ? { entityName: input.entityName } : {},
    ...input.sourceTool ? { sourceTool: input.sourceTool } : {},
    ...input.importance !== void 0 ? { importance: input.importance } : {}
  };
}
function humanizeSubtypeKey(value) {
  return value.split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

// src/claude-code/hooks/PostToolUse/_file.ops.ts
async function postFileToolEvent({ payload, ids }) {
  const toolName = payload.toolName;
  const filePath = toTrimmedString(payload.toolInput["file_path"]) || toTrimmedString(payload.toolInput["notebook_path"]) || toTrimmedString(payload.toolInput["path"]) || "";
  const relPath = filePath ? relativeProjectPath(filePath) : "";
  const semantic = inferFileToolSemantic(toolName, relPath || void 0);
  const title = relPath ? `${toolName}: ${path4.basename(relPath)}` : toolName;
  const body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;
  const editReplaceAll = toolName === "Edit" ? toBoolean(payload.toolInput["replace_all"]) : void 0;
  const captured = captureToolResultBody(payload.toolResponse);
  const metadata = {
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    ...buildSemanticMetadata(semantic),
    toolName,
    ...filePath ? { filePath, relPath } : {},
    ...editReplaceAll ? { editReplaceAll: true } : {},
    ...payload.toolUseId ? { toolUseId: payload.toolUseId } : {},
    ...captured
  };
  await postTaggedEvent2({
    kind: KIND.toolUsed,
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    lane: LANE.implementation,
    title,
    body,
    ...filePath ? { filePaths: [filePath] } : {},
    metadata
  });
}

// src/claude-code/hooks/PostToolUse/Write.ts
await runPostToolUseHook("Write", postFileToolEvent);
