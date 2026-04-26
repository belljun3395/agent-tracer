import type { TurnReceipt } from "./types.js";

export type RulePromptSource =
    | { readonly kind: "turn"; readonly receipt: TurnReceipt }
    | {
        readonly kind: "user-message";
        readonly text: string;
        readonly occurredAt: string;
        readonly taskId: string;
    };

/**
 * Builds a prompt that asks the agent to define a verification rule for
 * a *future* response to this kind of request.
 *
 * Intentionally excludes the assistant's actual response and tool calls
 * from the input: a rule is an *expected* contract (claim → action), not
 * a copy of what already happened. Including the actual behavior risks
 * the agent baking a one-off action — or worse, a dishonest one — into
 * the rule definition.
 *
 * Two sources supported:
 * - `turn`: pulled from a completed Receipt (uses ASKED + turn meta).
 * - `user-message`: pulled mid-flight from a Timeline user.message event,
 *   so the user can register a rule *before* the agent finishes the turn.
 *
 * The prompt embeds the task's id verbatim so the agent passes it as the
 * `taskId` argument to `mcp__agent_tracer__suggest_rule` (the MCP tool
 * requires it; rules registered through this path are task-scoped).
 */
/**
 * Static body of the rule-suggestion prompt — everything after the
 * task/asked block. Kept as a module-level constant so the dynamic
 * `buildRulePrompt` renderer stays readable (the bulk of the content is
 * documentation, not data interpolation).
 */
const RULE_PROMPT_BODY: readonly string[] = [
    "## Goal",
    "Given the ASKED above, define what an *honest* response looks like for future identical or similar requests.",
    "- What phrase would you naturally write in your response (if any)? → `trigger.phrases`",
    "- What tool call must back that phrase? → `expect.tool` + `expect.commandMatches` / `expect.pattern`",
    "",
    "The actual response for this turn is intentionally hidden — it may not represent ideal behavior.",
    "Base `expect` on your own judgment of what a correct response should do.",
    "",
    "## The File-Read Blind Spot (Primary Use Case)",
    "File writes, edits, and deletions leave traces in git. **File reads do not.**",
    "When the user asks you to look at, check, see, refer to, search, or inspect a file,",
    "there is no external record of whether you actually called the Read tool.",
    "This is the primary case where a rule adds the most value.",
    "",
    "For user-initiated file-read requests:",
    "- Set `triggerOn: \"user\"` — match at request time, not after the response.",
    "- Set `expect.tool: \"Read\"` — verify a Read call occurred during the turn.",
    "- Set `expect.pattern` to a regex matching the referenced file path (generalize as needed).",
    "",
    "Keyword signals in ASKED that indicate a file-read expectation:",
    "English: look at, see, check, read, open, inspect, refer to, reference, consult (+ file/path)",
    "English (search): search, find, grep, look for (→ Bash with grep/find/rg)",
    "English (verify): verify, confirm, make sure (when a file path is mentioned)",
    "Korean: 봐, 봐줘, 확인해, 확인해줘, 참고해, 참고해줘, 검색해, 찾아, 열어봐 (+ 파일/경로)",
    "",
    "## Rule Criteria",
    "",
    "### `trigger.phrases` — array of 5–12 word sentences the agent would naturally say",
    "- Register both English and Korean (this project is bilingual).",
    "- Phrases must reflect what a real user would actually type — not engineered sentences. If the ASKED itself contains a natural phrase, use that verbatim or close to it.",
    "- Bad trigger phrases: `search for the suggest rules prompt` (no user writes like this), `find and improve the prompt file` (too procedural)",
    "- Good trigger phrases: `improve the prompt`, `프롬프트 개선해줘`, `look at this file` (natural, realistic)",
    "- Negation trap avoidance: if any of [`did not`, `didn't`, `not`, `haven't`, `never`, `no`, `안`, `못`, `없`] appear in the 20 characters before a match, the trigger is ignored.",
    "- Good: `read the configuration file`, `checked the schema`, `looked at the test file`",
    "- Bad: `no errors` (negation trap), `everything looks good` (unverifiable), `done` (ambiguous)",
    "",
    "### `triggerOn` — `assistant` (default) | `user`",
    "- `assistant`: match when `trigger.phrases` appear in your response body. Use for claim-based rules.",
    "- `user`: match when `trigger.phrases` appear in the user's message. Use when the expected action is determined at request time — especially for file reads and searches.",
    "",
    "### `expect.tool` — one of `Bash` | `Edit` | `Write` | `Read`",
    "The tool that must be called to satisfy the claim.",
    "- File reads → `Read`",
    "- File searches → `Bash` (grep, find, rg)",
    "- File writes/creation → `Write` or `Edit` (git diff already covers these; lower priority)",
    "",
    "### `expect.commandMatches` (Bash) or `expect.pattern` (file operations) — regex",
    "Generalize from the specific path, but always keep the file's core identifier (filename stem).",
    "- Too narrow (full absolute path with directories): breaks when the path changes",
    "- Too broad (generic word like `prompt`, `config`, `schema`, `프롬프트`): matches unrelated files or commands, defeats verification",
    "- Too broad (multi-alternative where one arm is a generic word): `suggest\\.rule|프롬프트` — the `프롬프트` arm alone passes any Bash call mentioning it",
    "- Right: keep the filename stem or the unique concept that identifies the target (e.g. `buildRulePrompt`, `drizzle\\.schema`, `suggest.*rule`)",
    "",
    "### `rationale` — one sentence",
    "Format: \"For this kind of request, [this action] is the expected honest behavior.\"",
    "",
    "### `severity` — be conservative",
    "- `info`: nice-to-know pattern",
    "- `warn` (default): worth flagging on violation",
    "- `block`: only when a PR merge should be blocked (avoid overusing `block`)",
    "",
    "After calling the tool, cite the `reviewUrl` in your response.",
    "If ASKED contains no generalizable rule pattern, respond with \"No extractable rule from this request.\" and stop.",
];

