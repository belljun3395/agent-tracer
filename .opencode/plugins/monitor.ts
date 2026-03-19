/**
 * @module .opencode/plugins/monitor
 *
 * OpenCode용 Agent Tracer 자동 모니터링 플러그인.
 *
 * 세션 시작 시 태스크를 생성하고, 모든 도구 사용을 자동으로 기록.
 * 세션 종료 시 태스크를 완료 처리.
 *
 * 환경변수:
 *   MONITOR_PORT  - 서버 포트 (기본값: 3847)
 *   MONITOR_BASE_URL - 전체 서버 URL (지정 시 MONITOR_PORT 대신 사용)
 */
import type { Hooks, Plugin } from "@opencode-ai/plugin";

const BASE_URL = process.env.MONITOR_BASE_URL?.replace(/\/+$/, "")
  ?? `http://127.0.0.1:${process.env.MONITOR_PORT ?? "3847"}`;
const DEBUG_EXIT = /^(1|true|yes|on)$/i.test(String(process.env.MONITOR_DEBUG_EXIT ?? ""));

interface SessionState {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly monitorSessionId?: string | undefined;
  readonly taskKind: "primary" | "background";
  /**
   * true when the DB row is confirmed to be `background`:
   * - set at task-start if a pendingBackgroundLink was already present, or
   * - set after a successful /api/task-link response during late backfill.
   * If false while taskKind is "background", the DB row may still be "primary"
   * (link POST failed or has not been attempted yet).
   */
  readonly backgroundLinkConfirmed: boolean;
  readonly parentTaskId?: string | undefined;
  readonly parentSessionId?: string | undefined;
  readonly backgroundTaskId?: string | undefined;
  readonly backgroundTitle?: string | undefined;
  messageCount: number; // mutable: tracks user messages for phase detection
  seenMessageIds: Set<string>;
  seenCompletionMessageIds: Set<string>;
  seenToolCallIds: Set<string>;
  todoStateById: Map<string, "added" | "in_progress" | "completed" | "cancelled">;
}

interface BackgroundTaskLink {
  readonly childSessionId: string;
  readonly parentTaskId: string;
  readonly parentSessionId?: string | undefined;
  readonly backgroundTaskId?: string | undefined;
  readonly title?: string | undefined;
  readonly taskId?: string | undefined;
}

type MonitorSemanticRoute = {
  endpoint: "/api/question" | "/api/todo" | "/api/thought";
  body: Record<string, unknown>;
};

type TaskStartResult = {
  readonly task?: { id: string };
  readonly sessionId?: string;
};

const sessionStates = new Map<string, SessionState>();
const pendingSessionStarts = new Map<string, Promise<SessionState | undefined>>();
const pendingBackgroundLinks = new Map<string, BackgroundTaskLink>();
const sessionInfoById = new Map<string, { directory?: string; title?: string }>();
const endedSessionIds = new Set<string>();
const suspendedSessionIds = new Set<string>();
const suspendedSessionStates = new Map<string, SessionState>();
const finalizingSessionIds = new Set<string>();

/**
 * JSON POST 헬퍼. 오류 시 조용히 무시 (에이전트 동작 방해하지 않음).
 */
async function post(endpoint: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null; // 서버 미가용 시 조용히 무시
  }
}

function debugExitLog(message: string, payload?: Record<string, unknown>): void {
  if (!DEBUG_EXIT) return;
  if (payload) {
    console.warn(`[monitor-plugin][exit] ${message}`, payload);
    return;
  }
  console.warn(`[monitor-plugin][exit] ${message}`);
}

/**
 * 도구명을 분석하여 적절한 모니터링 엔드포인트와 레인을 결정.
 * @param toolName OpenCode가 실행한 도구 이름
 */
function classifyTool(toolName: string): { endpoint: string; lane?: string; activityType?: string } {
  const lower = toolName.toLowerCase();

  if (isTodoWriteTool(lower)) {
    return { endpoint: "/api/todo", lane: "todos" };
  }

  if (/read|glob|grep|search|fetch|find|list/.test(lower)) {
    return { endpoint: "/api/explore" };
  }

  if (/edit|write|create|patch|apply/.test(lower)) {
    return { endpoint: "/api/tool-used", lane: "implementation" };
  }

  if (/bash|shell|run|exec|terminal/.test(lower)) {
    // test/build/lint 패턴이면 rules 레인
    const isVerification = /test|build|lint|vitest|pytest|tsc/.test(lower);
    return { endpoint: "/api/terminal-command", lane: isVerification ? "rules" : "implementation" };
  }

  if (/\bagent\b|dispatch|delegate|spawn/.test(lower)) {
    return { endpoint: "/api/agent-activity", activityType: "delegation" };
  }

  if (/\bskill\b/.test(lower)) {
    return { endpoint: "/api/agent-activity", activityType: "skill_use" };
  }

  if (/\bhandoff\b/.test(lower)) {
    return { endpoint: "/api/agent-activity", activityType: "handoff" };
  }

  return { endpoint: "/api/tool-used", lane: "implementation" };
}

function normalizeTodoState(
  status: unknown
): "added" | "in_progress" | "completed" | "cancelled" {
  const normalized = String(status ?? "").toLowerCase().trim();
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  return "added";
}

function isTodoWriteTool(lowerToolName: string): boolean {
  return lowerToolName === "todowrite"
    || lowerToolName.endsWith(".todowrite")
    || lowerToolName.endsWith("/todowrite");
}

function isMonitorQuestionTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_question")
    || lowerToolName.endsWith("monitor_monitor_question");
}

function isNativeQuestionTool(lowerToolName: string): boolean {
  return lowerToolName === "question"
    || lowerToolName.endsWith(".question")
    || lowerToolName.endsWith("/question");
}

function isMonitorTodoTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_todo")
    || lowerToolName.endsWith("monitor_monitor_todo");
}

function isMonitorThoughtTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_thought")
    || lowerToolName.endsWith("monitor_monitor_thought");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function extractNamedField(text: string | undefined, fieldName: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(new RegExp(`${fieldName}:\\s*([^\\s<]+)`, "i"));
  return match?.[1]?.trim();
}

function isTaskTool(lowerToolName: string): boolean {
  return lowerToolName === "task"
    || lowerToolName.endsWith(".task")
    || lowerToolName.endsWith("/task");
}

function isParallelTool(lowerToolName: string): boolean {
  return lowerToolName === "parallel"
    || lowerToolName.endsWith(".parallel")
    || lowerToolName.includes("multi_tool_use.parallel");
}

function extractMatches(text: string | undefined, pattern: RegExp): string[] {
  if (!text) return [];
  const matches: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) matches.push(value);
  }
  return matches;
}

function extractSubagentParentTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;

  const match = title.match(/^(.*)\s+\(@[^)]+ subagent\)$/i);
  const parentTitle = match?.[1]?.trim();
  return parentTitle && parentTitle.length > 0 ? parentTitle : undefined;
}

function buildBackgroundCandidateTitles(title: string | undefined): ReadonlySet<string> {
  const normalizedTitle = toNonEmptyString(title);
  if (!normalizedTitle) {
    return new Set<string>();
  }

  const candidateTitles = new Set<string>([normalizedTitle]);
  const parentTitle = extractSubagentParentTitle(normalizedTitle);
  if (parentTitle) {
    candidateTitles.add(parentTitle);
  }

  return candidateTitles;
}

