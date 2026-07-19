import type { ApplicationConfig } from "./application.config.schema.js";

type AgentGraphConfig = ApplicationConfig["agentGraph"];

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}

/** 명시 설정과 실행 호스트를 바탕으로 실행 백엔드가 완료를 돌려줄 주소를 정한다. */
export function resolveCallbackUrl(
    explicitUrl: string | undefined,
    yamlUrl: string | undefined,
    host: string,
    port: number,
): string {
    return explicitUrl || yamlUrl || `http://${host}:${port}`;
}

/** 에이전트 실행 백엔드와 워커 완료 창구 연결 설정을 환경별 우선순위로 조립한다. */
export function buildAgentGraphConfig(
    source: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
    hostname: string,
): AgentGraphConfig {
    const callbackPort = envInt(env, "AGENT_CALLBACK_PORT", (source["callbackPort"] as number | undefined) ?? 8810);
    const callbackHost = env["AGENT_CALLBACK_HOST"]?.trim() || hostname;

    return {
        url: env["AGENT_GRAPH_URL"] ?? (source["url"] as string | undefined) ?? "http://127.0.0.1:8800",
        callbackPort,
        callbackUrl: resolveCallbackUrl(
            env["AGENT_CALLBACK_URL"],
            source["callbackUrl"] as string | undefined,
            callbackHost,
            callbackPort,
        ),
    };
}
