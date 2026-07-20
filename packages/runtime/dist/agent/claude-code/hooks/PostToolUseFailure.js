// src/support/json.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/support/text.ts
function truncate(value, maxLength) {
  if (maxLength <= 0) return "";
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  return isHighSurrogate(cut.charCodeAt(cut.length - 1)) ? cut.slice(0, -1) : cut;
}
function truncateStart(value, maxLength) {
  if (maxLength <= 0) return "";
  if (value.length <= maxLength) return value;
  const cut = value.slice(value.length - maxLength);
  return isLowSurrogate(cut.charCodeAt(0)) ? cut.slice(1) : cut;
}
function isHighSurrogate(code) {
  return code >= 55296 && code <= 56319;
}
function isLowSurrogate(code) {
  return code >= 56320 && code <= 57343;
}
function toTrimmedString(value, maxLength) {
  const next = typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" ? String(value).trim() : "";
  if (!maxLength || next.length <= maxLength) return next;
  return truncate(next, maxLength);
}
function truncateOutput(text, headChars, tailChars) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (text.length <= headChars + tailChars) {
    return { body: text, bytes, truncated: false };
  }
  const head = truncate(text, headChars);
  const tail = truncateStart(text, tailChars);
  const omitted = text.length - head.length - tail.length;
  return { body: `${head}
\u2026[${omitted} chars omitted]\u2026
${tail}`, bytes, truncated: true };
}
function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

// src/agent/claude-code/payload/field.payload.ts
function requireSessionId(raw) {
  return readString(raw, "session_id") ? null : { ok: false, reason: "missing session_id" };
}
function requireToolName(raw) {
  return readString(raw, "tool_name") ? null : { ok: false, reason: "missing tool_name" };
}
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
function readBoolean(raw, field) {
  return toBoolean(raw[field]);
}

// src/agent/claude-code/payload/context.payload.ts
function readSessionContext(raw) {
  return {
    sessionId: readString(raw, "session_id"),
    cwd: readOptionalString(raw, "cwd"),
    transcriptPath: readOptionalString(raw, "transcript_path"),
    agentTranscriptPath: readOptionalString(raw, "agent_transcript_path"),
    permissionMode: readOptionalString(raw, "permission_mode"),
    agentId: readOptionalString(raw, "agent_id"),
    agentType: readOptionalString(raw, "agent_type") ?? readOptionalString(raw, "subagent_type")
  };
}
function readToolContext(raw) {
  return {
    ...readSessionContext(raw),
    toolName: readString(raw, "tool_name"),
    toolInput: readRecord(raw, "tool_input"),
    toolUseId: readOptionalString(raw, "tool_use_id")
  };
}

// src/agent/claude-code/payload/tool.payload.ts
function readPostToolUseFailure(raw) {
  const missing = requireSessionId(raw) ?? requireToolName(raw);
  if (missing) return missing;
  return {
    ok: true,
    value: {
      payload: raw,
      ...readToolContext(raw),
      error: readString(raw, "error"),
      isInterrupt: readBoolean(raw, "is_interrupt")
    }
  };
}

// src/agent/claude-code/runtime.ts
import * as path11 from "node:path";

// src/config/monitor.identity.ts
import * as fs2 from "node:fs";

// ../kernel/src/user/user.header.const.ts
var MONITOR_USER_HEADER = "x-monitor-user";
var DEFAULT_USER_ID = "local";

