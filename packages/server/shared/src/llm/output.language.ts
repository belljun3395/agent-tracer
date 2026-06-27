export const OUTPUT_LANGUAGE = {
    auto: "auto",
    ko: "ko",
    en: "en",
    ja: "ja",
    zh: "zh",
} as const;

export const OUTPUT_LANGUAGES = [
    OUTPUT_LANGUAGE.auto,
    OUTPUT_LANGUAGE.ko,
    OUTPUT_LANGUAGE.en,
    OUTPUT_LANGUAGE.ja,
    OUTPUT_LANGUAGE.zh,
] as const;

export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

const OUTPUT_LANGUAGE_SET: ReadonlySet<string> = new Set(OUTPUT_LANGUAGES);

export function isOutputLanguage(value: string | undefined): value is OutputLanguage {
    return value !== undefined && OUTPUT_LANGUAGE_SET.has(value);
}

export function normalizeOutputLanguage(raw: string | null): OutputLanguage {
    if (!raw) return OUTPUT_LANGUAGE.auto;
    const normalized = raw.trim().toLowerCase();
    return isOutputLanguage(normalized) ? normalized : OUTPUT_LANGUAGE.auto;
}
