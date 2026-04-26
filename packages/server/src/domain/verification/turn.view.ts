import type { VerdictStatus } from "./verdict.js";

/**
 * Read-side view types for turn-shaped data. These mirror the HTTP DTO
 * shapes one-to-one but live in the domain so application + persistence
 * layers can reference them without importing zod-derived types from the
 * adapter layer. The HTTP zod schemas re-export these as `*Dto` aliases.
 */

export type VerdictFilter = "all" | VerdictStatus;

export interface TurnVerdictCount {
    readonly verified: number;
    readonly unverifiable: number;
    readonly contradicted: number;
}

export interface TurnCardView {
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
    readonly verdictCount: TurnVerdictCount;
    readonly rulesEvaluatedCount: number;
    readonly previewLines: readonly string[];
}

export interface TurnEventView {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly occurredAt: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TurnVerdictView {
    readonly id: string;
    readonly ruleId: string;
    readonly status: VerdictStatus;
    readonly matchedPhrase: string | null;
    readonly expectedPattern: string | null;
    readonly actualToolCalls: readonly string[];
    readonly matchedToolCalls: readonly string[] | null;
    readonly evaluatedAt: string;
}

export interface TurnReceiptView {
    readonly card: TurnCardView;
    readonly askedText: string | null;
    readonly verdicts: readonly TurnVerdictView[];
    readonly events: readonly TurnEventView[];
    readonly summaryMarkdown: string | null;
}
