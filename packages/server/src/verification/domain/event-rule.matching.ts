import { KIND } from "~event/public/types/event.const.js";
import type { TimelineEvent } from "~event/public/types/event.types.js";
import type { Rule } from "~rule/public/types/rule.types.js";
import { verificationToolMatchesExpectedAction } from "./tool-action.matching.js";
import { inferToolCall } from "./tool-call.inference.js";

export type RuleEventMatchKind = "trigger" | "expect-fulfilled";

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
        try {
            const re = new RegExp(rule.expect.pattern);
            const target = tc.filePath ?? tc.command ?? "";
            if (!re.test(target)) return false;
        } catch {
            return false;
        }
    }
    return rule.expect.action !== undefined
        || (rule.expect.commandMatches !== undefined && rule.expect.commandMatches.length > 0)
        || rule.expect.pattern !== undefined;
}
