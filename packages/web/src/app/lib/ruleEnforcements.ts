import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface RuleEnforcementView {
    readonly ruleId: string;
    readonly matchKind: "trigger" | "expect-fulfilled";
}

export function readRuleEnforcements(event: TimelineEventRecord): readonly RuleEnforcementView[] {
    const value = event.metadata["ruleEnforcements"];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const maybe = item as { ruleId?: unknown; matchKind?: unknown; role?: unknown };
        if (typeof maybe.ruleId !== "string") return [];
        const matchKind = maybe.matchKind ?? maybe.role;
        if (matchKind !== "trigger" && matchKind !== "expect-fulfilled") return [];
        return [{ ruleId: maybe.ruleId, matchKind }];
    });
}
