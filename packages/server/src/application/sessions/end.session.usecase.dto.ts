import type { TaskCompletionReason } from "~domain/index.js";

export interface EndSessionUseCaseIn {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly summary?: string;
    readonly backgroundCompletions?: string[];
    readonly metadata?: Record<string, unknown>;
}
