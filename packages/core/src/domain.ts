/** 타임라인 이벤트가 속하는 레인. 대시보드에서 수직 구역으로 표시됨. */
export type TimelineLane = "user" | "exploration" | "planning" | "implementation" | "rules" | "questions" | "todos" | "thoughts";

/**
 * 캐노니컬 user.message 메타데이터 계약 (contractVersion "1").
 *
 * 메타데이터 키 정의:
 *   messageId      — 클라이언트 할당 메시지 ID (중복 방지용)
 *   captureMode    — "raw" | "derived"
 *                    raw: 실제 사용자 입력 텍스트
 *                    derived: raw 이벤트에서 파생된 보강 레코드 (sourceEventId 필수)
 *   source         — 이미터 식별자 (opencode-plugin | claude-hook | manual-mcp | <custom>)
 *   phase          — "initial" | "follow_up" — 작업 내 첫 메시지 vs. 후속 메시지
 *   sourceEventId  — captureMode=derived 시 raw 소스 이벤트 ID (derived 시 필수)
 *   contractVersion — "1" (이 계약 버전)
 *
 * 자동 이미터 규칙:
 *   - source=opencode-plugin 또는 claude-hook 는 항상 sessionId를 제공해야 한다.
 *   - 런타임이 raw 프롬프트를 노출하지 않는 경우 fake raw 이벤트를 생성하지 말고
 *     ruleId="user-message-capture-unavailable" 로 /api/rule 을 호출해야 한다.
 *
 * 세션-종료 vs. 태스크-완료:
 *   - /api/session-end 는 현재 런타임 세션만 종료하며 task.status 를 변경하지 않는다.
 *   - /api/task-complete 만이 작업 항목을 명시적으로 닫는다.
 *   - 자동 런타임 종료(session.deleted, Claude Stop) 는 반드시 session-end 를 사용해야 한다.
 */
export const USER_MESSAGE_CONTRACT_VERSION = "1" as const;

/** 에이전트가 작업 중에 발생시키는 이벤트 종류. */
export type MonitoringEventKind =
  | "task.start"
  | "task.complete"
  | "task.error"
  | "plan.logged"
  | "action.logged"
  | "verification.logged"
  | "rule.logged"
  | "tool.used"
  | "terminal.command"
  | "context.saved"
  | "file.changed"
  | "thought.logged"
  | "user.message"
  | "question.logged"
  | "todo.logged";

/** 태스크 생성에 필요한 최소 입력 데이터. */
export interface MonitoringTaskInput {
  readonly title: string;
  readonly workspacePath?: string;
}

/** 모니터링 태스크. 하나의 에이전트 세션(또는 연속된 세션)을 나타냄. */
export interface MonitoringTask extends MonitoringTaskInput {
  readonly id: string;
  readonly slug: string;
  readonly status: "running" | "completed" | "errored";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  /** 이벤트를 생성한 CLI 소스 (예: claude-hook, opencode-plugin). */
  readonly cliSource?: string;
}