// src/config/home.paths.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
var HOME_DIRNAME = ".agent-tracer";
var HOME_MODE = 448;
function resolveAgentTracerPaths(env = process.env) {
  const home = env.HOME && env.HOME.trim() ? env.HOME : os.homedir();
  const homeDir = path.join(home, HOME_DIRNAME);
  const spoolDir = path.join(homeDir, "spool");
  const cacheDir = path.join(homeDir, "cache");
  const explicitSocket = (env.AGENT_TRACER_DAEMON_SOCKET ?? "").trim();
  return {
    homeDir,
    spoolDir,
    deadPath: path.join(spoolDir, "dead.jsonl"),
    cacheDir,
    configPath: path.join(homeDir, "config.json"),
    bindingsPath: path.join(homeDir, "bindings.json"),
    bindingsLockPath: path.join(homeDir, "bindings.lock"),
    recipePendingPath: path.join(homeDir, "recipe-pending.json"),
    socketPath: explicitSocket || path.join(homeDir, "daemon.sock"),
    logPath: path.join(homeDir, "daemon.log"),
    resumeTokenPath: path.join(homeDir, "resume.token"),
    pidPath: path.join(homeDir, "daemon.pid")
  };
}
function mkdirSecure(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: HOME_MODE });
  try {
    fs.chmodSync(dir, HOME_MODE);
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

// src/config/monitor.identity.ts
var DEFAULT_PORT = 3847;
var DEFAULT_HOST = "127.0.0.1";
function readMonitorConfigFile(paths = resolveAgentTracerPaths()) {
  try {
    const parsed = JSON.parse(fs2.readFileSync(paths.configPath, "utf8"));
    if (!isRecord(parsed)) return {};
    const userId = trimmed(parsed["userId"]);
    const baseUrl = trimmed(parsed["baseUrl"]);
    return { ...userId ? { userId } : {}, ...baseUrl ? { baseUrl } : {} };
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
  const baseUrl = fromEnv ?? config.baseUrl ?? `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return {
    userId,
    baseUrl: normalizeBaseUrl(baseUrl),
    userIdOrigin: envUser ? "env" : config.userId ? "file" : "default",
    baseUrlOrigin: fromEnv ? "env" : config.baseUrl ? "file" : "default"
  };
}
function monitorUserHeaders(identity) {
  return identity.userId === DEFAULT_USER_ID ? {} : { [MONITOR_USER_HEADER]: identity.userId };
}

// src/config/env.ts
var CLAUDE_RUNTIME_SOURCE = "claude-plugin";
function resolveProjectDir(env = process.env) {
  return env.CLAUDE_PROJECT_DIR || process.cwd();
}
function resolveMonitorTransportConfig(env = process.env) {
  const taskIdOverride = (env.MONITOR_TASK_ID ?? "").trim();
  const taskTitleOverride = (env.MONITOR_TASK_TITLE ?? "").trim();
  const rawOrigin = (env.MONITOR_TASK_ORIGIN ?? "").trim();
  const taskOriginOverride = rawOrigin === "user" || rawOrigin === "server-sdk" ? rawOrigin : void 0;
  return {
    baseUrl: resolveMonitorIdentity(env).baseUrl,
    taskIdOverride: taskIdOverride || void 0,
    taskTitleOverride: taskTitleOverride || void 0,
    taskOriginOverride
  };
}
function isVerboseLogging(env = process.env) {
  return env.NODE_ENV === "development";
}

// src/config/hook.log.ts
import * as fs3 from "node:fs";
var REDACT_KEYS = /* @__PURE__ */ new Set([
  "tool_input",
  "tool_response",
  "transcript_path",
  "agent_transcript_path",
  "prompt",
  "last_assistant_message"
]);
var MAX_LOG_BYTES = 10 * 1024 * 1024;
function rotateIfLarge(logFile) {
  try {
    if (fs3.statSync(logFile).size < MAX_LOG_BYTES) return;
    fs3.renameSync(logFile, `${logFile}.old`);
  } catch {
    return;
  }
}
function createHookLogger(config) {
  const appendLine = (line) => {
    try {
      rotateIfLarge(config.logFile);
      fs3.appendFileSync(config.logFile, `${line}
`);
    } catch {
      return;
    }
  };
  const log = (hookName, message, data) => {
    const stamp = (/* @__PURE__ */ new Date()).toISOString();
    const line = `[${stamp.slice(11, 23)}][HOOK:${hookName}] ${message} ${JSON.stringify({ timestamp: stamp, ...data })}`;
    if (config.verbose) process.stderr.write(`${line}
`);
    appendLine(line);
  };
  const logPayload = (hookName, payload) => {
    if (!config.verbose) return;
    const rest = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!REDACT_KEYS.has(key)) rest[key] = value;
    }
    if (isRecord(rest["tool_input"])) {
      rest["tool_input"] = Object.fromEntries(
        Object.entries(rest["tool_input"]).map(
          ([key, value]) => typeof value === "string" && value.length > 200 ? [key, `${value.slice(0, 200)}\u2026`] : [key, value]
        )
      );
    }
    appendLine(`[${(/* @__PURE__ */ new Date()).toISOString().slice(11, 23)}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`);
  };
  return { log, logPayload };
}

// src/config/stdin.ts
var HOOK_STDIN_MAX_BYTES = 5 * 1024 * 1024;
async function readStdinJson() {
  let raw = "";
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const text = String(chunk);
    bytes += Buffer.byteLength(text, "utf8");
    if (bytes > HOOK_STDIN_MAX_BYTES) throw new Error(`hook stdin exceeds ${HOOK_STDIN_MAX_BYTES} bytes`);
    raw += text;
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  return isRecord(parsed) ? parsed : {};
}

// src/daemon/ipc/hook.client.ts
import { spawn } from "node:child_process";
import * as fs6 from "node:fs";
import * as path3 from "node:path";

// src/config/runtime.root.ts
import * as fs4 from "node:fs";
import * as path2 from "node:path";
import { fileURLToPath } from "node:url";
var ROOT_MANIFESTS = [".claude-plugin/plugin.json", "package.json"];
function manifestDir(dir) {
  return ROOT_MANIFESTS.some((manifest) => fs4.existsSync(path2.join(dir, manifest)));
}
function resolveRuntimeRoot(from = path2.dirname(fileURLToPath(import.meta.url))) {
  const start = path2.resolve(from);
  let current = start;
  for (; ; ) {
    if (manifestDir(current)) return current;
    const parent = path2.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}
function readRuntimeManifestVersion(root = resolveRuntimeRoot()) {
  for (const manifest of ROOT_MANIFESTS) {
    try {
      const parsed = JSON.parse(fs4.readFileSync(path2.join(root, manifest), "utf8"));
      const version = isRecord(parsed) && typeof parsed["version"] === "string" ? parsed["version"].trim() : "";
      if (version) return version;
    } catch {
      continue;
    }
  }
  return "";
}

// src/daemon/ipc/socket.client.ts
import * as net from "node:net";

// src/daemon/ipc/socket.framing.ts
function createLineFramer() {
  let buffer = "";
  return (chunk) => {
    buffer += chunk.toString("utf8");
    const index = buffer.indexOf("\n");
    if (index === -1) return null;
    return buffer.slice(0, index).trim();
  };
}

// src/daemon/ipc/socket.client.ts
var SOCKET_CONNECT_TIMEOUT_MS = 200;
function probeSocket(socketPath, timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) {
  return new Promise((resolve2) => {
    const socket = net.createConnection(socketPath);
    let settled = false;
    const finish = (alive) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve2(alive);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("connect", () => finish(true));
  });
}
function requestDaemon(socketPath, message, timeoutMs, parse, empty) {
  return new Promise((resolve2, reject) => {
    const socket = net.createConnection(socketPath);
    const frame = createLineFramer();
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve2(value ?? empty);
    };
    const timer = setTimeout(
      () => finish(void 0, new Error(`daemon ${message.type} timeout`)),
      timeoutMs
    );
    socket.once("error", (error) => finish(void 0, error));
    socket.once("connect", () => {
      socket.write(`${JSON.stringify(message)}
`);
    });
    socket.on("data", (chunk) => {
      const line = frame(chunk);
      if (line === null) return;
      try {
        finish(parse(JSON.parse(line)));
      } catch {
        finish(empty);
      }
    });
  });
}

// src/daemon/lifecycle/daemon.pid.ts
import * as fs5 from "node:fs";
function readDaemonPid(paths) {
  const pid = readPidFile(paths);
  if (pid === void 0 || pid === process.pid) return void 0;
  return isProcessAlive(pid) ? pid : void 0;
}
function readPidFile(paths) {
  let raw;
  try {
    raw = fs5.readFileSync(paths.pidPath, "utf8");
  } catch {
    return void 0;
  }
  const pid = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : void 0;
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

// src/daemon/lifecycle/daemon.health.ts
var UNKNOWN_DAEMON_VERSION = "unknown";
function resolveDaemonVersion(root = resolveRuntimeRoot()) {
  return readRuntimeManifestVersion(root) || UNKNOWN_DAEMON_VERSION;
}

// src/daemon/port/daemon.socket.port.ts
function parseDaemonVersionResponse(value) {
  if (!isRecord(value) || typeof value["version"] !== "string") return null;
  return {
    version: value["version"],
    ...typeof value["pid"] === "number" ? { pid: value["pid"] } : {}
  };
}
function isDaemonAckResponse(value) {
  return isRecord(value) && value["ok"] === true;
}

// src/daemon/lifecycle/daemon.version.ts
var VERSION_CHECK_TIMEOUT_MS = 200;
var SHUTDOWN_ACK_TIMEOUT_MS = 1500;
var SOCKET_FREE_TIMEOUT_MS = 2e3;
var SOCKET_FREE_POLL_MS = 50;
function isDaemonOutdated(hookVersion, daemonVersion) {
  const hook = parseVersion(hookVersion);
  if (hook === null) return false;
  const daemon = parseVersion(daemonVersion);
  if (daemon === null) return true;
  const length = Math.max(hook.length, daemon.length);
  for (let index = 0; index < length; index += 1) {
    const left = hook[index] ?? 0;
    const right = daemon[index] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}
async function resolveDaemonAction(paths, hookVersion = resolveDaemonVersion()) {
  if (!await probeSocket(paths.socketPath)) return "spawn";
  if (hookVersion === UNKNOWN_DAEMON_VERSION) return "keep";
  let remote;
  try {
    remote = await requestVersion(paths.socketPath, hookVersion);
  } catch {
    return "keep";
  }
  if (!isDaemonOutdated(hookVersion, remote.version)) return "keep";
  await shutdownDaemon(paths, remote.pid, `hook=${hookVersion} daemon=${remote.version}`);
  await waitUntilSocketFree(paths.socketPath);
  return "spawn";
}
function parseVersion(version) {
  const core = version.trim().split(/[-+]/)[0] ?? "";
  const parts = core.split(".");
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 10));
}
function requestVersion(socketPath, hookVersion) {
  return requestDaemon(
    socketPath,
    { type: "version", hookVersion },
    VERSION_CHECK_TIMEOUT_MS,
    (parsed) => parseDaemonVersionResponse(parsed) ?? { version: UNKNOWN_DAEMON_VERSION },
    { version: UNKNOWN_DAEMON_VERSION }
  );
}
async function shutdownDaemon(paths, pid, reason) {
  if (await requestShutdownAck(paths.socketPath, reason)) return;
  const target = pid ?? readDaemonPid(paths);
  if (target === void 0) return;
  try {
    process.kill(target, "SIGTERM");
  } catch {
    return;
  }
}
async function requestShutdownAck(socketPath, reason) {
  try {
    return await requestDaemon(
      socketPath,
      { type: "shutdown", reason },
      SHUTDOWN_ACK_TIMEOUT_MS,
      isDaemonAckResponse,
      false
    );
  } catch {
    return false;
  }
}
async function waitUntilSocketFree(socketPath, timeoutMs = SOCKET_FREE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await probeSocket(socketPath, 100)) return;
    await new Promise((resolve2) => setTimeout(resolve2, SOCKET_FREE_POLL_MS));
  }
}

// src/daemon/ipc/hook.client.ts
var SOURCE_LOADER = "@swc-node/register/esm-register";
function daemonEntry() {
  const root = resolveRuntimeRoot();
  const compiled = path3.join(root, "dist/daemon/main.js");
  if (fs6.existsSync(compiled)) return { executable: process.execPath, args: [compiled] };
  return {
    executable: process.execPath,
    args: ["--import", SOURCE_LOADER, path3.join(root, "src/daemon/main.ts")]
  };
}
function spawnDaemon(paths) {
  const { executable, args } = daemonEntry();
  ensureAgentTracerHome(paths);
  let logFd;
  try {
    logFd = fs6.openSync(paths.logPath, "a");
  } catch {
    logFd = void 0;
  }
  const child = spawn(executable, [...args], {
    detached: true,
    stdio: logFd !== void 0 ? ["ignore", logFd, logFd] : "ignore",
    env: {
      ...process.env,
      AGENT_TRACER_DAEMON_CHILD: "1",
      AGENT_TRACER_DAEMON_SOCKET: paths.socketPath
    }
  });
  child.unref();
  if (logFd === void 0) return;
  try {
    fs6.closeSync(logFd);
  } catch {
    return;
  }
}
async function ensureDaemonRunning(env = process.env) {
  if (env.AGENT_TRACER_DAEMON_CHILD === "1") return;
  if (env.AGENT_TRACER_DAEMON_AUTOSTART === "0") return;
  const paths = resolveAgentTracerPaths(env);
  if (await resolveDaemonAction(paths) === "spawn") spawnDaemon(paths);
}

// src/domain/binding/adapter/file.binding.store.adapter.ts
import * as fs7 from "node:fs";
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
      const parsed = JSON.parse(fs7.readFileSync(this.paths.bindingsPath, "utf8"));
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  write(store) {
    ensureAgentTracerHome(this.paths);
    const tmp = `${this.paths.bindingsPath}.tmp`;
    fs7.writeFileSync(tmp, JSON.stringify(store));
    fs7.renameSync(tmp, this.paths.bindingsPath);
  }
  async acquireLock() {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (; ; ) {
      try {
        fs7.mkdirSync(this.paths.bindingsLockPath);
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
      fs7.rmdirSync(this.paths.bindingsLockPath);
    } catch {
      return;
    }
  }
  clearStaleLock() {
    try {
      const stat = fs7.statSync(this.paths.bindingsLockPath);
      if (Date.now() - stat.mtimeMs <= LOCK_STALE_MS) return false;
      fs7.rmdirSync(this.paths.bindingsLockPath);
      return true;
    } catch {
      return false;
    }
  }
};

// src/domain/binding/model/binding.model.ts
var MAX_BINDINGS = 1e3;
function bindingKey(runtimeSource, runtimeSessionId) {
  return `${runtimeSource}::${runtimeSessionId}`;
}
function capBindingStore(bindings2) {
  const entries = Object.entries(bindings2);
  if (entries.length <= MAX_BINDINGS) return bindings2;
  entries.sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt));
  return Object.fromEntries(entries.slice(entries.length - MAX_BINDINGS));
}
function turnStateOf(binding2) {
  if (!binding2?.currentTurnId) return void 0;
  return {
    turnId: binding2.currentTurnId,
    startedAt: binding2.turnStartedAt ?? binding2.createdAt,
    ...binding2.previousTurnId ? { previousTurnId: binding2.previousTurnId } : {},
    ...binding2.turnPrompt ? { prompt: binding2.turnPrompt } : {}
  };
}
function toBoundSession(binding2) {
  const turn2 = turnStateOf(binding2);
  return {
    taskId: binding2.taskId,
    sessionId: binding2.sessionId,
    startedAt: binding2.createdAt,
    ...turn2 ? { turnId: turn2.turnId, turn: turn2 } : {}
  };
}
function activityTimestamp(binding2) {
  return Date.parse(binding2.turnStartedAt ?? binding2.createdAt);
}
function resolveLiveBinding(bindings2, runtimeSource, runtimeSessionId) {
  const seen = /* @__PURE__ */ new Set();
  let key = bindingKey(runtimeSource, runtimeSessionId);
  let binding2 = bindings2[key];
  while (binding2?.supersededBy !== void 0) {
    if (seen.has(key)) return void 0;
    seen.add(key);
    key = bindingKey(runtimeSource, binding2.supersededBy);
    const next = bindings2[key];
    if (next === void 0) return void 0;
    binding2 = next;
  }
  return binding2;
}
function mostRecentBindingWhere(bindings2, predicate) {
  const matches = Object.values(bindings2).filter(predicate);
  if (matches.length === 0) return void 0;
  return matches.reduce((latest, candidate) => activityTimestamp(candidate) > activityTimestamp(latest) ? candidate : latest);
}

// src/domain/binding/application/read.binding.usecase.ts
var ReadBindingUsecase = class {
  constructor(bindings2) {
    this.bindings = bindings2;
  }
  bindings;
  execute(runtimeSource, runtimeSessionId) {
    const binding2 = resolveLiveBinding(this.bindings.read(), runtimeSource, runtimeSessionId);
    return binding2 ? toBoundSession(binding2) : void 0;
  }
};

// src/domain/binding/application/release.binding.usecase.ts
var ReleaseBindingUsecase = class {
  constructor(bindings2) {
    this.bindings = bindings2;
  }
  bindings;
  async execute(runtimeSource, runtimeSessionId) {
    const key = bindingKey(runtimeSource, runtimeSessionId);
    if (!await this.bindings.acquireLock()) return false;
    try {
      const store = this.bindings.read();
      if (store[key] === void 0) return false;
      delete store[key];
      this.bindings.write(store);
      return true;
    } finally {
      this.bindings.releaseLock();
    }
  }
};

// src/domain/ingest/adapter/file.todo.snapshot.adapter.ts
import * as path5 from "node:path";

// src/support/json.file.store.ts
import * as crypto from "node:crypto";
import * as fs8 from "node:fs";
import * as path4 from "node:path";
function readJsonFile(filePath, validate) {
  try {
    const parsed = JSON.parse(fs8.readFileSync(filePath, "utf-8"));
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function writeJsonFile(filePath, value, spacing) {
  const directory = path4.dirname(filePath);
  const tempFilePath = path4.join(
    directory,
    `.${path4.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  try {
    fs8.mkdirSync(directory, { recursive: true });
    fs8.writeFileSync(tempFilePath, JSON.stringify(value, null, spacing));
    fs8.renameSync(tempFilePath, filePath);
  } catch {
    try {
      fs8.unlinkSync(tempFilePath);
    } catch {
      return;
    }
  }
}
function deleteJsonFile(filePath) {
  try {
    fs8.unlinkSync(filePath);
  } catch {
    return;
  }
}

// src/domain/ingest/adapter/file.todo.snapshot.adapter.ts
function isTodoSnapshotFile(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const todos = value["todos"];
  if (!Array.isArray(todos)) return false;
  return todos.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const todo = item;
    return typeof todo["todoId"] === "string" && typeof todo["title"] === "string" && typeof todo["state"] === "string";
  });
}
var FileTodoSnapshotAdapter = class {
  constructor(projectDir2 = resolveProjectDir()) {
    this.projectDir = projectDir2;
  }
  projectDir;
  load(sessionId) {
    return readJsonFile(this.pathOf(sessionId), isTodoSnapshotFile)?.todos ?? [];
  }
  save(sessionId, todos) {
    writeJsonFile(this.pathOf(sessionId), { todos });
  }
  clear(sessionId) {
    deleteJsonFile(this.pathOf(sessionId));
  }
  pathOf(sessionId) {
    return path5.join(this.projectDir, ".claude", ".todo-state", `${sessionId}.json`);
  }
};

// src/domain/ingest/adapter/file.tool.timing.adapter.ts
import * as path6 from "node:path";
var PRUNE_AGE_MS = 6 * 60 * 60 * 1e3;
function isToolTimingFile(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const starts = value["starts"];
  if (typeof starts !== "object" || starts === null || Array.isArray(starts)) return false;
  return Object.values(starts).every((entry) => typeof entry === "number");
}
var FileToolTimingAdapter = class {
  constructor(projectDir2 = resolveProjectDir()) {
    this.projectDir = projectDir2;
  }
  projectDir;
  markStart(sessionId, toolUseId, startedAtMs) {
    const starts = { ...this.load(sessionId), [toolUseId]: startedAtMs };
    this.save(sessionId, prune(starts, startedAtMs));
  }
  takeStart(sessionId, toolUseId) {
    const starts = this.load(sessionId);
    const startedAtMs = starts[toolUseId];
    if (startedAtMs === void 0) return void 0;
    const { [toolUseId]: _removed, ...rest } = starts;
    this.save(sessionId, rest);
    return startedAtMs;
  }
  load(sessionId) {
    return readJsonFile(this.pathOf(sessionId), isToolTimingFile)?.starts ?? {};
  }
  save(sessionId, starts) {
    writeJsonFile(this.pathOf(sessionId), { starts });
  }
  pathOf(sessionId) {
    return path6.join(this.projectDir, ".claude", ".tool-timing", `${sessionId}.json`);
  }
};
function prune(starts, nowMs) {
  return Object.fromEntries(
    Object.entries(starts).filter(([, startedAtMs]) => nowMs - startedAtMs < PRUNE_AGE_MS)
  );
}

// src/config/spool.ts
import * as fs9 from "node:fs";
import * as path7 from "node:path";

// src/support/ulid.ts
import { createHash, randomBytes, randomUUID as randomUUID2 } from "node:crypto";
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
function createMessageId() {
  return randomUUID2();
}

// src/config/spool.ts
var SPOOL_MAX_BYTES = 50 * 1024 * 1024;
var SEGMENT_PREFIX = "seg-";
var SEGMENT_SUFFIX = ".jsonl";
var TMP_PREFIX = ".tmp-";
function appendSpoolLines(lines, paths = resolveAgentTracerPaths(), segmentId = generateUlid()) {
  if (lines.length === 0) return;
  ensureSpoolDir(paths);
  const payload = lines.map((line) => `${line}
`).join("");
  const tmpPath = path7.join(paths.spoolDir, `${TMP_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
  const finalPath = path7.join(paths.spoolDir, `${SEGMENT_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
  const fd = fs9.openSync(tmpPath, "w");
  try {
    fs9.writeSync(fd, payload);
    fs9.fsyncSync(fd);
  } finally {
    fs9.closeSync(fd);
  }
  fs9.renameSync(tmpPath, finalPath);
}

// src/domain/ingest/adapter/spool.event.sink.adapter.ts
var SpoolEventSinkAdapter = class {
  append(events) {
    if (events.length > 0) appendSpoolLines(events.map((event) => JSON.stringify(event)));
    return Promise.resolve();
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
var TURN_ACTIVITY_TYPE = "turn";
function toGenAiMessage(role, text) {
  return [{ role, parts: [{ type: "text", content: text }] }];
}
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
  constructor(sink2, ids2, clock2, runtimeSource) {
    this.sink = sink2;
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

// src/domain/ingest/application/mark.tool.start.usecase.ts
var MarkToolStartUsecase = class {
  constructor(timing, clock2) {
    this.timing = timing;
    this.clock = clock2;
  }
  timing;
  clock;
  execute(sessionId, toolUseId) {
    this.timing.markStart(sessionId, toolUseId, this.clock.now());
  }
};

// ../kernel/src/ingest/event.kind.const.ts
var KIND = {
  executeTool: GEN_AI_OPERATION.executeTool,
  invokeAgent: GEN_AI_OPERATION.invokeAgent,
  planLogged: GEN_AI_OPERATION.plan,
  tokenUsage: "gen_ai.client.inference.operation.details",
  actionLogged: "agent_tracer.action.logged",
  verificationLogged: "agent_tracer.verification.logged",
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
  taskStart: "agent_tracer.task.start",
  taskLinked: "agent_tracer.task.linked",
  taskComplete: "agent_tracer.task.complete",
  taskError: "agent_tracer.task.error",
  fileChanged: "agent_tracer.file.changed",
  userPromptExpansion: "agent_tracer.user.prompt.expansion",
  worktreeRemove: "agent_tracer.worktree.remove",
  permissionRequest: "agent_tracer.permission.request",
  setupTriggered: "agent_tracer.setup.triggered",
  recipeInjected: "agent_tracer.recipe.injected"
};
var TERMINAL_COMMAND_TOOL_NAME = "Bash";
var POWERSHELL_TOOL_NAME = "PowerShell";
var MONITOR_TOOL_NAME = "Monitor";
var AGENT_TOOL_NAME = "Agent";
var SKILL_TOOL_NAME = "Skill";
var LSP_TOOL_NAME = "LSP";
var TOOL_SEARCH_TOOL_NAME = "ToolSearch";
var EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
var ASK_USER_QUESTION_TOOL_NAME = "AskUserQuestion";
var BASH_OUTPUT_TOOL_NAME = "BashOutput";
var KILL_SHELL_TOOL_NAME = "KillShell";
var TOOL_ACTIVITY_EVENT_KINDS = [KIND.executeTool];
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
  KIND.taskStart,
  KIND.taskLinked,
  KIND.taskComplete,
  KIND.taskError
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

// src/domain/ingest/model/event.model.ts
var LANE = {
  user: "user",
  assistant: "assistant",
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
function provenEvidence(reason) {
  return { evidenceLevel: "proven", evidenceReason: reason };
}
function turnOf(target) {
  return target.turnId ? { turnId: target.turnId } : {};
}

// src/domain/ingest/model/tool.call.model.ts
var MAX_TOOL_INPUT_VALUE = 1e4;
var MAX_TOOL_INPUT_DEPTH = 4;
function toolUseIdOf(call) {
  return call.toolUseId ? { toolUseId: call.toolUseId } : {};
}
function sanitizeToolInput(input, maxValueLength = MAX_TOOL_INPUT_VALUE) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, sanitizeValue(value, maxValueLength, 0)])
  );
}
function sanitizeValue(value, maxValueLength, depth) {
  if (value === null || value === void 0) return value;
  if (typeof value === "string") return toTrimmedString(value, maxValueLength);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (depth >= MAX_TOOL_INPUT_DEPTH) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, maxValueLength, depth + 1));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeValue(nested, maxValueLength, depth + 1)])
    );
  }
  return toTrimmedString(Object.prototype.toString.call(value), maxValueLength);
}

// src/support/hash.ts
import * as crypto2 from "node:crypto";
function stableTodoId(content, priority) {
  return crypto2.createHash("sha1").update(`${content}::${priority}`).digest("hex").slice(0, 16);
}

