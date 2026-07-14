import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";

/** 심각도 단계마다 무엇이 일어나는지 못박는 절이며 모드와 무관하게 같다. */
export const SEVERITY_CLAUSE = {
    block: '  - "block" halts the agent\'s turn when the obligation is unfulfilled. Reserve it for an explicit, unambiguous user imperative ("반드시", "must always") whose violation would be a real failure.',
    warn: '  - "warn" also halts the turn when the obligation is unfulfilled. Use it for a clear obligation the user actually asked for.',
    info: '  - "info" only records the verdict and never interrupts the agent. Use it for soft or inferred expectations.',
} as const;

/** 자동 트리거는 사람 검토 없이 돌아 상향 문턱이 더 높다. */
export const SEVERITY_HEADING = {
    manual: 'Severity guidance (default to "info" when unsure, only escalate with clear evidence):',
    recent: 'Severity guidance (default to "info", this runs unreviewed, so escalate only on unmistakable evidence):',
} as const satisfies Record<RulegenMode, string>;

export function buildSeverityGuidance(mode: RulegenMode): string {
    const heading = mode === RULEGEN_MODE.recent ? SEVERITY_HEADING.recent : SEVERITY_HEADING.manual;
    return [heading, SEVERITY_CLAUSE.block, SEVERITY_CLAUSE.warn, SEVERITY_CLAUSE.info].join("\n");
}
