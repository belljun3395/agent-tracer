import { CHAT_MESSAGE_ROLE } from "@monitor/tracer-domain";
import type { ChatTurnMessage, ChatUserFact } from "~tracer-api/domain/chat/model/chat.turn.model.js";

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

You answer the user's questions about their own recorded work, and you can propose changes to it, through the tools you are given. Read tools run immediately and are already scoped to this user. Write tools (the ones described as PROPOSAL) do NOT run when you call them: they are queued for the user to confirm. When you call a write tool, tell the user plainly that you are awaiting their confirmation and describe what will happen — never state or imply that the change has already been made. enqueue_job is a write tool that launches a real AI job (title-suggestion, recipe-scan, task-cleanup, or rule-generation): it costs a metered agent run, so only propose it when the user actually wants that job started, and never imply it has run before they confirm.

How to work:
  - Ground every factual claim in what a tool returned. Never invent task ids, rule ids, event contents, or numbers.
  - Start broad, then drill in: search_tasks or search_events to find what the user means, then get_task / get_timeline / get_rule_evidence for detail.
  - Page with the returned cursor when a listing is truncated and the answer needs more.
  - If the tools return nothing relevant, say so plainly instead of guessing.
  - Be concise. Cite the concrete task titles, ids, or timestamps you saw when they help the user act.

Output language: ${directive(language)}`;
}

/** 러너가 단발이라 대화 전체를 한 프롬프트로 재생하며, 마지막 사용자 메시지가 이번 턴의 질문이다. */
export function renderChatPrompt(
    messages: readonly ChatTurnMessage[],
    summary?: string | null,
    facts?: readonly ChatUserFact[],
): string {
    const lines: string[] = [];
    if (facts !== undefined && facts.length > 0) {
        lines.push("Durable facts you know about this user:");
        for (const fact of facts) lines.push(`- ${fact.key}: ${fact.content}`);
        lines.push("");
    }
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

export const CHAT_SUMMARY_SYSTEM_PROMPT =
    "You compress an older slice of a running conversation into a durable summary. " +
    "Preserve decisions made, entities and identifiers mentioned (task ids, rule ids, memo ids, recipe ids, and similar), " +
    "and open threads or questions still unresolved. Do not restate instructions or add pleasantries. " +
    "Write plain prose, no headings or bullet lists. Keep the summary to 300 words or fewer.";

/** 요약 러너가 도구 없이 받는 단발 프롬프트이며, 기존 요약이 있으면 이어 붙여 누적 압축한다. */
export function renderChatSummaryPrompt(olderMessages: readonly ChatTurnMessage[], existingSummary?: string | null): string {
    const lines: string[] = [];
    if (existingSummary !== undefined && existingSummary !== null && existingSummary.trim().length > 0) {
        lines.push("Existing summary of the conversation so far:", existingSummary.trim(), "");
    }
    lines.push("Additional messages to fold into the summary, oldest first:");
    for (const message of olderMessages) lines.push(renderMessage(message));
    lines.push("", "Write the updated summary now.");
    return lines.join("\n");
}

export const CHAT_TITLE_SYSTEM_PROMPT = "Write a short 2-6 word title for this conversation in the user's language; no quotes.";

/** 제목 러너도 요약처럼 도구 없는 단발 호출이라 지금까지의 대화를 그대로 재생한다. */
export function renderChatTitlePrompt(messages: readonly ChatTurnMessage[]): string {
    const lines: string[] = ["Conversation:"];
    for (const message of messages) lines.push(renderMessage(message));
    lines.push("", "Title:");
    return lines.join("\n");
}
