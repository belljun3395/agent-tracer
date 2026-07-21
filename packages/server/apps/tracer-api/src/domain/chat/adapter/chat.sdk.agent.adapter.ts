import { AI_AGENT_BACKEND } from "@monitor/kernel";
import {
    buildMcpToolServer,
    mcpToolNames,
    withMcpToolPrefix,
    type AgentStreamSink,
    type ClaudeQueryOptions,
    type IQueryRunner,
} from "@monitor/llm-runtime";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { renderChatPrompt } from "~tracer-api/domain/chat/model/chat.prompt.js";
import type {
    ChatTurnInput,
    ChatTurnResult,
    ChatTurnSink,
    ChatTurnToolCall,
} from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { buildChatToolHandlers, type ChatToolDeps } from "./chat.tools.js";
import { buildChatWriteToolHandlers, type ChatWriteToolDeps } from "./chat.write.tools.js";
import { buildChatMemoryToolHandlers, type ChatMemoryToolDeps } from "./chat.memory.tools.js";

export const CHAT_MCP_SERVER = `monitor-${CHAT_SPEC.name}`;

/** Claude Agent SDK 방언으로 chat 명세를 렌더링하고, 러너의 스트리밍 싱크를 대화 싱크로 이어 준다. */
export class ChatSdkAgentAdapter implements ChatAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: ChatToolDeps,
        private readonly writeDeps: ChatWriteToolDeps,
        private readonly memoryDeps: ChatMemoryToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult> {
        // 읽기 도구와 장기기억 도구는 즉시 실행하고, mutation 도구는 실행 대신 확인 대기 행을 세우는 핸들러로 같은 도구 표면에 얹는다.
        const handlers = {
            ...buildChatToolHandlers(input.userId, this.deps),
            ...buildChatMemoryToolHandlers({ userId: input.userId, sink }, this.memoryDeps),
            ...buildChatWriteToolHandlers({ userId: input.userId, threadId: input.threadId, sink }, this.writeDeps),
        };
        const model = input.model?.trim() || CHAT_SPEC.limits.defaultModel;
        const toolCalls: ChatTurnToolCall[] = [];

        const runnerStream: AgentStreamSink = {
            onAssistantDelta: (text) => sink.onAssistantDelta(text),
            onToolCall: (call) => {
                toolCalls.push(call);
                sink.onToolCall(call);
            },
            onToolResult: (result) => sink.onToolResult(result),
        };

        const result = await this.runner.run({
            label: CHAT_SPEC.name,
            prompt: renderChatPrompt(input.messages, input.summary, input.facts),
            systemPrompt: withMcpToolPrefix(
                CHAT_SPEC.systemPrompt(input.language),
                CHAT_SPEC.toolNames,
                CHAT_MCP_SERVER,
            ),
            allowedTools: mcpToolNames(CHAT_MCP_SERVER, CHAT_SPEC.toolNames),
            model,
            maxTurns: CHAT_SPEC.limits.maxTurns,
            maxOutputTokens: CHAT_SPEC.limits.maxOutputTokens,
            maxBudgetUsd: CHAT_SPEC.limits.maxBudgetUsd,
            deadlineMs: input.deadlineMs,
            // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${CHAT_SPEC.name}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
                ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            },
            providerOptions: {
                mcpServers: {
                    [CHAT_MCP_SERVER]: buildMcpToolServer(CHAT_MCP_SERVER, CHAT_SPEC.tools, handlers),
                },
            },
            stream: runnerStream,
            ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
        });

        return {
            text: result.rawOutput,
            backend: AI_AGENT_BACKEND.claudeSdk,
            toolCalls,
            modelUsed: result.actualModel ?? model,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            errorSummary: result.errorSummary,
        };
    }
}
