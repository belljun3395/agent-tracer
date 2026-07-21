import type { ClaudeQueryOptions, IQueryRunner } from "@monitor/llm-runtime";
import { CHAT_SUMMARY_SPEC } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import type { ChatSummarizerPort, ChatSummarizeRequest } from "~tracer-api/domain/chat/port/chat.summarizer.port.js";

const LABEL = "chat-summary";

/** 대화 러너와 같은 IQueryRunner를 도구 없이 재사용하는 단발 요약 실행이다. */
export class ChatSummarizerAdapter implements ChatSummarizerPort {
    constructor(private readonly runner: IQueryRunner<ClaudeQueryOptions>) {}

    async summarize(request: ChatSummarizeRequest): Promise<string> {
        const result = await this.runner.run({
            label: LABEL,
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            allowedTools: [],
            model: CHAT_SUMMARY_SPEC.limits.model,
            maxTurns: 1,
            maxOutputTokens: CHAT_SUMMARY_SPEC.limits.maxOutputTokens,
            deadlineMs: CHAT_SUMMARY_SPEC.limits.deadlineMs,
            // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${LABEL}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
            },
        });
        if (result.errorSummary !== null) throw new Error(result.errorSummary);
        return result.rawOutput;
    }
}
