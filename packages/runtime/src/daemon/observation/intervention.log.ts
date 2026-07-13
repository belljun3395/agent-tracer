import {VERDICT_STATUS} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";
import type {PreprocessingHint, PreprocessingHintTrigger} from "~runtime/domain/hint/model/hint.model.js";

const RECENT_MAX = 200;

/** 데몬이 에이전트에 가한 개입의 종류다. */
export type InterventionKind = "tool_denied" | "stop_blocked" | "hints_injected" | "recipe_injected";

export interface Intervention {
    readonly at: number;
    readonly kind: InterventionKind;
    readonly taskId: string;
    readonly ruleName?: string;
    readonly severity?: string;
    readonly detail?: string;
    readonly tool?: string;
    readonly hintTypes?: readonly string[];
    readonly trigger?: PreprocessingHintTrigger;
    readonly injectedBytes?: number;
}

export interface RuleActivity {
    readonly ruleName: string;
    readonly taskId: string;
    readonly evaluated: number;
    readonly verified: number;
    readonly contradicted: number;
    readonly denied: number;
    readonly blocked: number;
    readonly lastFiredAt?: number;
}

export interface InterventionSnapshot {
    readonly recent: readonly Intervention[];
    readonly totals: Record<InterventionKind, number>;
    readonly injectedBytes: number;
    readonly hintTypeCounts: Record<string, number>;
    readonly ruleActivity: readonly RuleActivity[];
}

interface MutableRuleActivity {
    ruleName: string;
    taskId: string;
    evaluated: number;
    verified: number;
    contradicted: number;
    denied: number;
    blocked: number;
    lastFiredAt?: number;
}

/** 데몬 수명 동안의 개입 기록을 메모리에만 보관한다. */
export class InterventionLog {
    private readonly entries: Intervention[] = [];
    private readonly totals: Record<InterventionKind, number> = {
        tool_denied: 0,
        stop_blocked: 0,
        hints_injected: 0,
        recipe_injected: 0,
    };
    private readonly hintTypeCounts: Record<string, number> = {};
    private readonly rules = new Map<string, MutableRuleActivity>();
    private injectedBytes = 0;

    record(intervention: Intervention): void {
        this.entries.push(intervention);
        if (this.entries.length > RECENT_MAX) this.entries.splice(0, this.entries.length - RECENT_MAX);
        this.totals[intervention.kind] += 1;
        this.injectedBytes += intervention.injectedBytes ?? 0;
        for (const type of intervention.hintTypes ?? []) {
            this.hintTypeCounts[type] = (this.hintTypeCounts[type] ?? 0) + 1;
        }
        if (intervention.ruleName === undefined) return;
        const activity = this.ruleFor(intervention.taskId, intervention.ruleName);
        if (intervention.kind === "tool_denied") activity.denied += 1;
        if (intervention.kind === "stop_blocked") activity.blocked += 1;
        activity.lastFiredAt = intervention.at;
    }

    recordToolDenied(at: number, taskId: string, ruleName: string, tool: string, needle: string): void {
        this.record({at, kind: "tool_denied", taskId, ruleName, tool, detail: needle});
    }

    recordHintsInjected(
        at: number,
        taskId: string,
        trigger: PreprocessingHintTrigger,
        hints: readonly PreprocessingHint[],
        injectedBytes: number,
    ): void {
        if (hints.length === 0) return;
        this.record({
            at,
            kind: "hints_injected",
            taskId,
            trigger,
            hintTypes: hints.map((hint) => hint.type),
            detail: hints.map((hint) => hint.title).join("; "),
            injectedBytes,
        });
    }

    recordRecipeInjected(at: number, taskId: string, titles: readonly string[], injectedBytes: number): void {
        if (titles.length === 0) return;
        this.record({at, kind: "recipe_injected", taskId, detail: titles.join("; "), injectedBytes});
    }

    recordVerdicts(
        at: number,
        taskId: string,
        verdicts: readonly GuardrailVerdict[],
        blocking: readonly GuardrailVerdict[],
    ): void {
        for (const verdict of verdicts) {
            const activity = this.ruleFor(taskId, verdict.ruleName);
            activity.evaluated += 1;
            if (verdict.status === VERDICT_STATUS.verified) activity.verified += 1;
            if (verdict.status === VERDICT_STATUS.contradicted) activity.contradicted += 1;
        }
        for (const verdict of blocking) {
            this.record({
                at,
                kind: "stop_blocked",
                taskId,
                ruleName: verdict.ruleName,
                severity: verdict.severity,
                detail: verdict.matchedPhrase
                    ?? verdict.forbiddenPattern
                    ?? verdict.expectedPattern
                    ?? verdict.status,
            });
        }
    }

    snapshot(): InterventionSnapshot {
        const ruleActivity: RuleActivity[] = [...this.rules.values()].map((activity) => ({
            ruleName: activity.ruleName,
            taskId: activity.taskId,
            evaluated: activity.evaluated,
            verified: activity.verified,
            contradicted: activity.contradicted,
            denied: activity.denied,
            blocked: activity.blocked,
            ...(activity.lastFiredAt !== undefined ? {lastFiredAt: activity.lastFiredAt} : {}),
        }));
        ruleActivity.sort(
            (left, right) =>
                right.denied + right.blocked - (left.denied + left.blocked)
                || right.evaluated - left.evaluated,
        );
        return {
            recent: [...this.entries].reverse(),
            totals: {...this.totals},
            injectedBytes: this.injectedBytes,
            hintTypeCounts: {...this.hintTypeCounts},
            ruleActivity,
        };
    }

    private ruleFor(taskId: string, ruleName: string): MutableRuleActivity {
        const key = `${taskId} ${ruleName}`;
        const existing = this.rules.get(key);
        if (existing) return existing;
        const created: MutableRuleActivity = {
            ruleName,
            taskId,
            evaluated: 0,
            verified: 0,
            contradicted: 0,
            denied: 0,
            blocked: 0,
        };
        this.rules.set(key, created);
        return created;
    }
}
