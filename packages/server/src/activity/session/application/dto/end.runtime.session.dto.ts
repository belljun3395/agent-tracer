export type RuntimeSessionCompletionReason =
    | "idle"
    | "assistant_turn_complete"
    | "explicit_exit"
    | "runtime_terminated";

export interface EndRuntimeSessionIn {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: RuntimeSessionCompletionReason;
    readonly backgroundCompletions?: readonly string[];
}
