export type RuntimeSessionCompletionReasonUseCaseDto =
    | "idle"
    | "assistant_turn_complete"
    | "explicit_exit"
    | "runtime_terminated";

export interface EndRuntimeSessionUseCaseIn {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: RuntimeSessionCompletionReasonUseCaseDto;
    readonly backgroundCompletions?: readonly string[];
}
