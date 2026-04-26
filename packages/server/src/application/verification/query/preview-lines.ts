export interface PreviewSourceEvent {
    readonly kind: string;
    readonly title: string;
    readonly metadata?: Record<string, unknown>;
}

const MAX_LINES = 3;
const MAX_LINE_LENGTH = 80;

/**
 * Build a small set of preview lines (max 3) for a turn card.
 *
 * Tool events — kinds starting with "tool." OR with `metadata.toolName` — are
 * rendered as `<Tool> <title>` (e.g. `Edit auth/login.ts`, `Bash npm test`).
 * Non-tool events fall back to their title only.
 *
 * Consecutive identical lines are collapsed. If the input has more than
 * `MAX_LINES` events the last preview line becomes a `+ N more` summary
 * (where N = events.length - (MAX_LINES - 1)).
 */
export function buildPreviewLines(events: readonly PreviewSourceEvent[]): readonly string[] {
    if (events.length === 0) return [];

    const totalCount = events.length;
    const overflow = totalCount > MAX_LINES;
    const headLimit = overflow ? MAX_LINES - 1 : MAX_LINES;

    const lines: string[] = [];
    for (const event of events) {
        if (lines.length >= headLimit) break;
        const line = renderLine(event);
        if (lines.length > 0 && lines[lines.length - 1] === line) continue;
        lines.push(line);
    }

    if (overflow) {
        const remaining = totalCount - lines.length;
        if (remaining > 0) {
            lines.push(`+ ${remaining} more`);
        }
    }

    return lines;
}

function renderLine(event: PreviewSourceEvent): string {
    const toolName = pickToolLabel(event);
    const text = toolName ? `${toolName} ${event.title}` : event.title;
    return truncate(text);
}

function pickToolLabel(event: PreviewSourceEvent): string | null {
    if (event.metadata) {
        const metaTool = event.metadata["toolName"];
        if (typeof metaTool === "string" && metaTool.trim().length > 0) {
            return metaTool.trim();
        }
    }
    if (event.kind.startsWith("tool.")) {
        const suffix = event.kind.slice("tool.".length);
        if (suffix.length === 0) return null;
        return suffix.charAt(0).toUpperCase() + suffix.slice(1);
    }
    return null;
}

function truncate(line: string): string {
    if (line.length <= MAX_LINE_LENGTH) return line;
    return line.slice(0, MAX_LINE_LENGTH - 1) + "…";
}
