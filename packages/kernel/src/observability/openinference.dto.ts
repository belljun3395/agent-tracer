/** 궤적 내보내기의 와이어 계약이며 서버와 대시보드가 같은 타입을 쓴다. */
export type OpenInferenceSpanKind = "AGENT" | "CHAIN" | "TOOL" | "LLM" | "RETRIEVER" | "UNKNOWN";

export interface OpenInferenceSpanRecord {
    readonly spanId: string;
    readonly parentSpanId?: string;
    readonly name: string;
    readonly kind: OpenInferenceSpanKind;
    readonly startTime: string;
    readonly attributes: Record<string, unknown>;
}

export interface OpenInferenceTaskExport {
    readonly taskId: string;
    readonly runtimeSource?: string;
    readonly spans: readonly OpenInferenceSpanRecord[];
}

// 향후 호환을 위해 export를 `openinference` 아래에 감싼다.
export interface TaskOpenInferenceResponse {
    readonly openinference: OpenInferenceTaskExport;
}
