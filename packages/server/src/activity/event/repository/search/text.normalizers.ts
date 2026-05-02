export function normalizeSearchText(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    return normalized || null;
}