// src/domain/ingest/model/todo.tool.model.ts
var STATUS_MAP = {
  pending: "added",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled"
};
var TERMINAL_STATES = /* @__PURE__ */ new Set(["completed", "cancelled"]);
function shapeTodoEvents(call, previous) {
  if (call.toolName === "TodoWrite") return shapeTodoWrite(call, previous);
  if (call.toolName === "TaskCreate" || call.toolName === "TaskUpdate") {
    return { events: shapeTaskTool(call), snapshot: null };
  }
  return { events: [], snapshot: null };
}
function shapeTodoWrite(call, previous) {
  const rawTodos = Array.isArray(call.toolInput["todos"]) ? call.toolInput["todos"] : [];
  const current = rawTodos.flatMap((todo) => {
    if (typeof todo !== "object" || todo === null || Array.isArray(todo)) return [];
    const entry = todo;
    const title = toTrimmedString(entry["content"]);
    if (!title) return [];
    const status = toTrimmedString(entry["status"]) || "pending";
    const priority = toTrimmedString(entry["priority"]) || "medium";
    return [{ todoId: stableTodoId(title, priority), title, state: STATUS_MAP[status] ?? "added" }];
  });
  const currentIds = new Set(current.map((todo) => todo.todoId));
  const previousById = new Map(previous.map((todo) => [todo.todoId, todo]));
  const events = [];
  for (const stale of previousById.values()) {
    if (currentIds.has(stale.todoId) || TERMINAL_STATES.has(stale.state)) continue;
    events.push(todoEvent(call, stale.todoId, stale.title, "cancelled", {
      priority: "medium",
      status: "cancelled",
      autoReconciled: true
    }));
  }
  for (const todo of current) {
    const before = previousById.get(todo.todoId);
    if (before && before.state === todo.state) continue;
    events.push(todoEvent(call, todo.todoId, todo.title, todo.state, {
      priority: "medium",
      status: todo.state
    }));
  }
  return { events, snapshot: current };
}
function shapeTaskTool(call) {
  const taskId = firstString(call.toolInput, ["task_id", "taskId", "id"]);
  const title = firstString(call.toolInput, ["task_subject", "subject", "title", "content"]) || taskId;
  if (!title) return [];
  const status = firstString(call.toolInput, ["status"]) || (call.toolName === "TaskCreate" ? "pending" : "in_progress");
  const priority = firstString(call.toolInput, ["priority"]) || "medium";
  return [todoEvent(
    call,
    taskId || stableTodoId(title, priority),
    title,
    STATUS_MAP[status] ?? "added",
    { priority, status }
  )];
}
function todoEvent(call, todoId, title, todoState, extras) {
  const metadata = {
    ...provenEvidence(`Observed directly by the ${call.toolName} PostToolUse hook.`),
    todoId,
    todoState,
    toolName: call.toolName,
    priority: extras.priority,
    status: extras.status,
    ...extras.autoReconciled === true ? { autoReconciled: true } : {},
    ...toolUseIdOf(call)
  };
  return { kind: KIND.todoLogged, lane: LANE.todos, title, metadata };
}
function firstString(input, keys) {
  for (const key of keys) {
    const value = toTrimmedString(input[key]);
    if (value) return value;
  }
  return "";
}

// src/domain/ingest/model/shaped.event.model.ts
function toRuntimeEvent(shaped, target) {
  return {
    kind: shaped.kind,
    taskId: target.taskId,
    sessionId: target.sessionId,
    ...turnOf(target),
    lane: shaped.lane,
    title: shaped.title,
    ...shaped.body !== void 0 ? { body: shaped.body } : {},
    ...shaped.filePaths !== void 0 ? { filePaths: shaped.filePaths } : {},
    ...shaped.toolName !== void 0 ? { toolName: shaped.toolName } : {},
    ...shaped.command !== void 0 ? { command: shaped.command } : {},
    metadata: shaped.metadata
  };
}

// src/domain/ingest/application/record.todo.usecase.ts
var RecordTodoUsecase = class {
  constructor(sink2, snapshots, ids2, clock2, runtimeSource) {
    this.sink = sink2;
    this.snapshots = snapshots;
    this.ids = ids2;
    this.clock = clock2;
    this.runtimeSource = runtimeSource;
  }
  sink;
  snapshots;
  ids;
  clock;
  runtimeSource;
  async execute(call, target, runtimeSessionId) {
    const { events, snapshot } = shapeTodoEvents(call, this.snapshots.load(runtimeSessionId));
    if (events.length > 0) {
      await this.sink.append(toIngestEvents(
        events.map((shaped) => toRuntimeEvent(shaped, target)),
        this.runtimeSource,
        () => this.ids.next(),
        new Date(this.clock.now()).toISOString()
      ));
    }
    if (snapshot !== null) this.snapshots.save(runtimeSessionId, snapshot);
  }
};

// src/domain/ingest/model/tool.duration.model.ts
function withToolDuration(shaped, input) {
  if (!input.toolUseId) return shaped;
  const startedAt = input.takeStart(input.sessionId, input.toolUseId);
  if (startedAt === void 0) return shaped;
  const durationMs = input.now - startedAt;
  if (!Number.isFinite(durationMs) || durationMs < 0) return shaped;
  return { ...shaped, metadata: { ...shaped.metadata, durationMs } };
}

// src/domain/ingest/model/command.target.model.ts
function pathTargets(args) {
  return args.filter((arg) => arg.length > 0 && !arg.startsWith("-") && !isLikelyExpression(arg)).map((arg) => ({ type: targetTypeForPath(arg), value: arg }));
}
function urlTargets(args) {
  return args.filter((arg) => /^https?:\/\//.test(arg)).map((arg) => ({ type: "url", value: arg }));
}
function gitPathspecTargets(args) {
  const separatorIndex = args.indexOf("--");
  const candidates = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args.filter((arg) => !arg.startsWith("-") && !looksLikeGitRevision(arg));
  return pathTargets(candidates);
}
function uniqueTargets(targets) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const target of targets) {
    const key = `${target.type}:${target.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }
  return result;
}
function targetTypeForPath(value) {
  if (value === "-" || value === "/dev/stdin") return "stream";
  if (value === "." || value.endsWith("/")) return "directory";
  if (value.includes("*")) return "path";
  return "file";
}
function containsComplexShell(command) {
  return command.includes("$(") || command.includes("`") || command.includes("<<");
}
function isLikelyExpression(value) {
  return /^[0-9,$/{}().*+?[\\\]^]+p?$/.test(value);
}
function looksLikeGitRevision(value) {
  return value === "HEAD" || /^[A-Fa-f0-9]{7,40}$/.test(value) || value.includes("..");
}

// src/domain/ingest/model/command.classifier.model.ts
var READ_COMMANDS = /* @__PURE__ */ new Set(["cat", "head", "tail", "wc", "stat", "file", "which", "whereis"]);
var LIST_COMMANDS = /* @__PURE__ */ new Set(["pwd", "ls", "tree"]);
var SEARCH_COMMANDS = /* @__PURE__ */ new Set(["rg", "grep", "fd", "find"]);
var STREAM_TRANSFORM_COMMANDS = /* @__PURE__ */ new Set(["head", "tail", "wc", "sort"]);
var DESTRUCTIVE_COMMANDS = /* @__PURE__ */ new Set(["rm", "rmdir"]);
var WRITE_COMMANDS = /* @__PURE__ */ new Set(["mv", "cp", "chmod", "chown", "mkdir", "touch"]);
var NETWORK_COMMANDS = /* @__PURE__ */ new Set(["curl", "wget"]);
var DANGEROUS_ARG_PATTERNS = [/\bdrop\s+(table|database)\b/i];
function hasDangerousArgs(raw) {
  return DANGEROUS_ARG_PATTERNS.some((pattern) => pattern.test(raw));
}
function buildBaseStep(part, commandName, redirects) {
  return {
    raw: part.raw,
    commandName,
    operation: "unknown",
    targets: redirects.map((redirect) => redirect.target),
    effect: "unknown",
    confidence: containsComplexShell(part.raw) ? "low" : "medium",
    ...part.operatorFromPrevious ? { operatorFromPrevious: part.operatorFromPrevious } : {},
    ...redirects.length > 0 ? { redirects } : {}
  };
}
function withStep(base, patch) {
  return {
    ...base,
    ...patch,
    targets: uniqueTargets([...base.targets, ...patch.targets ?? []])
  };
}
function analyzeSed(base, args) {
  const lineRange = args.map(extractSedLineRange).find((value) => value !== void 0);
  const targets = pathTargets(
    args.filter((arg) => !arg.startsWith("-") && extractSedLineRange(arg) === void 0)
  );
  const inPlace = args.some((arg) => arg === "--in-place" || arg.startsWith("--in-place=") || /^-i/.test(arg));
  if (inPlace) {
    return withStep(base, {
      operation: "edit_in_place",
      effect: "write",
      targets,
      confidence: targets.length > 0 ? "high" : "medium",
      ...lineRange ? { selectors: { lineRange } } : {}
    });
  }
  return withStep(base, {
    operation: lineRange ? "read_range" : "read_file",
    effect: "read_only",
    targets,
    confidence: targets.length > 0 ? "high" : "medium",
    ...lineRange ? { selectors: { lineRange } } : {}
  });
}
function analyzeSearch(base, args) {
  const pattern = args.find((arg) => !arg.startsWith("-"));
  const targetArgs = pattern ? args.slice(args.indexOf(pattern) + 1) : args;
  return withStep(base, {
    operation: "search",
    effect: "read_only",
    targets: pathTargets(targetArgs),
    confidence: "high",
    ...pattern ? { selectors: { pattern } } : {}
  });
}
function analyzeFind(base, args) {
  const targets = [];
  for (const arg of args) {
    if (arg.startsWith("-") || isFindExpressionValue(arg)) break;
    targets.push({ type: targetTypeForPath(arg), value: arg });
  }
  const resolvedTargets = targets.length > 0 ? targets : [{ type: "directory", value: "." }];
  const action = findAction(args);
  if (action) {
    return withStep(base, { operation: action.operation, effect: action.effect, targets: resolvedTargets, confidence: "high" });
  }
  return withStep(base, { operation: "search", effect: "read_only", targets: resolvedTargets, confidence: "high" });
}
var FIND_EXEC_ACTIONS = /* @__PURE__ */ new Set(["-exec", "-execdir", "-ok", "-okdir"]);
var FIND_DESTRUCTIVE_EXEC = /* @__PURE__ */ new Set(["rm", "rmdir", "unlink"]);
function findAction(args) {
  if (args.includes("-delete")) return { operation: "delete_file", effect: "destructive" };
  const execIndex = args.findIndex((arg) => FIND_EXEC_ACTIONS.has(arg));
  if (execIndex < 0) return null;
  const execCommand = args[execIndex + 1];
  if (execCommand !== void 0 && FIND_DESTRUCTIVE_EXEC.has(execCommand)) {
    return { operation: "delete_file", effect: "destructive" };
  }
  return { operation: "execute", effect: "write" };
}
function analyzeRipgrep(base, args) {
  const filesMode = args.includes("--files");
  const optionsWithValue = /* @__PURE__ */ new Set(["-g", "--glob", "--type", "-t", "--type-not", "-T", "-e", "--regexp"]);
  const positional = stripOptionArguments(args, optionsWithValue).filter((arg) => !arg.startsWith("-"));
  if (filesMode) {
    return withStep(base, {
      operation: "list",
      effect: "read_only",
      targets: positional.length > 0 ? pathTargets(positional) : [{ type: "directory", value: "." }],
      confidence: "high"
    });
  }
  const [pattern, ...targetArgs] = positional;
  return withStep(base, {
    operation: "search",
    effect: "read_only",
    targets: targetArgs.length > 0 ? pathTargets(targetArgs) : [],
    confidence: "high",
    ...pattern ? { selectors: { pattern } } : {}
  });
}
function analyzeRead(base, args) {
  const targets = pathTargets(args);
  return withStep(base, {
    operation: "read_file",
    effect: "read_only",
    targets,
    confidence: targets.length > 0 ? "high" : "medium"
  });
}
function analyzeList(base, args) {
  const targets = pathTargets(args);
  return withStep(base, {
    operation: "list",
    effect: "read_only",
    targets: targets.length > 0 ? targets : [{ type: "directory", value: "." }],
    confidence: "high"
  });
}
function analyzeStreamTransform(base, args) {
  const targets = pathTargets(args);
  return withStep(base, {
    operation: base.commandName === "sort" ? "sort_output" : "limit_output",
    effect: "read_only",
    targets: targets.length > 0 ? targets : [{ type: "stream", value: "stdin" }],
    confidence: "medium"
  });
}
function extractSedLineRange(arg) {
  const match = arg.match(/^(\d+)(?:,(\d+))?p$/);
  if (!match) return void 0;
  return match[2] ? `${match[1]},${match[2]}` : match[1];
}
function stripOptionArguments(args, optionsWithValue) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (optionsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if ([...optionsWithValue].some((option) => arg.startsWith(`${option}=`))) continue;
    result.push(arg);
  }
  return result;
}
function isFindExpressionValue(arg) {
  return arg === "!" || arg === "(" || arg === ")" || arg === "{}" || arg === ";";
}

// src/domain/ingest/model/command.git.model.ts
function analyzeGit(base, args) {
  const subcommand = args[0];
  if (!subcommand) return withStep(base, { operation: "unknown", effect: "unknown", confidence: "medium" });
  if (["status", "log", "show"].includes(subcommand)) {
    return withStep(base, {
      subcommand,
      operation: subcommand === "status" ? "inspect_status" : "inspect_history",
      effect: "read_only",
      targets: gitPathspecTargets(args.slice(1)),
      confidence: "high"
    });
  }
  if (subcommand === "diff") {
    return withStep(base, {
      subcommand,
      operation: "inspect_diff",
      effect: "read_only",
      targets: gitPathspecTargets(args.slice(1)),
      confidence: "high"
    });
  }
  if (["add", "commit", "restore", "checkout", "switch", "merge", "rebase", "reset"].includes(subcommand)) {
    return withStep(base, {
      subcommand,
      operation: "vcs_write",
      effect: subcommand === "reset" ? "destructive" : "write",
      targets: gitPathspecTargets(args.slice(1)),
      confidence: "high"
    });
  }
  if (["push", "pull", "fetch", "clone"].includes(subcommand)) {
    const forcePush = subcommand === "push" && hasForceFlag(args.slice(1));
    return withStep(base, {
      subcommand,
      operation: subcommand === "push" ? forcePush ? "force_publish" : "publish" : "fetch_repo",
      effect: subcommand === "push" ? forcePush ? "destructive" : "network" : "read_only",
      targets: [],
      confidence: "high"
    });
  }
  if (subcommand === "clean") {
    const forced = hasForceFlag(args.slice(1));
    return withStep(base, {
      subcommand,
      operation: forced ? "clean_worktree" : "inspect_clean",
      effect: forced ? "destructive" : "read_only",
      targets: gitPathspecTargets(args.slice(1)),
      confidence: "high"
    });
  }
  return withStep(base, { subcommand, operation: "git_command", effect: "unknown", confidence: "medium" });
}
function hasForceFlag(args) {
  return args.some((arg) => arg === "--force" || arg === "--force-with-lease" || arg === "--force-if-includes" || /^-[a-z]*f/.test(arg));
}

