/**
 * Claude Agent SDK `query()` 한 번의 실행 경계. 에이전트(프롬프트 작성 + zod 파싱)는
 * 서버에 남고, 쿼리 실행만 이 포트에 위임한다. {@link LocalQueryRunner}가 서버
 * 프로세스 안에서 실행한다.
 */
export interface AgentQueryRequest {
    /** Short label for logging/observability, e.g. "rule-suggestion". */
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
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
}

export interface AgentQueryResult {
    /** Final assistant/result text — the agent parses this with its own schema. */
    readonly rawOutput: string;
    readonly durationMs: number;
    /** Non-null when the SDK reported a failure result (not an exception). */
    readonly errorSummary: string | null;
}

export interface IQueryRunner {
    /** 서버가 Anthropic API 키를 직접 공급해야 하는지 여부. */
    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest): Promise<AgentQueryResult>;
}

export const QUERY_RUNNER = "QUERY_RUNNER";
