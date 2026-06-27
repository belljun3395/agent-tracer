import { VERDICT_STATUSES } from "./const/verdict.const.js";
import type { VerdictStatus } from "./model/verdict.model.js";

const VERDICT_PRIORITY: Record<VerdictStatus, number> = {
    contradicted: 3,
    unverifiable: 2,
    verified: 1,
};

const VERDICT_STATUS_SET: ReadonlySet<string> = new Set<string>(VERDICT_STATUSES);

function isVerdictStatus(value: unknown): value is VerdictStatus {
    return typeof value === "string" && VERDICT_STATUS_SET.has(value);
}

export function aggregateVerdict(
    statuses: ReadonlyArray<string | null | undefined>,
): VerdictStatus | null {
    let worst: VerdictStatus | null = null;
    for (const status of statuses) {
        if (!isVerdictStatus(status)) continue;
        if (worst === null || VERDICT_PRIORITY[status] > VERDICT_PRIORITY[worst]) {
            worst = status;
        }
    }
    return worst;
}
