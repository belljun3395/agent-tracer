import type { TurnReceiptView } from "~domain/verification/index.js";
import type { LlmMessage } from "./llm.port.js";

const SYSTEM = `You generate a short, copy-paste-ready Markdown summary of a coding-agent turn.
Output exactly this structure:

## Turn {{index}} - {{YYYY-MM-DD HH:mm}}

**Asked:** <1 sentence of what the user asked>

**Claimed:** <1-2 sentences restating the agent's stated intent>

**Did:**
- <one bullet per tool call, in order; path or command + line delta>

**Verdict:** <all verified | N unverifiable | N rule(s) contradicted>
- <bullet per contradicted rule: the matched phrase and why it failed>

Rules:
- Do not invent tool calls or files that are not in the input.
- Do not mention anything outside the four sections.
- Plain prose; no headings beyond the four shown.
- If the Verdict line is "all verified", omit the contradiction bullets.`;

export function buildSummaryPrompt(receipt: TurnReceiptView): LlmMessage[] {
    const eventLines = receipt.events.map(renderEventLine).join("\n");
    const verdictLines = receipt.verdicts
        .map((v) => {
            const parts = [`  - ${v.ruleId} [${v.status}]`];
            if (v.matchedPhrase) parts.push(`phrase="${v.matchedPhrase}"`);
            if (v.expectedPattern) parts.push(`expected=/${v.expectedPattern}/`);
            if (v.actualToolCalls.length > 0) parts.push(`actual=${v.actualToolCalls.join(",")}`);
            return parts.join(" ");
        })
        .join("\n");

    const user = [
        `Turn index: ${receipt.card.index}`,
        `Turn started at: ${receipt.card.startedAt}`,
        `Session: ${receipt.card.sessionId}`,
        "",
        "User's preceding message (ASKED):",
        `  ${receipt.askedText ?? "(no preceding user message)"}`,
        "",
        "Assistant text (CLAIMED):",
        `  ${truncate(receipt.card.assistantText, 1200)}`,
        "",
        "Tool calls (DID):",
        eventLines.length > 0 ? eventLines : "  (none)",
        "",
        "Verdicts:",
        verdictLines.length > 0 ? verdictLines : "  (no rules evaluated)",
    ].join("\n");

    return [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
    ];
}

function renderEventLine(event: TurnReceiptView["events"][number]): string {
    const metadata = event.metadata ?? {};
    const extras = [
        typeof metadata["filePath"] === "string" ? `path=${metadata["filePath"]}` : null,
        typeof metadata["linesAdded"] === "number" ? `+${metadata["linesAdded"]}` : null,
        typeof metadata["command"] === "string" ? `cmd="${metadata["command"]}"` : null,
    ].filter((part): part is string => part !== null);
    return extras.length > 0
        ? `  - [${event.kind}] ${event.title} (${extras.join(" ")})`
        : `  - [${event.kind}] ${event.title}`;
}

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
