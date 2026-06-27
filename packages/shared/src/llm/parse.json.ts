/**
 * Parse an agent's JSON output, tolerating ```fenced``` blocks if the model
 * wrapped its answer. Returns null when no valid JSON can be extracted. Shared
 * by the adapters/llm agents (each used to carry its own copy).
 */
export function parseJsonStrict(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        // Tolerate fenced code blocks if the model couldn't resist them.
        const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        if (fenceMatch && fenceMatch[1]) {
            try {
                return JSON.parse(fenceMatch[1]);
            } catch {
                return null;
            }
        }
        return null;
    }
}
