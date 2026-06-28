export type PreprocessingHintTrigger = "user_prompt" | "pre_tool";

export type PreprocessingHintType =
    | "context_pressure"
    | "duplicate_question"
    | "command_repetition"
    | "destructive_risk";

export type PreprocessingHintSeverity = "info" | "warning" | "critical";

export interface PreprocessingHint {
    readonly type: PreprocessingHintType;
    readonly severity: PreprocessingHintSeverity;
    readonly title: string;
    readonly message: string;
}

export interface GetPreprocessingHintsUseCaseIn {
    readonly taskId: string;
    readonly trigger: PreprocessingHintTrigger;
    readonly toolName?: string;
    readonly command?: string;
    readonly questions?: readonly string[];
}

export interface GetPreprocessingHintsUseCaseOut {
    readonly hints: readonly PreprocessingHint[];
}
