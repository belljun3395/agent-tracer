/** 수집기가 읽는 환경변수를 타입 지정 설정으로 해석한다. */

export type MonitorTaskOrigin = "user" | "server-sdk";

export interface MonitorTransportConfig {
    readonly baseUrl: string;
    readonly taskIdOverride: string | undefined;
    readonly taskTitleOverride: string | undefined;
    readonly taskOriginOverride: MonitorTaskOrigin | undefined;
}

export const CLAUDE_RUNTIME_SOURCE = "claude-plugin";

/** Claude Code가 넘겨주는 워크스페이스 루트이며 없으면 프로세스 cwd를 쓴다. */
export function resolveProjectDir(env: NodeJS.ProcessEnv = process.env): string {
    return env.CLAUDE_PROJECT_DIR || process.cwd();
}

export function resolveMonitorBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = (env.MONITOR_BASE_URL ?? "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const port = parseInt(env.MONITOR_PORT ?? "", 10) || 3847;
    const host = (env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
    return `http://${host}:${port}`;
}

export function resolveMonitorTransportConfig(env: NodeJS.ProcessEnv = process.env): MonitorTransportConfig {
    const taskIdOverride = (env.MONITOR_TASK_ID ?? "").trim();
    const taskTitleOverride = (env.MONITOR_TASK_TITLE ?? "").trim();
    const rawOrigin = (env.MONITOR_TASK_ORIGIN ?? "").trim();
    const taskOriginOverride: MonitorTaskOrigin | undefined =
        rawOrigin === "user" || rawOrigin === "server-sdk" ? rawOrigin : undefined;
    return {
        baseUrl: resolveMonitorBaseUrl(env),
        taskIdOverride: taskIdOverride || undefined,
        taskTitleOverride: taskTitleOverride || undefined,
        taskOriginOverride,
    };
}

/** 모니터 API 요청에 런타임 사용자를 식별하는 헤더를 붙인다. */
export function monitorUserHeader(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
    const email = (env.MONITOR_USER_EMAIL ?? "").trim();
    return email ? {"x-monitor-user": email} : {};
}

/** 개발 모드에서만 훅 로그를 stderr로도 흘린다. */
export function isVerboseLogging(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV === "development";
}
