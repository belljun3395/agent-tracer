import type {
    ILlmClient,
    LlmCompletionRequest,
    LlmCompletionResult,
} from "~application/verification/summary/index.js";

export class EchoLlmClient implements ILlmClient {
    complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        const user = request.messages.find((message) => message.role === "user")?.content ?? "";
        return Promise.resolve({
            text: synthesize(user),
            model: "echo",
        });
    }
}

function synthesize(user: string): string {
    const turnIndex = user.match(/Turn index:\s*(\d+)/)?.[1] ?? "?";
    const startedAt = user.match(/Turn started at:\s*(\S+)/)?.[1] ?? "";
    const asked = pickIndentedLine(user, "User's preceding message (ASKED):")
        || "(no preceding user message)";
    const claimed = pickIndentedLine(user, "Assistant text (CLAIMED):")
        || "(no assistant text)";
    const did = extractBlock(user, "Tool calls (DID):")
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => `- ${renderEvent(line)}`);
    const verdictLines = extractBlock(user, "Verdicts:")
        .filter((line) => line.trim().startsWith("- "));
    const contradicted = verdictLines.filter((line) => line.includes("[contradicted]"));
    const unverifiable = verdictLines.filter((line) => line.includes("[unverifiable]"));
    const verdict = contradicted.length > 0
        ? `${contradicted.length} rule(s) contradicted`
        : unverifiable.length > 0
            ? `${unverifiable.length} unverifiable`
            : "all verified";
    const contradictionBullets = contradicted.map((line) => {
        const rule = line.match(/-\s+(\S+)/)?.[1] ?? "rule";
        const phrase = line.match(/phrase="([^"]+)"/)?.[1];
        return phrase
            ? `- "${phrase}" contradicted rule ${rule}`
            : `- rule ${rule} contradicted`;
    });

    return [
        `## Turn ${turnIndex}${startedAt ? ` - ${formatDate(startedAt)}` : ""}`,
        "",
        `**Asked:** ${asked}`,
        "",
        `**Claimed:** ${claimed}`,
        "",
        "**Did:**",
        did.length > 0 ? did.join("\n") : "- (no tool calls)",
        "",
        `**Verdict:** ${verdict}`,
        ...(contradictionBullets.length > 0 ? ["", ...contradictionBullets] : []),
    ].join("\n");
}

function pickIndentedLine(text: string, label: string): string {
    const lines = text.split("\n");
    const index = lines.findIndex((line) => line === label);
    if (index < 0) return "";
    const next = lines[index + 1] ?? "";
    return next.startsWith("  ") ? next.trim() : "";
}

function extractBlock(text: string, label: string): string[] {
    const lines = text.split("\n");
    const start = lines.findIndex((line) => line === label);
    if (start < 0) return [];
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        if (line !== "" && !line.startsWith(" ")) break;
        if (line !== "") out.push(line);
    }
    return out;
}

function renderEvent(line: string): string {
    const title = line.replace(/^\s*-\s+\[[^\]]+\]\s*/, "").replace(/\s*\([^)]*\)$/, "");
    const linesAdded = line.match(/\+(\d+)/)?.[1];
    return linesAdded ? `${title} (+${linesAdded})` : title;
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
