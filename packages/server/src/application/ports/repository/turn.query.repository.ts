import type {
    TurnCardView,
    TurnReceiptView,
    VerdictFilter,
} from "~domain/verification/index.js";

export interface ListTurnsArgs {
    readonly limit: number;
    readonly sessionId?: string;
    readonly taskId?: string;
    readonly verdict?: VerdictFilter;
    readonly cursor?: string;
}

export interface ListTurnsResult {
    readonly items: readonly TurnCardView[];
    readonly nextCursor: string | null;
}

export interface BackfillTurnRow {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly assistantText: string;
    readonly userMessageText: string;
    readonly rulesEvaluatedCount: number;
    readonly toolCalls: ReadonlyArray<{
        readonly tool: string;
        readonly command?: string;
        readonly filePath?: string;
    }>;
}

/**
 * Read+derive port for turn-shaped queries. Implementations compute the
 * domain views (`TurnCardView`, `TurnReceiptView`) directly from the
 * persistence layer for efficiency — there is no separate domain entity
 * to project from.
 *
 * Summary persistence (`getCachedSummary`/`updateSummaryMarkdown`) lives
 * here too because the same SQLite table backs the receipt lookup; a
 * separate write port would force a second connection without buying any
 * isolation.
 */
export interface ITurnQueryRepository {
    listTurns(args: ListTurnsArgs): Promise<ListTurnsResult>;
    getReceipt(turnId: string): Promise<TurnReceiptView | null>;
    listTurnsForBackfill(args: {
        readonly scope: "global" | "task";
        readonly taskId?: string;
    }): Promise<ReadonlyArray<BackfillTurnRow>>;
    getCachedSummary(turnId: string): Promise<string | null>;
    updateSummaryMarkdown(turnId: string, markdown: string): Promise<void>;
}
