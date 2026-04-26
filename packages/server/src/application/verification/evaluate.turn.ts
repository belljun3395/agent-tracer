import type { Rule, TurnVerdict, VerdictStatus } from "~domain/verification/index.js";

export interface EvaluateTurnToolCall {
    readonly tool: string; // e.g. "Bash", "Edit", "Write"
    readonly command?: string; // shell command string if tool === "Bash"
    readonly filePath?: string; // file path if tool is Edit/Write/Read
}

export interface EvaluateTurnInput {
    readonly turnId: string;
    readonly assistantText: string;
    readonly userMessageText?: string; // optional ASKED text for triggerOn='user' rules
    readonly toolCalls: ReadonlyArray<EvaluateTurnToolCall>;
    readonly rules: ReadonlyArray<Rule>; // active rules
    readonly now: string; // ISO timestamp for `evaluatedAt`
    readonly newVerdictId: () => string; // injected id generator
}

export interface EvaluateTurnResult {
    readonly verdicts: ReadonlyArray<TurnVerdict>;
}

const NEGATION_MARKERS: readonly string[] = [
    "did not ",
    "didn't ",
    "not ",
    "haven't ",
    "have not ",
    "never ",
    "no ",
    "couldn't ",
    "could not ",
];

const NEGATION_LOOKBACK = 20;

/**
 * Find the first trigger phrase that appears (case-insensitive substring)
 * in `text`, returning the matched phrase and its index in the lowercased
 * text. Phrases are checked in the order given.
 */
function findTriggerMatch(
    text: string,
    phrases: readonly string[],
): { phrase: string; index: number } | null {
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
        const needle = phrase.toLowerCase();
        const idx = lower.indexOf(needle);
        if (idx !== -1) {
            return { phrase, index: idx };
        }
    }
    return null;
}

/**
 * Returns true if the character window immediately preceding the match
 * contains one of the negation markers.
 */
function isNegated(text: string, matchIndex: number): boolean {
    const start = Math.max(0, matchIndex - NEGATION_LOOKBACK);
    const window = text.slice(start, matchIndex).toLowerCase();
    return NEGATION_MARKERS.some((marker) => window.includes(marker));
}

/**
 * Compile a pattern string to a RegExp. Returns null if the pattern is
 * not a valid JS regex.
 */
function compilePattern(pattern: string): RegExp | null {
    try {
        return new RegExp(pattern);
    } catch {
        return null;
    }
}

/**
 * Try to compile every pattern in `patterns`. If any pattern is invalid,
 * returns null so the caller can short-circuit to "unverifiable".
 */
function compilePatterns(patterns: readonly string[]): RegExp[] | null {
    const compiled: RegExp[] = [];
    for (const p of patterns) {
        const re = compilePattern(p);
        if (re === null) return null;
        compiled.push(re);
    }
    return compiled;
}

function commandMatchesAny(cmd: string, regexps: readonly RegExp[]): boolean {
    return regexps.some((re) => re.test(cmd));
}

function evaluateRule(
    rule: Rule,
    input: EvaluateTurnInput,
): TurnVerdict | null {
    let matchedPhrase: string | undefined;
    if (rule.trigger !== undefined) {
        // triggerOn defaults to 'assistant' (back-compat). 'user' mode matches
        // against the preceding user message instead — useful for "user asks
        // for X → expect tool Y" rules that don't depend on agent's claim
        // wording.
        const source = rule.triggerOn === "user"
            ? (input.userMessageText ?? "")
            : input.assistantText;
        const triggerMatch = findTriggerMatch(
            source,
            rule.trigger.phrases,
        );
        if (triggerMatch === null) return null;
        if (isNegated(source, triggerMatch.index)) return null;
        matchedPhrase = triggerMatch.phrase;
    }

    const matchingToolCalls =
        rule.expect.tool === undefined
            ? input.toolCalls
            : input.toolCalls.filter((tc) => tc.tool === rule.expect.tool);

    let status: VerdictStatus;
    let expectedPattern: string | undefined;
    let actualToolCalls: string[];
    let matchedToolCalls: string[] | undefined;

    const { commandMatches, pattern, tool } = rule.expect;

    if ((tool === undefined || tool === "Bash") && commandMatches !== undefined) {
        expectedPattern = commandMatches.join(" | ");
        const regexps = compilePatterns(commandMatches);
        if (regexps === null) {
            status = "unverifiable";
            actualToolCalls = matchingToolCalls.map((tc) => tc.command ?? "");
        } else {
            const bashCalls = matchingToolCalls;
            actualToolCalls = bashCalls.map((tc) => tc.command ?? "");
            if (bashCalls.length === 0) {
                status = "contradicted";
            } else {
                const matched = bashCalls.filter((tc) =>
                    commandMatchesAny(tc.command ?? "", regexps),
                );
                status = matched.length > 0 ? "verified" : "contradicted";
                if (matched.length > 0) {
                    matchedToolCalls = matched.map((tc) => tc.command ?? "");
                }
            }
        }
    } else if (pattern !== undefined) {
        expectedPattern = pattern;
        const re = compilePattern(pattern);
        actualToolCalls = matchingToolCalls.map(
            (tc) => tc.filePath ?? tc.command ?? "",
        );
        if (re === null) {
            status = "unverifiable";
        } else if (matchingToolCalls.length === 0) {
            status = "contradicted";
        } else {
            const matched = matchingToolCalls.filter((tc) =>
                re.test(tc.filePath ?? tc.command ?? ""),
            );
            status = matched.length > 0 ? "verified" : "contradicted";
            if (matched.length > 0) {
                matchedToolCalls = matched.map((tc) => tc.filePath ?? tc.command ?? "");
            }
        }
    } else {
        // No commandMatches and no pattern. If tool is specified, treat
        // mere presence of the tool call as the expectation.
        actualToolCalls = matchingToolCalls.map(
            (tc) => tc.filePath ?? tc.command ?? "",
        );
        if (tool === undefined) {
            status = "unverifiable";
        } else {
            status = matchingToolCalls.length > 0 ? "verified" : "contradicted";
            if (matchingToolCalls.length > 0) {
                matchedToolCalls = actualToolCalls;
            }
        }
    }

    const detail: TurnVerdict["detail"] = {
        actualToolCalls,
        ...(matchedPhrase !== undefined ? { matchedPhrase } : {}),
        ...(expectedPattern !== undefined ? { expectedPattern } : {}),
        ...(matchedToolCalls !== undefined ? { matchedToolCalls } : {}),
    };
    return {
        id: input.newVerdictId(),
        turnId: input.turnId,
        ruleId: rule.id,
        status,
        detail,
        evaluatedAt: input.now,
    };
}

/**
 * Evaluate a single turn against a set of active rules. Pure function:
 * no I/O, no wall-clock, no randomness. All externals are injected
 * (`now`, `newVerdictId`).
 *
 * Emits one {@link TurnVerdict} per rule whose trigger matched (and was
 * not negated). Rules without a `trigger` are always evaluated.
 */
export function evaluateTurn(input: EvaluateTurnInput): EvaluateTurnResult {
    const verdicts: TurnVerdict[] = [];
    for (const rule of input.rules) {
        const verdict = evaluateRule(rule, input);
        if (verdict !== null) verdicts.push(verdict);
    }
    return { verdicts };
}
