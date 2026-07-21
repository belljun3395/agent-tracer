import type { AiAgentBackend } from "@monitor/kernel";

export const DEFAULT_AGENT_BACKEND = Symbol("DefaultAgentBackend");

/** 잡 입력이 백엔드를 지정하지 않았을 때 원격 실행이 향하는 백엔드다. */
export type DefaultAgentBackendPort = AiAgentBackend;

export const LOCAL_CLI_AUTH = Symbol("LocalCliAuth");

/** claude-sdk 잡이 API 키 대신 로그인된 claude CLI 자격증명으로 도는지다. */
export type LocalCliAuthPort = boolean;
