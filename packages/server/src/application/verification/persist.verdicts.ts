import type { TurnVerdict } from "~domain/verification/index.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";

/**
 * Persists each verdict via the repository, mapping the in-memory
 * `TurnVerdict.detail` to the optional-field shape the repository expects
 * (`matchedPhrase`, `expectedPattern`, `matchedToolCalls` are dropped when
 * absent rather than written as `undefined`).
 *
 * `evaluatedAt` is supplied by the caller so all verdicts produced by a
 * single evaluation pass share an identical timestamp.
 */
export async function persistVerdicts(
    verdictRepo: IVerdictRepository,
    verdicts: ReadonlyArray<TurnVerdict>,
    evaluatedAt: string,
): Promise<TurnVerdict[]> {
    const persisted: TurnVerdict[] = [];
    for (const verdict of verdicts) {
        const saved = await verdictRepo.insert({
            id: verdict.id,
            turnId: verdict.turnId,
            ruleId: verdict.ruleId,
            status: verdict.status,
            detail: {
                ...(verdict.detail.matchedPhrase !== undefined
                    ? { matchedPhrase: verdict.detail.matchedPhrase }
                    : {}),
                ...(verdict.detail.expectedPattern !== undefined
                    ? { expectedPattern: verdict.detail.expectedPattern }
                    : {}),
                actualToolCalls: [...verdict.detail.actualToolCalls],
                ...(verdict.detail.matchedToolCalls !== undefined
                    ? { matchedToolCalls: [...verdict.detail.matchedToolCalls] }
                    : {}),
            },
            evaluatedAt,
        });
        persisted.push(saved);
    }
    return persisted;
}
