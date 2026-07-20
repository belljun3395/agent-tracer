// src/config/runtime.root.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// src/support/json.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/config/runtime.root.ts
var ROOT_MANIFESTS = [".claude-plugin/plugin.json", "package.json"];
function manifestDir(dir) {
  return ROOT_MANIFESTS.some((manifest) => fs.existsSync(path.join(dir, manifest)));
}
function resolveRuntimeRoot(from = path.dirname(fileURLToPath(import.meta.url))) {
  const start = path.resolve(from);
  let current = start;
  for (; ; ) {
    if (manifestDir(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}
function readRuntimeManifestVersion(root = resolveRuntimeRoot()) {
  for (const manifest of ROOT_MANIFESTS) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(root, manifest), "utf8"));
      const version = isRecord(parsed) && typeof parsed["version"] === "string" ? parsed["version"].trim() : "";
      if (version) return version;
    } catch {
      continue;
    }
  }
  return "";
}

// src/daemon/lifecycle/daemon.health.ts
var UNKNOWN_DAEMON_VERSION = "unknown";
function resolveDaemonVersion(root = resolveRuntimeRoot()) {
  return readRuntimeManifestVersion(root) || UNKNOWN_DAEMON_VERSION;
}

// src/config/monitor.identity.ts
import * as fs3 from "node:fs";

// ../kernel/src/user/user.header.const.ts
var MONITOR_USER_HEADER = "x-monitor-user";
var DEFAULT_USER_ID = "local";

// src/config/home.paths.ts
import * as fs2 from "node:fs";
import * as os from "node:os";
import * as path2 from "node:path";
var HOME_DIRNAME = ".agent-tracer";
var HOME_MODE = 448;
function resolveAgentTracerPaths(env = process.env) {
  const home = env.HOME && env.HOME.trim() ? env.HOME : os.homedir();
  const homeDir = path2.join(home, HOME_DIRNAME);
  const spoolDir = path2.join(homeDir, "spool");
  const cacheDir = path2.join(homeDir, "cache");
  const explicitSocket = (env.AGENT_TRACER_DAEMON_SOCKET ?? "").trim();
  return {
    homeDir,
    spoolDir,
    deadPath: path2.join(spoolDir, "dead.jsonl"),
    cacheDir,
    configPath: path2.join(homeDir, "config.json"),
    bindingsPath: path2.join(homeDir, "bindings.json"),
    bindingsLockPath: path2.join(homeDir, "bindings.lock"),
    recipePendingDir: path2.join(homeDir, "recipe-pending"),
    socketPath: explicitSocket || path2.join(homeDir, "daemon.sock"),
    logPath: path2.join(homeDir, "daemon.log"),
    resumeTokenPath: path2.join(homeDir, "resume.token"),
    pidPath: path2.join(homeDir, "daemon.pid")
  };
}
function mkdirSecure(dir) {
  fs2.mkdirSync(dir, { recursive: true, mode: HOME_MODE });
  try {
    fs2.chmodSync(dir, HOME_MODE);
  } catch {
  }
}
function ensureAgentTracerHome(paths = resolveAgentTracerPaths()) {
  mkdirSecure(paths.homeDir);
}
function ensureSpoolDir(paths = resolveAgentTracerPaths()) {
  mkdirSecure(paths.homeDir);
  mkdirSecure(paths.spoolDir);
}
function ensureRecipePendingDir(paths = resolveAgentTracerPaths()) {
  mkdirSecure(paths.homeDir);
  mkdirSecure(paths.recipePendingDir);
}

