export type OpenInferenceSpanKindUseCaseDto = "AGENT" | "CHAIN" | "TOOL" | "LLM" | "RETRIEVER" | "UNKNOWN";

export interface OpenInferenceSpanUseCaseDto {
    readonly spanId: string;
    readonly parentSpanId?: string;
    readonly name: string;
    readonly kind: OpenInferenceSpanKindUseCaseDto;
    readonly startTime: string;
    readonly attributes: Record<string, unknown>;
}

export interface OpenInferenceTaskExportUseCaseDto {
    readonly taskId: string;
    readonly runtimeSource?: string;
    readonly spans: readonly OpenInferenceSpanUseCaseDto[];
}

export interface GetTaskOpenInferenceUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskOpenInferenceUseCaseOut {
    readonly openinference: OpenInferenceTaskExportUseCaseDto;
}
