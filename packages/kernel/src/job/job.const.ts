export const JOB_KIND = {
    titleSuggestion: "title.suggestion",
    recipeScan: "recipe.scan",
    taskCleanup: "task.cleanup",
    ruleGeneration: "rule.generation",
} as const;

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND];

export const AI_AGENT_BACKEND = {
    python: "python",
    claudeSdk: "claude-sdk",
} as const;

export type AiAgentBackend = (typeof AI_AGENT_BACKEND)[keyof typeof AI_AGENT_BACKEND];

export const DEFAULT_AI_AGENT_BACKEND: AiAgentBackend = AI_AGENT_BACKEND.python;

export function normalizeAiAgentBackend(
    value: unknown,
    fallback: AiAgentBackend = DEFAULT_AI_AGENT_BACKEND,
): AiAgentBackend {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === AI_AGENT_BACKEND.python) return AI_AGENT_BACKEND.python;
    if (normalized === AI_AGENT_BACKEND.claudeSdk || normalized === "ts") return AI_AGENT_BACKEND.claudeSdk;
    return fallback;
}

export const RULE_GENERATION_FOCUS = {
    recent: "recent",
} as const;

export type RuleGenerationFocus = (typeof RULE_GENERATION_FOCUS)[keyof typeof RULE_GENERATION_FOCUS];

// 프롬프트에 그대로 실리므로 입력 표면과 실행 표면이 같은 값으로 잘라야 하는 상한이다.
export const RULE_GENERATION_INTENT_MAX_LENGTH = 500;

// 빈 문자열을 잡 입력에 남기면 멱등 해시가 의도 없는 요청과 갈라지므로 공백뿐인 의도는 없는 것으로 본다.
export function normalizeRuleGenerationIntent(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    return trimmed.slice(0, RULE_GENERATION_INTENT_MAX_LENGTH);
}

// 레시피 스캔을 요청한 표면이며 앵커 자격 판정이 여기서 갈린다.
export const RECIPE_SCAN_TRIGGER = {
    dashboard: "dashboard",
    session: "session",
} as const;

export type RecipeScanTrigger = (typeof RECIPE_SCAN_TRIGGER)[keyof typeof RECIPE_SCAN_TRIGGER];

export const JOB_EXECUTOR = {
    [JOB_KIND.titleSuggestion]: "temporal",
    [JOB_KIND.recipeScan]: "temporal",
    [JOB_KIND.taskCleanup]: "temporal",
    [JOB_KIND.ruleGeneration]: "local",
} as const satisfies Record<JobKind, "temporal" | "local">;

export type JobExecutor = (typeof JOB_EXECUTOR)[JobKind];

export const JOB_STATUS = {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    canceled: "canceled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_STATUSES: readonly JobStatus[] = Object.values(JOB_STATUS);

// canceled를 종료 상태에 포함해야 워커의 종결 가드가 취소된 잡을 덮어쓰지 않는다.
export function isTerminalJobStatus(status: JobStatus): boolean {
    return (
        status === JOB_STATUS.completed || status === JOB_STATUS.failed || status === JOB_STATUS.canceled
    );
}

// 대기·실행 중인 잡만 취소할 수 있다.
export function isCancelableJobStatus(status: JobStatus): boolean {
    return status === JOB_STATUS.pending || status === JOB_STATUS.running;
}

// 로컬 실행기가 잡을 쥐고 있음을 알리는 리스의 수명이며 하트비트가 이보다 잦아야 한다.
export const LOCAL_JOB_LEASE_TTL_MS = 90_000;
export const LOCAL_JOB_LEASE_HEARTBEAT_MS = 30_000;