// src/config/monitor.identity.ts
var DEFAULT_PORT = 3847;
var DEFAULT_HOST = "127.0.0.1";
function readMonitorConfigFile(paths = resolveAgentTracerPaths()) {
  try {
    const parsed = JSON.parse(fs3.readFileSync(paths.configPath, "utf8"));
    if (!isRecord(parsed)) return {};
    const userId = trimmed(parsed["userId"]);
    const baseUrl2 = trimmed(parsed["baseUrl"]);
    return { ...userId ? { userId } : {}, ...baseUrl2 ? { baseUrl: baseUrl2 } : {} };
  } catch {
    return {};
  }
}
function trimmed(value) {
  if (typeof value !== "string") return void 0;
  const next = value.trim();
  return next.length > 0 ? next : void 0;
}
function envBaseUrl(env) {
  const explicit = trimmed(env.MONITOR_BASE_URL);
  if (explicit) return explicit;
  const port = trimmed(env.MONITOR_PORT);
  const host = trimmed(env.MONITOR_PUBLIC_HOST);
  if (!port && !host) return void 0;
  return `http://${host ?? DEFAULT_HOST}:${parseInt(port ?? "", 10) || DEFAULT_PORT}`;
}
function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}
function resolveMonitorIdentity(env = process.env, config = readMonitorConfigFile()) {
  const envUser = trimmed(env.MONITOR_USER_EMAIL);
  const fromEnv = envBaseUrl(env);
  const userId = envUser ?? config.userId ?? DEFAULT_USER_ID;
  const baseUrl2 = fromEnv ?? config.baseUrl ?? `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return {
    userId,
    baseUrl: normalizeBaseUrl(baseUrl2),
    userIdOrigin: envUser ? "env" : config.userId ? "file" : "default",
    baseUrlOrigin: fromEnv ? "env" : config.baseUrl ? "file" : "default"
  };
}
function monitorUserHeaders(identity2) {
  return identity2.userId === DEFAULT_USER_ID ? {} : { [MONITOR_USER_HEADER]: identity2.userId };
}

// src/config/env.ts
var CLAUDE_RUNTIME_SOURCE = "claude-plugin";
function resolveClaudeSessionId(env = process.env) {
  const sessionId = (env.CLAUDE_CODE_SESSION_ID ?? "").trim();
  return sessionId || void 0;
}

// src/domain/binding/adapter/file.binding.store.adapter.ts
import * as fs4 from "node:fs";
var LOCK_TIMEOUT_MS = 1e3;
var LOCK_STALE_MS = 1e4;
var LOCK_RETRY_MS = 20;
function delay(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
var FileBindingStoreAdapter = class {
  constructor(paths = resolveAgentTracerPaths()) {
    this.paths = paths;
    ensureAgentTracerHome(this.paths);
  }
  paths;
  read() {
    try {
      const parsed = JSON.parse(fs4.readFileSync(this.paths.bindingsPath, "utf8"));
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  write(store) {
    ensureAgentTracerHome(this.paths);
    const tmp = `${this.paths.bindingsPath}.tmp`;
    fs4.writeFileSync(tmp, JSON.stringify(store));
    fs4.renameSync(tmp, this.paths.bindingsPath);
  }
  async acquireLock() {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (; ; ) {
      try {
        fs4.mkdirSync(this.paths.bindingsLockPath);
        return true;
      } catch (error) {
        if (error.code !== "EEXIST") return false;
        if (this.clearStaleLock()) continue;
        if (Date.now() >= deadline) return false;
        await delay(LOCK_RETRY_MS);
      }
    }
  }
  releaseLock() {
    try {
      fs4.rmdirSync(this.paths.bindingsLockPath);
    } catch {
      return;
    }
  }
  clearStaleLock() {
    try {
      const stat = fs4.statSync(this.paths.bindingsLockPath);
      if (Date.now() - stat.mtimeMs <= LOCK_STALE_MS) return false;
      fs4.rmdirSync(this.paths.bindingsLockPath);
      return true;
    } catch {
      return false;
    }
  }
};

// src/domain/binding/model/binding.model.ts
function bindingKey(runtimeSource, runtimeSessionId) {
  return `${runtimeSource}::${runtimeSessionId}`;
}
function turnStateOf(binding) {
  if (!binding?.currentTurnId) return void 0;
  return {
    turnId: binding.currentTurnId,
    startedAt: binding.turnStartedAt ?? binding.createdAt,
    ...binding.previousTurnId ? { previousTurnId: binding.previousTurnId } : {},
    ...binding.turnPrompt ? { prompt: binding.turnPrompt } : {}
  };
}
function toBoundSession(binding) {
  const turn = turnStateOf(binding);
  return {
    taskId: binding.taskId,
    sessionId: binding.sessionId,
    startedAt: binding.createdAt,
    ...turn ? { turnId: turn.turnId, turn } : {}
  };
}
function resolveLiveBinding(bindings, runtimeSource, runtimeSessionId) {
  const seen = /* @__PURE__ */ new Set();
  let key = bindingKey(runtimeSource, runtimeSessionId);
  let binding = bindings[key];
  while (binding?.supersededBy !== void 0) {
    if (seen.has(key)) return void 0;
    seen.add(key);
    key = bindingKey(runtimeSource, binding.supersededBy);
    const next = bindings[key];
    if (next === void 0) return void 0;
    binding = next;
  }
  return binding;
}

// src/domain/binding/application/read.binding.usecase.ts
var ReadBindingUsecase = class {
  constructor(bindings) {
    this.bindings = bindings;
  }
  bindings;
  execute(runtimeSource, runtimeSessionId) {
    const binding = resolveLiveBinding(this.bindings.read(), runtimeSource, runtimeSessionId);
    return binding ? toBoundSession(binding) : void 0;
  }
};

// ../kernel/src/observability/semconv.const.ts
var SEMCONV_ATTR = {
  operationName: "gen_ai.operation.name",
  providerName: "gen_ai.provider.name",
  conversationId: "gen_ai.conversation.id",
  agentName: "gen_ai.agent.name",
  agentId: "gen_ai.agent.id",
  requestModel: "gen_ai.request.model",
  responseModel: "gen_ai.response.model",
  responseFinishReasons: "gen_ai.response.finish_reasons",
  inputTokens: "gen_ai.usage.input_tokens",
  outputTokens: "gen_ai.usage.output_tokens",
  cacheReadInputTokens: "gen_ai.usage.cache_read.input_tokens",
  cacheCreationInputTokens: "gen_ai.usage.cache_creation.input_tokens",
  tokenType: "gen_ai.token.type",
  toolName: "gen_ai.tool.name",
  toolType: "gen_ai.tool.type",
  toolCallId: "gen_ai.tool.call.id",
  outputType: "gen_ai.output.type",
  inputMessages: "gen_ai.input.messages",
  outputMessages: "gen_ai.output.messages",
  systemInstructions: "gen_ai.system_instructions",
  mcpMethodName: "mcp.method.name",
  mcpToolName: "mcp.tool.name",
  mcpSessionId: "mcp.session.id",
  errorType: "error.type"
};
var AGENT_TRACER_ATTR = {
  jobId: "agent_tracer.job.id",
  jobKind: "agent_tracer.job.kind",
  backend: "agent_tracer.backend",
  runtimeSource: "agent_tracer.runtime.source",
  taskId: "agent_tracer.task.id",
  lane: "agent_tracer.lane",
  command: "agent_tracer.command",
  mcpServer: "agent_tracer.mcp.server",
  toolParametersFingerprint: "agent_tracer.tool.parameters.fingerprint",
  toolFamily: "agent_tracer.tool.family",
  subtypeKey: "agent_tracer.subtype.key",
  subtypeLabel: "agent_tracer.subtype.label",
  subtypeGroup: "agent_tracer.subtype.group",
  operation: "agent_tracer.operation",
  sourceTool: "agent_tracer.source_tool",
  entityType: "agent_tracer.entity.type",
  entityName: "agent_tracer.entity.name",
  displayTitle: "agent_tracer.display_title",
  evidenceLevel: "agent_tracer.evidence_level",
  evidenceReason: "agent_tracer.evidence_reason",
  filePaths: "agent_tracer.file_paths",
  durationMs: "agent_tracer.duration_ms",
  costUsd: "agent_tracer.cost_usd",
  asyncTaskId: "agent_tracer.async.task_id",
  asyncStatus: "agent_tracer.async.status",
  /** gen_ai.usage.input_tokens가 OTel 권고대로 cache 토큰을 포함한 총량이라, 과금 기준인 베이스 입력 토큰을 따로 싣는다. */
  billableBaseInputTokens: "agent_tracer.usage.billable_base_input_tokens",
  /** 늦게 도착한 commentary를 이미 닫힌 턴에 귀속시키는 상관키이며, 인과 부모와 별개다. */
  turnResponseEventId: "agent_tracer.turn.response_event_id",
  /** 직전 턴의 ID이며, 트레이스가 턴 단위로 갈리므로 OTLP span link로 이어 붙인다. */
  turnPreviousId: "agent_tracer.turn.previous_id"
};
var GEN_AI_OPERATION = {
  invokeAgent: "invoke_agent",
  chat: "chat",
  executeTool: "execute_tool",
  plan: "plan"
};
var GEN_AI_PROVIDER = {
  anthropic: "anthropic"
};
var ATTRIBUTE_PROMOTION = {
  toolName: SEMCONV_ATTR.toolName,
  agentName: SEMCONV_ATTR.agentName,
  agentModel: SEMCONV_ATTR.requestModel,
  model: SEMCONV_ATTR.requestModel,
  mcpTool: SEMCONV_ATTR.mcpToolName,
  inputTokens: SEMCONV_ATTR.inputTokens,
  outputTokens: SEMCONV_ATTR.outputTokens,
  cacheReadTokens: SEMCONV_ATTR.cacheReadInputTokens,
  cacheCreateTokens: SEMCONV_ATTR.cacheCreationInputTokens,
  stopReason: SEMCONV_ATTR.responseFinishReasons,
  mcpServer: AGENT_TRACER_ATTR.mcpServer,
  command: AGENT_TRACER_ATTR.command,
  costUsd: AGENT_TRACER_ATTR.costUsd,
  durationMs: AGENT_TRACER_ATTR.durationMs,
  errorType: SEMCONV_ATTR.errorType,
  evidenceLevel: AGENT_TRACER_ATTR.evidenceLevel,
  evidenceReason: AGENT_TRACER_ATTR.evidenceReason,
  filePaths: AGENT_TRACER_ATTR.filePaths,
  subtypeKey: AGENT_TRACER_ATTR.subtypeKey,
  subtypeLabel: AGENT_TRACER_ATTR.subtypeLabel,
  subtypeGroup: AGENT_TRACER_ATTR.subtypeGroup,
  toolFamily: AGENT_TRACER_ATTR.toolFamily,
  operation: AGENT_TRACER_ATTR.operation,
  sourceTool: AGENT_TRACER_ATTR.sourceTool,
  entityType: AGENT_TRACER_ATTR.entityType,
  entityName: AGENT_TRACER_ATTR.entityName,
  displayTitle: AGENT_TRACER_ATTR.displayTitle,
  asyncTaskId: AGENT_TRACER_ATTR.asyncTaskId,
  asyncStatus: AGENT_TRACER_ATTR.asyncStatus,
  turnResponseEventId: AGENT_TRACER_ATTR.turnResponseEventId
};
function promoteAttributeKey(key) {
  return ATTRIBUTE_PROMOTION[key] ?? key;
}
function toSemconvAttributes(metadata) {
  const promoted = {};
  for (const [key, value] of Object.entries(metadata)) promoted[promoteAttributeKey(key)] = value;
  return promoted;
}

// src/domain/ingest/model/ingest.event.model.ts
function toIngestEvent(event, occurredAt, nextId) {
  const { id, kind, taskId, sessionId, parentId, turnId, metadata, ...rest } = event;
  return {
    id: id ?? nextId(),
    kind,
    taskId,
    ...sessionId ? { sessionId } : {},
    ...parentId ? { parentId } : {},
    ...turnId ? { turnId } : {},
    occurredAt,
    payload: { ...rest, metadata: toSemconvAttributes(metadata) }
  };
}
function toRunIngestEvent(input, occurredAt, nextId) {
  return {
    id: input.id ?? nextId(),
    kind: input.kind,
    taskId: input.taskId,
    ...input.sessionId ? { sessionId: input.sessionId } : {},
    ...input.turnId ? { turnId: input.turnId } : {},
    occurredAt,
    payload: input.payload
  };
}

// src/domain/ingest/model/tags.model.ts
var TAG_KEYS = [
  ["ruleId", "rule"],
  ["ruleStatus", "rule-status"],
  ["verificationStatus", "verification"],
  ["severity", "severity"],
  ["rulePolicy", "policy"],
  ["ruleOutcome", "outcome"],
  ["asyncStatus", "async"],
  ["asyncAgent", "agent"],
  ["asyncCategory", "category"],
  ["activityType", "activity"],
  ["subtypeKey", "subtype"],
  ["subtypeGroup", "subtype-group"],
  ["entityType", "entity"],
  ["toolFamily", "tool-family"],
  ["operation", "operation"],
  ["sourceTool", "source-tool"],
  ["agentName", "agent"],
  ["skillName", "skill"],
  ["ruleSource", "source"],
  ["questionPhase", "question"],
  ["todoState", "todo"],
  ["modelName", "model"],
  ["modelProvider", "provider"],
  ["mcpServer", "mcp"],
  ["mcpTool", "mcp-tool"],
  ["compactPhase", "compact"]
];
var FLAG_KEYS = [
  ["asyncTaskId", "async-task"],
  ["questionId", "question"],
  ["todoId", "todo"]
];
function normalizeTag(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function readTagValue(metadata, key) {
  const value = metadata[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return void 0;
}
function buildTagsFromMetadata(metadata) {
  const tags = /* @__PURE__ */ new Set();
  for (const [key, prefix] of TAG_KEYS) {
    const value = readTagValue(metadata, key);
    if (value) tags.add(`${prefix}:${normalizeTag(value)}`);
  }
  for (const [key, tag] of FLAG_KEYS) {
    if (readTagValue(metadata, key)) tags.add(tag);
  }
  const importance = readTagValue(metadata, "importance");
  if (importance) tags.add(`importance:${normalizeTag(importance)}`);
  return [...tags];
}
function withTags(metadata) {
  return { ...metadata, tags: buildTagsFromMetadata(metadata) };
}

// src/domain/ingest/model/event.envelope.model.ts
function runtimeAttributes(runtimeSource) {
  return {
    [AGENT_TRACER_ATTR.runtimeSource]: runtimeSource,
    [SEMCONV_ATTR.providerName]: GEN_AI_PROVIDER.anthropic
  };
}
function toIngestEvents(events, runtimeSource, nextId, occurredAt) {
  const attributes = runtimeAttributes(runtimeSource);
  return events.map((event) => toIngestEvent(
    { ...event, metadata: { ...withTags(event.metadata), ...attributes } },
    occurredAt,
    nextId
  ));
}

// src/domain/ingest/application/append.events.usecase.ts
var AppendEventsUsecase = class {
  constructor(sink, ids2, clock2, runtimeSource) {
    this.sink = sink;
    this.ids = ids2;
    this.clock = clock2;
    this.runtimeSource = runtimeSource;
  }
  sink;
  ids;
  clock;
  runtimeSource;
  async execute(events) {
    if (events.length === 0) return;
    const occurredAt = new Date(this.clock.now()).toISOString();
    const nextId = () => this.ids.next();
    const runtime = events.filter(isRuntimeEvent);
    const raw = events.filter((event) => !isRuntimeEvent(event));
    await this.sink.append([
      ...toIngestEvents(runtime, this.runtimeSource, nextId, occurredAt),
      ...raw.map((event) => toRunIngestEvent(event, occurredAt, nextId))
    ]);
  }
};
function isRuntimeEvent(event) {
  return "lane" in event;
}

// src/config/spool.ts
import * as fs5 from "node:fs";
import * as path3 from "node:path";

// src/support/ulid.ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function encodeTime(timeMs) {
  let value = Math.floor(timeMs);
  let output = "";
  for (let index = 0; index < 10; index += 1) {
    output = ENCODING[value % 32] + output;
    value = Math.floor(value / 32);
  }
  return output;
}
function encodeBytes(bytes) {
  let bits = 0;
  let bitLength = 0;
  let output = "";
  for (const byte of bytes) {
    bits = bits << 8 | byte;
    bitLength += 8;
    while (bitLength >= 5) {
      output += ENCODING[bits >> bitLength - 5 & 31];
      bitLength -= 5;
    }
  }
  return output;
}
function generateUlid(timeMs = Date.now()) {
  return `${encodeTime(timeMs)}${encodeBytes(randomBytes(10)).slice(0, 16)}`;
}

// src/config/spool.ts
var SPOOL_MAX_BYTES = 50 * 1024 * 1024;
var SPOOL_BATCH_MAX = 100;
var SEGMENT_PREFIX = "seg-";
var SEGMENT_SUFFIX = ".jsonl";
var TMP_PREFIX = ".tmp-";
function chunkSegmentId(segmentId, index) {
  return `${segmentId}-${String(index).padStart(3, "0")}`;
}
function writeSegment(lines, paths, segmentId) {
  const payload = lines.map((line) => `${line}
`).join("");
  const tmpPath = path3.join(paths.spoolDir, `${TMP_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
  const finalPath = path3.join(paths.spoolDir, `${SEGMENT_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
  const fd = fs5.openSync(tmpPath, "w");
  try {
    fs5.writeSync(fd, payload);
    fs5.fsyncSync(fd);
  } finally {
    fs5.closeSync(fd);
  }
  fs5.renameSync(tmpPath, finalPath);
}
function appendSpoolLines(lines, paths = resolveAgentTracerPaths(), segmentId = generateUlid()) {
  if (lines.length === 0) return;
  ensureSpoolDir(paths);
  if (lines.length <= SPOOL_BATCH_MAX) {
    writeSegment(lines, paths, segmentId);
    return;
  }
  for (let offset = 0, index = 0; offset < lines.length; offset += SPOOL_BATCH_MAX, index += 1) {
    writeSegment(lines.slice(offset, offset + SPOOL_BATCH_MAX), paths, chunkSegmentId(segmentId, index));
  }
}

// src/domain/ingest/adapter/spool.event.sink.adapter.ts
var SpoolEventSinkAdapter = class {
  append(events) {
    if (events.length > 0) appendSpoolLines(events.map((event) => JSON.stringify(event)));
    return Promise.resolve();
  }
};

// ../kernel/src/api/memo.query.const.ts
var MEMOS_PATH = "/api/v1/memos";

// src/config/http.ts
var DEFAULT_TIMEOUT_MS = 5e3;
function jsonHeaders(headers2) {
  return { ...headers2, "Content-Type": "application/json" };
}
function resolveTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS, signal) {
  return signal ?? AbortSignal.timeout(timeoutMs);
}
async function getJson(url, headers2, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(url, { headers: headers2, signal: resolveTimeoutSignal(timeoutMs) });
  } catch {
    return { kind: "unavailable" };
  }
  if (response.status === 404) return { kind: "absent" };
  if (!response.ok) return { kind: "unavailable" };
  try {
    const parsed = await response.json();
    return isRecord(parsed) ? { kind: "found", value: parsed } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
async function postJson(url, headers2, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, {
    method: "POST",
    headers: jsonHeaders(headers2),
    body: JSON.stringify(body),
    signal: resolveTimeoutSignal(timeoutMs)
  });
}
async function patchJson(url, headers2, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, {
    method: "PATCH",
    headers: jsonHeaders(headers2),
    body: JSON.stringify(body),
    signal: resolveTimeoutSignal(timeoutMs)
  });
}

// src/domain/memo/adapter/http.memo.search.adapter.ts
var FETCH_TIMEOUT_MS = 3e3;
var HttpMemoSearchAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async listByTask(taskId) {
    const fetched = await getJson(
      `${this.baseUrl}${MEMOS_PATH}?taskId=${encodeURIComponent(taskId)}`,
      this.headers,
      FETCH_TIMEOUT_MS
    );
    if (fetched.kind !== "found") return fetched;
    const rawItems = fetched.value.data?.items;
    const items = Array.isArray(rawItems) ? rawItems : [];
    return {
      kind: "found",
      value: items.map(parseMemoItem).filter((item) => item !== null)
    };
  }
};
function parseMemoItem(item) {
  if (!isRecord(item)) return null;
  const id = item["id"];
  const taskId = item["taskId"];
  const body = item["body"];
  if (typeof id !== "string" || typeof taskId !== "string" || typeof body !== "string") return null;
  const eventId = item["eventId"];
  const author = item["author"];
  const updatedAt = item["updatedAt"];
  return {
    id,
    taskId,
    eventId: typeof eventId === "string" ? eventId : null,
    author: typeof author === "string" ? author : "",
    body,
    ...typeof updatedAt === "string" ? { updatedAt } : {}
  };
}

// ../kernel/src/memo/memo.const.ts
var MEMO_AUTHOR = {
  human: "human",
  agent: "agent"
};
var MEMO_AUTHORS = [MEMO_AUTHOR.human, MEMO_AUTHOR.agent];

// src/domain/memo/adapter/http.memo.write.adapter.ts
var HttpMemoWriteAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async create(input) {
    const response = await postJson(`${this.baseUrl}${MEMOS_PATH}`, this.headers, {
      taskId: input.taskId,
      body: input.body,
      author: MEMO_AUTHOR.agent,
      ...input.eventId !== void 0 ? { eventId: input.eventId } : {}
    });
    return response.ok;
  }
};

// src/domain/memo/application/create.memo.usecase.ts
var CreateMemoUsecase = class {
  constructor(writer) {
    this.writer = writer;
  }
  writer;
  async execute(input) {
    if (input.taskId === "" || input.body.trim() === "") return false;
    try {
      return await this.writer.create(input);
    } catch {
      return false;
    }
  }
};

// src/domain/memo/application/search.memos.usecase.ts
var DEFAULT_LIMIT = 20;
var SearchMemosUsecase = class {
  constructor(reader) {
    this.reader = reader;
  }
  reader;
  async execute(input) {
    if (input.taskId === "") return { kind: "found", value: [] };
    let fetched;
    try {
      fetched = await this.reader.listByTask(input.taskId);
    } catch {
      return { kind: "unavailable" };
    }
    if (fetched.kind !== "found") return fetched;
    const filtered = filterByQuery(fetched.value, input.query);
    const limit = input.limit ?? DEFAULT_LIMIT;
    return { kind: "found", value: filtered.slice(0, limit) };
  }
};
function filterByQuery(items, query) {
  const trimmed2 = query?.trim().toLowerCase();
  if (!trimmed2) return items;
  return items.filter((item) => item.body.toLowerCase().includes(trimmed2));
}

// src/domain/recipe/adapter/file.recipe.pending.mark.adapter.ts
import * as fs6 from "node:fs";
import * as path4 from "node:path";
var FileRecipePendingMarkAdapter = class {
  constructor(paths = resolveAgentTracerPaths()) {
    this.paths = paths;
  }
  paths;
  read(taskId) {
    try {
      const parsed = JSON.parse(fs6.readFileSync(this.filePath(taskId), "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  write(taskId, marks) {
    try {
      ensureRecipePendingDir(this.paths);
      const target = this.filePath(taskId);
      const tmp = `${target}.tmp`;
      fs6.writeFileSync(tmp, JSON.stringify(marks));
      fs6.renameSync(tmp, target);
    } catch {
      return;
    }
  }
  filePath(taskId) {
    return path4.join(this.paths.recipePendingDir, `${encodeURIComponent(taskId)}.json`);
  }
};

// src/domain/recipe/adapter/http.recipe.fetch.adapter.ts
var REQUEST_TIMEOUT_MS = 5e3;
var HttpRecipeFetchAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async fetch(recipeId) {
    const fetched = await getJson(
      `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(recipeId)}`,
      this.headers,
      REQUEST_TIMEOUT_MS
    );
    if (fetched.kind !== "found") return fetched;
    const payload = "data" in fetched.value ? fetched.value["data"] : fetched.value;
    const recipe2 = toCachedRecipe(payload);
    return recipe2 === null ? { kind: "unavailable" } : { kind: "found", value: recipe2 };
  }
};
function toCachedRecipe(value) {
  if (!isRecord(value)) return null;
  const id = readString(value, "id");
  const title = readString(value, "title");
  if (!id || !title) return null;
  return {
    id,
    title,
    intent: readString(value, "intent"),
    description: readString(value, "description"),
    summaryMd: readString(value, "summaryMd"),
    steps: readSteps(value["steps"]),
    pitfalls: readPitfalls(value["pitfalls"]),
    corrections: readCorrections(value["corrections"]),
    touchedFiles: readTouchedFiles(value["touchedFiles"]),
    governingRules: readStringArray(value["governingRules"])
  };
}
function readSteps(value) {
  if (!Array.isArray(value)) return [];
  const steps = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const order = entry["order"];
    const action = readString(entry, "action");
    if (typeof order !== "number" || !action) continue;
    const rationale = readString(entry, "rationale");
    steps.push({ order, action, ...rationale ? { rationale } : {} });
  }
  return steps;
}
function readPitfalls(value) {
  if (!Array.isArray(value)) return [];
  const pitfalls = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const pitfall = readString(entry, "pitfall");
    const whyNonObvious = readString(entry, "whyNonObvious");
    if (pitfall && whyNonObvious) pitfalls.push({ pitfall, whyNonObvious });
  }
  return pitfalls;
}
function readCorrections(value) {
  if (!Array.isArray(value)) return [];
  const corrections = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const whatAgentDid = readString(entry, "whatAgentDid");
    const howCorrected = readString(entry, "howCorrected");
    if (whatAgentDid && howCorrected) corrections.push({ whatAgentDid, howCorrected });
  }
  return corrections;
}
function readTouchedFiles(value) {
  if (!Array.isArray(value)) return [];
  const files = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const path5 = readString(entry, "path");
    const role = entry["role"];
    if (path5 && (role === "read" || role === "write" || role === "both")) files.push({ path: path5, role });
  }
  return files;
}
function readStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}
function readString(source, key) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

// src/domain/recipe/adapter/http.recipe.outcome.report.adapter.ts
var HttpRecipeOutcomeReportAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async report(input) {
    const url = `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(input.recipeId)}/outcome`;
    let response;
    try {
      response = await postJson(url, this.headers, {
        taskId: input.taskId,
        outcome: input.outcome,
        ...input.note !== void 0 ? { note: input.note } : {}
      });
    } catch {
      return "unavailable";
    }
    if (response.ok) return "accepted";
    return response.status === 404 ? "rejected" : "unavailable";
  }
};

// ../kernel/src/job/job.const.ts
var JOB_KIND = {
  titleSuggestion: "title.suggestion",
  recipeScan: "recipe.scan",
  taskCleanup: "task.cleanup",
  ruleGeneration: "rule.generation"
};
var AI_AGENT_BACKEND = {
  python: "python",
  claudeSdk: "claude-sdk"
};
var DEFAULT_AI_AGENT_BACKEND = AI_AGENT_BACKEND.python;
var RECIPE_SCAN_TRIGGER = {
  dashboard: "dashboard",
  session: "session"
};
var JOB_EXECUTOR = {
  [JOB_KIND.titleSuggestion]: "temporal",
  [JOB_KIND.recipeScan]: "temporal",
  [JOB_KIND.taskCleanup]: "temporal",
  [JOB_KIND.ruleGeneration]: "local"
};
var JOB_STATUS = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  canceled: "canceled"
};
var JOB_STATUSES = Object.values(JOB_STATUS);

// src/domain/recipe/adapter/http.recipe.scan.job.adapter.ts
var ACTIVE_STATUSES = /* @__PURE__ */ new Set([JOB_STATUS.pending, JOB_STATUS.running]);
var HttpRecipeScanJobAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async hasActiveScan(taskId) {
    const url = `${this.baseUrl}/api/v1/jobs/latest?kind=${encodeURIComponent(JOB_KIND.recipeScan)}&taskId=${encodeURIComponent(taskId)}`;
    const fetched = await getJson(url, this.headers);
    const status = fetched.kind === "found" ? fetched.value.data?.job?.status : void 0;
    return status !== void 0 && ACTIVE_STATUSES.has(status);
  }
  async enqueue(taskId, idempotencyKey, userPrompt) {
    const response = await postJson(`${this.baseUrl}/api/v1/jobs`, this.headers, {
      kind: JOB_KIND.recipeScan,
      input: {
        taskId,
        trigger: RECIPE_SCAN_TRIGGER.session,
        ...userPrompt !== void 0 ? { userPrompt } : {}
      },
      idempotencyKey
    });
    return response.ok;
  }
};

// src/domain/recipe/adapter/http.recipe.search.adapter.ts
var REQUEST_TIMEOUT_MS2 = 5e3;
var HttpRecipeSearchAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async search(query, limit) {
    const url = `${this.baseUrl}/api/v1/recipes/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const fetched = await getJson(url, this.headers, REQUEST_TIMEOUT_MS2);
    return fetched.kind === "found" ? { kind: "found", value: extractItems(fetched.value) } : fetched;
  }
};
function extractItems(body) {
  let source = body;
  if (isRecord(source) && "data" in source) source = source["data"];
  if (isRecord(source) && Array.isArray(source["items"])) source = source["items"];
  if (!Array.isArray(source)) return [];
  const items = [];
  for (const entry of source) {
    const item = toItem(entry);
    if (item) items.push(item);
  }
  return items;
}
function toItem(value) {
  if (!isRecord(value)) return null;
  const recipeId = value["recipeId"];
  const title = value["title"];
  if (typeof recipeId !== "string" || typeof title !== "string") return null;
  const intent = value["intent"];
  const description = value["description"];
  const score = value["score"];
  return {
    recipeId,
    title,
    intent: typeof intent === "string" ? intent : "",
    description: typeof description === "string" ? description : "",
    score: typeof score === "number" ? score : 0
  };
}

