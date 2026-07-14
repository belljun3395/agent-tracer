import {RULEGEN_REPAIR_ATTEMPTS} from "~runtime/domain/rulegen/model/proposal.grounding.model.js";
import {buildRuleProposalPolicy} from "~runtime/domain/rulegen/model/proposal.policy.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_TOOL,
    RULEGEN_WORKSPACE_TOOLS,
    rulegenToolFullName,
    type RulegenToolSpec,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

const ROLE = `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

Rules exist to verify that the agent did what the USER asked. The user's words are the source of every rule; the agent's activity is only evidence of fulfilment. Never turn the agent's own habits into rules unless the user asked for that behavior.`;

const RECENT_SCOPE = "This is an AUTO rule-generation job. Focus ONLY on the most recent turn, not the full task history.";

const WORKSPACE_ACCESS = `Read, Glob, and Grep let you inspect the workspace read-only. Use them to ground a rule in what the repository actually contains: the real test command, the real path, the real config key. Never turn a file you merely read into an obligation the user never asked for.`;

const CLOSING = "A rule is a checklist item the user will read: did the agent do what I asked? Verify fulfilment, never police the agent's style.";

const CITATIONS = `Every rule must cite the evidence it stands on:
  - citedTurnIds : the turnId values of the user turns whose request this rule verifies. At least one is required.
  - citedEventIds: the eventId values of the events that show how the work was done. May be empty when you read the events and found none.
Both come from the tool responses in THIS run: ${rulegenToolFullName(RULEGEN_TOOL.turns)} returns turnId, ${rulegenToolFullName(RULEGEN_TOOL.events)} returns eventId and turnId.
A deterministic verifier checks every ID you cite against what those tools actually returned. Never guess, reconstruct, or copy an ID from anywhere else: an ID the tools did not return is not evidence. A rule citing an unknown ID is handed back to you for exactly ${RULEGEN_REPAIR_ATTEMPTS} repair attempt and is then DROPPED, with the run's cost already spent. Workspace files you read with Read, Glob, and Grep carry no IDs, so a rule grounded only in the repository still needs the turn that asked for it.`;

function toolLine(spec: RulegenToolSpec): string {
    const params = spec.params.map((param) => (param.optional ? `${param.name}?` : param.name)).join(", ");
    return `  - ${rulegenToolFullName(spec.name)}(${params}) : ${spec.description}`;
}

function toolCatalog(tools: readonly RulegenToolSpec[]): string {
    return [
        "Tools available:",
        ...tools.map(toolLine),
        ...RULEGEN_WORKSPACE_TOOLS.map((name) => `  - ${name} : Inspect the workspace read-only.`),
    ].join("\n");
}

function manualRoute(maxTurns: number): string {
    return `Suggested route (you have up to ${maxTurns} turns; pull more evidence whenever the asks are unclear):
  1. Read the task turns turn by turn and extract explicit and implied obligations (e.g. "run the tests" → expect npm test).
  2. Read the task events to cross-check how the agent actually fulfilled those obligations; raise the limit or call again when ${RULEGEN_EVENT_LIMIT.fallback} events do not cover the work.
  3. List the existing rules and check for duplicates.
  4. Produce one rule per distinct obligation the user asked for.`;
}

function recentRoute(maxTurns: number): string {
    return `Recent-turn route (you have up to ${maxTurns} turns; usually three tool calls suffice):
  1. List the existing rules FIRST and identify which obligations are already covered before proposing anything.
  2. Pull the latest user turn, its assistant reply, and the latest assistant actions with the tools, and pull less or more as the evidence demands.
  3. Do NOT read the whole task for rule coverage.
  4. Output 1-2 rules for the obligations that request carries. If it carries none, return an EMPTY rules array: {"rules":[]}.`;
}

export interface RulegenPromptOptions {
    readonly mode: RulegenMode;
    readonly maxRules: number;
    readonly maxTurns: number;
    readonly language: string;
    readonly anchorDirective: string;
    readonly intentDirective: string;
    readonly tools: readonly RulegenToolSpec[];
}

export function buildRulegenSystemPrompt(options: RulegenPromptOptions): string {
    const recent = options.mode === RULEGEN_MODE.recent;
    return [
        ROLE,
        ...(recent ? [RECENT_SCOPE] : []),
        toolCatalog(options.tools),
        recent ? recentRoute(options.maxTurns) : manualRoute(options.maxTurns),
        WORKSPACE_ACCESS,
        CITATIONS,
        CLOSING,
        buildRuleProposalPolicy(options),
        "Return JSON conforming to the provided schema immediately after your tool calls.",
    ].join("\n\n");
}

export interface RulegenUserPromptOptions {
    readonly taskId: string;
    readonly workspacePath: string;
    readonly maxRules: number;
    readonly anchorBlock: string;
    readonly intentBlock: string;
}

export function buildRulegenUserPrompt(options: RulegenUserPromptOptions): string {
    return [
        `Task ID: ${options.taskId}`,
        `Workspace: ${options.workspacePath}`,
        `${options.anchorBlock}${options.intentBlock}`,
        `Propose up to ${options.maxRules} rules for task ${options.taskId}.`,
    ].join("\n");
}

/** SDK는 대화를 잇지 않으므로 직전 출력을 프롬프트에 다시 실어 한 번만 수리를 요청한다. */
export function buildRulegenRepairPrompt(
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic validation rejected it:",
        ...errors.map((error) => `  - ${error}`),
        "",
        `You get ${RULEGEN_REPAIR_ATTEMPTS} repair attempt and this is it. Fix exactly what these errors name, using only identifiers the tools`,
        "returned in this run. Call the tools again if you need an ID you do not have. Drop any rule you cannot",
        "ground; returning fewer rules, or none at all, is better than citing an ID you did not observe.",
        "Then return the complete rule list.",
    ].join("\n");
}
