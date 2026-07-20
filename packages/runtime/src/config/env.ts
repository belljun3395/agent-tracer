/** 수집기가 읽는 환경변수를 타입 지정 설정으로 해석한다. */
import {resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";

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

export function resolveMonitorTransportConfig(env: NodeJS.ProcessEnv = process.env): MonitorTransportConfig {
    const taskIdOverride = (env.MONITOR_TASK_ID ?? "").trim();
    const taskTitleOverride = (env.MONITOR_TASK_TITLE ?? "").trim();
    const rawOrigin = (env.MONITOR_TASK_ORIGIN ?? "").trim();
    const taskOriginOverride: MonitorTaskOrigin | undefined =
        rawOrigin === "user" || rawOrigin === "server-sdk" ? rawOrigin : undefined;
    return {
        baseUrl: resolveMonitorIdentity(env).baseUrl,
        taskIdOverride: taskIdOverride || undefined,
        taskTitleOverride: taskTitleOverride || undefined,
        taskOriginOverride,
    };
}

/** Claude Code가 MCP 서버 프로세스에 심어 주는, 그 서버가 딸린 세션의 식별자다. */
export function resolveClaudeSessionId(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const sessionId = (env.CLAUDE_CODE_SESSION_ID ?? "").trim();
    return sessionId || undefined;
}

/** 개발 모드에서만 훅 로그를 stderr로도 흘린다. */
export function isVerboseLogging(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV === "development";
}
