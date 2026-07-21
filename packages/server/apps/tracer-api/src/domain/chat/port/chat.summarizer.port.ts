export const CHAT_SUMMARIZER = Symbol("ChatSummarizer");

/** 요약 한 건을 내는 단발 질의 입력이며, 도구를 쓰지 않아 대화 턴 입력보다 훨씬 좁다. */
export interface ChatSummarizeRequest {
    readonly systemPrompt: string;
    readonly prompt: string;
}

/** 도구 없는 단발 언어 모델 호출로 대화 압축 요약 텍스트를 내는 포트다. */
export interface ChatSummarizerPort {
    summarize(request: ChatSummarizeRequest): Promise<string>;
}
