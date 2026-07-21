import { AGENT_BACKEND, normalizeAgentBackend, type AgentBackend } from "@monitor/llm-runtime";

/** 워커의 기본 실행 백엔드이며 워크플로 샌드박스에는 process가 없어 배선 계층이 읽는다. */
export function resolveDefaultAgentBackend(profile: string, env: NodeJS.ProcessEnv = process.env): AgentBackend {
    // local 프로파일은 API 키 없이 도는 claude-sdk를 기본값으로 써 키 설정 없이 에이전트를 돌린다.
    const fallback = profile === "local" ? AGENT_BACKEND.claudeSdk : AGENT_BACKEND.python;
    return normalizeAgentBackend(env["AGENT_BACKEND"], fallback);
}
