import type { AiAgentBackend } from "@monitor/kernel";

export const CHAT_DEFAULT_AGENT_BACKEND = Symbol("ChatDefaultAgentBackend");

/** 대화 턴 입력이 백엔드를 지정하지 않았을 때 향하는 기본 백엔드다. */
export type ChatDefaultAgentBackendPort = AiAgentBackend;
