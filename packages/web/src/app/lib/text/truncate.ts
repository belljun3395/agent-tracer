/**
 * Truncate `text` to at most `max` characters, replacing the trailing
 * character with an ellipsis (`…`). Returns `text` unchanged when shorter
 * than `max`.
 */
export function truncate(text: string, max: number): string {
    if (max <= 0) return "";
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