/** 태스크 내 단일 에이전트 실행 세션. */
export interface MonitoringSession {
  readonly id: string;
  readonly taskId: string;
  readonly status: "running" | "completed" | "errored";
  readonly summary?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

/** 이벤트 분류에서 특정 규칙이 매치된 이유. prefix 매치 또는 keyword 매치. */
export interface EventClassificationReason {
  readonly kind: "keyword" | "prefix" | "action-prefix" | "action-keyword";
  readonly value: string;
}

/** 단일 규칙에 대한 이벤트 매치 결과. 점수와 매치 이유 포함. */
export interface EventClassificationMatch {
  readonly ruleId: string;
  readonly source?: "rules-index" | "action-registry";
  readonly score: number;
  readonly lane?: TimelineLane;
  readonly tags: readonly string[];
  readonly reasons: readonly EventClassificationReason[];
}

/** 이벤트 분류 결과. 레인, 태그, 매치 목록 포함. */
export interface EventClassification {
  readonly lane: TimelineLane;
  readonly tags: readonly string[];
  readonly matches: readonly EventClassificationMatch[];
}

/** 태스크 타임라인에 기록되는 단일 이벤트. */
export interface TimelineEvent {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly classification: EventClassification;
  readonly createdAt: string;
}

/** 워크스페이스 경로에서 중복 슬래시를 제거하고 끝의 슬래시를 정리. */
export function normalizeWorkspacePath(path: string): string {
  const normalized = path.trim().replace(/\/+/g, "/");

  return normalized.endsWith("/") && normalized !== "/"
    ? normalized.slice(0, -1)
    : normalized;
}

/** 태스크 제목으로부터 URL-safe 슬러그 생성 (최대 64자). */
export function createTaskSlug(input: MonitoringTaskInput): string {
  const source = input.title.trim().toLowerCase();

  return source
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** 이벤트 종류에 따른 기본 타임라인 레인 반환. */
export function defaultLaneForEventKind(kind: MonitoringEventKind): TimelineLane {
  switch (kind) {
    case "verification.logged":
    case "rule.logged":
      return "rules";
    case "action.logged":
      return "implementation";
    case "plan.logged":
    case "context.saved":
      return "planning";
    case "file.changed":
      return "exploration";
    case "terminal.command":
    case "tool.used":
      return "implementation";
    case "task.start":
    case "task.complete":
    case "task.error":
    case "user.message":
      return "user";
    case "question.logged":
      return "questions";
    case "todo.logged":
      return "todos";
    case "thought.logged":
      return "thoughts";
  }
}

/** question.logged 이벤트의 단계. asked/answered는 user 레인, concluded는 planning 레인. */
export type QuestionPhase = "asked" | "answered" | "concluded";

/** todo.logged 이벤트의 상태. */
export type TodoState = "added" | "in_progress" | "completed" | "cancelled";

/**
 * 캐노니컬 question/todo/thought 메타데이터 계약.
 *
 * question.logged 메타데이터 키:
 *   questionId     — 클라이언트 할당 안정 ID (같은 질문 흐름의 이벤트 그룹화에 사용)
 *   questionPhase  — "asked" | "answered" | "concluded"
 *   sequence       — 같은 밀리초 이벤트의 결정론적 순서 (숫자)
 *
 * todo.logged 메타데이터 키:
 *   todoId         — 클라이언트 할당 안정 ID
 *   todoState      — "added" | "in_progress" | "completed" | "cancelled"
 *   sequence       — 결정론적 순서
 *
 * model/MCP 공통 메타데이터 키 (모든 이벤트에 선택적으로 추가 가능):
 *   modelName      — AI 모델명 (예: "claude-opus-4-6")
 *   modelProvider  — AI 제공자 (예: "anthropic")
 *   mcpServer      — MCP 서버명 (예: "monitor-server")
 *   mcpTool        — MCP 도구명 (예: "monitor_tool_used")
 */
export const TRACE_METADATA_KEYS = {
  questionId: "questionId",
  questionPhase: "questionPhase",
  todoId: "todoId",
  todoState: "todoState",
  sequence: "sequence",
  modelName: "modelName",
  modelProvider: "modelProvider",
  mcpServer: "mcpServer",
  mcpTool: "mcpTool"
} as const;

/** DB에 저장된 구버전 lane 값을 현재 레인 이름으로 정규화. */
export function normalizeLane(raw: string): TimelineLane {
  switch (raw) {
    case "file":      return "exploration";
    case "terminal":  return "implementation";
    case "tool":      return "implementation";
    case "thought":   return "planning";
    case "message":   return "user";
    // already-normalized values pass through
    case "user":
    case "exploration":
    case "planning":
    case "implementation":
    case "rules":
    case "questions":
    case "todos":
    case "thoughts":
      return raw as TimelineLane;
    default:
      return "user";
  }
}
