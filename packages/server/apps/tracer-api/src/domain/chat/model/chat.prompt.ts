import { CHAT_MESSAGE_ROLE } from "@monitor/tracer-domain";
import type { ChatTurnMessage } from "~tracer-api/domain/chat/model/chat.turn.model.js";

export const CHAT_LANGUAGE = {
    auto: "auto",
    ko: "ko",
    en: "en",
    ja: "ja",
    zh: "zh",
} as const;

export type ChatLanguage = (typeof CHAT_LANGUAGE)[keyof typeof CHAT_LANGUAGE];

const LANGUAGE_DIRECTIVES: Record<ChatLanguage, string> = {
    auto: "Reply in the language the user is writing in.",
    ko: "Reply in Korean (한국어). Translate technical terms naturally.",
    en: "Reply in English.",
    ja: "Reply in Japanese (日本語).",
    zh: "Reply in Simplified Chinese (简体中文).",
};

function directive(language: string): string {
    return language in LANGUAGE_DIRECTIVES ? LANGUAGE_DIRECTIVES[language as ChatLanguage] : LANGUAGE_DIRECTIVES.auto;
}

// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildChatSystemPrompt(language: string): string {
    return `You are the assistant of Agent Tracer, an observability tool that records coding-agent sessions (tasks), their timelines, verification rules, memos, recipes, tags, cleanup suggestions, AI jobs and settings.

You answer the user's questions about their own recorded work by reading it through the tools you are given. Every tool is read-only and already scoped to this user.

How to work:
  - Ground every factual claim in what a tool returned. Never invent task ids, rule ids, event contents, or numbers.
  - Start broad, then drill in: search_tasks or search_events to find what the user means, then get_task / get_timeline / get_rule_evidence for detail.
  - Page with the returned cursor when a listing is truncated and the answer needs more.
  - If the tools return nothing relevant, say so plainly instead of guessing.
  - Be concise. Cite the concrete task titles, ids, or timestamps you saw when they help the user act.

Output language: ${directive(language)}`;
}

/** 러너가 단발이라 대화 전체를 한 프롬프트로 재생하며, 마지막 사용자 메시지가 이번 턴의 질문이다. */
export function renderChatPrompt(messages: readonly ChatTurnMessage[], summary?: string | null): string {
    const lines: string[] = [];
    if (summary !== undefined && summary !== null && summary.trim().length > 0) {
        lines.push("Summary of earlier conversation:", summary.trim(), "");
    }
    lines.push("Conversation so far:");
    for (const message of messages) {
        lines.push(renderMessage(message));
    }
    lines.push("", "Answer the user's most recent message.");
    return lines.join("\n");
}

function renderMessage(message: ChatTurnMessage): string {
    if (message.role === CHAT_MESSAGE_ROLE.user) return `User: ${message.content}`;
    if (message.role === CHAT_MESSAGE_ROLE.tool) return `Tool result: ${message.content}`;
    const calls = message.toolCalls ?? [];
    const suffix = calls.length > 0 ? ` (called ${calls.map((call) => call.name).join(", ")})` : "";
    return `Assistant: ${message.content}${suffix}`;
}