// src/domain/ingest/model/command.runner.model.ts
var COMMAND_WRAPPERS = [
  { name: "npx" },
  { name: "bunx" },
  { name: "uv", subcommand: "run" },
  { name: "uvx" },
  { name: "poetry", subcommand: "run" },
  { name: "pipenv", subcommand: "run" },
  { name: "pnpm", subcommand: "dlx" },
  { name: "yarn", subcommand: "dlx" },
  { name: "bun", subcommand: "run" },
  { name: "deno", subcommand: "run" },
  { name: "python", subcommand: "-m" },
  { name: "python3", subcommand: "-m" }
];
var WRAPPER_VALUE_FLAGS = /* @__PURE__ */ new Set(["-p", "--package", "-c", "--call"]);
var RUNNER_SPECS = [
  { command: "vitest", operation: "run_test", effect: "execute_check" },
  { command: "jest", operation: "run_test", effect: "execute_check" },
  { command: "mocha", operation: "run_test", effect: "execute_check" },
  { command: "ava", operation: "run_test", effect: "execute_check" },
  { command: "pytest", operation: "run_test", effect: "execute_check" },
  { command: "phpunit", operation: "run_test", effect: "execute_check" },
  { command: "rspec", operation: "run_test", effect: "execute_check" },
  { command: "tsc", operation: "run_build", effect: "execute_check" },
  { command: "eslint", operation: "run_lint", effect: "execute_check" },
  { command: "prettier", operation: "run_lint", effect: "execute_check" },
  { command: "biome", operation: "run_lint", effect: "execute_check" },
  { command: "ruff", operation: "run_lint", effect: "execute_check" },
  { command: "black", operation: "run_lint", effect: "execute_check" },
  { command: "flake8", operation: "run_lint", effect: "execute_check" },
  { command: "mypy", operation: "run_build", effect: "execute_check" },
  { command: "go", subcommand: "test", operation: "run_test", effect: "execute_check" },
  { command: "go", subcommand: "build", operation: "run_build", effect: "execute_check" },
  { command: "go", subcommand: "vet", operation: "run_lint", effect: "execute_check" },
  { command: "cargo", subcommand: "test", operation: "run_test", effect: "execute_check" },
  { command: "cargo", subcommand: "build", operation: "run_build", effect: "execute_check" },
  { command: "cargo", subcommand: "check", operation: "run_build", effect: "execute_check" },
  { command: "cargo", subcommand: "clippy", operation: "run_lint", effect: "execute_check" },
  { command: "gradle", subcommand: "test", operation: "run_test", effect: "execute_check" },
  { command: "gradle", subcommand: "build", operation: "run_build", effect: "execute_check" },
  { command: "mvn", subcommand: "test", operation: "run_test", effect: "execute_check" },
  { command: "mvn", subcommand: "package", operation: "run_build", effect: "execute_check" },
  { command: "mvn", subcommand: "install", operation: "run_build", effect: "execute_check" },
  { command: "make", subcommand: "test", operation: "run_test", effect: "execute_check" },
  { command: "make", subcommand: "build", operation: "run_build", effect: "execute_check" },
  { command: "make", subcommand: "lint", operation: "run_lint", effect: "execute_check" },
  { command: "make", subcommand: "check", operation: "run_test", effect: "execute_check" }
];
function unwrapCommand(tokens) {
  let current = tokens;
  for (; ; ) {
    const stripped = stripWrapperOnce(current);
    if (stripped === null) return current;
    current = stripped;
  }
}
function stripWrapperOnce(tokens) {
  const head = tokens[0];
  if (head === void 0) return null;
  const wrapper = COMMAND_WRAPPERS.find((entry) => entry.name === head);
  if (!wrapper) return null;
  if (wrapper.subcommand !== void 0 && tokens[1] !== wrapper.subcommand) return null;
  const rest = tokens.slice(wrapper.subcommand !== void 0 ? 2 : 1);
  const inner = skipLeadingFlags(rest);
  return inner.length > 0 ? inner : null;
}
function skipLeadingFlags(tokens) {
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (!token.startsWith("-")) break;
    index += WRAPPER_VALUE_FLAGS.has(token) ? 2 : 1;
  }
  return tokens.slice(index);
}
function runnerStepFrom(base, commandName, args) {
  const spec = matchRunner(commandName, args[0]);
  if (!spec) return null;
  return withStep(base, {
    operation: spec.operation,
    effect: spec.effect,
    confidence: "high",
    ...spec.subcommand ? { subcommand: spec.subcommand } : {}
  });
}
function matchRunner(commandName, firstArg) {
  const withSubcommand = RUNNER_SPECS.find(
    (spec) => spec.command === commandName && spec.subcommand === firstArg
  );
  if (withSubcommand) return withSubcommand;
  return RUNNER_SPECS.find((spec) => spec.command === commandName && spec.subcommand === void 0);
}
function runnerOperationFromArgs(args) {
  const found = /* @__PURE__ */ new Set();
  for (let index = 0; index < args.length; index += 1) {
    const spec = matchRunner(args[index] ?? "", args[index + 1]);
    if (spec) found.add(spec.operation);
  }
  if (found.has("run_test")) return "run_test";
  if (found.has("run_lint")) return "run_lint";
  if (found.has("run_build")) return "run_build";
  return void 0;
}

// src/domain/ingest/model/command.package.model.ts
function analyzePackageManager(base, args) {
  const workspace = extractWorkspace(args);
  const scriptName = extractScriptName(base.commandName, args);
  const operation = scriptOperation(scriptName, args);
  const effect = packageManagerEffect(operation, args);
  const targets = workspace ? [{ type: "workspace", value: workspace }] : [];
  return withStep(base, {
    operation,
    effect,
    targets,
    confidence: operation === "run_command" ? "medium" : "high",
    ...workspace ? { workspace } : {},
    ...scriptName ? { scriptName } : {}
  });
}
function extractWorkspace(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--workspace" || arg === "-w") return args[index + 1];
    const equalsMatch = arg.match(/^--workspace=(.+)$/);
    if (equalsMatch) return equalsMatch[1];
  }
  return void 0;
}
function extractScriptName(commandName, args) {
  const filtered = stripPackageManagerOptions(args);
  if (commandName === "yarn" && filtered[0] && filtered[0] !== "run") return filtered[0];
  if (filtered[0] === "run" || filtered[0] === "run-script") return filtered[1];
  return filtered[0];
}
function scriptOperation(scriptName, args) {
  const name = (scriptName ?? "").toLowerCase();
  if (name.includes("test")) return "run_test";
  if (name.includes("lint") || name.includes("format")) return "run_lint";
  if (name.includes("build")) return "run_build";
  const runnerOperation = runnerOperationFromArgs(args);
  if (runnerOperation) return runnerOperation;
  if (["install", "add", "i"].includes(name)) return "install_dependency";
  if (name === "publish") return "publish";
  return "run_command";
}
function packageManagerEffect(operation, args) {
  if (operation === "install_dependency" || operation === "publish") return "network";
  if (["run_test", "run_lint", "run_build"].includes(operation)) return "execute_check";
  if (args.some((arg) => arg === "install" || arg === "add" || arg === "i")) return "network";
  return "unknown";
}
function stripPackageManagerOptions(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--workspace" || arg === "-w" || arg === "--prefix") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--workspace=") || arg.startsWith("--prefix=")) continue;
    if (arg.startsWith("-")) continue;
    result.push(arg);
  }
  return result;
}

// src/domain/ingest/model/command.parser.model.ts
function splitSequence(command) {
  const parts = [];
  let current = "";
  let pendingOperator;
  const state = { quote: null, escaped: false, parenDepth: 0 };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? "";
    const next = command[index + 1] ?? "";
    updateShellState(state, char);
    if (!state.quote && state.parenDepth === 0 && command[index - 1] !== "\\") {
      const operator = char === "&" && next === "&" ? "&&" : char === "|" && next === "|" ? "||" : char === ";" ? ";" : char === "\n" ? ";" : null;
      if (operator) {
        pushSequencePart(parts, current, pendingOperator);
        current = "";
        pendingOperator = operator;
        if (char !== "\n" && operator !== ";") index += 1;
        continue;
      }
    }
    current += char;
  }
  pushSequencePart(parts, current, pendingOperator);
  return parts;
}
function splitPipeline(command) {
  const parts = [];
  let current = "";
  const state = { quote: null, escaped: false, parenDepth: 0 };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? "";
    const next = command[index + 1] ?? "";
    updateShellState(state, char);
    if (!state.quote && state.parenDepth === 0 && char === "|" && next !== "|" && command[index - 1] !== "\\") {
      const trimmed3 = current.trim();
      if (trimmed3) parts.push(trimmed3);
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed2 = current.trim();
  if (trimmed2) parts.push(trimmed2);
  return parts;
}
function tokenizeShell(command) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}
function extractRedirects(tokens) {
  const cleanTokens = [];
  const redirects = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const next = tokens[index + 1];
    const attached = token.match(/^(2>>|2>|>>|>|<|&>)(.+)$/);
    if (attached) {
      const value = attached[2] ?? "";
      if (value) redirects.push({ operator: attached[1] ?? token, target: redirectTarget(value) });
      continue;
    }
    if (isRedirectOperator(token)) {
      if (next && !isRedirectOperator(next)) {
        redirects.push({ operator: token, target: redirectTarget(next) });
        index += 1;
      }
      continue;
    }
    cleanTokens.push(token);
  }
  return { tokens: cleanTokens, redirects };
}
function isEnvAssignment(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}
function redirectTarget(value) {
  if (/^&\d*-?$/.test(value)) return { type: "stream", value };
  const devices = ["/dev/null", "/dev/stdin", "/dev/stdout", "/dev/stderr", "/dev/tty"];
  if (devices.includes(value)) return { type: "stream", value };
  return { type: "file", value };
}
function updateShellState(state, char) {
  if (state.escaped) {
    state.escaped = false;
    return;
  }
  if (char === "\\") {
    state.escaped = true;
    return;
  }
  if (state.quote) {
    if (char === state.quote) state.quote = null;
    return;
  }
  if (char === "'" || char === '"') {
    state.quote = char;
    return;
  }
  if (char === "(") state.parenDepth += 1;
  if (char === ")" && state.parenDepth > 0) state.parenDepth -= 1;
}
function pushSequencePart(parts, raw, operatorFromPrevious) {
  const trimmed2 = raw.trim();
  if (!trimmed2) return;
  parts.push({ raw: trimmed2, ...operatorFromPrevious ? { operatorFromPrevious } : {} });
}
function isRedirectOperator(token) {
  return ["<", ">", ">>", "2>", "2>>", "&>"].includes(token);
}

