/**
 * Typed environment-variable loader for Agent Tracer runtimes.
 *
 * Each runtime (Claude Code plugin, Codex hooks, Codex app-server) picks its
 * own set of fields via the helpers below. Centralizing the reads keeps the
 * zero-runtime-dep design while making mocking trivial in tests.
 */

export interface MonitorTransportConfig {
    readonly baseUrl: string;
    readonly requestTimeoutMs: number;
    readonly taskIdOverride: string | undefined;
}

export interface RuntimeLoggingConfig {
    readonly enabled: boolean;
}

export function resolveMonitorBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = (env.MONITOR_BASE_URL ?? "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const port = parseInt(env.MONITOR_PORT ?? "", 10) || 3847;
    const host = (env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
    return `http://${host}:${port}`;
}

export function resolveMonitorTransportConfig(
    env: NodeJS.ProcessEnv = process.env,
): MonitorTransportConfig {
    const taskIdOverride = (env.MONITOR_TASK_ID ?? "").trim();
    return {
        baseUrl: resolveMonitorBaseUrl(env),
        requestTimeoutMs: 2000,
        taskIdOverride: taskIdOverride || undefined,
    };
}

export function resolveRuntimeLoggingConfig(
    env: NodeJS.ProcessEnv = process.env,
): RuntimeLoggingConfig {
    return {
        enabled: env.NODE_ENV === "development",
    };
}

export function resolveClaudeProjectDir(env: NodeJS.ProcessEnv = process.env): string {
    return (env.CLAUDE_PROJECT_DIR ?? "").trim() || process.cwd();
}

export function resolveCodexProjectDir(env: NodeJS.ProcessEnv = process.env): string {
    return (env.CODEX_PROJECT_DIR ?? "").trim() || process.cwd();
}