// src/domain/recipe/model/recipe.pending.mark.model.ts
var MAX_PENDING_MARKS_PER_TASK = 3;
var PENDING_MARK_TTL_MS = 24 * 60 * 60 * 1e3;
function markRecipeOpened(marks, recipeId, openedAt) {
  const appended = [...marks.filter((mark) => mark.recipeId !== recipeId), { recipeId, openedAt }];
  return appended.length > MAX_PENDING_MARKS_PER_TASK ? appended.slice(appended.length - MAX_PENDING_MARKS_PER_TASK) : appended;
}
function clearRecipeMark(marks, recipeId) {
  return marks.filter((mark) => mark.recipeId !== recipeId);
}
function dropExpiredMarks(marks, nowMs, ttlMs) {
  return marks.filter((mark) => nowMs - Date.parse(mark.openedAt) < ttlMs);
}

// src/domain/recipe/application/clear.recipe.mark.usecase.ts
var ClearRecipeMarkUsecase = class {
  constructor(marks) {
    this.marks = marks;
  }
  marks;
  execute(taskId, recipeId) {
    if (taskId === "" || recipeId === "") return;
    const marks = this.marks.read(taskId);
    const next = clearRecipeMark(marks, recipeId);
    if (next.length !== marks.length) this.marks.write(taskId, next);
  }
};

