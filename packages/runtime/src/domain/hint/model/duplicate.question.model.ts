import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {PreprocessingHint} from "~runtime/domain/hint/model/hint.model.js";
import {truncate} from "~runtime/support/text.js";

const QUESTION_LOOKBACK = 30;
const DUPLICATE_AGE_MS = 24 * 60 * 60 * 1000;

/** 최근 24시간 안에 같은 질문을 이미 던졌으면 알린다. */
export function detectDuplicateQuestion(
    recent: readonly RecentEvent[],
    questions: readonly string[],
    now: number,
): PreprocessingHint[] {
    const incoming = questions.map(normalizeQuestion).filter((question) => question.length > 0);
    if (incoming.length === 0) return [];

    const prior = recent.filter((event) => event.kind === KIND.questionLogged).slice(-QUESTION_LOOKBACK);
    const hints: PreprocessingHint[] = [];

    for (const question of incoming) {
        for (const event of prior) {
            const ageMs = now - Date.parse(event.occurredAt);
            if (!Number.isFinite(ageMs) || ageMs > DUPLICATE_AGE_MS) continue;
            const previous = normalizeQuestion(event.body ?? event.title ?? "");
            if (previous.length === 0) continue;
            if (previous !== question && !previous.startsWith(question) && !question.startsWith(previous)) continue;
            hints.push({
                type: "duplicate_question",
                severity: "warning",
                title: "Same question already asked",
                message: `You already asked the user this question ${formatRelativeTime(ageMs)} ago, so re-check the prior response in the timeline before asking again.`,
            });
            break;
        }
    }

    return hints;
}

function normalizeQuestion(text: string): string {
    if (!text) return "";
    const normalized = text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[?.!,;:'"`]+/g, "")
        .trim();
    return truncate(normalized, 240);
}

function formatRelativeTime(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return "less than a minute";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} d`;
}
