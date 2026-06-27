import { Injectable } from "@nestjs/common";
import { PreprocessingHintsRepository } from "@monitor/activity/event/repository/preprocessing.hints.repository.js";
import type { PreprocessingHint } from "../dto/preprocessing.hints.dto.js";

const QUESTION_LOOKBACK = 30;
const DUPLICATE_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DuplicateQuestionDetector {
    constructor(private readonly repo: PreprocessingHintsRepository) {}

    async detect(taskId: string, questions: readonly string[]): Promise<readonly PreprocessingHint[]> {
        const normalizedIncoming = questions
            .map(normalizeQuestion)
            .filter((q) => q.length > 0);
        if (normalizedIncoming.length === 0) return [];

        const recent = await this.repo.findRecentQuestions(taskId, QUESTION_LOOKBACK);
        const now = Date.now();
        const hints: PreprocessingHint[] = [];

        for (const incoming of normalizedIncoming) {
            for (const event of recent) {
                const ageMs = now - Date.parse(event.createdAt);
                if (!Number.isFinite(ageMs) || ageMs > DUPLICATE_AGE_MS) continue;
                const prior = normalizeQuestion(event.body ?? event.title);
                if (prior.length === 0) continue;
                if (prior === incoming || prior.startsWith(incoming) || incoming.startsWith(prior)) {
                    hints.push({
                        type: "duplicate_question",
                        severity: "warning",
                        title: "Same question already asked",
                        message: `You already asked the user this question ${formatRelativeTime(ageMs)} ago — re-check the prior response in the timeline before asking again.`,
                    });
                    break;
                }
            }
        }

        return hints;
    }
}

function normalizeQuestion(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[?.!,;:'"`]+/g, "")
        .trim()
        .slice(0, 240);
}

function formatRelativeTime(ms: number): string {
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return "less than a minute";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} d`;
}
