export interface ProvenanceSnapshot {
    readonly eventIdsByTask: Readonly<Record<string, readonly string[]>>;
    readonly ruleIds: readonly string[];
    readonly recipeRevs: Readonly<Record<string, number>>;
}

/** 최종 출력이 인용할 수 있는 실행 내 도구 관측 ID를 모은다. */
export class ProvenanceLedger {
    private readonly eventIdsByTask = new Map<string, Set<string>>();
    private readonly ruleIds = new Set<string>();
    private readonly recipeRevs = new Map<string, number>();

    recordEvents(taskId: string, eventIds: readonly string[]): void {
        if (eventIds.length === 0) return;
        const set = this.eventIdsByTask.get(taskId) ?? new Set<string>();
        for (const id of eventIds) set.add(id);
        this.eventIdsByTask.set(taskId, set);
    }

    recordRules(ruleIds: readonly string[]): void {
        for (const id of ruleIds) this.ruleIds.add(id);
    }

    recordRecipe(recipeId: string, rev: number): void {
        this.recipeRevs.set(recipeId, rev);
    }

    snapshot(): ProvenanceSnapshot {
        return {
            eventIdsByTask: Object.fromEntries(
                [...this.eventIdsByTask.entries()].map(([taskId, ids]) => [taskId, [...ids]] as const),
            ),
            ruleIds: [...this.ruleIds],
            recipeRevs: Object.fromEntries(this.recipeRevs),
        };
    }
}

export function isEventVerified(snapshot: ProvenanceSnapshot, taskId: string, eventId: string): boolean {
    return (snapshot.eventIdsByTask[taskId] ?? []).includes(eventId);
}

export function isEventVerifiedAnyTask(snapshot: ProvenanceSnapshot, eventId: string): boolean {
    return Object.values(snapshot.eventIdsByTask).some((ids) => ids.includes(eventId));
}

export function isRuleVerified(snapshot: ProvenanceSnapshot, ruleId: string): boolean {
    return snapshot.ruleIds.includes(ruleId);
}

export function verifiedRecipeRev(snapshot: ProvenanceSnapshot, recipeId: string): number | undefined {
    return snapshot.recipeRevs[recipeId];
}