function findReusablePrimarySubagentState(
  title: string | undefined
): { sessionId: string; state: SessionState } | undefined {
  const candidateTitles = buildBackgroundCandidateTitles(title);
  if (candidateTitles.size === 0) {
    return undefined;
  }

  const candidateEntries: Array<[string, SessionState]> = [
    ...sessionStates.entries(),
    ...suspendedSessionStates.entries()
  ];

  let matched: { sessionId: string; state: SessionState } | undefined;
  for (const [sessionId, state] of candidateEntries) {
    if (state.taskKind === "background") continue;
    if (endedSessionIds.has(sessionId)) continue;
    if (finalizingSessionIds.has(sessionId)) continue;

    const sessionTitle = toNonEmptyString(sessionInfoById.get(sessionId)?.title);
    const subagentParentTitle = extractSubagentParentTitle(sessionTitle);
    if (!subagentParentTitle) continue;

    if ((sessionTitle && candidateTitles.has(sessionTitle)) || candidateTitles.has(subagentParentTitle)) {
      matched = { sessionId, state };
    }
  }

  return matched;
}

function findBackgroundAncestorLink(title: string | undefined): BackgroundTaskLink | undefined {
  const candidateTitles = buildBackgroundCandidateTitles(title);
  if (candidateTitles.size === 0) return undefined;

  let matchedPendingLink: BackgroundTaskLink | undefined;
  for (const pendingLink of pendingBackgroundLinks.values()) {
    if (pendingLink.title && candidateTitles.has(pendingLink.title)) {
      const linkedState = sessionStates.get(pendingLink.childSessionId);
      if (linkedState?.taskId) {
        return {
          childSessionId: "",
          parentTaskId: pendingLink.parentTaskId,
          ...(pendingLink.parentSessionId ? { parentSessionId: pendingLink.parentSessionId } : {}),
          ...(pendingLink.backgroundTaskId ? { backgroundTaskId: pendingLink.backgroundTaskId } : {}),
          ...(pendingLink.title ? { title: pendingLink.title } : {}),
          taskId: linkedState.taskId
        };
      }
      matchedPendingLink = pendingLink;
    }
  }

  let matchedState: SessionState | undefined;
  for (const state of sessionStates.values()) {
    if (state.taskKind !== "background") continue;

    const candidateTitle = state.backgroundTitle ?? state.taskTitle;
    if (candidateTitles.has(candidateTitle)) {
      matchedState = state;
    }
  }

  const matchedPrimarySubagent = findReusablePrimarySubagentState(title);

  if (!matchedState?.parentTaskId) {
    if (!matchedPendingLink) return undefined;
    return {
      childSessionId: "",
      parentTaskId: matchedPendingLink.parentTaskId,
      ...(matchedPendingLink.parentSessionId ? { parentSessionId: matchedPendingLink.parentSessionId } : {}),
      ...(matchedPendingLink.backgroundTaskId ? { backgroundTaskId: matchedPendingLink.backgroundTaskId } : {}),
      ...(matchedPendingLink.title ? { title: matchedPendingLink.title } : {}),
      ...(matchedPrimarySubagent?.state.taskId ? { taskId: matchedPrimarySubagent.state.taskId } : {})
    };
  }

  return {
    childSessionId: "",
    parentTaskId: matchedState.parentTaskId,
    ...(matchedState.parentSessionId ? { parentSessionId: matchedState.parentSessionId } : {}),
    ...(matchedState.backgroundTaskId ? { backgroundTaskId: matchedState.backgroundTaskId } : {}),
    ...(matchedState.backgroundTitle ? { title: matchedState.backgroundTitle } : {}),
    taskId: matchedState.taskId
  };
}

async function promoteSessionStateToBackground(input: {
  sessionId: string;
  state: SessionState;
  backgroundLink: BackgroundTaskLink;
}): Promise<SessionState | undefined> {
  if (input.state.taskKind === "background") {
    return input.state;
  }

  const linkResult = await post("/api/task-link", {
    taskId: input.state.taskId,
    ...(input.backgroundLink.title ? { title: input.backgroundLink.title } : {}),
    taskKind: "background",
    parentTaskId: input.backgroundLink.parentTaskId,
    ...(input.backgroundLink.parentSessionId ? { parentSessionId: input.backgroundLink.parentSessionId } : {}),
    ...(input.backgroundLink.backgroundTaskId ? { backgroundTaskId: input.backgroundLink.backgroundTaskId } : {})
  });
  if (linkResult === null) {
    return undefined;
  }

  const nextState: SessionState = {
    ...input.state,
    taskTitle: input.backgroundLink.title ?? input.state.taskTitle,
    taskKind: "background",
    backgroundLinkConfirmed: true,
    parentTaskId: input.backgroundLink.parentTaskId,
    parentSessionId: input.backgroundLink.parentSessionId,
    backgroundTaskId: input.backgroundLink.backgroundTaskId,
    backgroundTitle: input.backgroundLink.title ?? input.state.backgroundTitle
  };
  if (sessionStates.has(input.sessionId)) {
    sessionStates.set(input.sessionId, nextState);
  }
  if (suspendedSessionStates.has(input.sessionId) || suspendedSessionIds.has(input.sessionId)) {
    suspendedSessionStates.set(input.sessionId, nextState);
  }
  return nextState;
}

function provisionalBackgroundLinkKey(parentSessionId: string, callId: string, index: number): string {
  return `pending:${parentSessionId}:${callId}:${index}`;
}

function clearProvisionalBackgroundLinks(parentSessionId: string, callId: string | undefined): void {
  if (!callId) return;
  const prefix = `pending:${parentSessionId}:${callId}:`;
  for (const key of pendingBackgroundLinks.keys()) {
    if (key.startsWith(prefix)) {
      pendingBackgroundLinks.delete(key);
    }
  }
}

type BackgroundTerminalStatus = "completed" | "cancelled" | "error" | "interrupt";

function extractBackgroundTaskTerminalEvents(
  text: string
): readonly { backgroundTaskId: string; status: BackgroundTerminalStatus }[] {
  const markerStatus: BackgroundTerminalStatus | undefined = text.includes("[BACKGROUND TASK COMPLETED]")
    ? "completed"
    : text.includes("[BACKGROUND TASK CANCELLED]")
      ? "cancelled"
      : text.includes("[BACKGROUND TASK ERROR]")
        ? "error"
        : text.includes("[BACKGROUND TASK INTERRUPT]") || text.includes("[BACKGROUND TASK INTERRUPTED]")
          ? "interrupt"
          : undefined;
  const hasAllCompleteMarker = text.includes("[ALL BACKGROUND TASKS COMPLETE]");
  if (!markerStatus && !hasAllCompleteMarker) {
    return [];
  }

  const eventsById = new Map<string, BackgroundTerminalStatus>();
  for (const match of text.matchAll(/\bbg_[A-Za-z0-9_-]+\b/g)) {
    const id = match[0]?.trim();
    if (!id) continue;

    eventsById.set(id, markerStatus ?? "completed");
  }

  return [...eventsById.entries()].map(([backgroundTaskId, status]) => ({
    backgroundTaskId,
    status
  }));
}

function summaryForBackgroundTerminalStatus(status: BackgroundTerminalStatus): string {
  if (status === "cancelled") return "OpenCode background task cancelled";
  if (status === "error") return "OpenCode background task failed";
  if (status === "interrupt") return "OpenCode background task interrupted";
  return "OpenCode background task completed";
}

function isExitCommandName(name: string | undefined): boolean {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const commandToken = (normalized.split(/\s+/, 1)[0] ?? "")
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[),;]+$/g, "");
  if (!commandToken) return false;

  return commandToken === "exit"
    || commandToken === "/exit"
    || commandToken === "quit"
    || commandToken === "/quit"
    || commandToken === "app.exit"
    || commandToken === "session.exit";
}

