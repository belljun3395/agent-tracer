import { CLAUDE_MODEL } from "@monitor/llm-runtime";

/** 메시지가 20개를 넘거나 누적 글자 수가 대략 3천 토큰(4자/토큰 근사)을 넘으면 최근 8개를 남기고 압축하며, 도구 없는 단발 호출이라 모델은 haiku로 충분하다. */
export const CHAT_SUMMARY_SPEC = {
    triggerMessageCount: 20,
    recentKeepCount: 8,
    triggerCharBudget: 12_000,
    limits: {
        model: CLAUDE_MODEL.haiku,
        maxOutputTokens: 600,
        deadlineMs: 30_000,
    },
} as const;

/** 압축 문턱: 메시지 수 또는 누적 글자 수 중 하나라도 넘으면 참이다. */
export function shouldSummarize(messages: readonly { readonly content: string }[]): boolean {
    if (messages.length > CHAT_SUMMARY_SPEC.triggerMessageCount) return true;
    const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    return totalChars > CHAT_SUMMARY_SPEC.triggerCharBudget;
}

/** 재생 창: 요약이 있으면 최근 recentKeepCount개만, 없으면 전체를 재생 대상으로 고른다. */
export function selectReplayMessages<T>(messages: readonly T[], hasSummary: boolean): readonly T[] {
    if (!hasSummary) return messages;
    return messages.slice(-CHAT_SUMMARY_SPEC.recentKeepCount);
}

/** 요약에 접어 넣을 오래된 메시지: 재생 창 바깥에 남는 나머지다. */
export function selectMessagesToFold<T>(messages: readonly T[]): readonly T[] {
    return messages.slice(0, Math.max(0, messages.length - CHAT_SUMMARY_SPEC.recentKeepCount));
}
