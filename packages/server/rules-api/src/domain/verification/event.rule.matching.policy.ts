import { KIND } from "@monitor/timeline-api/public/types/event.const.js";
import type { TimelineEvent } from "@monitor/timeline-api/public/types/event.types.js";
import type { Rule } from "@monitor/rules-api/domain/rule/rule.types.js";
import { compilePattern } from "@monitor/shared/kernel/compile.pattern.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.policy.js";
import { inferToolCall } from "./tool.call.inference.policy.js";
import { matchRuleTrigger } from "./rule.trigger.matching.policy.js";

export type RuleEventMatchKind = "trigger" | "expect-fulfilled";

const MAX_PATTERN_TARGET_LEN = 4096;

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
    const speaker = event.kind === KIND.userMessage
        ? "user"
        : event.kind === KIND.assistantResponse
            ? "assistant"
            : "other";
    return matchRuleTrigger(
        rule,
        [{ speaker, text: `${event.title}\n${event.body ?? ""}` }],
        { negationAware: false },
    ) !== null;
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
