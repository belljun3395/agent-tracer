/**
 * Turn-related view types shared by the io layer and the turns feature.
 *
 * Mirrors the server's `domain/verification/turn.view.ts` shape one-to-one.
 * Kept under `src/types/` (not `app/features/turns/`) so `io/api.ts` can
 * reference these without taking a feature-layer dependency.
 */

export type VerdictStatus = "verified" | "unverifiable" | "contradicted";
export type VerdictFilter = "all" | VerdictStatus;

export interface TurnCardSummary {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly index: number;
    readonly taskIndex: number;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly askedText: string | null;
    readonly assistantText: string;
    readonly aggregateVerdict: VerdictStatus | null;
    readonly eventCount: number;
    readonly verdictCount: { verified: number; unverifiable: number; contradicted: number };
    readonly rulesEvaluatedCount: number;
    readonly previewLines: readonly string[];
}

export interface TurnVerdictRecord {
    readonly id: string;
    readonly ruleId: string;
    readonly status: VerdictStatus;
    readonly matchedPhrase: string | null;
    readonly expectedPattern: string | null;
    readonly actualToolCalls: readonly string[];
    readonly matchedToolCalls: readonly string[] | null;
    readonly evaluatedAt: string;
}

export interface TurnEventRecord {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly occurredAt: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TurnReceipt {
    readonly card: TurnCardSummary;
    readonly askedText: string | null;
    readonly verdicts: readonly TurnVerdictRecord[];
    readonly events: readonly TurnEventRecord[];
    readonly summaryMarkdown: string | null;
}
