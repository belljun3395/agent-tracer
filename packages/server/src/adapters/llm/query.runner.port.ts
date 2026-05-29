/**
 * Boundary for a single Claude Agent SDK `query()` execution — the only part of
 * an agent that must run where the workspace lives. Agents (prompt building +
 * zod parsing + orchestration) stay on the server; they delegate just the
 * query call to this port.
 *
 * - Local / single process (default): {@link LocalQueryRunner} runs `query()`
 *   in-process, where the server is co-located with the workspace.
 * - Cloud (server remote, runtime local): {@link RemoteQueryRunner} dispatches
 *   the request to the local runtime daemon, which runs `query()` next to the
 *   workspace (the SDK's Read/Glob/Grep read the local filesystem via `cwd`).
 *   The Anthropic API key is never forwarded — the runtime supplies its own.
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
    /**
     * Whether the server must supply the Anthropic API key. True for the
     * in-process runner; false for the remote runner (the runtime holds its
     * own local key). Agents expose this so consumers can gate their key check.
     */
    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest): Promise<AgentQueryResult>;
}

export const QUERY_RUNNER = "QUERY_RUNNER";
