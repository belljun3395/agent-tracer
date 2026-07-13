import { normalizeAgentBackend, type AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";

/** 워커의 기본 실행 백엔드이며 워크플로 샌드박스에는 process가 없어 배선 계층이 읽는다. */
export function resolveDefaultAgentBackend(env: NodeJS.ProcessEnv = process.env): AgentBackend {
    return normalizeAgentBackend(env["AGENT_BACKEND"]);
}