// src/domain/ingest/model/command.semantic.model.ts
function analyzeCommand(command) {
  const raw = command.trim();
  if (!raw) {
    return { raw: command, structure: "simple", overallEffect: "unknown", confidence: "low", steps: [] };
  }
  const sequence = splitSequence(raw);
  const steps = sequence.map((part) => analyzeSequencePart(part));
  const failureMasked = detectFailureMasked(sequence);
  return {
    raw,
    structure: resolveStructure(sequence, steps),
    overallEffect: combineEffects(steps.map((step) => step.effect)),
    confidence: combineConfidence(steps.map((step) => step.confidence)),
    steps,
    ...failureMasked ? { failureMasked } : {}
  };
}
function inferCommandSemantic(command, rulePatterns = []) {
  const normalized = command.trim().toLowerCase();
  const analysis = analyzeCommand(command);
  const entityName = analysis.steps[0]?.commandName || firstCommandToken(command) || "shell";
  const matchesRule = rulePatterns.some((pattern) => {
    const needle = pattern.trim().toLowerCase();
    return needle.length > 0 && normalized.includes(needle);
  });
  if (matchesRule) {
    return {
      lane: "rule",
      metadata: terminalSemantic("rule_check", "Rule check", "execution", "execute", entityName),
      analysis
    };
  }
  const executionSubtype = executionSubtypeFromAnalysis(analysis);
  if (executionSubtype) {
    return {
      lane: "implementation",
      metadata: terminalSemantic(
        executionSubtype,
        subtypeLabel(executionSubtype),
        "execution",
        "execute",
        entityName
      ),
      analysis
    };
  }
  if (analysis.overallEffect === "read_only") {
    return {
      lane: "exploration",
      metadata: terminalSemantic(
        "shell_probe",
        "Shell probe",
        "shell",
        analysis.steps[0]?.operation ?? "probe",
        entityName
      ),
      analysis
    };
  }
  return {
    lane: "implementation",
    metadata: terminalSemantic("run_command", "Run command", "execution", "execute", entityName),
    analysis
  };
}
function terminalSemantic(subtypeKey, subtypeLabelText, subtypeGroup, operation, entityName) {
  return {
    subtypeKey,
    subtypeLabel: subtypeLabelText,
    subtypeGroup,
    toolFamily: "terminal",
    operation,
    entityType: "command",
    entityName,
    sourceTool: "Bash"
  };
}
function analyzeSequencePart(part) {
  const pipelineParts = splitPipeline(part.raw);
  if (pipelineParts.length > 1) {
    const pipeline = pipelineParts.map((rawStep) => analyzeSimpleCommand({ raw: rawStep }));
    return {
      raw: part.raw,
      commandName: pipeline[0]?.commandName ?? "pipeline",
      operation: "pipeline",
      targets: uniqueTargets(pipeline.flatMap((step) => step.targets)),
      effect: combineEffects(pipeline.map((step) => step.effect)),
      confidence: combineConfidence(pipeline.map((step) => step.confidence)),
      ...part.operatorFromPrevious ? { operatorFromPrevious: part.operatorFromPrevious } : {},
      pipeline
    };
  }
  return analyzeSimpleCommand(part);
}
function analyzeSimpleCommand(part) {
  const { tokens: commandTokens, redirects } = extractRedirects(tokenizeShell(part.raw));
  const usefulTokens = unwrapCommand(commandTokens.filter((token) => !isEnvAssignment(token)));
  const commandName = usefulTokens[0] ?? "shell";
  const args = usefulTokens.slice(1);
  const base = buildBaseStep(part, commandName, redirects);
  const step = dispatchSimpleCommand(base, commandName, args, redirects, part.raw);
  return hasDangerousArgs(part.raw) ? withStep(step, { effect: "destructive" }) : step;
}
function dispatchSimpleCommand(base, commandName, args, redirects, raw) {
  if (commandName === "sed") return analyzeSed(base, args);
  if (commandName === "git") return analyzeGit(base, args);
  if (["npm", "pnpm", "yarn"].includes(commandName)) return analyzePackageManager(base, args);
  const runner = runnerStepFrom(base, commandName, args);
  if (runner) return runner;
  if (STREAM_TRANSFORM_COMMANDS.has(commandName)) return analyzeStreamTransform(base, args);
  if (commandName === "find") return analyzeFind(base, args);
  if (commandName === "rg") return analyzeRipgrep(base, args);
  if (SEARCH_COMMANDS.has(commandName)) return analyzeSearch(base, args);
  if (READ_COMMANDS.has(commandName)) return analyzeRead(base, args);
  if (LIST_COMMANDS.has(commandName)) return analyzeList(base, args);
  if (DESTRUCTIVE_COMMANDS.has(commandName)) {
    return withStep(base, { operation: "delete_file", effect: "destructive", targets: pathTargets(args), confidence: "medium" });
  }
  if (WRITE_COMMANDS.has(commandName)) {
    return withStep(base, { operation: "write_file", effect: "write", targets: pathTargets(args), confidence: "medium" });
  }
  if (NETWORK_COMMANDS.has(commandName)) {
    return withStep(base, { operation: "fetch_url", effect: "network", targets: urlTargets(args), confidence: "medium" });
  }
  return withStep(base, {
    operation: "unknown",
    effect: redirects.some((redirect) => redirect.operator.includes(">")) ? "write" : "unknown",
    confidence: containsComplexShell(raw) ? "low" : "medium"
  });
}
function resolveStructure(sequence, steps) {
  if (sequence.length > 1) {
    return steps.some((step) => step.pipeline && step.pipeline.length > 0) ? "compound" : "sequence";
  }
  if (steps[0]?.pipeline && steps[0].pipeline.length > 0) return "pipeline";
  return "simple";
}
function combineEffects(effects) {
  if (effects.includes("destructive")) return "destructive";
  if (effects.includes("write")) return "write";
  if (effects.includes("network")) return "network";
  if (effects.includes("execute_check")) return "execute_check";
  if (effects.length > 0 && effects.every((effect) => effect === "read_only")) return "read_only";
  return "unknown";
}
function combineConfidence(values) {
  if (values.includes("low")) return "low";
  if (values.includes("medium")) return "medium";
  return "high";
}
function detectFailureMasked(sequence) {
  return sequence.some((part) => part.operatorFromPrevious === "||" && /^(true|:)\b/.test(part.raw.trim()));
}
function executionSubtypeFromAnalysis(analysis) {
  const operations = analysis.steps.flatMap((step) => [
    step.operation,
    ...step.pipeline?.map((pipelineStep) => pipelineStep.operation) ?? []
  ]);
  if (operations.includes("run_test")) return "run_test";
  if (operations.includes("run_lint")) return "run_lint";
  if (operations.includes("run_build")) return "run_build";
  if (operations.some((operation) => operation === "verify" || operation === "execute_check")) return "verify";
  return null;
}
function subtypeLabel(subtypeKey) {
  switch (subtypeKey) {
    case "run_test":
      return "Run test";
    case "run_lint":
      return "Run lint";
    case "run_build":
      return "Run build";
    case "verify":
      return "Verify";
  }
}
function firstCommandToken(command) {
  const [first = ""] = command.trim().split(/\s+/, 1);
  return first.replace(/^['"]+|['"]+$/g, "");
}

// src/domain/ingest/model/tool.semantic.model.ts
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
function inferExploreSemantic(toolName, options = {}) {
  const { entityName, queryOrUrl } = options;
  switch (toolName) {
    case "Read":
      return exploreSemantic("read_file", "Read file", "files", "read", "file", toolName, entityName);
    case "Glob":
      return exploreSemantic("glob_files", "Glob files", "search", "search", "file", toolName, entityName);
    case "Grep":
      return exploreSemantic("grep_code", "Grep code", "search", "search", "file", toolName, entityName);
    case "WebFetch":
      return exploreSemantic("web_fetch", "Web fetch", "web", "fetch", "url", toolName, queryOrUrl);
    case "WebSearch":
      return exploreSemantic("web_search", "Web search", "web", "search", "query", toolName, queryOrUrl);
    default:
      return exploreSemantic("list_files", "List files", "search", "list", "file", toolName, entityName);
  }
}
function inferFileToolSemantic(toolName, entityName) {
  if (toolName === "Write") return fileSemantic("create_file", "Create file", "create", toolName, entityName);
  return fileSemantic("modify_file", "Modify file", "modify", toolName, entityName);
}
function inferMcpSemantic(mcpServer, mcpTool, sourceTool) {
  return {
    subtypeKey: "mcp_call",
    subtypeLabel: "MCP call",
    subtypeGroup: "coordination",
    toolFamily: "coordination",
    operation: "invoke",
    entityType: "mcp",
    entityName: `${mcpServer}/${mcpTool}`,
    sourceTool
  };
}
function inferSkillSemantic(skillName, sourceTool = "Skill") {
  return {
    subtypeKey: "skill_use",
    subtypeLabel: "Skill use",
    subtypeGroup: "coordination",
    toolFamily: "coordination",
    operation: "invoke",
    entityType: "skill",
    ...skillName ? { entityName: skillName } : {},
    sourceTool
  };
}
function inferAgentSemantic(entityName, sourceTool = "Agent") {
  return {
    subtypeKey: "delegation",
    subtypeLabel: "Delegation",
    subtypeGroup: "coordination",
    toolFamily: "coordination",
    operation: "delegate",
    entityType: "agent",
    ...entityName ? { entityName } : {},
    sourceTool
  };
}
function parseMcpToolName(toolName) {
  if (!toolName.startsWith("mcp__")) return null;
  const parts = toolName.split("__");
  if (parts.length < 3) return null;
  const server = parts[1]?.trim();
  const tool = parts.slice(2).join("__").trim();
  if (!server || !tool) return null;
  return { server, tool };
}
function exploreSemantic(subtypeKey, subtypeLabel2, subtypeGroup, operation, entityType, sourceTool, entityName) {
  return {
    subtypeKey,
    subtypeLabel: subtypeLabel2,
    ...subtypeGroup ? { subtypeGroup } : {},
    toolFamily: "explore",
    operation,
    entityType,
    ...entityName ? { entityName } : {},
    sourceTool
  };
}
function fileSemantic(subtypeKey, subtypeLabel2, operation, sourceTool, entityName) {
  return {
    subtypeKey,
    subtypeLabel: subtypeLabel2,
    subtypeGroup: "file_ops",
    toolFamily: "file",
    operation,
    entityType: "file",
    ...entityName ? { entityName } : {},
    sourceTool
  };
}
function humanizeSubtypeKey(value) {
  return value.split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

// src/domain/ingest/model/coordination.tool.model.ts
var SELF_MCP_SERVER = "agent-tracer";
var CHILD_TITLE_MAX = 400;
var CRON_TOOLS = ["CronCreate", "CronDelete", "CronList"];
var MODE_CHANGE_TOOLS = ["EnterPlanMode", "EnterWorktree", "ExitWorktree"];
function shapeAgentTool(call) {
  const description = toTrimmedString(call.toolInput["description"]);
  const prompt = toTrimmedString(call.toolInput["prompt"], CHILD_TITLE_MAX);
  const agentName = toTrimmedString(call.toolInput["subagent_type"]);
  const agentModel = toTrimmedString(call.toolInput["model"]);
  const runInBackground = toBoolean(call.toolInput["run_in_background"]);
  const metadata = {
    ...provenEvidence("Observed directly by the Agent PostToolUse hook."),
    toolInput: sanitizeToolInput(call.toolInput),
    ...toolUseIdOf(call),
    ...buildSemanticMetadata(inferAgentSemantic(agentName || void 0, "Agent")),
    activityType: "delegation",
    ...agentName ? { agentName } : {},
    ...agentModel ? { agentModel } : {},
    ...runInBackground ? { agentRunInBackground: true } : {}
  };
  return {
    kind: KIND.invokeAgent,
    lane: LANE.coordination,
    title: description ? `Agent: ${truncate(description, 80)}` : "Agent dispatch",
    ...prompt || description ? { body: prompt || description } : {},
    metadata
  };
}
function shapeSkillTool(call) {
  const skillName = toTrimmedString(call.toolInput["skill"]);
  const args = toTrimmedString(call.toolInput["args"], 400);
  const metadata = {
    ...provenEvidence("Observed directly by the Skill PostToolUse hook."),
    toolInput: sanitizeToolInput(call.toolInput),
    ...toolUseIdOf(call),
    ...buildSemanticMetadata(inferSkillSemantic(skillName || void 0)),
    activityType: "skill_use",
    ...skillName ? { skillName } : {}
  };
  return {
    kind: KIND.invokeAgent,
    lane: LANE.coordination,
    title: skillName ? `Skill: ${skillName}` : "Skill invoked",
    ...args ? { body: `args: ${args}` } : {},
    metadata
  };
}
function shapeMcpTool(call) {
  const mcp = parseMcpToolName(call.toolName);
  if (!mcp || mcp.server === SELF_MCP_SERVER) return null;
  const metadata = {
    ...provenEvidence("Observed directly by the Mcp PostToolUse hook."),
    ...buildSemanticMetadata(inferMcpSemantic(mcp.server, mcp.tool, call.toolName)),
    activityType: "mcp_call",
    mcpServer: mcp.server,
    mcpTool: mcp.tool,
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.invokeAgent,
    lane: LANE.coordination,
    title: `MCP: ${mcp.server}/${mcp.tool}`,
    body: `Used MCP tool ${mcp.server}/${mcp.tool}`,
    metadata
  };
}
function shapeCronTool(call) {
  const toolName = call.toolName;
  const cronId = toTrimmedString(call.toolInput["id"]);
  const schedule = toTrimmedString(call.toolInput["schedule"]);
  const prompt = toTrimmedString(call.toolInput["prompt"], 200);
  const action = toolName.replace(/^Cron/, "").toLowerCase() || "list";
  const metadata = {
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    ...buildSemanticMetadata({
      subtypeKey: "delegation",
      subtypeLabel: `Cron ${action}`,
      subtypeGroup: "coordination",
      toolFamily: "coordination",
      operation: action,
      entityType: "cron",
      ...cronId ? { entityName: cronId } : schedule ? { entityName: schedule } : {},
      sourceTool: toolName
    }),
    activityType: "delegation",
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.invokeAgent,
    lane: LANE.coordination,
    title: cronTitle(toolName, cronId, schedule),
    body: cronBody(toolName, cronId, schedule, prompt),
    metadata
  };
}
function shapeModeChange(call) {
  const toolName = call.toolName;
  const worktreePath = toTrimmedString(call.toolInput["path"]);
  const isPlanMode = toolName === "EnterPlanMode";
  const isEnterWorktree = toolName === "EnterWorktree";
  const metadata = {
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    trigger: `mode_change:${toolName}`,
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.contextSaved,
    lane: isPlanMode ? LANE.planning : LANE.background,
    title: modeChangeTitle(isPlanMode, isEnterWorktree, worktreePath),
    body: modeChangeBody(isPlanMode, isEnterWorktree, worktreePath),
    metadata
  };
}
function cronTitle(toolName, cronId, schedule) {
  if (toolName === "CronCreate") return `Cron schedule: ${schedule || "?"}`;
  if (toolName === "CronDelete") return `Cron delete: ${cronId || "?"}`;
  return "Cron list";
}
function cronBody(toolName, cronId, schedule, prompt) {
  if (toolName === "CronCreate" && prompt) return `Schedule: ${schedule}
Prompt: ${prompt}`;
  if (toolName === "CronDelete") return `Cancel scheduled task ${cronId}`;
  return "Enumerated scheduled tasks";
}
function modeChangeTitle(isPlanMode, isEnterWorktree, worktreePath) {
  if (isPlanMode) return "Enter plan mode";
  if (!isEnterWorktree) return "Exit worktree";
  return worktreePath ? `Enter worktree: ${worktreePath}` : "Enter worktree";
}
function modeChangeBody(isPlanMode, isEnterWorktree, worktreePath) {
  if (isPlanMode) return "Switched to plan mode";
  if (!isEnterWorktree) return "Returned from worktree to original directory";
  return worktreePath ? `Switched into worktree at ${worktreePath}` : "Switched into worktree";
}

// src/domain/ingest/model/error.taxonomy.model.ts
var ERROR_RULES = [
  { pattern: /permission denied|not allowed|EACCES|EPERM|denied by (the )?user/i, type: "permission" },
  { pattern: /timed? ?out|ETIMEDOUT|deadline exceeded/i, type: "timeout" },
  { pattern: /no such file|command not found|not found|ENOENT|does not exist/i, type: "not_found" },
  { pattern: /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network/i, type: "network" },
  { pattern: /InputValidationError|invalid|must be|required (parameter|field)|\bexpected\b/i, type: "invalid_input" }
];
function classifyToolError(error, isInterrupt) {
  if (isInterrupt) return "interrupt";
  return ERROR_RULES.find((rule) => rule.pattern.test(error))?.type ?? "unknown";
}

// src/domain/ingest/model/explore.tool.model.ts
import * as path9 from "node:path";

// src/domain/ingest/model/file.target.model.ts
var MAX_FILE_TARGETS = 100;
var MAX_FILE_TARGET_LENGTH = 1024;
function collectFileTargets(analysis) {
  const seen = /* @__PURE__ */ new Set();
  const filePaths = [];
  const visit = (step) => {
    for (const target of step.targets) {
      if (filePaths.length >= MAX_FILE_TARGETS) return;
      if (target.type !== "file" && target.type !== "path") continue;
      if (!target.value || target.value === "-" || seen.has(target.value)) continue;
      if (target.value.length > MAX_FILE_TARGET_LENGTH) continue;
      seen.add(target.value);
      filePaths.push(target.value);
    }
    for (const sub of step.pipeline ?? []) {
      if (filePaths.length >= MAX_FILE_TARGETS) return;
      visit(sub);
    }
  };
  for (const step of analysis.steps) {
    if (filePaths.length >= MAX_FILE_TARGETS) break;
    visit(step);
  }
  return filePaths;
}
function toOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return void 0;
}

// src/domain/ingest/model/tool.capture.model.ts
var TERMINAL_STDOUT_HEAD = 4096;
var TERMINAL_STDOUT_TAIL = 4096;
var TERMINAL_STDERR_HEAD = 2048;
var TERMINAL_STDERR_TAIL = 2048;
var TOOL_RESULT_HEAD = 2048;
var TOOL_RESULT_TAIL = 2048;
function captureTerminalToolResponse(value) {
  if (typeof value === "string") {
    const result2 = {};
    captureText(result2, "stdout", value, TERMINAL_STDOUT_HEAD, TERMINAL_STDOUT_TAIL);
    return result2;
  }
  if (!isRecord(value)) return {};
  const result = {};
  const exit = value["exit_code"] ?? value["exitCode"];
  if (typeof exit === "number" && Number.isFinite(exit)) result["exitCode"] = exit;
  const interrupted = value["interrupted"] ?? value["wasInterrupted"];
  if (typeof interrupted === "boolean") result["interrupted"] = interrupted;
  captureText(result, "stdout", value["stdout"] ?? value["output"], TERMINAL_STDOUT_HEAD, TERMINAL_STDOUT_TAIL);
  captureText(result, "stderr", value["stderr"], TERMINAL_STDERR_HEAD, TERMINAL_STDERR_TAIL);
  return result;
}
function captureToolResultBody(value, options = {}) {
  const text = stringifyToolResult(value);
  if (text === void 0) return {};
  const matches = options.matchCounter?.(value, text);
  const captured = truncateOutput(text, TOOL_RESULT_HEAD, TOOL_RESULT_TAIL);
  return {
    resultText: captured.body,
    resultBytes: captured.bytes,
    ...captured.truncated ? { resultTruncated: true } : {},
    ...typeof matches === "number" && Number.isFinite(matches) ? { resultMatches: matches } : {}
  };
}
function captureText(target, key, value, head, tail) {
  if (typeof value !== "string" || value.length === 0) return;
  const captured = truncateOutput(value, head, tail);
  target[key] = captured.body;
  target[`${key}Bytes`] = captured.bytes;
  if (captured.truncated) target[`${key}Truncated`] = true;
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

// src/domain/ingest/model/workspace.path.model.ts
import * as path8 from "node:path";
function relativeProjectPath(projectDir2, filePath) {
  if (!filePath) return filePath;
  const relative2 = path8.relative(projectDir2, filePath);
  if (!relative2) return "";
  const normalized = relative2.split(path8.sep).join("/");
  if (normalized === ".." || normalized.startsWith("../") || path8.isAbsolute(relative2)) return filePath;
  return normalized.replace(/^\/+/, "");
}
function defaultTaskTitle(projectDir2) {
  return `Claude Code \u2014 ${path8.basename(projectDir2)}`;
}

// src/domain/ingest/model/explore.tool.model.ts
var MAX_PATH_LENGTH = 300;
var EXPLORE_TOOLS = ["Read", "Glob", "Grep", "WebFetch", "WebSearch"];
function shapeExploreTool(call, context) {
  const toolName = call.toolName;
  const shape = shapeOf(toolName, call, context);
  const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
  const queryOrUrl = isWebTool ? toTrimmedString(call.toolInput["query"]) || toTrimmedString(call.toolInput["url"]) : "";
  const entityName = shape.filePaths[0];
  const semantic = inferExploreSemantic(toolName, {
    ...entityName ? { entityName } : {},
    ...queryOrUrl ? { queryOrUrl } : {}
  });
  const captured = captureToolResultBody(call.toolResponse, {
    matchCounter: (raw, text) => exploreMatchCount(toolName, raw, text)
  });
  const metadata = {
    ...buildSemanticMetadata(semantic),
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    toolName,
    toolInput: sanitizeToolInput(call.toolInput),
    ...shape.extras,
    ...isWebTool && queryOrUrl ? { webUrls: [truncate(queryOrUrl, MAX_PATH_LENGTH)] } : {},
    ...toolUseIdOf(call),
    ...captured
  };
  return {
    kind: KIND.executeTool,
    lane: LANE.exploration,
    title: shape.title,
    body: shape.body,
    filePaths: shape.filePaths.map((filePath) => truncate(filePath, MAX_PATH_LENGTH)),
    metadata
  };
}
function shapeLspTool(call, context) {
  const operation = toTrimmedString(call.toolInput["operation"]) || "lsp";
  const filePath = toTrimmedString(call.toolInput["file_path"]);
  const symbol = toTrimmedString(call.toolInput["symbol"]);
  const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
  const titleSuffix = symbol || relPath;
  const metadata = {
    ...provenEvidence("Observed directly by the LSP PostToolUse hook."),
    ...buildSemanticMetadata({
      subtypeKey: "grep_code",
      subtypeLabel: `LSP ${operation}`,
      subtypeGroup: "search",
      toolFamily: "explore",
      operation: `lsp_${operation}`,
      entityType: symbol ? "symbol" : "file",
      ...symbol ? { entityName: symbol } : relPath ? { entityName: relPath } : {},
      sourceTool: "LSP"
    }),
    toolName: "LSP",
    toolInput: sanitizeToolInput(call.toolInput),
    ...filePath ? { filePath, relPath } : {},
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.executeTool,
    lane: LANE.exploration,
    title: `LSP ${operation}${titleSuffix ? `: ${truncate(titleSuffix, 60)}` : ""}`,
    body: `LSP ${operation}${relPath ? ` in ${relPath}` : ""}${symbol ? ` for ${symbol}` : ""}`,
    ...filePath ? { filePaths: [filePath] } : {},
    metadata
  };
}
function shapeToolSearch(call) {
  const query = toTrimmedString(call.toolInput["query"]);
  const metadata = {
    ...provenEvidence("Observed directly by the ToolSearch PostToolUse hook."),
    ...buildSemanticMetadata({
      subtypeKey: "list_files",
      subtypeLabel: "Tool search",
      subtypeGroup: "search",
      toolFamily: "explore",
      operation: "search",
      entityType: "query",
      ...query ? { entityName: query } : {},
      sourceTool: "ToolSearch"
    }),
    toolName: "ToolSearch",
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.executeTool,
    lane: LANE.exploration,
    title: query ? `ToolSearch: ${truncate(query, 60)}` : "ToolSearch",
    body: query ? `Searched deferred tools for: ${query}` : "Listed deferred tools",
    metadata
  };
}
function shapeOf(toolName, call, context) {
  if (toolName === "Read") return shapeRead(call, context);
  if (toolName === "Glob") return shapeGlob(call, context);
  if (toolName === "Grep") return shapeGrep(call, context);
  return shapeWeb(toolName, call);
}
function shapeRead(call, context) {
  const filePath = toTrimmedString(call.toolInput["file_path"]);
  const relPath = relativeProjectPath(context.projectDir, filePath);
  const offset = toOptionalNumber(call.toolInput["offset"]);
  const limit = toOptionalNumber(call.toolInput["limit"]);
  const rangeSuffix = offset !== void 0 || limit !== void 0 ? ` (lines ${offset ?? 1}${limit ? `\u2013${(offset ?? 1) + limit - 1}` : "+"})` : "";
  return {
    title: `Read: ${path9.basename(relPath)}${rangeSuffix}`,
    body: `Reading ${relPath}${rangeSuffix}`,
    filePaths: filePath ? [filePath] : [],
    extras: {
      ...offset !== void 0 ? { readOffset: offset } : {},
      ...limit !== void 0 ? { readLimit: limit } : {}
    }
  };
}
function shapeGlob(call, context) {
  const pattern = toTrimmedString(call.toolInput["pattern"]);
  const searchPath = toTrimmedString(call.toolInput["path"]);
  const relPath = searchPath ? relativeProjectPath(context.projectDir, searchPath) : "";
  return {
    title: `Glob: ${pattern}`,
    body: `Searching for files matching: ${pattern}${relPath ? ` in ${relPath}` : ""}`,
    filePaths: searchPath ? [searchPath] : [],
    extras: {
      ...pattern ? { searchPattern: pattern } : {},
      ...searchPath ? { searchPath } : {}
    }
  };
}
function shapeGrep(call, context) {
  const pattern = toTrimmedString(call.toolInput["pattern"]);
  const searchPath = toTrimmedString(call.toolInput["path"]);
  const relPath = searchPath ? relativeProjectPath(context.projectDir, searchPath) : "";
  const glob = toTrimmedString(call.toolInput["glob"]);
  const outputMode = normalizeOutputMode(call.toolInput["output_mode"]);
  const modeBadge = outputMode === "content" ? " [content]" : outputMode === "count" ? " [count]" : "";
  return {
    title: `Grep: ${truncate(pattern, 60)}${modeBadge}`,
    body: `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}${glob ? ` (glob ${glob})` : ""}`,
    filePaths: searchPath ? [searchPath] : [],
    extras: {
      ...pattern ? { searchPattern: pattern } : {},
      ...searchPath ? { searchPath } : {},
      ...glob ? { searchGlob: glob } : {},
      ...outputMode ? { grepOutputMode: outputMode } : {},
      ...toBoolean(call.toolInput["-i"]) ? { grepCaseInsensitive: true } : {},
      ...toBoolean(call.toolInput["multiline"]) ? { grepMultiline: true } : {}
    }
  };
}
function shapeWeb(toolName, call) {
  const query = toTrimmedString(call.toolInput["query"]) || toTrimmedString(call.toolInput["url"]);
  const webPrompt = toTrimmedString(call.toolInput["prompt"], 400);
  const allowedDomains = toStringArray(call.toolInput["allowed_domains"]);
  const blockedDomains = toStringArray(call.toolInput["blocked_domains"]);
  return {
    title: `${toolName}: ${truncate(query, 60)}`,
    body: `Web lookup: ${query}${webPrompt ? `
Prompt: ${webPrompt}` : ""}`,
    filePaths: [],
    extras: {
      ...query ? { webQuery: truncate(query, MAX_PATH_LENGTH) } : {},
      ...webPrompt ? { webPrompt } : {},
      ...allowedDomains ? { webAllowedDomains: allowedDomains } : {},
      ...blockedDomains ? { webBlockedDomains: blockedDomains } : {}
    }
  };
}
function normalizeOutputMode(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "content" || normalized === "files_with_matches" || normalized === "count") return normalized;
  return void 0;
}
function toStringArray(value) {
  if (!Array.isArray(value)) return void 0;
  const items = value.map((entry) => toTrimmedString(entry)).filter((entry) => entry.length > 0);
  return items.length > 0 ? items : void 0;
}
function exploreMatchCount(toolName, raw, text) {
  if (toolName === "Grep") return countLines(text);
  if (toolName === "Glob") return Array.isArray(raw) ? raw.length : countLines(text);
  if (toolName === "WebSearch") return Array.isArray(raw) ? raw.length : void 0;
  return void 0;
}
function countLines(text) {
  if (!text.trim()) return 0;
  return text.split("\n").filter((line) => line.length > 0).length;
}

// src/domain/ingest/model/file.tool.model.ts
import * as path10 from "node:path";
var FILE_TOOLS = ["Edit", "Write", "NotebookEdit"];
function shapeFileTool(call, context) {
  const toolName = call.toolName;
  const filePath = readFilePath(call);
  const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
  const semantic = inferFileToolSemantic(toolName, relPath || void 0);
  const editReplaceAll = toolName === "Edit" && toBoolean(call.toolInput["replace_all"]);
  const metadata = {
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    ...buildSemanticMetadata(semantic),
    toolName,
    ...filePath ? { filePath, relPath } : {},
    ...editReplaceAll ? { editReplaceAll: true } : {},
    ...toolUseIdOf(call),
    ...captureToolResultBody(call.toolResponse)
  };
  return {
    kind: KIND.executeTool,
    lane: LANE.implementation,
    title: relPath ? `${toolName}: ${path10.basename(relPath)}` : toolName,
    body: relPath ? `Modified ${relPath}` : `Used ${toolName}`,
    ...filePath ? { filePaths: [filePath] } : {},
    metadata
  };
}
function readFilePath(call) {
  return toTrimmedString(call.toolInput["file_path"]) || toTrimmedString(call.toolInput["notebook_path"]) || toTrimmedString(call.toolInput["path"]);
}

// src/domain/ingest/model/interaction.tool.model.ts
function shapePlanTool(call) {
  const plan = toTrimmedString(call.toolInput["plan"]);
  const metadata = {
    ...provenEvidence("Observed directly by the ExitPlanMode PostToolUse hook."),
    toolName: call.toolName,
    toolInput: sanitizeToolInput(call.toolInput),
    planSource: "ExitPlanMode",
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.planLogged,
    lane: LANE.planning,
    title: "Exit plan mode",
    ...plan ? { body: plan } : {},
    metadata
  };
}
function shapeQuestionTool(call) {
  const question = toTrimmedString(call.toolInput["question"]);
  const options = Array.isArray(call.toolInput["options"]) ? call.toolInput["options"].filter(
    (option) => typeof option === "string" && option.trim().length > 0
  ) : [];
  const metadata = {
    ...provenEvidence("Observed directly by the AskUserQuestion PostToolUse hook."),
    questionId: call.toolUseId ? `tool-${call.toolUseId}` : `q-${createMessageId()}`,
    questionPhase: "asked",
    toolName: call.toolName,
    toolInput: sanitizeToolInput(call.toolInput),
    ...options.length > 0 ? { options } : {},
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.questionLogged,
    lane: LANE.questions,
    title: question ? `Ask: ${truncate(question, 60)}` : "User question posed",
    ...question ? { body: question } : {},
    metadata
  };
}

// src/domain/ingest/model/terminal.tool.model.ts
var TITLE_MAX = 80;
function shapeTerminalCommand(call) {
  const command = toTrimmedString(call.toolInput["command"]);
  if (!command) return null;
  const isPowerShell = call.toolName === POWERSHELL_TOOL_NAME;
  const toolName = isPowerShell ? POWERSHELL_TOOL_NAME : TERMINAL_COMMAND_TOOL_NAME;
  const description = toTrimmedString(call.toolInput["description"]);
  const timeoutMs = toOptionalNumber(call.toolInput["timeout"]);
  const runInBackground = toBoolean(call.toolInput["run_in_background"]);
  const { lane, metadata: semantic, analysis } = inferCommandSemantic(command);
  const filePaths = collectFileTargets(analysis);
  const captured = captureTerminalToolResponse(call.toolResponse);
  const prompt = isPowerShell ? ">" : "$";
  const metadata = {
    ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
    ...buildSemanticMetadata({ ...semantic, sourceTool: toolName }),
    toolName,
    command,
    commandAnalysis: analysis,
    ...description ? { description } : {},
    ...timeoutMs !== void 0 ? { timeoutMs } : {},
    ...runInBackground ? { runInBackground: true } : {},
    ...toolUseIdOf(call),
    ...captured
  };
  return {
    kind: KIND.executeTool,
    lane,
    title: description || truncate(command, TITLE_MAX),
    body: description ? `${description}

${prompt} ${command}` : command,
    ...filePaths.length > 0 ? { filePaths } : {},
    metadata
  };
}
function shapeBackgroundShell(call) {
  const bashId = toTrimmedString(call.toolInput["bash_id"]) || "?";
  const isRead = call.toolName === "BashOutput";
  const filter = isRead ? toTrimmedString(call.toolInput["filter"]) : "";
  const metadata = {
    ...provenEvidence(`Observed directly by the ${call.toolName} PostToolUse hook.`),
    ...buildSemanticMetadata({
      subtypeKey: isRead ? "shell_probe" : "run_command",
      subtypeLabel: isRead ? "Background shell read" : "Kill background shell",
      subtypeGroup: isRead ? "shell" : "execution",
      toolFamily: "terminal",
      operation: isRead ? "read" : "execute",
      entityType: "shell",
      entityName: bashId,
      sourceTool: call.toolName
    }),
    toolName: call.toolName,
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.executeTool,
    lane: isRead ? LANE.exploration : LANE.implementation,
    title: isRead ? `BashOutput: ${bashId}${filter ? ` /${filter}/` : ""}` : `KillShell: ${bashId}`,
    body: isRead ? `Read output from background shell ${bashId}${filter ? ` (filter ${filter})` : ""}` : `Terminated background shell ${bashId}`,
    metadata
  };
}
function shapeMonitorCommand(call) {
  const script = toTrimmedString(call.toolInput["command"]);
  const description = toTrimmedString(call.toolInput["description"]);
  const metadata = {
    ...provenEvidence("Observed directly by the Monitor PostToolUse hook."),
    ...buildSemanticMetadata({
      subtypeKey: "shell_probe",
      subtypeLabel: "Monitor watch",
      subtypeGroup: "shell",
      toolFamily: "terminal",
      operation: "monitor",
      entityType: "command",
      entityName: script.split(/\s+/)[0] || "monitor",
      sourceTool: MONITOR_TOOL_NAME
    }),
    toolName: MONITOR_TOOL_NAME,
    ...script ? { monitorScript: script } : {},
    ...description ? { monitorDescription: description } : {},
    ...toolUseIdOf(call)
  };
  return {
    kind: KIND.executeTool,
    lane: LANE.background,
    title: description || `Monitor: ${truncate(script, 60)}`,
    body: description ? `${description}

$ ${script}` : script,
    metadata
  };
}

// src/domain/ingest/model/tool.catalog.model.ts
var oneOf = (names) => {
  const set = new Set(names);
  return (toolName) => set.has(toolName);
};
var exactly = (name) => (toolName) => toolName === name;
var CATALOG = [
  { category: "terminal", match: oneOf([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]), shape: shapeTerminalCommand },
  { category: "background_shell", match: oneOf([BASH_OUTPUT_TOOL_NAME, KILL_SHELL_TOOL_NAME]), shape: shapeBackgroundShell },
  { category: "monitor", match: exactly(MONITOR_TOOL_NAME), shape: shapeMonitorCommand },
  { category: "explore", match: oneOf(EXPLORE_TOOLS), shape: shapeExploreTool },
  { category: "lsp", match: exactly(LSP_TOOL_NAME), shape: shapeLspTool },
  { category: "tool_search", match: exactly(TOOL_SEARCH_TOOL_NAME), shape: shapeToolSearch },
  { category: "file", match: oneOf(FILE_TOOLS), shape: shapeFileTool },
  { category: "agent", match: exactly(AGENT_TOOL_NAME), shape: shapeAgentTool },
  { category: "skill", match: exactly(SKILL_TOOL_NAME), shape: shapeSkillTool },
  { category: "mcp", match: (toolName) => toolName.startsWith("mcp__"), shape: shapeMcpTool },
  { category: "cron", match: oneOf(CRON_TOOLS), shape: shapeCronTool },
  { category: "mode_change", match: oneOf(MODE_CHANGE_TOOLS), shape: shapeModeChange },
  { category: "plan", match: exactly(EXIT_PLAN_MODE_TOOL_NAME), shape: shapePlanTool },
  { category: "question", match: exactly(ASK_USER_QUESTION_TOOL_NAME), shape: shapeQuestionTool }
];
function rowOf(toolName) {
  return CATALOG.find((row) => row.match(toolName));
}
function shapeToolEvent(call, context) {
  return rowOf(call.toolName)?.shape(call, context) ?? null;
}
function toolCategoryOf(toolName) {
  return rowOf(toolName)?.category;
}

// src/domain/ingest/model/tool.failure.model.ts
function shapeToolFailure(failure, context) {
  const mcp = parseMcpToolName(failure.toolName);
  if (mcp?.server === SELF_MCP_SERVER) return null;
  const title = `Failed ${failure.toolName}`;
  const body = failure.error || `Tool failed: ${failure.toolName}`;
  const base = {
    ...provenEvidence("Observed directly by the PostToolUseFailure hook."),
    failed: true,
    error: failure.error,
    isInterrupt: failure.isInterrupt,
    errorType: classifyToolError(failure.error, failure.isInterrupt),
    ...toolUseIdOf(failure)
  };
  if (mcp) {
    return {
      kind: KIND.invokeAgent,
      lane: LANE.coordination,
      title,
      body,
      metadata: {
        ...buildSemanticMetadata(inferMcpSemantic(mcp.server, mcp.tool, failure.toolName)),
        ...base,
        activityType: "mcp_call",
        mcpServer: mcp.server,
        mcpTool: mcp.tool
      }
    };
  }
  const isTerminal = toolCategoryOf(failure.toolName) === "terminal";
  const command = isTerminal ? toTrimmedString(failure.toolInput["command"]) : "";
  const description = isTerminal ? toTrimmedString(failure.toolInput["description"]) : "";
  const classification = classify(failure, context, command);
  return {
    kind: KIND.executeTool,
    lane: classification?.lane ?? LANE.implementation,
    toolName: failure.toolName,
    title,
    body,
    ...command ? { command } : {},
    metadata: {
      ...classification ? buildSemanticMetadata(classification.semantic) : {},
      ...description ? { description } : {},
      ...base
    }
  };
}
function classify(failure, context, command) {
  const category = toolCategoryOf(failure.toolName);
  if (category === "terminal" && command) {
    const { lane, metadata } = inferCommandSemantic(command);
    return { lane, semantic: metadata };
  }
  if (category === "file") {
    const filePath = toTrimmedString(failure.toolInput["file_path"]) || toTrimmedString(failure.toolInput["notebook_path"]) || toTrimmedString(failure.toolInput["path"]);
    const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
    return {
      lane: LANE.implementation,
      semantic: inferFileToolSemantic(failure.toolName, relPath || void 0)
    };
  }
  if (category === "skill") {
    const skillName = toTrimmedString(failure.toolInput["skill"]);
    return { lane: LANE.coordination, semantic: inferSkillSemantic(skillName || void 0) };
  }
  if (category === "agent") {
    const agentName = toTrimmedString(failure.toolInput["subagent_type"]);
    return { lane: LANE.coordination, semantic: inferAgentSemantic(agentName || void 0) };
  }
  return null;
}

// src/domain/ingest/application/record.tool.failure.usecase.ts
var RecordToolFailureUsecase = class {
  constructor(sink2, timing, ids2, clock2, runtimeSource, context) {
    this.sink = sink2;
    this.timing = timing;
    this.ids = ids2;
    this.clock = clock2;
    this.runtimeSource = runtimeSource;
    this.context = context;
  }
  sink;
  timing;
  ids;
  clock;
  runtimeSource;
  context;
  async execute(failure, target) {
    const shaped = shapeToolFailure(failure, this.context);
    if (shaped === null) return;
    const timed = withToolDuration(shaped, {
      ...failure.toolUseId ? { toolUseId: failure.toolUseId } : {},
      sessionId: target.sessionId,
      takeStart: (sessionId, toolUseId) => this.timing.takeStart(sessionId, toolUseId),
      now: this.clock.now()
    });
    await this.sink.append(toIngestEvents(
      [toRuntimeEvent(timed, target)],
      this.runtimeSource,
      () => this.ids.next(),
      new Date(this.clock.now()).toISOString()
    ));
  }
};

// src/domain/ingest/application/record.tool.use.usecase.ts
var RecordToolUseUsecase = class {
  constructor(sink2, timing, ids2, clock2, runtimeSource, context) {
    this.sink = sink2;
    this.timing = timing;
    this.ids = ids2;
    this.clock = clock2;
    this.runtimeSource = runtimeSource;
    this.context = context;
  }
  sink;
  timing;
  ids;
  clock;
  runtimeSource;
  context;
  async execute(call, target) {
    const shaped = shapeToolEvent(call, this.context);
    if (shaped === null) return null;
    const timed = withToolDuration(shaped, {
      ...call.toolUseId ? { toolUseId: call.toolUseId } : {},
      sessionId: target.sessionId,
      takeStart: (sessionId, toolUseId) => this.timing.takeStart(sessionId, toolUseId),
      now: this.clock.now()
    });
    await this.sink.append(toIngestEvents(
      [toRuntimeEvent(timed, target)],
      this.runtimeSource,
      () => this.ids.next(),
      new Date(this.clock.now()).toISOString()
    ));
    return timed;
  }
};

// src/domain/recipe/adapter/file.recipe.pending.mark.adapter.ts
import * as fs10 from "node:fs";
var FileRecipePendingMarkAdapter = class {
  constructor(paths = resolveAgentTracerPaths()) {
    this.paths = paths;
  }
  paths;
  read() {
    try {
      const parsed = JSON.parse(fs10.readFileSync(this.paths.recipePendingPath, "utf8"));
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  write(store) {
    try {
      ensureAgentTracerHome(this.paths);
      const tmp = `${this.paths.recipePendingPath}.tmp`;
      fs10.writeFileSync(tmp, JSON.stringify(store));
      fs10.renameSync(tmp, this.paths.recipePendingPath);
    } catch {
      return;
    }
  }
};

// src/config/http.ts
var DEFAULT_TIMEOUT_MS = 5e3;
function jsonHeaders(headers2) {
  return { ...headers2, "Content-Type": "application/json" };
}
function resolveTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS, signal) {
  return signal ?? AbortSignal.timeout(timeoutMs);
}
async function getJson(url, headers2, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await fetch(url, { headers: headers2, signal: resolveTimeoutSignal(timeoutMs) });
  if (!response.ok) return null;
  const parsed = await response.json();
  return isRecord(parsed) ? parsed : null;
}
async function postJson(url, headers2, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, {
    method: "POST",
    headers: jsonHeaders(headers2),
    body: JSON.stringify(body),
    signal: resolveTimeoutSignal(timeoutMs)
  });
}

// src/domain/recipe/adapter/http.recipe.fetch.adapter.ts
var REQUEST_TIMEOUT_MS = 5e3;
var HttpRecipeFetchAdapter = class {
  constructor(baseUrl, headers2) {
    this.baseUrl = baseUrl;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async fetch(recipeId) {
    const body = await getJson(
      `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(recipeId)}`,
      this.headers,
      REQUEST_TIMEOUT_MS
    );
    if (body === null) return null;
    const payload = isRecord(body) && "data" in body ? body["data"] : body;
    return toCachedRecipe(payload);
  }
};
function toCachedRecipe(value) {
  if (!isRecord(value)) return null;
  const id = readString2(value, "id");
  const title = readString2(value, "title");
  if (!id || !title) return null;
  return {
    id,
    title,
    intent: readString2(value, "intent"),
    description: readString2(value, "description"),
    summaryMd: readString2(value, "summaryMd"),
    steps: readSteps(value["steps"]),
    pitfalls: readPitfalls(value["pitfalls"]),
    corrections: readCorrections(value["corrections"]),
    touchedFiles: readTouchedFiles(value["touchedFiles"]),
    governingRules: readStringArray2(value["governingRules"])
  };
}
function readSteps(value) {
  if (!Array.isArray(value)) return [];
  const steps = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const order = entry["order"];
    const action = readString2(entry, "action");
    if (typeof order !== "number" || !action) continue;
    const rationale = readString2(entry, "rationale");
    steps.push({ order, action, ...rationale ? { rationale } : {} });
  }
  return steps;
}
function readPitfalls(value) {
  if (!Array.isArray(value)) return [];
  const pitfalls = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const pitfall = readString2(entry, "pitfall");
    const whyNonObvious = readString2(entry, "whyNonObvious");
    if (pitfall && whyNonObvious) pitfalls.push({ pitfall, whyNonObvious });
  }
  return pitfalls;
}
function readCorrections(value) {
  if (!Array.isArray(value)) return [];
  const corrections = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const whatAgentDid = readString2(entry, "whatAgentDid");
    const howCorrected = readString2(entry, "howCorrected");
    if (whatAgentDid && howCorrected) corrections.push({ whatAgentDid, howCorrected });
  }
  return corrections;
}
function readTouchedFiles(value) {
  if (!Array.isArray(value)) return [];
  const files = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const path12 = readString2(entry, "path");
    const role = entry["role"];
    if (path12 && (role === "read" || role === "write" || role === "both")) files.push({ path: path12, role });
  }
  return files;
}
function readStringArray2(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}
function readString2(source, key) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

