import type { ApplicationConfig } from "./application.config.schema.js";

type AgentGraphConfig = ApplicationConfig["agentGraph"];

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}

/** 명시 설정과 실행 호스트를 바탕으로 에이전트 도구 콜백 주소를 정한다. */
export function resolveToolCallbackUrl(
    explicitUrl: string | undefined,
    yamlUrl: string | undefined,
    host: string,
    port: number,
): string {
    return explicitUrl || yamlUrl || `http://${host}:${port}`;
}

/** 명시 식별자가 없을 때 실행 호스트를 워커 복제본 식별자로 사용한다. */
export function resolveToolCallbackInstanceId(explicitId: string | undefined, host: string): string {
    return explicitId?.trim() || host;
}

/** 에이전트 사이드카와 워커 콜백 연결 설정을 환경별 우선순위로 조립한다. */
export function buildAgentGraphConfig(
    source: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
    hostname: string,
): AgentGraphConfig {
    const toolCallbackPort = envInt(
        env,
        "AGENT_TOOL_CALLBACK_PORT",
        (source["toolCallbackPort"] as number | undefined) ?? 8810,
    );
    const toolCallbackHost = env["AGENT_TOOL_CALLBACK_HOST"]?.trim() || hostname;

    return {
        url: env["AGENT_GRAPH_URL"] ?? (source["url"] as string | undefined) ?? "http://127.0.0.1:8800",
        toolCallbackPort,
        toolCallbackUrl: resolveToolCallbackUrl(
            env["AGENT_TOOL_CALLBACK_URL"],
            source["toolCallbackUrl"] as string | undefined,
            toolCallbackHost,
            toolCallbackPort,
        ),
        instanceId: resolveToolCallbackInstanceId(env["AGENT_TOOL_CALLBACK_INSTANCE_ID"], toolCallbackHost),
    };
}
