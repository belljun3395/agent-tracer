import type { TaskCompletionReason } from "~domain/index.js";

export interface EndRuntimeSessionUseCaseIn {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly backgroundCompletions?: readonly string[];
}
