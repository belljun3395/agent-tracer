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
    recipesCachePath: path2.join(cacheDir, "recipes.json"),
    configPath: path2.join(homeDir, "config.json"),
    bindingsPath: path2.join(homeDir, "bindings.json"),
    bindingsLockPath: path2.join(homeDir, "bindings.lock"),
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

// src/daemon/port/mcp.socket.port.ts
function parseDaemonRecipeSearchResponse(value) {
  return isRecord(value) && Array.isArray(value["matches"]) ? { matches: value["matches"] } : null;
}
function parseDaemonRecipeOutcomeResponse(value) {
  if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
  return {
    ok: value["ok"],
    ...typeof value["reason"] === "string" ? { reason: value["reason"] } : {}
  };
}
function parseDaemonRecipeScanResponse(value) {
  if (!isRecord(value) || typeof value["queued"] !== "boolean") return null;
  return {
    queued: value["queued"],
    ...typeof value["reason"] === "string" ? { reason: value["reason"] } : {}
  };
}
function parseDaemonSetTaskTitleResponse(value) {
  if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
  return {
    ok: value["ok"],
    ...typeof value["reason"] === "string" ? { reason: value["reason"] } : {}
  };
}
function parseDaemonMemoCreateResponse(value) {
  if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
  return {
    ok: value["ok"],
    ...typeof value["reason"] === "string" ? { reason: value["reason"] } : {}
  };
}
function parseDaemonMemoSearchResponse(value) {
  if (!isRecord(value) || !Array.isArray(value["items"])) return null;
  return {
    items: value["items"],
    ...typeof value["reason"] === "string" ? { reason: value["reason"] } : {}
  };
}

// src/daemon/ipc/mcp.client.ts
var REQUEST_TIMEOUT_MS = 3e3;
var EMPTY_SEARCH = { matches: [] };
var NO_DAEMON_OUTCOME = { ok: false, reason: "daemon_unreachable" };
var NO_DAEMON_SCAN = { queued: false, reason: "daemon_unreachable" };
var NO_DAEMON_TITLE = { ok: false, reason: "daemon_unreachable" };
var NO_DAEMON_MEMO_CREATE = { ok: false, reason: "daemon_unreachable" };
var NO_DAEMON_MEMO_SEARCH = { items: [], reason: "daemon_unreachable" };
async function searchRecipesViaDaemon(query, limit) {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      {
        type: "recipe-search",
        query,
        ...limit !== void 0 ? { limit } : {}
      },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonRecipeSearchResponse(parsed) ?? EMPTY_SEARCH,
      EMPTY_SEARCH
    );
  } catch {
    return EMPTY_SEARCH;
  }
}
async function reportRecipeOutcomeViaDaemon(recipeId, outcome, note) {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      {
        type: "recipe-outcome",
        recipeId,
        outcome,
        ...note !== void 0 ? { note } : {}
      },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonRecipeOutcomeResponse(parsed) ?? NO_DAEMON_OUTCOME,
      NO_DAEMON_OUTCOME
    );
  } catch {
    return NO_DAEMON_OUTCOME;
  }
}
async function requestRecipeScanViaDaemon() {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      { type: "recipe-scan-request" },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonRecipeScanResponse(parsed) ?? NO_DAEMON_SCAN,
      NO_DAEMON_SCAN
    );
  } catch {
    return NO_DAEMON_SCAN;
  }
}
async function setTaskTitleViaDaemon(title, sessionId) {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      { type: "set-task-title", title, sessionId },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonSetTaskTitleResponse(parsed) ?? NO_DAEMON_TITLE,
      NO_DAEMON_TITLE
    );
  } catch {
    return NO_DAEMON_TITLE;
  }
}
async function createMemoViaDaemon(body, eventId) {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      {
        type: "memo-create",
        body,
        ...eventId !== void 0 ? { eventId } : {}
      },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonMemoCreateResponse(parsed) ?? NO_DAEMON_MEMO_CREATE,
      NO_DAEMON_MEMO_CREATE
    );
  } catch {
    return NO_DAEMON_MEMO_CREATE;
  }
}
async function searchMemosViaDaemon(query, limit) {
  const paths = resolveAgentTracerPaths();
  try {
    return await requestDaemon(
      paths.socketPath,
      {
        type: "memo-search",
        ...query !== void 0 ? { query } : {},
        ...limit !== void 0 ? { limit } : {}
      },
      REQUEST_TIMEOUT_MS,
      (parsed) => parseDaemonMemoSearchResponse(parsed) ?? NO_DAEMON_MEMO_SEARCH,
      NO_DAEMON_MEMO_SEARCH
    );
  } catch {
    return NO_DAEMON_MEMO_SEARCH;
  }
}

