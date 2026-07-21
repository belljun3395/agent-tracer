import { AGENT } from "@monitor/kernel";
import { chatTurnResultSchema } from "@monitor/kernel/agent/chat.result.schema.js";
import { CLAUDE_MODEL } from "@monitor/llm-runtime";
import { buildChatSystemPrompt } from "./chat.prompt.js";
import { CHAT_TOOL_CONTRACT, CHAT_TOOL_DEFINITIONS, CHAT_TOOL_NAMES } from "./chat.tool.schema.js";

const CHAT_DEADLINE_MS = 120_000;

/** 두 백엔드가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 chat 대화 에이전트 정의다. */
export const CHAT_SPEC = {
    name: AGENT.chat.id,
    systemPrompt: (language: string): string => buildChatSystemPrompt(language),
    tools: CHAT_TOOL_DEFINITIONS,
    toolNames: CHAT_TOOL_NAMES,
    // graph 백엔드가 최종 결과로 돌려주는 구조화 출력 계약이며, 커널이 소유한다.
    outputSchema: chatTurnResultSchema,
    limits: {
        defaultModel: CLAUDE_MODEL.sonnet,
        maxTurns: CHAT_TOOL_CONTRACT.maxTurns,
        maxOutputTokens: CHAT_TOOL_CONTRACT.limits.maxOutputTokens,
        maxBudgetUsd: CHAT_TOOL_CONTRACT.limits.maxBudgetUsd,
        deadlineMs: CHAT_DEADLINE_MS,
    },
} as const;
