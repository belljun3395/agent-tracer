/** 셸 명령 분석 결과의 공개 이벤트 계약이다. */
export type CommandStructure = "simple" | "sequence" | "pipeline" | "compound";
export type CommandEffect = "read_only" | "execute_check" | "write" | "destructive" | "network" | "unknown";
export type CommandConfidence = "high" | "medium" | "low";

export interface CommandTarget {
    readonly type: "file" | "directory" | "path" | "workspace" | "stream" | "url" | "package" | "unknown";
    readonly value: string;
}

export interface CommandSelectors {
    readonly lineRange?: string;
    readonly pattern?: string;
}

export interface CommandRedirect {
    readonly operator: string;
    readonly target: CommandTarget;
}

export interface CommandStep {
    readonly raw: string;
    readonly commandName: string;
    readonly subcommand?: string;
    readonly operation: string;
    readonly targets: readonly CommandTarget[];
    readonly effect: CommandEffect;
    readonly confidence: CommandConfidence;
    readonly operatorFromPrevious?: "&&" | "||" | ";";
    readonly selectors?: CommandSelectors;
    readonly workspace?: string;
    readonly scriptName?: string;
    readonly redirects?: readonly CommandRedirect[];
    readonly pipeline?: readonly CommandStep[];
}

export interface CommandAnalysis {
    readonly raw: string;
    readonly structure: CommandStructure;
    readonly overallEffect: CommandEffect;
    readonly confidence: CommandConfidence;
    readonly steps: readonly CommandStep[];
    readonly failureMasked?: boolean;
}

/** 셸 시퀀스 파서가 만든 명령 조각이다. */
export interface CommandSequencePart {
    readonly raw: string;
    readonly operatorFromPrevious?: "&&" | "||" | ";";
}
