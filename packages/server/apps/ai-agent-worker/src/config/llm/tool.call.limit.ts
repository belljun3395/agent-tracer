import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

// 호출부가 예외 메시지가 아니라 signal.reason의 타입으로 도구 호출 상한 초과를 구분한다.
export class ToolCallLimitExceededError extends Error {
    constructor(maxToolCalls: number) {
        super(`Agent query exceeded ${maxToolCalls} tool calls`);
        this.name = "ToolCallLimitExceededError";
    }
}

/** 실행 전체의 도구 호출 수를 세어 상한을 넘으면 요청을 중단하는 PreToolUse 훅을 만든다. */
export function createToolCallLimitHook(
    maxToolCalls: number,
    controller: AbortController,
): () => Promise<HookJSONOutput> {
    let toolCallCount = 0;
    return () => {
        toolCallCount += 1;
        if (toolCallCount <= maxToolCalls) return Promise.resolve({ continue: true });
        controller.abort(new ToolCallLimitExceededError(maxToolCalls));
        return Promise.resolve({ continue: false, stopReason: "tool call limit exceeded" });
    };
}
