import {buildRuleProposalPolicy} from "~runtime/domain/rulegen/model/proposal.policy.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_WORKSPACE_TOOLS,
    rulegenToolFullName,
    type RulegenToolSpec,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

const ROLE = `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

Rules exist to verify that the agent did what the USER asked. The user's words are the source of every rule; the agent's activity is only evidence of fulfilment. Never turn the agent's own habits into rules unless the user asked for that behavior.`;

const RECENT_SCOPE = "This is an AUTO rule-generation job. Focus ONLY on the most recent turn, not the full task history.";

const WORKSPACE_ACCESS = `Read, Glob, and Grep let you inspect the workspace read-only. Use them to ground a rule in what the repository actually contains: the real test command, the real path, the real config key. Never turn a file you merely read into an obligation the user never asked for.`;

const CLOSING = "Rules are not blockers. They describe what to EXPECT a future agent doing similar work to do.";

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
  4. Produce rules anchored to the user's asks.`;
}

function recentRoute(maxTurns: number): string {
    return `Recent-turn route (you have up to ${maxTurns} turns; usually three tool calls suffice):
  1. List the existing rules FIRST and identify existing rule intent and trigger coverage before proposing anything.
  2. Pull the latest user turn, its assistant reply, and the latest assistant actions with the tools, and pull less or more as the evidence demands.
  3. Do NOT read the whole task for rule coverage.
  4. Output 1-2 rules anchored to the latest user turn. If the latest turn introduces no new verifiable obligation, return an EMPTY rules array: {"rules":[]}.`;
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
