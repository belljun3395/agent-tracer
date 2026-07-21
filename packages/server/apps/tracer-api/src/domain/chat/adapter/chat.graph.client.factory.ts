import { loadApplicationConfig } from "@monitor/platform";
import { AgentGraphStreamClient } from "@monitor/llm-runtime";

// 대화는 짧고 인터랙티브하므로 완료 창구 대신 실행을 요청한 HTTP 연결로 토큰을 라이브 스트리밍한다.
export function buildChatGraphStreamClient(): AgentGraphStreamClient {
    const { agentGraph } = loadApplicationConfig();
    return new AgentGraphStreamClient(agentGraph.url);
}