// src/domain/recipe/adapter/http.recipe.outcome.report.adapter.ts
var HttpRecipeOutcomeReportAdapter = class {
  constructor(baseUrl, headers2) {
    this.baseUrl = baseUrl;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async report(input) {
    const url = `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(input.recipeId)}/outcome`;
    const response = await postJson(url, this.headers, {
      taskId: input.taskId,
      outcome: input.outcome,
      ...input.note !== void 0 ? { note: input.note } : {}
    });
    return response.ok;
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
  constructor(baseUrl, headers2) {
    this.baseUrl = baseUrl;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async hasActiveScan(taskId) {
    const url = `${this.baseUrl}/api/v1/jobs/latest?kind=${encodeURIComponent(JOB_KIND.recipeScan)}&taskId=${encodeURIComponent(taskId)}`;
    const body = await getJson(url, this.headers);
    const status = body?.data?.job?.status;
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
  constructor(baseUrl, headers2) {
    this.baseUrl = baseUrl;
    this.headers = headers2;
  }
  baseUrl;
  headers;
  async search(query, limit) {
    const url = `${this.baseUrl}/api/v1/recipes/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const body = await getJson(url, this.headers, REQUEST_TIMEOUT_MS2);
    return body === null ? [] : extractItems(body);
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
function pendingRecipeMarkFor(store, taskId) {
  return store[taskId];
}
function markRecipeOpened(store, taskId, recipeId, openedAt) {
  return { ...store, [taskId]: { taskId, recipeId, openedAt } };
}
function clearRecipeMark(store, taskId, recipeId) {
  const existing = store[taskId];
  if (existing === void 0 || existing.recipeId !== recipeId) return store;
  const rest = { ...store };
  delete rest[taskId];
  return rest;
}

// src/domain/recipe/application/clear.recipe.mark.usecase.ts
var ClearRecipeMarkUsecase = class {
  constructor(marks) {
    this.marks = marks;
  }
  marks;
  execute(taskId, recipeId) {
    if (taskId === "" || recipeId === "") return;
    this.marks.write(clearRecipeMark(this.marks.read(), taskId, recipeId));
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
      const recipe2 = await this.fetcher.fetch(recipeId);
      return recipe2 ? buildRecipeBody(recipe2) : null;
    } catch {
      return null;
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
    this.marks.write(markRecipeOpened(this.marks.read(), taskId, recipeId, openedAt));
  }
};

// src/domain/recipe/application/read.pending.recipe.mark.usecase.ts
var ReadPendingRecipeMarkUsecase = class {
  constructor(marks) {
    this.marks = marks;
  }
  marks;
  execute(taskId) {
    if (taskId === "") return void 0;
    return pendingRecipeMarkFor(this.marks.read(), taskId);
  }
};

// src/domain/recipe/application/report.recipe.outcome.usecase.ts
var ReportRecipeOutcomeUsecase = class {
  constructor(reports) {
    this.reports = reports;
  }
  reports;
  async execute(input) {
    if (input.recipeId === "" || input.taskId === "") return false;
    try {
      return await this.reports.report(input);
    } catch {
      return false;
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
var DEFAULT_LIMIT = 3;
var SearchRecipesUsecase = class {
  constructor(search) {
    this.search = search;
  }
  search;
  async execute(input) {
    const query = input.query.trim();
    if (query === "") return [];
    try {
      return await this.search.search(query, input.limit ?? DEFAULT_LIMIT);
    } catch {
      return [];
    }
  }
};

// src/domain/session/model/ensured.session.model.ts
function restored(binding2, firstTitling = false) {
  const turn2 = turnStateOf(binding2);
  return {
    taskId: binding2.taskId,
    sessionId: binding2.sessionId,
    taskCreated: false,
    firstTitling,
    ...turn2 ? { turnId: turn2.turnId } : {}
  };
}

// src/domain/session/model/session.event.model.ts
var SUBAGENT_PREFIX = "sub--";
function subagentSessionId(agentId) {
  return `${SUBAGENT_PREFIX}${agentId}`;
}
function isSubagentSession(runtimeSessionId) {
  return runtimeSessionId.startsWith(SUBAGENT_PREFIX);
}
function subagentTitle(agentId, agentType) {
  return agentType ? `Subagent: ${agentType}` : `Subagent: ${agentId}`;
}
function sessionStartedEvent(taskId, sessionId, input) {
  return {
    kind: KIND.sessionStarted,
    taskId,
    sessionId,
    payload: {
      runtimeSource: input.runtimeSource,
      runtimeSessionId: input.runtimeSessionId,
      title: input.title,
      ...input.workspacePath ? { workspacePath: input.workspacePath } : {},
      ...input.parentTaskId ? { parentTaskId: input.parentTaskId } : {},
      ...input.parentSessionId ? { parentSessionId: input.parentSessionId } : {},
      ...input.taskKind ? { taskKind: input.taskKind } : {},
      ...input.origin ? { origin: input.origin } : {},
      ...input.resume !== void 0 ? { resume: input.resume } : {}
    }
  };
}
function taskLinkedEvent(taskId, title) {
  return { kind: KIND.taskLinked, taskId, payload: { title } };
}
function sessionEndedEvent(input) {
  return {
    kind: KIND.sessionEnded,
    taskId: input.taskId,
    sessionId: input.sessionId,
    ...input.turnId ? { turnId: input.turnId } : {},
    payload: {
      runtimeSource: input.runtimeSource,
      runtimeSessionId: input.runtimeSessionId,
      summary: input.summary,
      completionReason: input.completionReason,
      completeTask: input.completeTask
    }
  };
}

// src/domain/session/application/clear.session.usecase.ts
var ClearSessionUsecase = class {
  constructor(bindings2, sink2, ids2, clock2) {
    this.bindings = bindings2;
    this.sink = sink2;
    this.ids = ids2;
    this.clock = clock2;
  }
  bindings;
  sink;
  ids;
  clock;
  async execute(input) {
    const key = bindingKey(input.runtimeSource, input.runtimeSessionId);
    if (!await this.bindings.acquireLock()) {
      const contended = this.bindings.read()[key];
      if (contended) return restored(contended);
      throw new Error("bindings lock unavailable, cannot clear session binding");
    }
    let created;
    let predecessor;
    try {
      const store = this.bindings.read();
      predecessor = input.runtimePid === void 0 ? void 0 : mostRecentBindingWhere(store, (candidate) => candidate.runtimePid === input.runtimePid && candidate.supersededBy === void 0 && bindingKey(candidate.runtimeSource, candidate.runtimeSessionId) !== key && !isSubagentSession(candidate.runtimeSessionId));
      created = {
        taskId: this.ids.next(),
        sessionId: this.ids.next(),
        runtimeSource: input.runtimeSource,
        runtimeSessionId: input.runtimeSessionId,
        ...input.workspacePath ? { workspacePath: input.workspacePath } : {},
        ...input.runtimePid !== void 0 ? { runtimePid: input.runtimePid } : {},
        createdAt: new Date(this.clock.now()).toISOString(),
        titled: input.titled ?? true
      };
      store[key] = created;
      if (predecessor) {
        store[bindingKey(predecessor.runtimeSource, predecessor.runtimeSessionId)] = {
          ...predecessor,
          supersededBy: input.runtimeSessionId
        };
      }
      this.bindings.write(capBindingStore(store));
    } finally {
      this.bindings.releaseLock();
    }
    if (predecessor) {
      await this.append(sessionEndedEvent({
        taskId: predecessor.taskId,
        sessionId: predecessor.sessionId,
        runtimeSource: input.runtimeSource,
        runtimeSessionId: predecessor.runtimeSessionId,
        summary: "Claude Code conversation cleared (/clear)",
        completionReason: "cleared",
        completeTask: true
      }));
    }
    await this.append(sessionStartedEvent(created.taskId, created.sessionId, {
      runtimeSource: input.runtimeSource,
      runtimeSessionId: input.runtimeSessionId,
      title: input.title,
      ...input.workspacePath ? { workspacePath: input.workspacePath } : {}
    }));
    return { taskId: created.taskId, sessionId: created.sessionId, taskCreated: true, firstTitling: false };
  }
  async append(event) {
    await this.sink.append([toRunIngestEvent(
      event,
      new Date(this.clock.now()).toISOString(),
      () => this.ids.next()
    )]);
  }
};

// src/domain/session/application/end.session.usecase.ts
var EndSessionUsecase = class {
  constructor(sink2, ids2, clock2) {
    this.sink = sink2;
    this.ids = ids2;
    this.clock = clock2;
  }
  sink;
  ids;
  clock;
  async execute(input) {
    await this.sink.append([toRunIngestEvent(
      sessionEndedEvent(input),
      new Date(this.clock.now()).toISOString(),
      () => this.ids.next()
    )]);
  }
};

// src/domain/session/application/ensure.session.usecase.ts
var EnsureSessionUsecase = class {
  constructor(bindings2, sink2, ids2, clock2) {
    this.bindings = bindings2;
    this.sink = sink2;
    this.ids = ids2;
    this.clock = clock2;
  }
  bindings;
  sink;
  ids;
  clock;
  async execute(input) {
    const key = bindingKey(input.runtimeSource, input.runtimeSessionId);
    const titled = input.titled ?? true;
    if (!await this.bindings.acquireLock()) {
      const contended = this.bindings.read()[key];
      if (contended) return restored(contended);
      throw new Error("bindings lock unavailable, cannot create session binding");
    }
    let created;
    let existing;
    let retitled = false;
    let firstTitling = false;
    let resumedFromPrior;
    try {
      const store = this.bindings.read();
      existing = store[key];
      if (!existing) {
        resumedFromPrior = input.resumedFrom ? store[bindingKey(input.runtimeSource, input.resumedFrom)] : void 0;
        created = {
          taskId: resumedFromPrior?.taskId ?? (input.taskId?.trim() || this.ids.next()),
          sessionId: this.ids.next(),
          runtimeSource: input.runtimeSource,
          runtimeSessionId: input.runtimeSessionId,
          ...input.workspacePath ? { workspacePath: input.workspacePath } : {},
          ...input.runtimePid !== void 0 ? { runtimePid: input.runtimePid } : {},
          createdAt: new Date(this.clock.now()).toISOString(),
          titled,
          ...resumedFromPrior ? { resumed: true } : {}
        };
        store[key] = created;
        this.bindings.write(capBindingStore(store));
      } else if (titled && existing.titled !== true) {
        firstTitling = existing.resumed !== true;
        existing = { ...existing, titled: true };
        store[key] = existing;
        this.bindings.write(store);
        retitled = true;
      }
    } finally {
      this.bindings.releaseLock();
    }
    if (existing) {
      if (retitled) await this.append(taskLinkedEvent(existing.taskId, input.title));
      return restored(existing, firstTitling);
    }
    if (!created) throw new Error("session binding was not created");
    await this.append(sessionStartedEvent(created.taskId, created.sessionId, {
      ...input,
      ...resumedFromPrior ? { parentSessionId: resumedFromPrior.sessionId, resume: true } : {}
    }));
    return {
      taskId: created.taskId,
      sessionId: created.sessionId,
      taskCreated: !resumedFromPrior,
      firstTitling: !resumedFromPrior && titled
    };
  }
  async append(event) {
    await this.sink.append([toRunIngestEvent(
      event,
      new Date(this.clock.now()).toISOString(),
      () => this.ids.next()
    )]);
  }
};

// src/domain/session/inbound/session.hook.ts
function onSessionStart(hook, input) {
  return hook.ensureSession.execute(input);
}

// src/domain/turn/model/turn.span.model.ts
var MESSAGE_HEAD_CHARS = 32768;
var MESSAGE_TAIL_CHARS = 32768;
function capTurnMessage(text) {
  return truncateOutput(text, MESSAGE_HEAD_CHARS, MESSAGE_TAIL_CHARS).body;
}
function buildTurnSpan(turn2, input, now) {
  const turnId = turn2?.turnId ?? input.fallbackTurnId;
  const startedAt = turn2?.startedAt ?? input.sessionStartedAt ?? new Date(now).toISOString();
  const durationMs = Math.max(0, now - Date.parse(startedAt));
  const event = {
    id: turnId,
    turnId,
    kind: KIND.invokeAgent,
    taskId: input.taskId,
    sessionId: input.sessionId,
    lane: LANE.coordination,
    title: `\uC5D0\uC774\uC804\uD2B8 \uD134 (${input.stopReason})`,
    metadata: {
      ...provenEvidence("\uD134 \uACBD\uACC4 \uD6C5\uC774 \uAD00\uCE21\uD588\uB2E4."),
      activityType: TURN_ACTIVITY_TYPE,
      agentName: input.agentName,
      ...Number.isFinite(durationMs) ? { durationMs } : {},
      [SEMCONV_ATTR.responseFinishReasons]: input.stopReason,
      ...turn2?.prompt ? { [SEMCONV_ATTR.inputMessages]: toGenAiMessage("user", turn2.prompt) } : {},
      ...input.response ? { [SEMCONV_ATTR.outputMessages]: toGenAiMessage("assistant", capTurnMessage(input.response)) } : {},
      ...turn2?.previousTurnId ? { [AGENT_TRACER_ATTR.turnPreviousId]: turn2.previousTurnId } : {}
    }
  };
  return { turnId, event };
}

// src/domain/turn/application/close.turn.usecase.ts
var CloseTurnUsecase = class {
  constructor(bindings2, sink2, ids2, clock2, runtimeSource) {
    this.bindings = bindings2;
    this.sink = sink2;
    this.ids = ids2;
    this.clock = clock2;
    this.runtimeSource = runtimeSource;
  }
  bindings;
  sink;
  ids;
  clock;
  runtimeSource;
  async execute(input) {
    const binding2 = this.bindings.read()[bindingKey(input.runtimeSource, input.runtimeSessionId)];
    const now = this.clock.now();
    const span = buildTurnSpan(turnStateOf(binding2), {
      ...input,
      ...binding2 ? { sessionStartedAt: binding2.createdAt } : {}
    }, now);
    await this.sink.append(toIngestEvents(
      [span.event],
      this.runtimeSource,
      () => this.ids.next(),
      new Date(now).toISOString()
    ));
    return span.turnId;
  }
};

// src/domain/turn/application/open.turn.usecase.ts
var OpenTurnUsecase = class {
  constructor(bindings2, clock2) {
    this.bindings = bindings2;
    this.clock = clock2;
  }
  bindings;
  clock;
  async execute(input) {
    if (!await this.bindings.acquireLock()) return;
    try {
      const store = this.bindings.read();
      const key = bindingKey(input.runtimeSource, input.runtimeSessionId);
      const existing = store[key];
      if (!existing) return;
      const previous = turnStateOf(existing);
      store[key] = {
        ...existing,
        currentTurnId: input.turnId,
        turnStartedAt: new Date(this.clock.now()).toISOString(),
        turnPrompt: capTurnMessage(input.prompt),
        ...previous ? { previousTurnId: previous.turnId } : {}
      };
      this.bindings.write(store);
    } finally {
      this.bindings.releaseLock();
    }
  }
};

// src/agent/claude-code/transcript/transcript.resume.ts
import * as fs11 from "node:fs";
import * as readline from "node:readline";

// src/agent/claude-code/transcript/transcript.reader.ts
var TRANSCRIPT_READ_MAX_BYTES = 1024 * 1024;
function parseJsonLine(line) {
  const trimmed2 = line.trim();
  if (!trimmed2) return null;
  try {
    const parsed = JSON.parse(trimmed2);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// src/agent/claude-code/transcript/transcript.resume.ts
var RESUME_SCAN_MAX_LINES = 2e4;
function findResumedSessionId(transcriptPath, currentSessionId, maxLines = RESUME_SCAN_MAX_LINES) {
  if (!transcriptPath || !fs11.existsSync(transcriptPath)) return Promise.resolve(void 0);
  return new Promise((resolve2) => {
    let resumedFrom;
    let lineCount = 0;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve2(value);
    };
    const stream = fs11.createReadStream(transcriptPath, { encoding: "utf8" });
    stream.on("error", () => finish(void 0));
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on("error", () => finish(void 0));
    rl.on("line", (line) => {
      lineCount += 1;
      if (lineCount > maxLines) {
        rl.close();
        stream.destroy();
        return;
      }
      const parsed = parseJsonLine(line);
      if (!parsed) return;
      const sessionId = parsed["session_id"];
      if (typeof sessionId === "string" && sessionId && sessionId !== currentSessionId) {
        resumedFrom = sessionId;
      }
    });
    rl.on("close", () => finish(resumedFrom));
  });
}

// src/agent/claude-code/runtime.ts
var transport = resolveMonitorTransportConfig();
var headers = monitorUserHeaders(resolveMonitorIdentity());
var projectDir = resolveProjectDir();
var sink = new SpoolEventSinkAdapter();
var bindings = new FileBindingStoreAdapter();
var todoSnapshots = new FileTodoSnapshotAdapter(projectDir);
var toolTiming = new FileToolTimingAdapter(projectDir);
var recipeJobs = new HttpRecipeScanJobAdapter(transport.baseUrl, headers);
var shapeContext = { projectDir };
var ids = { next: generateUlid };
var clock = { now: () => Date.now() };
var ingest = {
  appendEvents: new AppendEventsUsecase(sink, ids, clock, CLAUDE_RUNTIME_SOURCE),
  recordToolUse: new RecordToolUseUsecase(sink, toolTiming, ids, clock, CLAUDE_RUNTIME_SOURCE, shapeContext),
  recordToolFailure: new RecordToolFailureUsecase(
    sink,
    toolTiming,
    ids,
    clock,
    CLAUDE_RUNTIME_SOURCE,
    shapeContext
  ),
  recordTodo: new RecordTodoUsecase(sink, todoSnapshots, ids, clock, CLAUDE_RUNTIME_SOURCE),
  markToolStart: new MarkToolStartUsecase(toolTiming, clock)
};
var session = {
  ensureSession: new EnsureSessionUsecase(bindings, sink, ids, clock),
  endSession: new EndSessionUsecase(sink, ids, clock),
  clearSession: new ClearSessionUsecase(bindings, sink, ids, clock)
};
var turn = {
  openTurn: new OpenTurnUsecase(bindings, clock),
  closeTurn: new CloseTurnUsecase(bindings, sink, ids, clock, CLAUDE_RUNTIME_SOURCE)
};
var binding = {
  readBinding: new ReadBindingUsecase(bindings),
  releaseBinding: new ReleaseBindingUsecase(bindings)
};
var recipe = {
  getRecipe: new GetRecipeUsecase(new HttpRecipeFetchAdapter(transport.baseUrl, headers)),
  requestScan: new RequestRecipeScanUsecase(recipeJobs),
  reportOutcome: new ReportRecipeOutcomeUsecase(new HttpRecipeOutcomeReportAdapter(transport.baseUrl, headers)),
  searchRecipes: new SearchRecipesUsecase(new HttpRecipeSearchAdapter(transport.baseUrl, headers))
};
var recipeOutcomeMark = {
  markOpened: new MarkRecipeOpenedUsecase(new FileRecipePendingMarkAdapter(), clock),
  clearMark: new ClearRecipeMarkUsecase(new FileRecipePendingMarkAdapter()),
  readPendingMark: new ReadPendingRecipeMarkUsecase(new FileRecipePendingMarkAdapter())
};
var logger = createHookLogger({
  logFile: path11.join(projectDir, ".claude", "hooks.log"),
  verbose: isVerboseLogging()
});
var claudeRuntime = {
  runtimeSource: CLAUDE_RUNTIME_SOURCE,
  projectDir,
  logger,
  ingest,
  session,
  turn,
  binding,
  recipe,
  recipeOutcomeMark,
  todoSnapshots
};
async function runHook(name, script) {
  let raw;
  try {
    raw = await readStdinJson();
  } catch (error) {
    logger.log(name, "stdin_read_error", { error: messageOf(error) });
    return;
  }
  logger.logPayload(name, raw);
  const parsed = script.parse(raw);
  if (!parsed.ok) {
    logger.log(name, "skipped", { reason: parsed.reason });
    return;
  }
  try {
    await ensureDaemonRunning();
    await script.handler(parsed.value);
  } catch (error) {
    logger.log(name, "handler_error", {
      error: messageOf(error),
      ...error instanceof Error && error.stack !== void 0 ? { stack: error.stack } : {}
    });
  }
}
async function resolveResumedFrom(runtimeSessionId, transcriptPath) {
  if (!transcriptPath) return void 0;
  const key = bindingKey(CLAUDE_RUNTIME_SOURCE, runtimeSessionId);
  if (bindings.read()[key]) return void 0;
  return findResumedSessionId(transcriptPath, runtimeSessionId);
}
async function ensureClaudeSession(runtimeSessionId, title, options = {}) {
  const explicitTitle = transport.taskTitleOverride ?? title;
  const resumedFrom = await resolveResumedFrom(runtimeSessionId, options.transcriptPath);
  return onSessionStart(session, {
    runtimeSource: CLAUDE_RUNTIME_SOURCE,
    runtimeSessionId,
    title: explicitTitle ?? defaultTaskTitle(projectDir),
    titled: explicitTitle !== void 0,
    workspacePath: projectDir,
    runtimePid: process.ppid,
    ...transport.taskIdOverride !== void 0 ? { taskId: transport.taskIdOverride } : {},
    ...transport.taskOriginOverride !== void 0 ? { origin: transport.taskOriginOverride } : {},
    ...options.parentTaskId !== void 0 ? { parentTaskId: options.parentTaskId } : {},
    ...options.parentSessionId !== void 0 ? { parentSessionId: options.parentSessionId } : {},
    ...options.taskKind !== void 0 ? { taskKind: options.taskKind } : {},
    ...options.resume === false ? { resume: false } : {},
    ...resumedFrom !== void 0 ? { resumedFrom } : {}
  });
}
async function ensureSubagentSession(parentSessionId, agentId, agentType, parent, transcriptPath) {
  const parentIds = parent ?? await ensureClaudeSession(parentSessionId, void 0, { transcriptPath });
  return ensureBackgroundSession(
    parentIds,
    subagentSessionId(agentId),
    subagentTitle(agentId, agentType)
  );
}
function ensureBackgroundSession(parent, childRuntimeSessionId, childTitle) {
  return ensureClaudeSession(childRuntimeSessionId, childTitle, {
    parentTaskId: parent.taskId,
    parentSessionId: parent.sessionId,
    taskKind: "background"
  });
}
function resolveEventSession(sessionId, agentId, agentType, transcriptPath) {
  if (agentId !== void 0) {
    return ensureSubagentSession(sessionId, agentId, agentType, void 0, transcriptPath);
  }
  return ensureClaudeSession(sessionId, void 0, { transcriptPath });
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/domain/ingest/inbound/tool.hook.ts
function onToolFailure(hook, failure, target) {
  return hook.recordToolFailure.execute(failure, target);
}

// src/agent/claude-code/hooks/PostToolUseFailure.ts
await runHook("PostToolUseFailure", {
  parse: readPostToolUseFailure,
  handler: async (payload) => {
    const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType, payload.transcriptPath);
    const failure = {
      toolName: payload.toolName,
      toolInput: payload.toolInput,
      toolResponse: payload.payload["tool_response"],
      ...payload.toolUseId !== void 0 ? { toolUseId: payload.toolUseId } : {},
      error: payload.error,
      isInterrupt: payload.isInterrupt
    };
    await onToolFailure(claudeRuntime.ingest, failure, target);
  }
});