// src/daemon/ipc/hook.client.ts
import { spawn } from "node:child_process";
import * as fs4 from "node:fs";
import * as path3 from "node:path";

// src/daemon/lifecycle/daemon.pid.ts
import * as fs3 from "node:fs";
function readDaemonPid(paths) {
  const pid = readPidFile(paths);
  if (pid === void 0 || pid === process.pid) return void 0;
  return isProcessAlive(pid) ? pid : void 0;
}
function readPidFile(paths) {
  let raw;
  try {
    raw = fs3.readFileSync(paths.pidPath, "utf8");
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
  if (fs4.existsSync(compiled)) return { executable: process.execPath, args: [compiled] };
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
    logFd = fs4.openSync(paths.logPath, "a");
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
    fs4.closeSync(logFd);
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

// src/domain/memo/model/create.memo.tool.model.ts
var CREATE_MEMO_TOOL = {
  name: "create_memo",
  description: "Leave a short note on the current task in Agent Tracer, visible to the human operator later. Call this when you notice something worth flagging for a human but that does not belong in your normal response \u2014 an assumption you made, a workaround you had to use, or a risk you could not resolve yourself. Best-effort: this tool cannot see which session it is attached to, so it attaches to whichever task in this workspace was most recently active. If several sessions or subagents may be active at once, expect it to occasionally land on the wrong task.",
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
  description: "Read notes left on the current task in Agent Tracer. Call this when you want to check what a human or a prior agent run already flagged before you repeat work or make a decision. Omit query to list every memo on the active task; pass query to narrow to memos whose text matches.",
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

// src/domain/recipe/model/report.recipe.outcome.tool.model.ts
var REPORT_RECIPE_OUTCOME_TOOL = {
  name: "report_recipe_outcome",
  description: "Report whether a recipe you followed actually helped on this task. Call this once you can judge the result \u2014 right after finishing the work the recipe guided, or as soon as you abandon the recipe partway through because it did not fit. This is the only feedback signal recipe effectiveness is measured by: call it every time you acted on a recipe, whether you found it with search_recipes or it arrived in your context, even when the outcome was mixed or negative.",
  inputSchema: {
    type: "object",
    properties: {
      recipeId: {
        type: "string",
        description: "The recipeId from a search_recipes result or from a recipe block in your context."
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
  description: "Ask Agent Tracer to scan this task for reusable patterns and turn them into a recipe candidate for later review. Call this near the end of a task, once you judge that the approach you used \u2014 a non-obvious fix, a multi-step setup, a workaround worth remembering \u2014 would be worth reusing the next time this kind of work comes up in this workspace. Equivalent to the user typing /recipe. Runs in the background and does not return the recipe itself, so don't call this expecting immediate output.",
  inputSchema: { type: "object", properties: {} }
};

// src/domain/recipe/model/search.recipes.tool.model.ts
var SEARCH_RECIPES_TOOL = {
  name: "search_recipes",
  description: "Search this workspace's saved task recipes \u2014 reusable workflows distilled from how past tasks here were actually solved. Call this BEFORE you start substantive work whenever the user's request plausibly repeats a pattern this workspace has handled before: a familiar setup, migration, recurring fix, or multi-step workflow. Matches come back with their full guidance already included (intent, description, and the recorded steps), so one search is usually enough to act on without a follow-up lookup. Skip this for requests that are clearly one-off, novel, or trivial.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The user's request or task, in your own words." },
      limit: { type: "number", description: "Max recipes to return (default 3, max 10)." }
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

// src/domain/session/model/set.task.title.tool.model.ts
var SET_TASK_TITLE_TOOL = {
  name: "set_task_title",
  description: `Rename the current task in Agent Tracer's dashboard. A task opens with a crude placeholder title \u2014 for a user session, the first 120 characters of the initial prompt; for a subagent, "Subagent: <type>". Set a real title once you understand what the work is actually about AND it is a meaningful, trackable task worth its own name: as the primary agent, right after the first exchange; as a subagent, right after you grasp the delegated task you are starting. Judge first \u2014 if the request is trivial, throwaway, or a one-off question where the placeholder already reads fine, skip it. Give a short, specific, human-readable title (a few words to a short sentence). This tool cannot see which session it is attached to on its own \u2014 you must pass the sessionId given to you in the injected task-title context exactly as provided; do not invent one, and do not call this tool if you were not given that value. Title once, promptly, and re-title only if the scope later shifts substantially.`,
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, specific task title (a few words to a short sentence)." },
      sessionId: {
        type: "string",
        description: "The sessionId provided to you in the injected task-title context. Pass it exactly; do not invent one."
      }
    },
    required: ["title", "sessionId"]
  }
};
function parseSetTaskTitleArgs(value) {
  if (!isRecord(value)) return null;
  const title = value["title"];
  const sessionId = value["sessionId"];
  if (typeof title !== "string" || title.trim() === "") return null;
  if (typeof sessionId !== "string" || sessionId.trim() === "") return null;
  return { title: title.trim(), sessionId };
}

// src/agent/claude-code/mcp/tool.dispatch.ts
var MCP_TOOLS = [
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
function formatSearchResult(matches) {
  if (matches.length === 0) return "No matching recipes found in this workspace.";
  return matches.map((match) => `## ${match.title} (recipeId: ${match.recipeId}, score ${match.score.toFixed(2)})
intent: ${match.intent}
${match.description}

${match.summaryMd}`).join("\n\n---\n\n");
}
function formatMemoSearchResult(items) {
  if (items.length === 0) return "No memos found on the active task.";
  return items.map((item) => `## memo ${item.id} (author: ${item.author}${item.eventId ? `, event: ${item.eventId}` : ""})
${item.body}`).join("\n\n---\n\n");
}
async function callTool(name, args) {
  await ensureDaemonRunning();
  switch (name) {
    case SEARCH_RECIPES_TOOL.name: {
      const parsed = parseSearchRecipesArgs(args);
      if (!parsed) return invalidArgs();
      const { matches } = await searchRecipesViaDaemon(parsed.query, parsed.limit);
      return { text: formatSearchResult(matches), isError: false };
    }
    case REPORT_RECIPE_OUTCOME_TOOL.name: {
      const parsed = parseReportRecipeOutcomeArgs(args);
      if (!parsed) return invalidArgs();
      const result = await reportRecipeOutcomeViaDaemon(parsed.recipeId, parsed.outcome, parsed.note);
      return result.ok ? { text: "Outcome recorded.", isError: false } : { text: `Could not record outcome${result.reason ? ` (${result.reason})` : ""}.`, isError: true };
    }
    case REQUEST_RECIPE_SCAN_TOOL.name: {
      const result = await requestRecipeScanViaDaemon();
      return result.queued ? { text: "Recipe scan queued.", isError: false } : { text: `Scan not queued${result.reason ? ` (${result.reason})` : ""}.`, isError: true };
    }
    case SET_TASK_TITLE_TOOL.name: {
      const parsed = parseSetTaskTitleArgs(args);
      if (!parsed) return invalidArgs();
      const result = await setTaskTitleViaDaemon(parsed.title, parsed.sessionId);
      return result.ok ? { text: "Task title updated.", isError: false } : { text: `Could not update title${result.reason ? ` (${result.reason})` : ""}.`, isError: true };
    }
    case CREATE_MEMO_TOOL.name: {
      const parsed = parseCreateMemoArgs(args);
      if (!parsed) return invalidArgs();
      const result = await createMemoViaDaemon(parsed.body, parsed.eventId);
      return result.ok ? { text: "Memo saved.", isError: false } : { text: `Could not save memo${result.reason ? ` (${result.reason})` : ""}.`, isError: true };
    }
    case SEARCH_MEMOS_TOOL.name: {
      const parsed = parseSearchMemosArgs(args);
      if (!parsed) return invalidArgs();
      const result = await searchMemosViaDaemon(parsed.query, parsed.limit);
      return { text: formatMemoSearchResult(result.items), isError: false };
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
var INSTRUCTIONS = "This workspace's activity is observed by Agent Tracer. search_recipes looks up saved recipes (reusable workflows distilled from past tasks in this workspace), report_recipe_outcome feeds back whether a recipe you used actually helped \u2014 the only signal recipe quality is judged by \u2014 request_recipe_scan asks for this task itself to be distilled into a new recipe candidate, and set_task_title corrects this task's crude auto-generated title once its real scope is clear. Each tool's own description states exactly when to call it; this note is only the overall picture.";
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
