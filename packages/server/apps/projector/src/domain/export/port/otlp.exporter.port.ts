export const OTLP_EXPORTER = Symbol("OtlpExporter");

/** 원장이 확정한 식별자를 담은 OTLP payload를 관측 수집기로 내보내는 포트다. */
export interface OtlpExporterPort {
    exportTraces(body: Record<string, unknown>): Promise<void>;
    exportLogs(body: Record<string, unknown>): Promise<void>;
}