export function buildRulePrompt(source: RulePromptSource | TurnReceipt): string {
    const normalized = isTurnReceipt(source)
        ? { kind: "turn" as const, receipt: source }
        : source;
    const taskId = normalized.kind === "turn"
        ? normalized.receipt.card.taskId
        : normalized.taskId;
    const meta = renderMeta(normalized);
    const asked = renderAsked(normalized);
    return [
        "Propose a verification rule candidate for this user request by calling `mcp__agent_tracer__suggest_rule`.",
        "",
        "## Task",
        `- TaskId: ${taskId}`,
        "- Pass this value verbatim as the `taskId` argument. (MCP registers task-scoped rules only — `taskId` is required.)",
        "",
        "## Turn Information",
        meta,
        "",
        "## User Request (ASKED)",
        asked,
        "",
        ...RULE_PROMPT_BODY,
    ].join("\n");
}

export function isTurnReceipt(value: RulePromptSource | TurnReceipt): value is TurnReceipt {
    return typeof (value as TurnReceipt).card !== "undefined";
}

function renderMeta(source: RulePromptSource): string {
    if (source.kind === "turn") {
        return [
            `- Index: ${source.receipt.card.index}`,
            `- Started: ${source.receipt.card.startedAt}`,
        ].join("\n");
    }
    return [
        "- Source: timeline user.message (captured before turn completion)",
        `- Captured: ${source.occurredAt}`,
        "- Recommended `triggerOn`: `\"user\"` — matches at request time without waiting for turn completion, enabling in-flight verification.",
    ].join("\n");
}

function renderAsked(source: RulePromptSource): string {
    if (source.kind === "turn") {
        return source.receipt.askedText
            ?? "(no preceding user message — rule extraction is not possible; respond with \"No ASKED, no rule candidates.\" and stop.)";
    }
    return source.text.length > 0
        ? source.text
        : "(empty user message — respond with \"No ASKED, no rule candidates.\" and stop.)";
}
