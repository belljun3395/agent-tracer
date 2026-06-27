/**
 * Preprocessing hints emitted by the monitor when a runtime hook (UserPromptSubmit
 * or PreToolUse) asks for context-aware suggestions before Claude Code processes
 * the next turn. Hooks call this with the current `trigger` and any tool-specific
 * payload; the server inspects recent timeline events for the task and returns
 * actionable hints that the hook forwards via `hookSpecificOutput.additionalContext`.
 */
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
