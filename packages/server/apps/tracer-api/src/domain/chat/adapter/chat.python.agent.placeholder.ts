import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { ChatBackendNotImplementedError } from "~tracer-api/domain/chat/model/chat.error.js";
import type { ChatTurnInput, ChatTurnResult, ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~tracer-api/domain/chat/port/chat.agent.port.js";

/** 레지스트리 타입을 전 백엔드로 채우기 위한 python 자리이며, 이후 단계가 실제 HTTP 백엔드로 대체한다. */
export class ChatPythonAgentPlaceholder implements ChatAgentPort {
    requiresLocalApiKey(): boolean {
        return false;
    }

    converse(_input: ChatTurnInput, _sink: ChatTurnSink): Promise<ChatTurnResult> {
        return Promise.reject(new ChatBackendNotImplementedError(AI_AGENT_BACKEND.python));
    }
}
