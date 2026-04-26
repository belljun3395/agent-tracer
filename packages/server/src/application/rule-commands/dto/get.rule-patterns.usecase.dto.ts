export interface GetRulePatternsUseCaseIn {
    readonly taskId: string;
}

export interface GetRulePatternsUseCaseOut {
    readonly patterns: readonly string[];
}
