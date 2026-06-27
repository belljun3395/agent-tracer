import { KIND } from "@monitor/activity/event/public/types/event.const.js";
import type { TimelineEvent } from "@monitor/activity/event/public/types/event.types.js";
import type { Rule } from "@monitor/governance/rule/public/types/rule.types.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.js";
import { inferToolCall } from "./tool.call.inference.js";

export type RuleEventMatchKind = "trigger" | "expect-fulfilled";

// Compile each user-supplied pattern once instead of per event×rule, and bound
// the matched input length so a pathological pattern can't backtrack
// catastrophically (ReDoS) over a long command/path. A non-global RegExp is
// safe to cache and reuse via test() (no lastIndex state).
const MAX_PATTERN_TARGET_LEN = 4096;
const compiledPatternCache = new Map<string, RegExp | null>();

function compilePattern(pattern: string): RegExp | null {
    const cached = compiledPatternCache.get(pattern);
    if (cached !== undefined) return cached;
    let compiled: RegExp | null;
    try {
        compiled = new RegExp(pattern);
    } catch {
        compiled = null;
    }
    // Bound the cache so a flood of distinct (e.g. invalid) patterns can't grow it.
    if (compiledPatternCache.size > 500) compiledPatternCache.clear();
    compiledPatternCache.set(pattern, compiled);
    return compiled;
}

/**
 * Returns the match kind(s) under which `event` matches `rule`. An event can
 * match both trigger and expect when a single recorded event satisfies both
 * sides of the rule contract.
 */
export function matchEventAgainstRule(
    event: TimelineEvent,
    rule: Rule,
): readonly RuleEventMatchKind[] {
    const matchKinds: RuleEventMatchKind[] = [];

    if (rule.trigger && triggerMatchesEvent(event, rule)) {
        matchKinds.push("trigger");
    }
    if (expectMatchesEvent(event, rule)) {
        matchKinds.push("expect-fulfilled");
    }
    return matchKinds;
}

function triggerMatchesEvent(event: TimelineEvent, rule: Rule): boolean {
    if (!rule.trigger || rule.trigger.phrases.length === 0) return false;
    const triggerOn = rule.triggerOn;
    if (triggerOn === "user" && event.kind !== KIND.userMessage) return false;
    if (triggerOn === "assistant" && event.kind !== KIND.assistantResponse) return false;
    if (!triggerOn && event.kind !== KIND.userMessage && event.kind !== KIND.assistantResponse) return false;

    const text = `${event.title}\n${event.body ?? ""}`.toLowerCase();
    if (!text.trim()) return false;
    return rule.trigger.phrases.some((phrase) => text.includes(phrase.toLowerCase()));
}

function expectMatchesEvent(event: TimelineEvent, rule: Rule): boolean {
    const tc = inferToolCall(event);
    if (!tc) return false;
    if (
        rule.expect.action &&
        !verificationToolMatchesExpectedAction(tc.tool, rule.expect.action)
    ) {
        return false;
    }
    if (rule.expect.commandMatches && rule.expect.commandMatches.length > 0) {
        const cmd = (tc.command ?? "").toLowerCase();
        if (!cmd) return false;
        if (!rule.expect.commandMatches.some((m) => cmd.includes(m.toLowerCase()))) return false;
    }
    if (rule.expect.pattern) {
        const re = compilePattern(rule.expect.pattern);
        if (!re) return false;
        const target = (tc.filePath ?? tc.command ?? "").slice(0, MAX_PATTERN_TARGET_LEN);
        if (!re.test(target)) return false;
    }
    return rule.expect.action !== undefined
        || (rule.expect.commandMatches !== undefined && rule.expect.commandMatches.length > 0)
        || rule.expect.pattern !== undefined;
}
