import type { AiAgentBackend } from "@monitor/kernel";
import type { ChatTurnInput, ChatTurnResult, ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";

export const CHAT_AGENT_REGISTRY = Symbol("ChatAgentRegistry");

/** 한 실행 백엔드가 대화 턴을 실행하는 포트다. */
export interface ChatAgentPort {
    requiresLocalApiKey(): boolean;
    converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult>;
}

/** 실행 백엔드마다 하나씩, 전 백엔드를 덮는 레지스트리다. */
export type ChatAgentRegistry = Readonly<Record<AiAgentBackend, ChatAgentPort>>;
