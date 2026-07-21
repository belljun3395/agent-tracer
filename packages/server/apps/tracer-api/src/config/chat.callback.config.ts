import os from "node:os";
import { resolveCallbackUrl } from "@monitor/platform";

// ai-agent-worker와 별도 프로세스이므로 완료 콜백 포트를 공유하면 한 호스트에 둘 다 뜰 때 리스너가 충돌한다.
const DEFAULT_CHAT_CALLBACK_PORT = 8811;

export interface ChatCallbackConfig {
    readonly port: number;
    readonly url: string;
}

/** 대화 그래프 백엔드가 완료를 되돌려줄 tracer-api 전용 콜백 창구 설정이다. */
export function resolveChatCallbackConfig(
    env: NodeJS.ProcessEnv = process.env,
    hostname: string = os.hostname(),
): ChatCallbackConfig {
    const port = envInt(env, "CHAT_AGENT_CALLBACK_PORT", DEFAULT_CHAT_CALLBACK_PORT);
    const host = env["CHAT_AGENT_CALLBACK_HOST"]?.trim() || hostname;
    return {
        port,
        url: resolveCallbackUrl(env["CHAT_AGENT_CALLBACK_URL"], undefined, host, port),
    };
}

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}
