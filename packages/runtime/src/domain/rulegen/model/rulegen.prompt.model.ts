import type {RuleGenerationEvidence} from "~runtime/domain/rulegen/model/evidence.model.js";
import {buildRuleProposalPolicy} from "~runtime/domain/rulegen/model/proposal.policy.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";

export const EVIDENCE_TAG = {
    turns: "task-turns",
    events: "task-events",
    existingRules: "existing-rules",
} as const;

const ROLE = `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

Rules exist to verify that the agent did what the USER asked. The user's words are the source of every rule; the agent's activity is only evidence of fulfilment. Never turn the agent's own habits into rules unless the user asked for that behavior.`;

const MANUAL_ROUTE = `Evidence is supplied inline. You have no filesystem access and no tools, so every rule must come from it:
  - <${EVIDENCE_TAG.turns}>     : what the user asked in each turn (askedText, the user's own words) plus a short reply summary. THE PRIMARY SOURCE for rules.
  - <${EVIDENCE_TAG.events}>    : slim activity log (kind, title, body) showing HOW the agent fulfilled the asks.
  - <${EVIDENCE_TAG.existingRules}>: rules that already exist.

Route:
  1. Read <${EVIDENCE_TAG.turns}> turn by turn and extract explicit and implied obligations (e.g. "run the tests" → expect npm test).
  2. Cross-check <${EVIDENCE_TAG.events}> for how the agent actually fulfilled those obligations.
  3. Read <${EVIDENCE_TAG.existingRules}> and avoid duplicates.
  4. Produce rules anchored to the user's asks.`;

const RECENT_ROUTE = `This is an AUTO rule-generation job. Focus ONLY on the most recent turn, not the full task history.

Evidence is supplied inline. You have no filesystem access and no tools, so every rule must come from it:
  - <${EVIDENCE_TAG.turns}>     : the most recent user turn and its assistant reply summary.
  - <${EVIDENCE_TAG.events}>    : the latest assistant actions that help verify that turn.
  - <${EVIDENCE_TAG.existingRules}>: rules that already exist.

Route:
  1. Read <${EVIDENCE_TAG.existingRules}> FIRST and identify existing rule intent and trigger coverage before proposing anything.
  2. Read the most recent user turn, its assistant reply, and the latest assistant actions.
  3. Do NOT read the whole task for rule coverage.
  4. Output 1-2 rules anchored to the latest user turn. If the latest turn introduces no new verifiable obligation, return an EMPTY rules array: {"rules":[]}.`;

const CLOSING = "Rules are not blockers. They describe what to EXPECT a future agent doing similar work to do.";

export interface RulegenPromptOptions {
    readonly mode: RulegenMode;
    readonly maxRules: number;
    readonly language: string;
    readonly anchorDirective: string;
    readonly intentDirective: string;
}

export function buildRulegenSystemPrompt(options: RulegenPromptOptions): string {
    return [
        ROLE,
        options.mode === RULEGEN_MODE.recent ? RECENT_ROUTE : MANUAL_ROUTE,
        CLOSING,
        buildRuleProposalPolicy(options),
        "Return JSON conforming to the provided schema.",
    ].join("\n\n");
}

export interface RulegenUserPromptOptions {
    readonly taskId: string;
    readonly workspacePath: string;
    readonly maxRules: number;
    readonly anchorBlock: string;
    readonly intentBlock: string;
    readonly evidence: RuleGenerationEvidence;
}

function tagged(tag: string, value: unknown): string {
    return `<${tag}>\n${JSON.stringify(value, null, 2)}\n</${tag}>`;
}

export function buildRulegenUserPrompt(options: RulegenUserPromptOptions): string {
    return [
        `Task ID: ${options.taskId}`,
        `Workspace: ${options.workspacePath}`,
        `${options.anchorBlock}${options.intentBlock}`,
        tagged(EVIDENCE_TAG.turns, options.evidence.turns),
        tagged(EVIDENCE_TAG.events, options.evidence.events),
        tagged(EVIDENCE_TAG.existingRules, options.evidence.existingRules),
        `Propose up to ${options.maxRules} rules for task ${options.taskId}.`,
    ].join("\n");
}
