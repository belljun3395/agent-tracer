/**
 * OpenInference span shape mirrored from server.
 *
 * Source of truth lives in
 *   packages/server/src/work/task/domain/task.openinference.export.model.ts
 *
 * Kept inline here (rather than synthesised from a shared `domain/types`
 * package) so the web bundle stays self-contained. If the server contract
 * adds a field, copy it here and adjust the Trace tab — the API layer
 * will surface schema drift via runtime errors.
 */
export type OpenInferenceSpanKind =
  | "AGENT"
  | "CHAIN"
  | "TOOL"
  | "LLM"
  | "RETRIEVER"
  | "UNKNOWN";

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

/** Server wraps the export under `openinference` for forward compat. */
export interface TaskOpenInferenceResponse {
  readonly openinference: OpenInferenceTaskExport;
}
