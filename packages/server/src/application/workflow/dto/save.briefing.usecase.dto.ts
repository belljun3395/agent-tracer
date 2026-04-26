export type SaveBriefingPurposeUseCaseDto = "continue" | "handoff" | "review" | "reference";
export type SaveBriefingFormatUseCaseDto = "plain" | "markdown" | "xml" | "system-prompt" | "prompt";

export interface SaveBriefingUseCaseIn {
    readonly taskId: string;
    readonly purpose: SaveBriefingPurposeUseCaseDto;
    readonly format: SaveBriefingFormatUseCaseDto;
    readonly memo?: string | null;
    readonly content: string;
    readonly generatedAt: string;
}

export interface SaveBriefingUseCaseOut {
    readonly id: string;
    readonly taskId: string;
    readonly generatedAt: string;
    readonly purpose: SaveBriefingPurposeUseCaseDto;
    readonly format: SaveBriefingFormatUseCaseDto;
    readonly memo: string | null;
    readonly content: string;
}