// src/domain/recipe/model/recipe.body.model.ts
function buildRecipeBody(recipe2) {
  const lines = [`# ${recipe2.title}`, "", `intent: ${recipe2.intent}`, recipe2.description];
  const summary = recipe2.summaryMd.trim();
  if (summary) lines.push("", summary);
  if (recipe2.steps.length > 0) {
    lines.push("", "## Steps");
    for (const step of [...recipe2.steps].sort((left, right) => left.order - right.order)) {
      const rationale = step.rationale ? ` (${step.rationale})` : "";
      lines.push(`${step.order}. ${step.action}${rationale}`);
    }
  }
  if (recipe2.pitfalls.length > 0) {
    lines.push("", "## Pitfalls");
    for (const pitfall of recipe2.pitfalls) lines.push(`- ${pitfall.pitfall} \u2014 ${pitfall.whyNonObvious}`);
  }
  if (recipe2.corrections.length > 0) {
    lines.push("", "## Corrections");
    for (const correction of recipe2.corrections) {
      lines.push(`- ${correction.whatAgentDid} \u2192 ${correction.howCorrected}`);
    }
  }
  if (recipe2.touchedFiles.length > 0) {
    const files = recipe2.touchedFiles.map((file) => `${file.path} (${file.role})`).join(", ");
    lines.push("", `touched files: ${files}`);
  }
  if (recipe2.governingRules.length > 0) lines.push("", `governing rules: ${recipe2.governingRules.join(", ")}`);
  return lines.join("\n");
}

