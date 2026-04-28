export interface RunTurnEvaluationToolCallUseCaseDto {
    readonly tool: string;
    readonly command?: string;
    readonly filePath?: string;
}

export interface RunTurnEvaluationUseCaseIn {
    readonly turnId: string;
    readonly taskId: string;
    readonly assistantText: string;
    readonly userMessageText?: string;
    readonly toolCalls: ReadonlyArray<RunTurnEvaluationToolCallUseCaseDto>;
}

export interface RunTurnEvaluationUseCaseOut {
    readonly rulesEvaluated: number;
    readonly evaluatedRuleIds: readonly string[];
    readonly verdictCount: number;
}
