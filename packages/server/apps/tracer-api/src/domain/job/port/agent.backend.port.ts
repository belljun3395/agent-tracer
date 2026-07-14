import type { AiAgentBackend } from "@monitor/kernel";

export const DEFAULT_AGENT_BACKEND = Symbol("DefaultAgentBackend");

/** 잡 입력이 백엔드를 지정하지 않았을 때 원격 실행이 향하는 백엔드다. */
export type DefaultAgentBackendPort = AiAgentBackend;
