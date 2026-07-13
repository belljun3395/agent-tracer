import { Inject, Injectable } from "@nestjs/common";
import type { OtlpExporterPort } from "~projector/domain/export/port/otlp.exporter.port.js";
import { OTLP_EXPORT_ENDPOINT } from "~projector/support/projector.tokens.js";
import { logError } from "~projector/support/log.js";

/** OTel SDK가 trace/span ID와 타임스탬프 지정을 허용하지 않아 OTLP/HTTP JSON을 직접 전송하는 어댑터다. */
@Injectable()
export class HttpOtlpExporter implements OtlpExporterPort {
    constructor(@Inject(OTLP_EXPORT_ENDPOINT) private readonly endpoint: string) {}

    exportTraces(body: Record<string, unknown>): Promise<void> {
        return this.post("/v1/traces", body);
    }

    exportLogs(body: Record<string, unknown>): Promise<void> {
        return this.post("/v1/logs", body);
    }

    private async post(path: string, body: Record<string, unknown>): Promise<void> {
        let response: Response;
        try {
            response = await fetch(`${this.endpoint}${path}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
        } catch (err) {
            logError({ msg: "otlp.export.failed", path, error: err instanceof Error ? err.message : String(err) });
            throw err;
        }
        if (!response.ok) {
            logError({ msg: "otlp.export.rejected", path, status: response.status });
            throw new Error(`OTLP export rejected: ${path} HTTP ${response.status}`);
        }
    }
}
