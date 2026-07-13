import type { TitleSuggestionPayload } from "@monitor/kernel";

/** 대소문자와 유니코드 정규형과 공백 차이를 무시하는 비교 키를 만든다. */
function normalizeForComparison(title: string): string {
    return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 기존 제목과 겹치거나 서로 중복인 제안을 정규화 기준으로 걷어낸다. */
export function dedupeTitleSuggestions(
    suggestions: readonly TitleSuggestionPayload[],
    currentTitle: string,
): readonly TitleSuggestionPayload[] {
    const seen = new Set<string>([normalizeForComparison(currentTitle)]);
    const result: TitleSuggestionPayload[] = [];
    for (const suggestion of suggestions) {
        const key = normalizeForComparison(suggestion.title);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ title: suggestion.title, rationale: suggestion.rationale });
    }
    return result;
}

/** 완료 알림에 실을 요약 문장이다. */
export function titleSuggestionSummary(suggestionCount: number): string {
    if (suggestionCount === 0) return "No title alternatives produced";
    return `${suggestionCount} title ${suggestionCount === 1 ? "suggestion" : "suggestions"}`;
}
