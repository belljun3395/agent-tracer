import type { ChatSummarizerPort, ChatSummarizeRequest } from "~tracer-api/domain/chat/port/chat.summarizer.port.js";

/** 요약 포트의 대역이며, 정해진 텍스트를 반환하거나 지정된 오류로 거절한다. */
export class FakeChatSummarizer implements ChatSummarizerPort {
    lastRequest: ChatSummarizeRequest | null = null;
    calls = 0;

    constructor(
        private readonly text = "요약",
        private readonly failure: Error | null = null,
    ) {}

    summarize(request: ChatSummarizeRequest): Promise<string> {
        this.calls += 1;
        this.lastRequest = request;
        if (this.failure !== null) return Promise.reject(this.failure);
        return Promise.resolve(this.text);
    }
}