// src/domain/recipe/application/get.recipe.usecase.ts
var GetRecipeUsecase = class {
  constructor(fetcher) {
    this.fetcher = fetcher;
  }
  fetcher;
  async execute(recipeId) {
    try {
      const fetched = await this.fetcher.fetch(recipeId);
      return fetched.kind === "found" ? { kind: "found", value: buildRecipeBody(fetched.value) } : fetched;
    } catch {
      return { kind: "unavailable" };
    }
  }
};

// src/domain/recipe/application/mark.recipe.opened.usecase.ts
var MarkRecipeOpenedUsecase = class {
  constructor(marks, clock2) {
    this.marks = marks;
    this.clock = clock2;
  }
  marks;
  clock;
  execute(taskId, recipeId) {
    if (taskId === "" || recipeId === "") return;
    const openedAt = new Date(this.clock.now()).toISOString();
    this.marks.write(taskId, markRecipeOpened(this.marks.read(taskId), recipeId, openedAt));
  }
};

// src/domain/recipe/application/read.pending.recipe.mark.usecase.ts
var ReadPendingRecipeMarkUsecase = class {
  constructor(marks, clock2) {
    this.marks = marks;
    this.clock = clock2;
  }
  marks;
  clock;
  execute(taskId) {
    if (taskId === "") return void 0;
    const marks = this.marks.read(taskId);
    const alive = dropExpiredMarks(marks, this.clock.now(), PENDING_MARK_TTL_MS);
    if (alive.length !== marks.length) this.marks.write(taskId, alive);
    return alive[0];
  }
};

// src/domain/recipe/application/report.recipe.outcome.usecase.ts
var ReportRecipeOutcomeUsecase = class {
  constructor(reports) {
    this.reports = reports;
  }
  reports;
  async execute(input) {
    if (input.recipeId === "" || input.taskId === "") return "rejected";
    try {
      return await this.reports.report(input);
    } catch {
      return "unavailable";
    }
  }
};

// src/domain/recipe/model/scan.command.model.ts
var RECIPE_COMMAND = /^(?:\/(?:[\w-]+:)?recipe|\$recipe)(?:\s|$)/i;
function hasRecipeScanCommand(prompt) {
  return RECIPE_COMMAND.test(prompt.trimStart());
}
function readRecipeScanIntent(prompt) {
  const trimmed2 = prompt.trimStart();
  const command = RECIPE_COMMAND.exec(trimmed2);
  if (!command) return void 0;
  const intent = trimmed2.slice(command[0].length).trim();
  return intent.length > 0 ? intent : void 0;
}

// src/domain/recipe/application/request.recipe.scan.usecase.ts
var RequestRecipeScanUsecase = class {
  constructor(jobs) {
    this.jobs = jobs;
  }
  jobs;
  async execute(request) {
    if (request.taskId === "" || request.eventId === "") return false;
    if (!hasRecipeScanCommand(request.prompt)) return false;
    try {
      if (await this.jobs.hasActiveScan(request.taskId)) return false;
      return await this.jobs.enqueue(request.taskId, request.eventId, readRecipeScanIntent(request.prompt));
    } catch {
      return false;
    }
  }
};

// src/domain/recipe/application/search.recipes.usecase.ts
var DEFAULT_LIMIT2 = 3;
var SearchRecipesUsecase = class {
  constructor(search) {
    this.search = search;
  }
  search;
  async execute(input) {
    const query = input.query.trim();
    if (query === "") return { kind: "found", value: [] };
    try {
      return await this.search.search(query, input.limit ?? DEFAULT_LIMIT2);
    } catch {
      return { kind: "unavailable" };
    }
  }
};

// ../kernel/src/ingest/task.const.ts
var AGENT_TITLE_RANK = "agent";

