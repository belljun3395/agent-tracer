import { loadApplicationConfig } from "@monitor/platform";
import { AgentGraphClient, DurableCompletionInbox } from "@monitor/llm-runtime";
import type { AgentCompletionInboxRepository } from "@monitor/tracer-domain";
import { resolveChatCallbackConfig } from "~tracer-api/config/chat.callback.config.js";

// graph 백엔드는 실행을 요청한 HTTP 연결이 아니라 tracer-api 전용 완료 창구로 결과를 되받으므로, DB 완료 창구를 폴링하는 클라이언트로 부른다.
export function buildChatGraphClient(completionInbox: AgentCompletionInboxRepository): AgentGraphClient {
    const { agentGraph } = loadApplicationConfig();
    const { url: callbackUrl } = resolveChatCallbackConfig();
    return new AgentGraphClient(agentGraph.url, new DurableCompletionInbox(callbackUrl, completionInbox));
}
