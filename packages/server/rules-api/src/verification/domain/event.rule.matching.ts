import { KIND } from "@monitor/timeline-api/event/public/types/event.const.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.js";
import { inferToolCall } from "./tool.call.inference.js";

export type RuleEventMatchKind = "trigger" | "expect-fulfilled";

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

    // 서로 다른 패턴이 과도하게 들어오면 캐시를 비워 메모리 증가를 막는다.
    if (compiledPatternCache.size > 500) compiledPatternCache.clear();
    compiledPatternCache.set(pattern, compiled);
    return compiled;
}

export function matchEventAgainstRule(
    event: TimelineEvent,
    rule: Rule,
): readonly RuleEventMatchKind[] {
    const matchKinds: RuleEventMatchKind[] = [];

    if (rule.trigger && triggerMatchesEvent(event, rule)) {
        // 이벤트 본문이 룰의 트리거 문구와 발화자 조건을 만족하면 trigger로 기록한다.
        matchKinds.push("trigger");
    }
    if (expectMatchesEvent(event, rule)) {
        // 도구 호출이 룰의 기대 액션/명령/패턴 조건을 만족하면 expect-fulfilled로 기록한다.
        matchKinds.push("expect-fulfilled");
    }
    return matchKinds;
}

function triggerMatchesEvent(event: TimelineEvent, rule: Rule): boolean {
    if (!rule.trigger || rule.trigger.phrases.length === 0) return false;
    const triggerOn = rule.triggerOn;
    // triggerOn이 지정된 룰은 해당 발화자 이벤트에서만 트리거된다.
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
    // action이 지정되면 해당 도구 계열이 아니면 기대 충족으로 보지 않는다.
    if (
        rule.expect.action &&
        !verificationToolMatchesExpectedAction(tc.tool, rule.expect.action)
    ) {
        return false;
    }
    if (rule.expect.commandMatches && rule.expect.commandMatches.length > 0) {
        // commandMatches가 있으면 실제 명령 문자열에 지정 문구가 포함되어야 한다.
        const cmd = (tc.command ?? "").toLowerCase();
        if (!cmd) return false;
        if (!rule.expect.commandMatches.some((m) => cmd.includes(m.toLowerCase()))) return false;
    }
    if (rule.expect.pattern) {
        // pattern은 파일 경로나 명령 문자열 중 사용 가능한 값에 적용한다.
        const re = compilePattern(rule.expect.pattern);
        if (!re) return false;
        const target = (tc.filePath ?? tc.command ?? "").slice(0, MAX_PATTERN_TARGET_LEN);
        if (!re.test(target)) return false;
    }
    return rule.expect.action !== undefined
        || (rule.expect.commandMatches !== undefined && rule.expect.commandMatches.length > 0)
        || rule.expect.pattern !== undefined;
}