// src/domain/session/adapter/http.task.rename.adapter.ts
var HttpTaskRenameAdapter = class {
  constructor(baseUrl2, headers2) {
    this.baseUrl = baseUrl2;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async rename(taskId, title) {
    const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`;
    const response = await patchJson(url, this.headers, { title, titleRank: AGENT_TITLE_RANK });
    return response.ok;
  }
};

// src/domain/session/application/set.task.title.usecase.ts
var SetTaskTitleUsecase = class {
  constructor(renamer) {
    this.renamer = renamer;
  }
  renamer;
  async execute(taskId, title) {
    const trimmed2 = title.trim();
    if (taskId === "" || trimmed2 === "") return false;
    try {
      return await this.renamer.rename(taskId, trimmed2);
    } catch {
      return false;
    }
  }
};

// src/agent/claude-code/mcp/composition.ts
var identity = resolveMonitorIdentity();
var baseUrl = identity.baseUrl;
var headers = monitorUserHeaders(identity);
var clock = { now: () => Date.now() };
var ids = { next: generateUlid };
var recipe = {
  getRecipe: new GetRecipeUsecase(new HttpRecipeFetchAdapter(baseUrl, headers)),
  requestScan: new RequestRecipeScanUsecase(new HttpRecipeScanJobAdapter(baseUrl, headers)),
  reportOutcome: new ReportRecipeOutcomeUsecase(new HttpRecipeOutcomeReportAdapter(baseUrl, headers)),
  searchRecipes: new SearchRecipesUsecase(new HttpRecipeSearchAdapter(baseUrl, headers))
};
var recipeOutcomeMark = {
  markOpened: new MarkRecipeOpenedUsecase(new FileRecipePendingMarkAdapter(), clock),
  clearMark: new ClearRecipeMarkUsecase(new FileRecipePendingMarkAdapter()),
  readPendingMark: new ReadPendingRecipeMarkUsecase(new FileRecipePendingMarkAdapter(), clock)
};
var memo = {
  createMemo: new CreateMemoUsecase(new HttpMemoWriteAdapter(baseUrl, headers)),
  searchMemos: new SearchMemosUsecase(new HttpMemoSearchAdapter(baseUrl, headers))
};
var session = {
  setTaskTitle: new SetTaskTitleUsecase(new HttpTaskRenameAdapter(baseUrl, headers))
};
var readBinding = new ReadBindingUsecase(new FileBindingStoreAdapter());
var appendIngestEvents = new AppendEventsUsecase(
  new SpoolEventSinkAdapter(),
  ids,
  clock,
  CLAUDE_RUNTIME_SOURCE
);
var mcpRuntime = {
  recipe,
  recipeOutcomeMark,
  memo,
  session
};

// src/domain/memo/model/create.memo.tool.model.ts
var CREATE_MEMO_TOOL = {
  name: "create_memo",
  description: "Leave a short note on this session's task in Agent Tracer, visible to the human operator later. Call this when you notice something worth flagging for a human but that does not belong in your normal response \u2014 an assumption you made, a workaround you had to use, or a risk you could not resolve yourself. The note is attached to the task of the session this tool runs in, which it identifies on its own \u2014 you do not pass a session or task id. If you are a subagent, the note lands on the task of the session that launched you, not on your own subagent task.",
  inputSchema: {
    type: "object",
    properties: {
      body: { type: "string", description: "The note text." },
      eventId: {
        type: "string",
        description: "Optional event id to attach the note to a specific event instead of the task overall."
      }
    },
    required: ["body"]
  }
};
function parseCreateMemoArgs(value) {
  if (!isRecord(value)) return null;
  const body = value["body"];
  if (typeof body !== "string" || body.trim() === "") return null;
  const eventId = value["eventId"];
  return {
    body,
    ...typeof eventId === "string" && eventId.trim() !== "" ? { eventId } : {}
  };
}

// src/domain/memo/model/search.memos.tool.model.ts
var SEARCH_MEMOS_TOOL = {
  name: "search_memos",
  description: "Read notes left on this session's task in Agent Tracer. Call this when you want to check what a human or a prior agent run already flagged before you repeat work or make a decision. Omit query to list every memo on that task; pass query to narrow to memos whose text matches. The task is the one belonging to the session this tool runs in, which it identifies on its own \u2014 you do not pass a session or task id. If you are a subagent, this reads the task of the session that launched you, not your own subagent task.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional text to filter memos by. Omit to list all." },
      limit: { type: "number", description: "Max memos to return (default 20)." }
    },
    required: []
  }
};
function parseSearchMemosArgs(value) {
  if (!isRecord(value)) return null;
  const query = value["query"];
  const limit = value["limit"];
  return {
    ...typeof query === "string" && query.trim() !== "" ? { query } : {},
    ...typeof limit === "number" && Number.isFinite(limit) ? { limit } : {}
  };
}

// src/domain/memo/inbound/memo.hook.ts
function onMemoCreateRequested(hook, input) {
  return hook.createMemo.execute(input);
}
function onMemoSearchRequested(hook, input) {
  return hook.searchMemos.execute(input);
}

// ../kernel/src/ingest/event.kind.const.ts
var KIND = {
  executeTool: GEN_AI_OPERATION.executeTool,
  invokeAgent: GEN_AI_OPERATION.invokeAgent,
  planLogged: GEN_AI_OPERATION.plan,
  tokenUsage: "gen_ai.client.inference.operation.details",
  actionLogged: "agent_tracer.action.logged",
  ruleLogged: "agent_tracer.rule.logged",
  thoughtLogged: "agent_tracer.thought.logged",
  contextSaved: "agent_tracer.context.saved",
  userMessage: "agent_tracer.user.message",
  assistantCommentary: "agent_tracer.assistant.commentary",
  assistantResponse: "agent_tracer.assistant.response",
  questionLogged: "agent_tracer.question.logged",
  todoLogged: "agent_tracer.todo.logged",
  sessionStarted: "agent_tracer.session.started",
  sessionEnded: "agent_tracer.session.ended",
  instructionsLoaded: "agent_tracer.instructions.loaded",
  contextSnapshot: "agent_tracer.context.snapshot",
  taskLinked: "agent_tracer.task.linked",
  fileChanged: "agent_tracer.file.changed",
  userPromptExpansion: "agent_tracer.user.prompt.expansion",
  worktreeRemove: "agent_tracer.worktree.remove",
  permissionRequest: "agent_tracer.permission.request",
  setupTriggered: "agent_tracer.setup.triggered",
  recipeInjected: "agent_tracer.recipe.injected"
};
var TOOL_ACTIVITY_EVENT_KINDS = [KIND.executeTool];
var WORKFLOW_EVENT_KINDS = [
  KIND.planLogged,
  KIND.actionLogged,
  KIND.ruleLogged,
  KIND.thoughtLogged,
  KIND.contextSaved,
  KIND.contextSnapshot,
  KIND.userPromptExpansion,
  KIND.permissionRequest,
  KIND.worktreeRemove,
  KIND.setupTriggered,
  KIND.fileChanged
];
var CONVERSATION_EVENT_KINDS = [
  KIND.userMessage,
  KIND.assistantCommentary,
  KIND.assistantResponse,
  KIND.questionLogged,
  KIND.todoLogged
];
var COORDINATION_EVENT_KINDS = [KIND.invokeAgent];
var LIFECYCLE_EVENT_KINDS = [KIND.instructionsLoaded];
var TELEMETRY_EVENT_KINDS = [KIND.tokenUsage];
var RUN_EVENT_KINDS = [
  KIND.sessionStarted,
  KIND.sessionEnded,
  KIND.taskLinked
];
var TIMELINE_EVENT_KINDS = [
  ...TOOL_ACTIVITY_EVENT_KINDS,
  ...WORKFLOW_EVENT_KINDS,
  ...CONVERSATION_EVENT_KINDS,
  ...COORDINATION_EVENT_KINDS,
  ...LIFECYCLE_EVENT_KINDS
];
var SPAN_EVENT_KINDS = [KIND.executeTool, KIND.invokeAgent, KIND.planLogged];
var SPAN_KIND_SET = new Set(SPAN_EVENT_KINDS);

// src/domain/ingest/model/recipe.injection.event.model.ts
function recipeInjectedEvent(target, input) {
  return {
    kind: KIND.recipeInjected,
    taskId: target.taskId,
    sessionId: target.sessionId,
    ...target.turnId ? { turnId: target.turnId } : {},
    payload: {
      recipeId: input.recipeId,
      applicationId: input.applicationId,
      injectedVia: input.injectedVia
    }
  };
}

// src/domain/recipe/model/get.recipe.tool.model.ts
var GET_RECIPE_TOOL = {
  name: "get_recipe",
  description: "Fetch the full workflow for a recipe you saw in the <agent-tracer-recipes> menu \u2014 its intent, the recorded steps in order, known pitfalls, past corrections, touched files, and governing rules. Call this before you start work whenever a recipe in the menu plausibly fits the current task. Calling this marks the recipe as applied to this task, so only call it for a recipe you intend to actually follow.",
  inputSchema: {
    type: "object",
    properties: {
      recipeId: { type: "string", description: "The recipeId from a recipe entry in the menu." }
    },
    required: ["recipeId"]
  }
};
function parseGetRecipeArgs(value) {
  if (!isRecord(value)) return null;
  const recipeId = value["recipeId"];
  return typeof recipeId === "string" && recipeId.trim() !== "" ? { recipeId } : null;
}

// ../kernel/src/recipe/recipe.const.ts
var RECIPE_STATUS = {
  candidate: "candidate",
  active: "active",
  dismissed: "dismissed",
  superseded: "superseded",
  retired: "retired"
};
var RECIPE_STATUSES = [
  RECIPE_STATUS.candidate,
  RECIPE_STATUS.active,
  RECIPE_STATUS.dismissed,
  RECIPE_STATUS.superseded,
  RECIPE_STATUS.retired
];
var RECIPE_OUTCOME = {
  completed: "completed",
  abandoned: "abandoned",
  superseded: "superseded"
};
var RECIPE_OUTCOMES = [
  RECIPE_OUTCOME.completed,
  RECIPE_OUTCOME.abandoned,
  RECIPE_OUTCOME.superseded
];

// src/domain/recipe/model/report.recipe.outcome.tool.model.ts
var REPORT_RECIPE_OUTCOME_TOOL = {
  name: "report_recipe_outcome",
  description: "Report whether a recipe you followed actually helped on this task. Call this once you can judge the result \u2014 right after finishing the work the recipe guided, or as soon as you abandon the recipe partway through because it did not fit. This is the only feedback signal recipe effectiveness is measured by: call it every time you acted on a recipe, whether you opened it with get_recipe or judged it from the menu alone, even when the outcome was mixed or negative. The report is filed against the task of the session this tool runs in, which it identifies on its own \u2014 you do not pass a session or task id; if you are a subagent, it is filed against the task of the session that launched you.",
  inputSchema: {
    type: "object",
    properties: {
      recipeId: {
        type: "string",
        description: "The recipeId from a get_recipe call or from a recipe entry in the menu."
      },
      outcome: {
        type: "string",
        enum: [...RECIPE_OUTCOMES],
        description: "'completed' if the recipe helped you finish the task, 'abandoned' if you stopped following it because it did not help, 'superseded' if you found a better approach and replaced it."
      },
      note: { type: "string", description: "Optional short note on what happened." }
    },
    required: ["recipeId", "outcome"]
  }
};
var OUTCOME_SET = new Set(RECIPE_OUTCOMES);
function parseReportRecipeOutcomeArgs(value) {
  if (!isRecord(value)) return null;
  const recipeId = value["recipeId"];
  const outcome = value["outcome"];
  if (typeof recipeId !== "string" || recipeId.trim() === "") return null;
  if (typeof outcome !== "string" || !OUTCOME_SET.has(outcome)) return null;
  const note = value["note"];
  return {
    recipeId,
    outcome,
    ...typeof note === "string" && note.trim() !== "" ? { note } : {}
  };
}

// src/domain/recipe/model/request.recipe.scan.tool.model.ts
var REQUEST_RECIPE_SCAN_TOOL = {
  name: "request_recipe_scan",
  description: "Ask Agent Tracer to scan this task for reusable patterns and turn them into a recipe candidate for later review. Call this near the end of a task, once you judge that the approach you used \u2014 a non-obvious fix, a multi-step setup, a workaround worth remembering \u2014 would be worth reusing the next time this kind of work comes up in this workspace. Equivalent to the user typing /recipe. The task scanned is the one belonging to the session this tool runs in, which it identifies on its own \u2014 you do not pass a session or task id; if you are a subagent, it scans the task of the session that launched you. Runs in the background and does not return the recipe itself, so don't call this expecting immediate output.",
  inputSchema: { type: "object", properties: {} }
};

// src/domain/recipe/model/search.recipes.tool.model.ts
var SEARCH_RECIPES_TOOL = {
  name: "search_recipes",
  description: "Search this workspace's saved recipes \u2014 workflows distilled from how past tasks here were actually solved \u2014 by describing the current task in your own words. Returns decision-level info only (recipeId, title, intent, description, relevance score), not the steps, pitfalls, or corrections. Call this before starting work whenever the request plausibly repeats something already solved here. If a result looks like a fit, call get_recipe(recipeId) next to pull its full workflow before you act on it.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The current task described in your own words." },
      limit: { type: "number", description: "Max recipes to return (default 3)." }
    },
    required: ["query"]
  }
};
function parseSearchRecipesArgs(value) {
  if (!isRecord(value)) return null;
  const query = value["query"];
  if (typeof query !== "string" || query.trim() === "") return null;
  const limit = value["limit"];
  return {
    query,
    ...typeof limit === "number" && Number.isFinite(limit) ? { limit } : {}
  };
}

// src/domain/recipe/inbound/recipe.hook.ts
function onGetRecipe(hook, recipeId) {
  return hook.getRecipe.execute(recipeId);
}
function onRecipeSearchRequested(hook, input) {
  return hook.searchRecipes.execute(input);
}
function onRecipeScanRequested(hook, request) {
  return hook.requestScan.execute(request);
}
function onRecipeOutcomeReported(hook, input) {
  return hook.reportOutcome.execute(input);
}
function onRecipeOpened(hook, taskId, recipeId) {
  hook.markOpened.execute(taskId, recipeId);
}
function onRecipeMarkCleared(hook, taskId, recipeId) {
  hook.clearMark.execute(taskId, recipeId);
}

// src/domain/session/inbound/session.hook.ts
function onSetTaskTitleRequested(hook, taskId, title) {
  return hook.setTaskTitle.execute(taskId, title);
}

// src/domain/session/model/set.task.title.tool.model.ts
var SET_TASK_TITLE_TOOL = {
  name: "set_task_title",
  description: `Rename this session's task in Agent Tracer's dashboard. A task opens with a crude placeholder title \u2014 the first 120 characters of the initial prompt, or "Subagent: <type>". Set a real title once you understand what the work is actually about and it is worth tracking on its own. If the request is trivial, throwaway, or a one-off question, skip it. Give a short, specific title, and re-title only if the scope later shifts substantially. The tool identifies its own session, so you do not pass a session or task id; a subagent renames the task of the session that launched it.`,
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, specific task title (a few words to a short sentence)." }
    },
    required: ["title"]
  }
};
function parseSetTaskTitleArgs(value) {
  if (!isRecord(value)) return null;
  const title = value["title"];
  return typeof title === "string" && title.trim() !== "" ? { title: title.trim() } : null;
}

// src/agent/claude-code/mcp/tool.dispatch.ts
var MCP_RECIPE_SCAN_PROMPT = "/recipe";
var UNKNOWN_SESSION = "unknown_session";
var MCP_TOOLS = [
  GET_RECIPE_TOOL,
  SEARCH_RECIPES_TOOL,
  REPORT_RECIPE_OUTCOME_TOOL,
  REQUEST_RECIPE_SCAN_TOOL,
  SET_TASK_TITLE_TOOL,
  CREATE_MEMO_TOOL,
  SEARCH_MEMOS_TOOL
];
function invalidArgs() {
  return { text: "Invalid arguments.", isError: true };
}
function formatMemoSearchResult(items) {
  if (items.length === 0) return "No memos found on the active task.";
  return items.map((item) => `## memo ${item.id} (author: ${item.author}${item.eventId ? `, event: ${item.eventId}` : ""})
${item.body}`).join("\n\n---\n\n");
}
function formatRecipeSearchResult(items) {
  if (items.length === 0) return "Nothing saved here fits that.";
  return items.map((item) => `## ${item.title} (recipeId: ${item.recipeId})
intent: ${item.intent}
${item.description}`).join("\n\n---\n\n");
}
function resolveTarget() {
  const sessionId = resolveClaudeSessionId();
  return sessionId === void 0 ? void 0 : readBinding.execute(CLAUDE_RUNTIME_SOURCE, sessionId);
}
async function recordRecipeInjection(target, recipeId) {
  try {
    await appendIngestEvents.execute([
      recipeInjectedEvent(target, {
        recipeId,
        applicationId: generateUlid(),
        injectedVia: "pull"
      })
    ]);
  } catch {
  }
  onRecipeOpened(mcpRuntime.recipeOutcomeMark, target.taskId, recipeId);
}
async function callTool(name, args) {
  switch (name) {
    case GET_RECIPE_TOOL.name: {
      const parsed = parseGetRecipeArgs(args);
      if (!parsed) return invalidArgs();
      const fetched = await onGetRecipe(mcpRuntime.recipe, parsed.recipeId);
      if (fetched.kind === "unavailable") {
        return { text: "Could not reach the recipe server. Try again.", isError: true };
      }
      const target = resolveTarget();
      if (fetched.kind === "absent") {
        if (target !== void 0) onRecipeMarkCleared(mcpRuntime.recipeOutcomeMark, target.taskId, parsed.recipeId);
        return { text: `Recipe not found: ${parsed.recipeId}`, isError: true };
      }
      if (target !== void 0) await recordRecipeInjection(target, parsed.recipeId);
      return { text: fetched.value, isError: false };
    }
    case REPORT_RECIPE_OUTCOME_TOOL.name: {
      const parsed = parseReportRecipeOutcomeArgs(args);
      if (!parsed) return invalidArgs();
      const target = resolveTarget();
      if (target === void 0) {
        return { text: `Could not record outcome (${UNKNOWN_SESSION}).`, isError: true };
      }
      const result = await onRecipeOutcomeReported(mcpRuntime.recipe, {
        recipeId: parsed.recipeId,
        taskId: target.taskId,
        outcome: parsed.outcome,
        ...parsed.note !== void 0 ? { note: parsed.note } : {}
      });
      if (result === "unavailable") {
        return { text: "Could not reach the server to record the outcome. Try again.", isError: true };
      }
      onRecipeMarkCleared(mcpRuntime.recipeOutcomeMark, target.taskId, parsed.recipeId);
      return result === "accepted" ? { text: "Outcome recorded.", isError: false } : { text: `Recipe no longer exists: ${parsed.recipeId}`, isError: true };
    }
    case REQUEST_RECIPE_SCAN_TOOL.name: {
      const target = resolveTarget();
      if (target === void 0) return { text: `Scan not queued (${UNKNOWN_SESSION}).`, isError: true };
      const queued = await onRecipeScanRequested(mcpRuntime.recipe, {
        taskId: target.taskId,
        eventId: generateUlid(),
        prompt: MCP_RECIPE_SCAN_PROMPT
      });
      return queued ? { text: "Recipe scan queued.", isError: false } : { text: "Scan not queued.", isError: true };
    }
    case SET_TASK_TITLE_TOOL.name: {
      const parsed = parseSetTaskTitleArgs(args);
      if (!parsed) return invalidArgs();
      const target = resolveTarget();
      if (target === void 0) {
        return { text: `Could not update title (${UNKNOWN_SESSION}).`, isError: true };
      }
      const ok = await onSetTaskTitleRequested(mcpRuntime.session, target.taskId, parsed.title);
      return ok ? { text: "Task title updated.", isError: false } : { text: "Could not update title.", isError: true };
    }
    case CREATE_MEMO_TOOL.name: {
      const parsed = parseCreateMemoArgs(args);
      if (!parsed) return invalidArgs();
      const target = resolveTarget();
      if (target === void 0) return { text: `Could not save memo (${UNKNOWN_SESSION}).`, isError: true };
      const ok = await onMemoCreateRequested(mcpRuntime.memo, {
        taskId: target.taskId,
        body: parsed.body,
        ...parsed.eventId !== void 0 ? { eventId: parsed.eventId } : {}
      });
      return ok ? { text: "Memo saved.", isError: false } : { text: "Could not save memo.", isError: true };
    }
    case SEARCH_MEMOS_TOOL.name: {
      const parsed = parseSearchMemosArgs(args);
      if (!parsed) return invalidArgs();
      const target = resolveTarget();
      if (target === void 0) return { text: formatMemoSearchResult([]), isError: false };
      const fetched = await onMemoSearchRequested(mcpRuntime.memo, {
        taskId: target.taskId,
        ...parsed.query !== void 0 ? { query: parsed.query } : {},
        ...parsed.limit !== void 0 ? { limit: parsed.limit } : {}
      });
      if (fetched.kind === "unavailable") {
        return { text: "Could not reach the memo server. Try again.", isError: true };
      }
      return { text: formatMemoSearchResult(fetched.kind === "found" ? fetched.value : []), isError: false };
    }
    case SEARCH_RECIPES_TOOL.name: {
      const parsed = parseSearchRecipesArgs(args);
      if (!parsed) return invalidArgs();
      const fetched = await onRecipeSearchRequested(mcpRuntime.recipe, {
        query: parsed.query,
        ...parsed.limit !== void 0 ? { limit: parsed.limit } : {}
      });
      if (fetched.kind === "unavailable") {
        return { text: "Could not reach the recipe server to search. Try again.", isError: true };
      }
      return { text: formatRecipeSearchResult(fetched.kind === "found" ? fetched.value : []), isError: false };
    }
    default:
      return { text: `Unknown tool: ${name}`, isError: true };
  }
}

// src/agent/claude-code/mcp/rpc.ts
function isJsonRpcRequest(value) {
  return isRecord(value) && typeof value["method"] === "string";
}
function readJsonRpcRequests(stream, onRequest) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");
    while (index !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) {
        try {
          const parsed = JSON.parse(line);
          if (isJsonRpcRequest(parsed)) onRequest(parsed);
        } catch {
        }
      }
      index = buffer.indexOf("\n");
    }
  });
}
function writeJsonRpcMessage(stream, message) {
  stream.write(`${JSON.stringify(message)}
`);
}

// src/agent/claude-code/mcp/server.ts
var SERVER_NAME = "agent-tracer";
var DEFAULT_PROTOCOL_VERSION = "2024-11-05";
var INSTRUCTIONS = "This workspace's activity is observed by Agent Tracer. A menu of saved recipes (reusable workflows distilled from past tasks in this workspace) arrives in your context on every prompt; get_recipe fetches the full workflow for one you saw there, report_recipe_outcome feeds back whether a recipe you used actually helped \u2014 the only signal recipe quality is judged by \u2014 request_recipe_scan asks for this task itself to be distilled into a new recipe candidate, and set_task_title corrects this task's crude auto-generated title once its real scope is clear. Each tool's own description states exactly when to call it; this note is only the overall picture.";
function protocolVersionOf(params) {
  return isRecord(params) && typeof params["protocolVersion"] === "string" ? params["protocolVersion"] : DEFAULT_PROTOCOL_VERSION;
}
function respond(id, result) {
  writeJsonRpcMessage(process.stdout, { jsonrpc: "2.0", id, result });
}
function respondError(id, code, message) {
  writeJsonRpcMessage(process.stdout, { jsonrpc: "2.0", id, error: { code, message } });
}
function handleRequest(request) {
  if (request.id === void 0) return;
  const id = request.id;
  switch (request.method) {
    case "initialize":
      respond(id, {
        protocolVersion: protocolVersionOf(request.params),
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: resolveDaemonVersion() },
        instructions: INSTRUCTIONS
      });
      return;
    case "tools/list":
      respond(id, { tools: MCP_TOOLS });
      return;
    case "tools/call": {
      const params = isRecord(request.params) ? request.params : {};
      const name = typeof params["name"] === "string" ? params["name"] : "";
      void callTool(name, params["arguments"]).then((result) => {
        respond(id, { content: [{ type: "text", text: result.text }], isError: result.isError });
      });
      return;
    }
    default:
      respondError(id, -32601, `Method not found: ${request.method}`);
  }
}
readJsonRpcRequests(process.stdin, handleRequest);
process.stdin.resume();
