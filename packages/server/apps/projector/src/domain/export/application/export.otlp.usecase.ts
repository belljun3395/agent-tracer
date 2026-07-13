import { Inject, Injectable } from "@nestjs/common";
import { buildOtlpLogsBody, buildOtlpTracesBody, type OtlpEventRecord } from "@monitor/kernel";
import { OTLP_EXPORTER, type OtlpExporterPort } from "~projector/domain/export/port/otlp.exporter.port.js";

/** 원장 배치를 OTLP 트레이스·로그로 변환해 관측 수집기로 내보낸다. */
@Injectable()
export class ExportOtlpUseCase {
    constructor(@Inject(OTLP_EXPORTER) private readonly exporter: OtlpExporterPort) {}

    async execute(records: readonly OtlpEventRecord[]): Promise<void> {
        const traces = buildOtlpTracesBody(records);
        const logs = buildOtlpLogsBody(records);
        await Promise.all([
            traces === null ? Promise.resolve() : this.exporter.exportTraces(traces),
            logs === null ? Promise.resolve() : this.exporter.exportLogs(logs),
        ]);
    }
}
