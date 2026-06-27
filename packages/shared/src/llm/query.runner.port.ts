/**
 * Claude Agent SDK `query()` 한 번의 실행 경계. 에이전트(프롬프트 작성 + zod 파싱)는
 * 서버에 남고, 쿼리 실행만 이 포트에 위임한다. {@link LocalQueryRunner}가 서버
 * 프로세스 안에서 실행한다.
 */
export interface AgentQueryRequest {
    /** Short label for logging/observability, e.g. "rule-suggestion". */
    readonly label: string;
    readonly prompt: string;
    /** System prompt. In the default ("replace") mode this is the full prompt. When
     * {@link useClaudeCodePreset} is set, it is *appended* to Claude Code's preset
     * instead — keep it static (no per-call interpolation) so the cached prefix hits. */
    readonly systemPrompt: string;
    /** Run on top of Claude Code's preset system prompt (tool-use scaffolding for
     * Read/Glob/Grep) with {@link systemPrompt} as the append, instead of replacing
     * the whole prompt. Recommended for tool-using, multi-turn workspace agents. */
    readonly useClaudeCodePreset?: boolean;
    /** With {@link useClaudeCodePreset}, strip per-session dynamic sections
     * (cwd / auto-memory / git status) from the preset so the cacheable prefix stays
     * byte-stable across workspaces; the SDK re-injects them as the first user message. */
    readonly excludeDynamicSections?: boolean;
    readonly allowedTools: readonly string[];
    /** Workspace directory the SDK tools read; omitted → the runner's own cwd. */
    readonly cwd?: string;
    readonly model: string;
    readonly maxTurns: number;
    /** Wall-clock abort deadline for the query (the SDK has no init timeout). */
    readonly deadlineMs: number;
    /** Extra process env for the spawned SDK (e.g. MONITOR_TASK_*). The API key
     * is included here only by the local runner; the remote runner strips it. */
    readonly env: Readonly<Record<string, string | undefined>>;
    /** JSON Schema for the agent's final answer. When set, the runner enables the
     * SDK's structured-output mode (outputFormat) instead of free-form text: the
     * model is constrained to the schema, the SDK retries schema violations on its
     * own, and the parsed object returns on {@link AgentQueryResult.structuredOutput}. */
    readonly outputSchema?: Record<string, unknown>;
}

/** Token usage the SDK reports for one query (includes prompt-cache counters). */
export interface AgentQueryUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
}

export interface AgentQueryResult {
    /** Final result text. Empty under structured-output mode — read structuredOutput. */
    readonly rawOutput: string;
    /** SDK-validated structured output when outputSchema was supplied; else null. */
    readonly structuredOutput: unknown;
    readonly durationMs: number;
    /** Turns (assistant↔tool loops) the SDK consumed; null if no result message. */
    readonly numTurns: number | null;
    /** Cost in USD the SDK reported for this query; null if unavailable. */
    readonly costUsd: number | null;
    /** Token usage incl. cache read/creation; null if unavailable. */
    readonly usage: AgentQueryUsage | null;
    /** Non-null when the SDK reported a failure result (not an exception). */
    readonly errorSummary: string | null;
    /** SDK failure subtype (error_max_turns | error_during_execution | …); null on success. */
    readonly errorSubtype: string | null;
}

export interface IQueryRunner {
    /** 서버가 Anthropic API 키를 직접 공급해야 하는지 여부. */
    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest): Promise<AgentQueryResult>;
}

export const QUERY_RUNNER = "QUERY_RUNNER";
