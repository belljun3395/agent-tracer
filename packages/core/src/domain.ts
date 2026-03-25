/** 타임라인 이벤트가 속하는 레인. 대시보드에서 수직 구역으로 표시됨. */
export type TimelineLane =
  | "user"
  | "exploration"
  | "planning"
  | "implementation"
  | "questions"
  | "todos"
  | "background"
  | "coordination";

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
 *   - sessionId는 모든 호출자에게 필수다 (서버가 자동으로 세션을 유추하지 않는다).
 *   - 런타임이 raw 프롬프트를 노출하지 않는 경우 fake raw 이벤트를 생성하지 말고
 *     ruleId="user-message-capture-unavailable" 로 /api/rule 을 호출해야 한다.
 *
 * 세션-종료 vs. 태스크-완료:
 *   - /api/session-end 및 /api/runtime-session-end 는 현재 런타임 세션만 종료한다.
 *   - primary 태스크는 /api/task-complete 로 명시적으로 닫는다.
 *   - background 태스크는 마지막 running 세션 종료 시 자동 완료될 수 있다.
 *   - Claude 훅은 runtime-session adapter 로 동작하며 primary 태스크를 자동 완료하지 않는다.
 *   - OpenCode plugin/SSE adapter 는 primary session 종료에서만 completeTask=true 를 보낼 수 있다.
 *   - 세부 정책은 runtime capability registry 를 따른다.
 */
export const USER_MESSAGE_CONTRACT_VERSION = "1" as const;

/** 에이전트가 작업 중에 발생시키는 이벤트 종류. */
export type MonitoringEventKind =
  | "task.start"
  | "task.complete"
  | "task.error"
  | "plan.logged"
  | "action.logged"
  | "agent.activity.logged"
  | "verification.logged"
  | "rule.logged"
  | "tool.used"
  | "terminal.command"
  | "context.saved"
  | "file.changed"
  | "thought.logged"
  | "user.message"
  | "question.logged"
  | "todo.logged"
  | "assistant.response";

export type MonitoringTaskKind = "primary" | "background";

/** 태스크 생성에 필요한 최소 입력 데이터. */
export interface MonitoringTaskInput {
  readonly title: string;
  readonly workspacePath?: string;
  readonly taskKind?: MonitoringTaskKind;
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
}

/** 모니터링 태스크. 하나의 에이전트 세션(또는 연속된 세션)을 나타냄. */
export interface MonitoringTask extends MonitoringTaskInput {
  readonly id: string;
  readonly slug: string;
  readonly displayTitle?: string;
  readonly status: "running" | "waiting" | "completed" | "errored";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  /** 이벤트 출처 소스 (read-model, 파생값). 예: claude-hook, codex-skill, opencode-plugin, opencode-sse, manual-mcp */
  readonly runtimeSource?: string;
  readonly taskKind?: MonitoringTaskKind;
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

/** 이벤트 분류에서 특정 규칙이 매치된 이유. keyword 또는 action 기반 매치. */
export interface EventClassificationReason {
  readonly kind: "keyword" | "action-prefix" | "action-keyword";
  readonly value: string;
}

/** 단일 규칙에 대한 이벤트 매치 결과. 점수와 매치 이유 포함. */
export interface EventClassificationMatch {
  readonly ruleId: string;
  readonly source?: "action-registry";
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

/** 카드 간 관계를 설명하는 고수준 의미 레이블. */
export type EventRelationType =
  | "implements"
  | "revises"
  | "verifies"
  | "answers"
  | "delegates"
  | "returns"
  | "completes"
  | "blocks"
  | "caused_by"
  | "relates_to";

/** 에이전트 관측용 coordination 레인 활동 종류. */
export type AgentActivityType =
  | "agent_step"
  | "mcp_call"
  | "skill_use"
  | "delegation"
  | "handoff"
  | "bookmark"
  | "search";

/** 태스크 워크플로우 평가 레코드. */
export interface TaskEvaluation {
  readonly taskId: string;
  readonly rating: "good" | "skip";
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly evaluatedAt: string;
}

/** 워크플로우 라이브러리 목록 항목 (workflowContext 제외). */
export interface WorkflowSummary {
  readonly taskId: string;
  readonly title: string;
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly rating: "good" | "skip";
  readonly eventCount: number;
  readonly createdAt: string;
  readonly evaluatedAt: string;
}

/** 유사 워크플로우 검색 결과. */
export interface WorkflowSearchResult {
  readonly taskId: string;
  readonly title: string;
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly rating: string;
  readonly eventCount: number;
  readonly createdAt: string;
  readonly workflowContext: string;
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
      return "implementation";
    case "action.logged":
      return "implementation";
    case "agent.activity.logged":
      return "coordination";
    case "plan.logged":
    case "context.saved":
      return "planning";
    case "file.changed":
      return "implementation";
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
      return "planning";
    case "assistant.response":
      return "user";
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
 * relation/activity 메타데이터 키:
 *   parentEventId   — 현재 이벤트가 직접 이어받는 상위 이벤트 ID
 *   relatedEventIds — 추가 연관 이벤트 ID 목록
 *   workItemId      — todo/question을 넘어 작업 단위를 묶는 안정 ID
 *   goalId          — 상위 목표 식별자
 *   planId          — 계획 식별자
 *   handoffId       — handoff/delegation 식별자
 *   relationType    — 카드 간 관계 의미
 *   relationLabel   — UI에 표시할 짧은 관계 레이블
 *   relationExplanation — 관계를 설명하는 한 줄 설명
 *   activityType    — coordination 레인 활동 유형
 *   agentName       — 활동 주체 에이전트 이름
 *   skillName       — 사용된 skill 이름
 *   skillPath       — 사용된 skill 경로
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
  parentEventId: "parentEventId",
  relatedEventIds: "relatedEventIds",
  workItemId: "workItemId",
  goalId: "goalId",
  planId: "planId",
  handoffId: "handoffId",
  relationType: "relationType",
  relationLabel: "relationLabel",
  relationExplanation: "relationExplanation",
  activityType: "activityType",
  agentName: "agentName",
  skillName: "skillName",
  skillPath: "skillPath",
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
    case "thoughts":  return "planning";
    case "message":   return "user";
    case "rules":      return "implementation";
    // already-normalized values pass through
    case "user":
    case "exploration":
    case "planning":
    case "implementation":
    case "questions":
    case "todos":
    case "background":
    case "coordination":
      return raw as TimelineLane;
    default:
      return "user";
  }
}
