/** 에이전트를 실행하는 두 백엔드이며 잡 입력이 워커 기본값보다 우선한다. */
export const AGENT_BACKEND = {
    python: "python",
    claudeSdk: "claude-sdk",
} as const;

export type AgentBackend = (typeof AGENT_BACKEND)[keyof typeof AGENT_BACKEND];

export const DEFAULT_AGENT_BACKEND: AgentBackend = AGENT_BACKEND.python;

export function normalizeAgentBackend(
    value: unknown,
    fallback: AgentBackend = DEFAULT_AGENT_BACKEND,
): AgentBackend {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === AGENT_BACKEND.python) return AGENT_BACKEND.python;
    if (normalized === AGENT_BACKEND.claudeSdk || normalized === "ts") return AGENT_BACKEND.claudeSdk;
    return fallback;
}
