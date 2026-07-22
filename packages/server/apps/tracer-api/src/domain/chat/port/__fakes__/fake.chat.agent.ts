import { AI_AGENT_BACKEND, type AiAgentBackend } from "@monitor/kernel";
import type {
    ChatTurnInput,
    ChatTurnResult,
    ChatTurnSink,
    ChatTurnToolCall,
} from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort, ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";

/** 대화 백엔드 포트의 대역이며, 정해진 텍스트와 도구 호출을 싱크로 흘리고 그대로 반환한다. */
export class FakeChatAgent implements ChatAgentPort {
    lastInput: ChatTurnInput | null = null;
    calls = 0;

    constructor(
        private readonly text = "answer",
        private readonly toolCalls: readonly ChatTurnToolCall[] = [],
        private readonly backend: AiAgentBackend = AI_AGENT_BACKEND.claudeSdk,
        private readonly needsApiKey = false,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult> {
        this.calls += 1;
        this.lastInput = input;
        for (const call of this.toolCalls) void sink.onToolCall(call);
        void sink.onAssistantDelta(this.text);
        return Promise.resolve({
            text: this.text,
            backend: this.backend,
            toolCalls: this.toolCalls,
            modelUsed: "fake-model",
            costUsd: 0,
            numTurns: 1,
            usage: null,
            errorSummary: null,
        });
    }
}

/** claude-sdk 자리에 대역을, python 자리엔 넘긴 대역이나 기본으로 던지는 대역을 채운 전 백엔드 레지스트리를 만든다. */
export function fakeChatRegistry(claude: ChatAgentPort, python?: ChatAgentPort): ChatAgentRegistry {
    return {
        [AI_AGENT_BACKEND.python]: python ?? {
            requiresLocalApiKey: () => false,
            converse: () => Promise.reject(new Error("python backend not wired in test")),
        },
        [AI_AGENT_BACKEND.claudeSdk]: claude,
    };
}