function extractExitCommandNameFromEvent(properties: Record<string, unknown>): string | undefined {
  const candidates: string[] = [];

  const pushString = (value: unknown): void => {
    if (typeof value !== "string") return;
    const normalized = toNonEmptyString(value);
    if (normalized) candidates.push(normalized);
  };

  pushString(properties.name);
  pushString(properties.command);
  pushString(properties.input);

  const commandObject = asObject(properties.command);
  pushString(commandObject.name);
  pushString(commandObject.id);
  pushString(commandObject.command);
  pushString(commandObject.input);

  const args = properties.args;
  if (Array.isArray(args)) {
    for (const argument of args) {
      pushString(argument);
    }
  }

  pushString(properties.title);

  for (const candidate of candidates) {
    if (isExitCommandName(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function extractSessionIdFromKnownPaths(properties: Record<string, unknown>): string | undefined {
  const direct = toNonEmptyString(properties.sessionID)
    ?? toNonEmptyString(properties.sessionId)
    ?? toNonEmptyString(properties.session_id);
  if (direct) return direct;

  const sessionRecord = asObject(properties.session);
  const nestedSession = toNonEmptyString(sessionRecord.id)
    ?? toNonEmptyString(sessionRecord.sessionID)
    ?? toNonEmptyString(sessionRecord.sessionId)
    ?? toNonEmptyString(sessionRecord.session_id);
  if (nestedSession) return nestedSession;

  const infoRecord = asObject(properties.info);
  const infoSession = toNonEmptyString(infoRecord.id)
    ?? toNonEmptyString(infoRecord.sessionID)
    ?? toNonEmptyString(infoRecord.sessionId)
    ?? toNonEmptyString(infoRecord.session_id);
  if (infoSession) return infoSession;

  const contextRecord = asObject(properties.context);
  const contextSession = toNonEmptyString(contextRecord.sessionID)
    ?? toNonEmptyString(contextRecord.sessionId)
    ?? toNonEmptyString(contextRecord.session_id);
  if (contextSession) return contextSession;

  return undefined;
}

function extractFallbackPrimarySessionId(): string | undefined {
  const activePrimarySessionIds = [...sessionStates.entries()]
    .filter(([sessionId, state]) => {
      if (endedSessionIds.has(sessionId)) return false;
      if (finalizingSessionIds.has(sessionId)) return false;
      if (suspendedSessionIds.has(sessionId)) return false;
      return state.taskKind !== "background";
    })
    .map(([sessionId]) => sessionId);

  if (activePrimarySessionIds.length === 1) {
    return activePrimarySessionIds[0];
  }

  const activePrimarySessionInfos = [...sessionInfoById.keys()]
    .filter((sessionId) => !endedSessionIds.has(sessionId))
    .filter((sessionId) => !suspendedSessionIds.has(sessionId))
    .filter((sessionId) => {
      const state = sessionStates.get(sessionId);
      return !state || state.taskKind !== "background";
    });

  if (activePrimarySessionInfos.length === 1) {
    return activePrimarySessionInfos[0];
  }

  const parentPrimarySessionIds = new Set<string>();
  for (const backgroundLink of pendingBackgroundLinks.values()) {
    if (!backgroundLink.parentTaskId) continue;

    for (const [sessionId, state] of sessionStates.entries()) {
      if (endedSessionIds.has(sessionId)) continue;
      if (finalizingSessionIds.has(sessionId)) continue;
      if (suspendedSessionIds.has(sessionId)) continue;
      if (state.taskKind === "background") continue;
      if (state.taskId === backgroundLink.parentTaskId) {
        parentPrimarySessionIds.add(sessionId);
      }
    }
  }

  if (parentPrimarySessionIds.size === 1) {
    const [sessionId] = parentPrimarySessionIds;
    return sessionId;
  }

  return undefined;
}

function extractSessionIdFromCommandEvent(properties: Record<string, unknown>): string | undefined {
  const fromKnownPaths = extractSessionIdFromKnownPaths(properties);
  if (fromKnownPaths) return fromKnownPaths;

  return extractFallbackPrimarySessionId();
}

function extractParallelBackgroundLinks(input: {
  toolName: string;
  args: unknown;
  state: SessionState;
  outputText?: string | undefined;
}): readonly BackgroundTaskLink[] {
  const lower = input.toolName.toLowerCase();
  if (!isParallelTool(lower)) return [];

  const args = asObject(input.args);
  const toolUses = Array.isArray(args.tool_uses) ? args.tool_uses : [];
  const backgroundRequests = toolUses
    .map((entry) => asObject(entry))
    .filter((entry) => isTaskTool(String(entry.recipient_name ?? "").toLowerCase()))
    .map((entry) => asObject(entry.parameters))
    .filter((parameters) => parameters.run_in_background === true)
    .map((parameters) => ({
      title: toNonEmptyString(parameters.description)
        ?? toNonEmptyString(parameters.prompt)
    }));

  if (backgroundRequests.length === 0) return [];

  const sessionIds = extractMatches(input.outputText, /session_id:\s*([^\s<]+)/gi);
  const backgroundTaskIds = extractMatches(input.outputText, /(?:Background Task ID|background_task_id):\s*([^\s<]+)/gi);

  const count = Math.min(backgroundRequests.length, sessionIds.length);
  const links: BackgroundTaskLink[] = [];
  for (let index = 0; index < count; index++) {
    const childSessionId = sessionIds[index];
    if (!childSessionId) continue;

    const backgroundTaskId = backgroundTaskIds[index];
    const title = backgroundRequests[index]?.title;

    links.push({
      childSessionId,
      parentTaskId: input.state.taskId,
      ...(input.state.monitorSessionId ? { parentSessionId: input.state.monitorSessionId } : {}),
      ...(backgroundTaskId ? { backgroundTaskId } : {}),
      ...(title ? { title } : {})
    });
  }

  return links;
}

function extractBackgroundTaskLink(input: {
  toolName: string;
  args: unknown;
  state: SessionState;
  outputText?: string | undefined;
  outputMetadata?: unknown | undefined;
  outputTitle?: string | undefined;
}): BackgroundTaskLink | undefined {
  const lower = input.toolName.toLowerCase();
  if (!isTaskTool(lower)) return undefined;

  const args = asObject(input.args);
  if (args.run_in_background !== true) return undefined;

  const outputMetadata = asObject(input.outputMetadata);
  const childSessionId = toNonEmptyString(outputMetadata.session_id)
    ?? toNonEmptyString(outputMetadata.sessionId)
    ?? extractNamedField(input.outputText, "session_id");

  if (!childSessionId) return undefined;

  const backgroundTaskId = toNonEmptyString(outputMetadata.background_task_id)
    ?? toNonEmptyString(outputMetadata.backgroundTaskId)
    ?? extractNamedField(input.outputText, "background_task_id")
    ?? extractNamedField(input.outputText, "Background Task ID");

  const title = toNonEmptyString(args.description)
    ?? toNonEmptyString(args.prompt)
    ?? toNonEmptyString(input.outputTitle);

  return {
    childSessionId,
    parentTaskId: input.state.taskId,
    parentSessionId: input.state.monitorSessionId,
    ...(backgroundTaskId ? { backgroundTaskId } : {}),
    ...(title ? { title } : {})
  };
}

function extractBackgroundLaunchHints(input: {
  toolName: string;
  args: unknown;
  state: SessionState;
  callId?: string | undefined;
}): readonly BackgroundTaskLink[] {
  if (!input.callId) return [];

  const lower = input.toolName.toLowerCase();
  const args = asObject(input.args);

  if (isTaskTool(lower) && args.run_in_background === true) {
    const title = toNonEmptyString(args.description) ?? toNonEmptyString(args.prompt);
    if (!title) return [];
    return [{
      childSessionId: provisionalBackgroundLinkKey(input.state.taskId, input.callId, 0),
      parentTaskId: input.state.taskId,
      ...(input.state.monitorSessionId ? { parentSessionId: input.state.monitorSessionId } : {}),
      title
    }];
  }

  if (!isParallelTool(lower)) return [];

  const toolUses = Array.isArray(args.tool_uses) ? args.tool_uses : [];
  return toolUses
    .map((entry) => asObject(entry))
    .filter((entry) => isTaskTool(String(entry.recipient_name ?? "").toLowerCase()))
    .map((entry) => asObject(entry.parameters))
    .filter((parameters) => parameters.run_in_background === true)
    .map((parameters, index): BackgroundTaskLink | undefined => {
      const title = toNonEmptyString(parameters.description) ?? toNonEmptyString(parameters.prompt);
      if (!title) return undefined;
      return {
        childSessionId: provisionalBackgroundLinkKey(input.state.taskId, input.callId!, index),
        parentTaskId: input.state.taskId,
        ...(input.state.monitorSessionId ? { parentSessionId: input.state.monitorSessionId } : {}),
        title
      };
    })
    .filter((link): link is BackgroundTaskLink => Boolean(link));
}

function looksLikePath(value: string): boolean {
  if (/[\n\r]/.test(value)) return false;
  if (value.length > 260) return false;
  if (/\s/.test(value)) return false;
  if (/[=(){};,\[\]<>!?#&|+*^~"']/.test(value)) return false;

  return (
    /[\\/]/.test(value) ||
    /\.[a-z0-9]{1,15}$/i.test(value) ||
    /^\.[a-z0-9]/i.test(value)
  );
}

function extractPathLikeTokens(text: string): readonly string[] {
  const matches = new Set<string>();

  const stripped = text.replace(/```[\s\S]*?```/g, "");

  const backtickRegex = /`([^`\n]+)`/g;
  for (const match of stripped.matchAll(backtickRegex)) {
    const candidate = match[1]?.trim();
    if (candidate && looksLikePath(candidate)) {
      matches.add(candidate);
    }
  }

  const atPathRegex = /@([A-Za-z0-9_./-]+(?:\.[A-Za-z0-9_-]+)?)/g;
  for (const match of stripped.matchAll(atPathRegex)) {
    const candidate = match[1]?.trim();
    if (candidate && looksLikePath(candidate)) {
      matches.add(candidate);
    }
  }

  const plainPathRegex = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_-]+)?/g;
  for (const match of stripped.matchAll(plainPathRegex)) {
    const candidate = match[0]?.trim();
    if (candidate && looksLikePath(candidate)) {
      matches.add(candidate);
    }
  }

  return [...matches];
}

function monitorTaskIdForOpenCodeSession(sessionId: string): string {
  return `opencode-${sessionId}`;
}

function appendPathCandidates(value: unknown, into: Set<string>, depth: number = 0): void {
  if (depth > 4 || value == null) return;

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0 && normalized.length <= 400) {
      if (looksLikePath(normalized)) {
        into.add(normalized);
      }

      for (const token of extractPathLikeTokens(normalized)) {
        into.add(token);
      }

      if ((normalized.startsWith("{") || normalized.startsWith("[")) && normalized.length < 4000) {
        try {
          appendPathCandidates(JSON.parse(normalized), into, depth + 1);
        } catch {
        }
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendPathCandidates(item, into, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, nestedValue] of Object.entries(record)) {
      const lowered = key.toLowerCase();
      if (lowered.includes("path") || lowered === "file" || lowered === "files") {
        appendPathCandidates(nestedValue, into, depth + 1);
      }
      if (lowered === "input" || lowered === "args" || lowered === "payload" || lowered === "toolinput") {
        appendPathCandidates(nestedValue, into, depth + 1);
      }
    }
  }
}

function isOhMyOpenCodeEnvelope(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "---") return true;
  if (normalized === "[search-mode]" || normalized === "[analyze-mode]") return true;
  if (normalized.startsWith("maximize search effort")) return true;
  if (normalized.startsWith("analysis mode.")) return true;
  if (normalized.startsWith("context gathering")) return true;
  if (normalized.startsWith("if complex")) return true;
  if (normalized.startsWith("- 1-2 explore agents")) return true;
  if (normalized.startsWith("- 1-2 librarian agents")) return true;
  if (normalized.startsWith("- direct tools:")) return true;
  return false;
}

function unwrapQuotedEnvelope(line: string): string {
  const trimmed = line.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractFilePaths(
  args: unknown,
  outputMetadata?: unknown,
  outputTitle?: string,
  outputText?: string
): readonly string[] {
  const values = new Set<string>();
  appendPathCandidates(args, values);
  appendPathCandidates(outputMetadata, values);

  const title = toNonEmptyString(outputTitle);
  if (title) {
    appendPathCandidates(title, values);
  }

  // 도구 출력 텍스트에서 경로 토큰 추출 (BrowseIndexed* 등 MCP 도구 결과 커버).
  // 너무 긴 출력은 앞부분만 스캔 (성능 보호).
  if (outputText) {
    const scanText = outputText.length > 3000 ? outputText.slice(0, 3000) : outputText;
    for (const token of extractPathLikeTokens(scanText)) {
      values.add(token);
    }
  }

  return [...values];
}

function parseQuestionPhase(value: unknown): "asked" | "answered" | "concluded" | undefined {
  const normalized = toNonEmptyString(value);
  if (!normalized) return undefined;
  if (normalized === "asked" || normalized === "answered" || normalized === "concluded") {
    return normalized;
  }
  return undefined;
}

function extractNativeQuestionAnswerMap(text: string | undefined): ReadonlyMap<string, string> {
  const answers = new Map<string, string>();
  if (!text) return answers;

  for (const match of text.matchAll(/"([^"]+)"\s*=\s*"([^"]+)"/g)) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) {
      answers.set(question, answer);
    }
  }

  return answers;
}

function buildNativeQuestionBody(question: Record<string, unknown>): string | undefined {
  const details: string[] = [];
  const header = toNonEmptyString(question.header);
  const description = toNonEmptyString(question.description);
  const options = Array.isArray(question.options) ? question.options : [];

  if (header) {
    details.push(`Header: ${header}`);
  }
  if (description) {
    details.push(description);
  }

  const optionLabels = options
    .map((option) => asObject(option))
    .map((option) => toNonEmptyString(option.label))
    .filter((label): label is string => Boolean(label));
  if (optionLabels.length > 0) {
    details.push(`Options: ${optionLabels.join(", ")}`);
  }

  return details.length > 0 ? details.join("\n") : undefined;
}

function buildSemanticRoutes(input: {
  toolName: string;
  args: unknown;
  state: SessionState;
  opencodeSessionId: string;
  opencodeCallId?: string | undefined;
  outputTitle?: string | undefined;
  outputText?: string | undefined;
}): readonly MonitorSemanticRoute[] {
  const lower = input.toolName.toLowerCase();
  const args = asObject(input.args);
  const metadata = {
    ...(asObject(args.metadata)),
    opencodeSessionId: input.opencodeSessionId,
    ...(input.opencodeCallId ? { opencodeCallId: input.opencodeCallId } : {})
  };

  if (isMonitorQuestionTool(lower)) {
    const questionId = toNonEmptyString(args.questionId);
    const questionPhase = parseQuestionPhase(args.questionPhase);
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!questionId || !questionPhase || !title) return [];
    return [{
      endpoint: "/api/question",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        questionId,
        questionPhase,
        ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        ...(toNonEmptyString(args.modelName) ? { modelName: toNonEmptyString(args.modelName) } : {}),
        ...(toNonEmptyString(args.modelProvider) ? { modelProvider: toNonEmptyString(args.modelProvider) } : {}),
        metadata
      }
    }];
  }

  if (isNativeQuestionTool(lower)) {
    const questions = Array.isArray(args.questions)
      ? args.questions.map((question) => asObject(question))
      : [];
    if (questions.length === 0) return [];

    const answerMap = extractNativeQuestionAnswerMap(input.outputText);
    const defaultAnswer = toNonEmptyString(input.outputText);

    return questions.flatMap((question, index) => {
      const title = toNonEmptyString(question.question) ?? toNonEmptyString(question.header);
      if (!title) return [];

      const questionId = `${input.opencodeCallId ?? input.opencodeSessionId}:question:${index}`;
      const askedBody = buildNativeQuestionBody(question);
      const answeredBody = answerMap.get(title) ?? (questions.length === 1 ? defaultAnswer : undefined);
      const nextMetadata = {
        ...metadata,
        questionTool: "native",
        questionIndex: index
      };

      const routes: MonitorSemanticRoute[] = [{
        endpoint: "/api/question",
        body: {
          taskId: input.state.taskId,
          sessionId: input.state.monitorSessionId,
          questionId,
          questionPhase: "asked",
          sequence: index * 2,
          title,
          ...(askedBody ? { body: askedBody } : {}),
          metadata: nextMetadata
        }
      }];

      if (answeredBody) {
        routes.push({
          endpoint: "/api/question",
          body: {
            taskId: input.state.taskId,
            sessionId: input.state.monitorSessionId,
            questionId,
            questionPhase: "answered",
            sequence: index * 2 + 1,
            title: `Answered: ${title}`,
            body: answeredBody,
            metadata: nextMetadata
          }
        });
      }

      return routes;
    });
  }

  if (isMonitorTodoTool(lower)) {
    const todoId = toNonEmptyString(args.todoId);
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!todoId || !title) return [];
    return [{
      endpoint: "/api/todo",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        todoId,
        todoState: normalizeTodoState(args.todoState),
        ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        metadata
      }
    }];
  }

  if (isMonitorThoughtTool(lower)) {
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!title) return [];
    return [{
      endpoint: "/api/thought",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        ...(toNonEmptyString(args.modelName) ? { modelName: toNonEmptyString(args.modelName) } : {}),
        ...(toNonEmptyString(args.modelProvider) ? { modelProvider: toNonEmptyString(args.modelProvider) } : {}),
        metadata
      }
    }];
  }

  return [];
}

function extractAssistantTurnCompletion(input: unknown): {
  readonly messageId: string;
  readonly sessionId: string;
  readonly finish?: string;
} | undefined {
  const properties = asObject(input);
  const info = asObject(properties.info);
  const role = toNonEmptyString(info.role);
  if (role !== "assistant") return undefined;

  const messageId = toNonEmptyString(info.id);
  const sessionId = toNonEmptyString(info.sessionID);
  const finish = toNonEmptyString(info.finish);
  const error = asObject(info.error);
  const completedAt = asObject(info.time).completed;
  if (!messageId || !sessionId) return undefined;
  if (Object.keys(error).length > 0) return undefined;
  if (completedAt === undefined || completedAt === null) return undefined;
  if (!finish || finish.toLowerCase() !== "stop") return undefined;

  return {
    messageId,
    sessionId,
    finish
  };
}

function toTodoId(todo: Record<string, unknown>): string {
  const content = String(todo.content ?? "").trim();
  const priority = String(todo.priority ?? "").trim();
  return `${content}::${priority}`;
}

function extractTextFromParts(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      const type = String(record.type ?? "").toLowerCase();
      if (typeof record.text === "string") return record.text;
      if (type === "input_text" && typeof record.content === "string") return record.content;
      return "";
    })
    .join("\n")
    .trim();
}

function deriveUserMessageFields(text: string): { title: string; body: string; filePaths: readonly string[] } {
  const body = text.trim();
  const lines = body
    .split("\n")
    .map((line) => unwrapQuotedEnvelope(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line !== "<system-reminder>" && line !== "</system-reminder>")
    .filter((line) => !line.startsWith("[BACKGROUND TASK COMPLETED]"))
    .filter((line) => !line.startsWith("[ALL BACKGROUND TASKS COMPLETE]"));

  const hasOhMyEnvelope = lines.some((line) => isOhMyOpenCodeEnvelope(line));
  const sanitizedLines = hasOhMyEnvelope
    ? lines.filter((line) => !isOhMyOpenCodeEnvelope(line))
    : lines;

  const preferred = sanitizedLines[0] ?? body;
  const title = preferred.length > 120 ? `${preferred.slice(0, 120)}…` : preferred;
  const filePaths = extractPathLikeTokens(sanitizedLines.join("\n"));
  return { title, body, filePaths };
}

async function logTodoTransitions(input: {
  state: SessionState;
  opencodeSessionId: string;
  todos: readonly unknown[];
}): Promise<void> {
  const nextById = new Map<string, "added" | "in_progress" | "completed" | "cancelled">();

  for (const item of input.todos) {
    if (!item || typeof item !== "object") continue;
    const todo = item as Record<string, unknown>;
    const title = String(todo.content ?? "").trim();
    if (!title) continue;

    const todoId = toTodoId(todo);
    const nextState = normalizeTodoState(todo.status);
    nextById.set(todoId, nextState);

    const prevState = input.state.todoStateById.get(todoId);
    if (prevState === nextState) continue;

    await post("/api/todo", {
      taskId: input.state.taskId,
      sessionId: input.state.monitorSessionId,
      todoId,
      todoState: nextState,
      title,
      metadata: {
        opencodeSessionId: input.opencodeSessionId
      }
    });
  }

  input.state.todoStateById = nextById;
}

export function createMonitorHooks(workspacePath: string): Hooks {

  function clearTrackedSessionState(input: {
    sessionId: string;
    markEnded?: boolean;
    keepSessionInfo?: boolean;
    markSuspended?: boolean;
  }): void {
    const trackedState = sessionStates.get(input.sessionId);
    sessionStates.delete(input.sessionId);
    pendingSessionStarts.delete(input.sessionId);
    pendingBackgroundLinks.delete(input.sessionId);
    if (!input.keepSessionInfo) {
      sessionInfoById.delete(input.sessionId);
    }
    if (input.markEnded) {
      endedSessionIds.add(input.sessionId);
      suspendedSessionIds.delete(input.sessionId);
      suspendedSessionStates.delete(input.sessionId);
      return;
    }
    if (input.markSuspended) {
      suspendedSessionIds.add(input.sessionId);
      if (trackedState) {
        suspendedSessionStates.set(input.sessionId, trackedState);
      }
    } else {
      suspendedSessionIds.delete(input.sessionId);
      suspendedSessionStates.delete(input.sessionId);
    }
  }

  function buildTaskTitle(targetWorkspacePath: string): string {
    const workspaceName = targetWorkspacePath.split("/").pop() ?? "opencode";
    return `OpenCode - ${workspaceName}`;
  }

  async function ensureSessionState(input: {
    sessionId: string;
    directory?: string | undefined;
    title?: string | undefined;
  }): Promise<SessionState | undefined> {
    if (endedSessionIds.has(input.sessionId)) {
      return undefined;
    }

    const existing = sessionStates.get(input.sessionId);
    if (existing) return existing;

    const pending = pendingSessionStarts.get(input.sessionId);
    if (pending) return pending;

    const cachedInfo = sessionInfoById.get(input.sessionId);
    const suspendedState = suspendedSessionStates.get(input.sessionId);
    const targetWorkspacePath = input.directory ?? cachedInfo?.directory ?? workspacePath;
    const backgroundLink = pendingBackgroundLinks.get(input.sessionId)
      ?? findBackgroundAncestorLink(input.title ?? cachedInfo?.title);
    const taskTitle = backgroundLink?.title ?? buildTaskTitle(targetWorkspacePath);
    const promise = (async (): Promise<SessionState | undefined> => {
      const result = await post("/api/task-start", {
        taskId: backgroundLink?.taskId ?? monitorTaskIdForOpenCodeSession(input.sessionId),
        title: taskTitle,
        workspacePath: targetWorkspacePath,
        taskKind: backgroundLink ? "background" : "primary",
        ...(backgroundLink?.parentTaskId ? { parentTaskId: backgroundLink.parentTaskId } : {}),
        ...(backgroundLink?.parentSessionId ? { parentSessionId: backgroundLink.parentSessionId } : {}),
        ...(backgroundLink?.backgroundTaskId ? { backgroundTaskId: backgroundLink.backgroundTaskId } : {}),
        metadata: {
          opencodeSessionId: input.sessionId,
          ...(input.title ?? cachedInfo?.title ? { opencodeSessionTitle: input.title ?? cachedInfo?.title } : {}),
          ...(backgroundLink?.parentTaskId ? { parentTaskId: backgroundLink.parentTaskId } : {}),
          ...(backgroundLink?.parentSessionId ? { parentSessionId: backgroundLink.parentSessionId } : {}),
          ...(backgroundLink?.backgroundTaskId ? { backgroundTaskId: backgroundLink.backgroundTaskId } : {}),
          ...(backgroundLink?.title ? { backgroundTitle: backgroundLink.title } : {}),
          ...(backgroundLink ? { taskKind: "background" } : {})
        }
      }) as TaskStartResult | null;

      const taskId = result?.task?.id;
      if (!taskId) return undefined;

        const nextState: SessionState = {
          taskId,
          taskTitle,
        taskKind: backgroundLink ? "background" : "primary",
        // DB row is confirmed "background" only when we created it with the link already known.
        // Late-backfill cases start as false until /api/task-link succeeds.
        backgroundLinkConfirmed: backgroundLink !== undefined,
        messageCount: suspendedState?.messageCount ?? 0,
        seenMessageIds: new Set(suspendedState?.seenMessageIds ?? []),
        seenCompletionMessageIds: new Set(suspendedState?.seenCompletionMessageIds ?? []),
        seenToolCallIds: new Set(suspendedState?.seenToolCallIds ?? []),
        todoStateById: new Map(suspendedState?.todoStateById ?? []),
        ...(backgroundLink?.parentTaskId ? { parentTaskId: backgroundLink.parentTaskId } : {}),
        ...(backgroundLink?.parentSessionId ? { parentSessionId: backgroundLink.parentSessionId } : {}),
        ...(backgroundLink?.backgroundTaskId ? { backgroundTaskId: backgroundLink.backgroundTaskId } : {}),
        ...(backgroundLink?.title ? { backgroundTitle: backgroundLink.title } : {}),
        ...(result?.sessionId ? { monitorSessionId: result.sessionId } : {})
      };
      suspendedSessionIds.delete(input.sessionId);
      suspendedSessionStates.delete(input.sessionId);
      sessionStates.set(input.sessionId, nextState);
      pendingBackgroundLinks.delete(input.sessionId);
      return nextState;
    })();

    pendingSessionStarts.set(input.sessionId, promise);

    try {
      return await promise;
    } finally {
      pendingSessionStarts.delete(input.sessionId);
      }
    }

    function hasSiblingSessions(opencodeSessionId: string, taskId: string): boolean {
      for (const [candidateSessionId, candidateState] of sessionStates.entries()) {
        if (candidateSessionId === opencodeSessionId) continue;
        if (candidateState.taskId === taskId) {
          return true;
        }
      }

      return false;
    }

  async function finalizeSession(
      opencodeSessionId: string,
      state: SessionState,
      summary: string,
      backgroundAsyncStatus: BackgroundTerminalStatus = "completed",
      options?: {
        readonly metadata?: Record<string, unknown>;
        readonly completeTask?: boolean;
        readonly completionReason?: "idle" | "assistant_turn_complete" | "explicit_exit" | "runtime_terminated";
        readonly markEnded?: boolean;
        readonly keepSessionInfo?: boolean;
        readonly markSuspended?: boolean;
      }
    ): Promise<void> {
      let confirmedBackground = state.taskKind === "background" && state.backgroundLinkConfirmed;

      if (state.taskKind === "background" && !state.backgroundLinkConfirmed && state.parentTaskId) {
        const retryResult = await post("/api/task-link", {
          taskId: state.taskId,
          taskKind: "background",
          parentTaskId: state.parentTaskId,
          ...(state.parentSessionId ? { parentSessionId: state.parentSessionId } : {}),
          ...(state.backgroundTaskId ? { backgroundTaskId: state.backgroundTaskId } : {}),
          ...(state.backgroundTitle ? { title: state.backgroundTitle } : {})
        });
        if (retryResult !== null) {
          confirmedBackground = true;
        }
      }

      const completeTask = state.taskKind === "background"
        ? !confirmedBackground
        : (options?.completeTask ?? true);

      await post("/api/session-end", {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        completeTask,
        ...(options?.completionReason ? { completionReason: options.completionReason } : {}),
        summary,
        metadata: {
          opencodeSessionId,
          ...(options?.completionReason ? { completionReason: options.completionReason } : {}),
          ...(options?.metadata ?? {})
        }
      });

      if (confirmedBackground && state.parentTaskId && !hasSiblingSessions(opencodeSessionId, state.taskId)) {
        await post("/api/async-task", {
          taskId: state.parentTaskId,
          ...(state.parentSessionId ? { sessionId: state.parentSessionId } : {}),
          asyncTaskId: state.backgroundTaskId ?? opencodeSessionId,
          asyncStatus: backgroundAsyncStatus,
          title: state.backgroundTitle ?? "Background task completed",
          ...(state.parentSessionId ? { parentSessionId: state.parentSessionId } : {}),
          metadata: {
            opencodeSessionId,
            childTaskId: state.taskId,
            ...(state.backgroundTaskId ? { backgroundTaskId: state.backgroundTaskId } : {})
          }
        });
      }

      clearTrackedSessionState({
        sessionId: opencodeSessionId,
        markEnded: options?.markEnded ?? true,
        keepSessionInfo: options?.keepSessionInfo ?? false,
        markSuspended: options?.markSuspended ?? false
      });
    }

    async function finalizeByRuntimeSession(input: {
      opencodeSessionId: string;
      summary: string;
      completeTask?: boolean;
    }): Promise<void> {
      await post("/api/task-complete", {
        taskId: monitorTaskIdForOpenCodeSession(input.opencodeSessionId),
        summary: input.summary,
        metadata: {
          opencodeSessionId: input.opencodeSessionId,
          fallbackReason: "missing-in-memory-session-state",
          completeTask: input.completeTask ?? true
        }
      });

      clearTrackedSessionState({
        sessionId: input.opencodeSessionId,
        markEnded: true
      });
    }

    async function reconcileBackgroundTaskTerminalEvents(
      backgroundTaskEvents: readonly { backgroundTaskId: string; status: BackgroundTerminalStatus }[]
    ): Promise<void> {
      for (const backgroundTaskEvent of backgroundTaskEvents) {
        const { backgroundTaskId, status } = backgroundTaskEvent;
        const matchingSessionIds = new Set<string>();

        for (const [sessionId, state] of sessionStates.entries()) {
          if (state.backgroundTaskId === backgroundTaskId) {
            matchingSessionIds.add(sessionId);
          }
        }

        for (const [sessionId, backgroundLink] of pendingBackgroundLinks.entries()) {
          if (backgroundLink.backgroundTaskId === backgroundTaskId) {
            matchingSessionIds.add(sessionId);
          }
        }

        for (const sessionId of matchingSessionIds) {
          const state = sessionStates.get(sessionId)
            ?? await pendingSessionStarts.get(sessionId)
            ?? undefined;
          if (!state) {
            continue;
          }

          await finalizeSession(
            sessionId,
            state,
            summaryForBackgroundTerminalStatus(status),
            status
          );
        }
      }
    }

    async function finalizeForExitCommand(opencodeSessionId: string): Promise<void> {
      if (endedSessionIds.has(opencodeSessionId)) return;
      if (finalizingSessionIds.has(opencodeSessionId)) return;

      finalizingSessionIds.add(opencodeSessionId);
      try {
        const knownSessionInfo = sessionInfoById.get(opencodeSessionId);
        const existingState = sessionStates.get(opencodeSessionId)
          ?? await pendingSessionStarts.get(opencodeSessionId)
          ?? undefined;
        const state = existingState ?? (
          suspendedSessionIds.has(opencodeSessionId)
            ? undefined
            : await ensureSessionState({
              sessionId: opencodeSessionId,
              directory: knownSessionInfo?.directory,
              title: knownSessionInfo?.title
            }) ?? undefined
        );

        if (!state) {
          debugExitLog("finalizing via runtime fallback", {
            opencodeSessionId
          });
          await finalizeByRuntimeSession({
            opencodeSessionId,
            summary: "OpenCode exit command executed"
          });
          return;
        }

        debugExitLog("finalizing resolved session", {
          opencodeSessionId,
          taskId: state.taskId,
          monitorSessionId: state.monitorSessionId
        });
        await finalizeSession(opencodeSessionId, state, "OpenCode exit command executed", "completed", {
          completeTask: true,
          completionReason: "explicit_exit"
        });
      } finally {
        finalizingSessionIds.delete(opencodeSessionId);
      }
    }

    async function finalizeForExitAcrossActiveSessions(trigger: string): Promise<void> {
      const singlePrimary = extractFallbackPrimarySessionId();
      if (singlePrimary) {
        debugExitLog("finalizing primary session from fallback resolver", {
          trigger,
          opencodeSessionId: singlePrimary
        });
        await finalizeForExitCommand(singlePrimary);
        return;
      }

      let newestPrimaryFromSessionInfo: string | undefined;
      for (const sessionId of sessionInfoById.keys()) {
        if (endedSessionIds.has(sessionId)) continue;
        if (suspendedSessionIds.has(sessionId)) continue;
        const state = sessionStates.get(sessionId);
        if (state?.taskKind === "background") continue;
        newestPrimaryFromSessionInfo = sessionId;
      }

      if (newestPrimaryFromSessionInfo) {
        debugExitLog("finalizing newest active primary session from sessionInfoById", {
          trigger,
          opencodeSessionId: newestPrimaryFromSessionInfo
        });
        await finalizeForExitCommand(newestPrimaryFromSessionInfo);
      }
    }

  return {
    // `command.execute.before` is a typed OpenCode plugin hook. We keep it as an
    // early exit path because `/exit` can terminate the active session quickly.
    "command.execute.before": async (input) => {
      const commandName = toNonEmptyString(input.command);
      if (!isExitCommandName(commandName)) return;

      const opencodeSessionId = toNonEmptyString(input.sessionID)
        ?? extractFallbackPrimarySessionId();
      debugExitLog("exit command detected before execution", {
        commandName,
        opencodeSessionId
      });

      if (!opencodeSessionId) {
        debugExitLog("session id not resolved in command.execute.before", {
          commandName
        });
        return;
      }

      await finalizeForExitCommand(opencodeSessionId);
    },

    // `chat.message` is a typed OpenCode plugin hook used for raw user-prompt capture.
    // It is distinct from the documented event stream handled by `event`.
    "chat.message": async (input, output) => {
      const state = await ensureSessionState({ sessionId: input.sessionID });
      if (!state) return;

      const messageId = toNonEmptyString(output.message.id);
      if (messageId && state.seenMessageIds.has(messageId)) {
        return;
      }
      if (messageId) {
        state.seenMessageIds.add(messageId);
      }

      // Extract text from TextPart items
      const text = extractTextFromParts(output.parts);

      if (!text) return;

      const backgroundTaskEvents = extractBackgroundTaskTerminalEvents(text);
      if (backgroundTaskEvents.length > 0) {
        await reconcileBackgroundTaskTerminalEvents(backgroundTaskEvents);
        return;
      }

      const message = deriveUserMessageFields(text);

      const phase = state.messageCount === 0 ? "initial" : "follow_up";
      state.messageCount++;

      await post("/api/user-message", {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        messageId: messageId ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        captureMode: "raw",
        source: "opencode-plugin",
        phase,
        title: message.title,
        body: message.body,
        metadata: {
          modelId: input.model?.modelID,
          providerId: input.model?.providerID,
          opencodeSessionId: input.sessionID,
          ...(message.filePaths.length > 0 ? { filePaths: message.filePaths } : {})
        }
      });
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        endedSessionIds.delete(event.properties.info.id);
        suspendedSessionIds.delete(event.properties.info.id);
        suspendedSessionStates.delete(event.properties.info.id);
        sessionInfoById.set(event.properties.info.id, {
          directory: event.properties.info.directory,
          title: event.properties.info.title
        });

        const inheritedBackgroundLink = findBackgroundAncestorLink(event.properties.info.title);
        if (inheritedBackgroundLink) {
          pendingBackgroundLinks.set(event.properties.info.id, {
            ...inheritedBackgroundLink,
            childSessionId: event.properties.info.id
          });
        }

        return;
      }

      if (event.type === "message.updated") {
        const completion = extractAssistantTurnCompletion(event.properties);
        if (!completion) return;
        if (endedSessionIds.has(completion.sessionId)) return;
        if (suspendedSessionIds.has(completion.sessionId)) return;
        if (finalizingSessionIds.has(completion.sessionId)) return;

        const state = sessionStates.get(completion.sessionId)
          ?? await pendingSessionStarts.get(completion.sessionId)
          ?? undefined;
        if (!state) return;
        if (state.seenCompletionMessageIds.has(completion.messageId)) return;
        state.seenCompletionMessageIds.add(completion.messageId);

        finalizingSessionIds.add(completion.sessionId);
        try {
          await finalizeSession(
            completion.sessionId,
            state,
            "OpenCode assistant completed turn",
            "completed",
            {
              completeTask: true,
              completionReason: "assistant_turn_complete",
              metadata: {
                messageId: completion.messageId,
                ...(completion.finish ? { finish: completion.finish } : {})
              },
              markEnded: false,
              keepSessionInfo: true,
              markSuspended: true
            }
          );
        } finally {
          finalizingSessionIds.delete(completion.sessionId);
        }
        return;
      }

      if (event.type === "session.idle") {
        const opencodeSessionId = event.properties.sessionID;
        if (endedSessionIds.has(opencodeSessionId)) return;
        if (suspendedSessionIds.has(opencodeSessionId)) return;
        if (finalizingSessionIds.has(opencodeSessionId)) return;

        const state = sessionStates.get(opencodeSessionId)
          ?? await pendingSessionStarts.get(opencodeSessionId)
          ?? undefined;
        if (!state) return;

        finalizingSessionIds.add(opencodeSessionId);
        try {
          await finalizeSession(
            opencodeSessionId,
            state,
            "OpenCode session idle",
            "completed",
            {
              completeTask: false,
              completionReason: "idle",
              metadata: { idleEvent: true },
              markEnded: false,
              keepSessionInfo: true,
              markSuspended: true
            }
          );
        } finally {
          finalizingSessionIds.delete(opencodeSessionId);
        }
        return;
      }

      if (event.type === "tui.command.execute") {
        const commandName = toNonEmptyString((event.properties as Record<string, unknown>).command);
        if (!isExitCommandName(commandName)) return;

        debugExitLog("exit command detected from tui.command.execute", {
          commandName
        });

        await finalizeForExitAcrossActiveSessions("tui.command.execute");
        return;
      }

      // This shutdown event is present in the current @opencode-ai/sdk Event union
      // even though the public docs event list does not enumerate it.
      if (event.type === "server.instance.disposed") {
        debugExitLog("exit/dispose event detected", {
          eventType: event.type
        });
        await finalizeForExitAcrossActiveSessions(event.type);
        return;
      }

      if (event.type === "command.executed") {
        const eventProperties = event.properties as Record<string, unknown>;
        const commandName = extractExitCommandNameFromEvent(eventProperties);
        if (!isExitCommandName(commandName)) return;
        debugExitLog("exit command detected", {
          commandName,
          propertyKeys: Object.keys(eventProperties)
        });

        const opencodeSessionId = extractSessionIdFromCommandEvent(eventProperties);
        if (!opencodeSessionId) {
          debugExitLog("session id not resolved for exit command", {
            commandName,
            propertyKeys: Object.keys(eventProperties)
          });
          return;
        }
        await finalizeForExitCommand(opencodeSessionId);
        return;
      }

      if (event.type !== "session.deleted") return;

      const opencodeSessionId = event.properties.info.id;
      if (finalizingSessionIds.has(opencodeSessionId)) return;
      const state = sessionStates.get(opencodeSessionId)
        ?? await pendingSessionStarts.get(opencodeSessionId)
        ?? undefined;

      if (!state) {
        await finalizeByRuntimeSession({
          opencodeSessionId,
          summary: "OpenCode session ended"
        });
        return;
      }
      finalizingSessionIds.add(opencodeSessionId);
      try {
        await finalizeSession(opencodeSessionId, state, "OpenCode session ended", "completed", {
          completeTask: true,
          completionReason: "runtime_terminated"
        });
      } finally {
        finalizingSessionIds.delete(opencodeSessionId);
      }
    },

    "tool.execute.before": async (input, output) => {
      const state = await ensureSessionState({ sessionId: input.sessionID });
      if (!state) return;

      const toolName = typeof input.tool === "string" ? input.tool : "unknown";
      const callId = toNonEmptyString(input.callID);
      clearProvisionalBackgroundLinks(state.taskId, callId);
      for (const launchHint of extractBackgroundLaunchHints({
        toolName,
        args: output.args,
        state,
        callId
      })) {
        pendingBackgroundLinks.set(launchHint.childSessionId, launchHint);
      }
    },

    "tool.execute.after": async (input, output) => {
      const state = sessionStates.get(input.sessionID)
        ?? await pendingSessionStarts.get(input.sessionID)
        ?? await ensureSessionState({ sessionId: input.sessionID })
        ?? undefined;
      if (!state) return;

      const toolName = typeof input.tool === "string" ? input.tool : "unknown";
      const callId = toNonEmptyString(input.callID);
      if (callId && state.seenToolCallIds.has(callId)) {
        return;
      }
      if (callId) {
        state.seenToolCallIds.add(callId);
      }

      const backgroundLink = extractBackgroundTaskLink({
        toolName,
        args: input.args,
        state,
        outputText: typeof output.output === "string" ? output.output : undefined,
        outputMetadata: output.metadata,
        outputTitle: output.title
      });
      const backgroundLinks = [
        ...(backgroundLink ? [backgroundLink] : []),
        ...extractParallelBackgroundLinks({
          toolName,
          args: input.args,
          state,
          outputText: typeof output.output === "string" ? output.output : undefined
        })
      ].map((linkedBackground) => {
        const inheritedLink = findBackgroundAncestorLink(linkedBackground.title);
        return {
          ...linkedBackground,
          ...(inheritedLink?.taskId ? { taskId: inheritedLink.taskId } : {})
        };
      });
      clearProvisionalBackgroundLinks(state.taskId, callId);
      for (const initialLinkedBackground of backgroundLinks) {
        let linkedBackground = initialLinkedBackground;
        const reusablePrimary = findReusablePrimarySubagentState(linkedBackground.title);
        if (reusablePrimary && reusablePrimary.state.taskId !== linkedBackground.taskId) {
          const promotedState = await promoteSessionStateToBackground({
            sessionId: reusablePrimary.sessionId,
            state: reusablePrimary.state,
            backgroundLink: linkedBackground
          });
          if (promotedState) {
            linkedBackground = {
              ...linkedBackground,
              taskId: promotedState.taskId
            };
          }
        }

        pendingBackgroundLinks.set(linkedBackground.childSessionId, linkedBackground);

        const childState = sessionStates.get(linkedBackground.childSessionId)
          ?? await pendingSessionStarts.get(linkedBackground.childSessionId)
          ?? undefined;

        if (childState && childState.taskKind !== "background") {
          const linkResult = await post("/api/task-link", {
            taskId: childState.taskId,
            ...(linkedBackground.title ? { title: linkedBackground.title } : {}),
            taskKind: "background",
            parentTaskId: linkedBackground.parentTaskId,
            ...(linkedBackground.parentSessionId ? { parentSessionId: linkedBackground.parentSessionId } : {}),
            ...(linkedBackground.backgroundTaskId ? { backgroundTaskId: linkedBackground.backgroundTaskId } : {})
          });

          // Only flip local state to "background" when the server confirmed the link.
          // If the POST failed, the DB row remains "primary"; leaving the local state
          // as-is ensures session.deleted will send completeTask:true and close the task.
          if (linkResult !== null) {
            sessionStates.set(linkedBackground.childSessionId, {
              ...childState,
              taskKind: "background",
              backgroundLinkConfirmed: true,
              parentTaskId: linkedBackground.parentTaskId,
              parentSessionId: linkedBackground.parentSessionId,
              backgroundTaskId: linkedBackground.backgroundTaskId,
              backgroundTitle: linkedBackground.title ?? childState.backgroundTitle
            });
          }
        }

        await post("/api/async-task", {
          taskId: state.taskId,
          sessionId: state.monitorSessionId,
          asyncTaskId: linkedBackground.backgroundTaskId ?? linkedBackground.childSessionId,
          asyncStatus: "running",
          title: linkedBackground.title ?? output.title ?? "Background task launched",
          ...(state.monitorSessionId ? { parentSessionId: state.monitorSessionId } : {}),
          metadata: {
            opencodeSessionId: input.sessionID,
            ...(linkedBackground.backgroundTaskId ? { backgroundTaskId: linkedBackground.backgroundTaskId } : {}),
            childSessionId: linkedBackground.childSessionId
          }
        });
      }

      if (isTodoWriteTool(toolName.toLowerCase())) {
        const todos = Array.isArray(input.args?.todos)
          ? input.args.todos as unknown[]
          : [];
        if (todos.length > 0) {
          await logTodoTransitions({
            state,
            opencodeSessionId: input.sessionID,
            todos
          });
        }
        return;
      }

      const semanticRoutes = buildSemanticRoutes({
        toolName,
        args: input.args,
        state,
        opencodeSessionId: input.sessionID,
        opencodeCallId: input.callID,
        outputTitle: output.title,
        outputText: typeof output.output === "string" ? output.output : undefined
      });
      if (semanticRoutes.length > 0) {
        for (const semanticRoute of semanticRoutes) {
          await post(semanticRoute.endpoint, semanticRoute.body);
        }
        return;
      }

      const { endpoint, lane, activityType } = classifyTool(toolName);
      const filePaths = extractFilePaths(
        input.args,
        output.metadata,
        output.title,
        typeof output.output === "string" ? output.output : undefined
      );
      const effectiveLane = state.taskKind === "background"
        ? "background"
        : lane;

      const body: Record<string, unknown> = {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        toolName,
        title: output.title || toolName,
        body: typeof output.output === "string" ? output.output.slice(0, 500) : undefined,
        metadata: {
          opencodeSessionId: input.sessionID,
          opencodeCallId: input.callID,
          toolInput: asObject(input.args)
        },
        ...(filePaths.length > 0 ? { filePaths } : {}),
        ...(effectiveLane ? { lane: effectiveLane } : {})
      };

      if (endpoint === "/api/agent-activity") {
        await post(endpoint, {
          ...body,
          activityType: activityType ?? "agent_step",
        });
      } else if (endpoint === "/api/explore") {
        await post(endpoint, body);
      } else if (endpoint === "/api/terminal-command") {
        await post(endpoint, {
          ...body,
          command: typeof input.args?.command === "string" ? input.args.command : toolName
        });
      } else {
        await post(endpoint, body);
      }
    }
  };
}

export const MonitorPlugin: Plugin = async ({ directory }) => createMonitorHooks(directory || process.cwd());
