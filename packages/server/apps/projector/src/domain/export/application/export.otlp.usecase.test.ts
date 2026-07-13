import { describe, expect, it } from "vitest";
import { KIND, type OtlpEventRecord } from "@monitor/kernel";
import type { OtlpExporterPort } from "~projector/domain/export/port/otlp.exporter.port.js";
import { ExportOtlpUseCase } from "~projector/domain/export/application/export.otlp.usecase.js";

function record(kind = KIND.userMessage): OtlpEventRecord {
    return {
        id: "01KX6A00000000000000000000",
        kind,
        taskId: "task-1",
        sessionId: "session-1",
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        parentSpanId: null,
        occurredAt: new Date("2026-07-10T00:00:00.000Z"),
        payload: { body: "hello" },
    };
}

class RecordingExporter implements OtlpExporterPort {
    readonly traces: Record<string, unknown>[] = [];
    readonly logs: Record<string, unknown>[] = [];
    error: Error | null = null;

    exportTraces(body: Record<string, unknown>): Promise<void> {
        if (this.error !== null) return Promise.reject(this.error);
        this.traces.push(body);
        return Promise.resolve();
    }

    exportLogs(body: Record<string, unknown>): Promise<void> {
        if (this.error !== null) return Promise.reject(this.error);
        this.logs.push(body);
        return Promise.resolve();
    }
}

describe("ExportOtlpUseCase", () => {
    it("원장 레코드를 OTLP 로그로 만들어 내보낸다", async () => {
        const exporter = new RecordingExporter();

        await new ExportOtlpUseCase(exporter).execute([record()]);

        expect(exporter.logs).toHaveLength(1);
    });

    it("span으로 볼 수 없는 레코드는 트레이스로 내보내지 않는다", async () => {
        const exporter = new RecordingExporter();

        await new ExportOtlpUseCase(exporter).execute([record()]);

        expect(exporter.traces).toHaveLength(0);
    });

    it("내보낼 레코드가 없으면 아무것도 내보내지 않는다", async () => {
        const exporter = new RecordingExporter();

        await new ExportOtlpUseCase(exporter).execute([]);

        expect(exporter.logs).toHaveLength(0);
        expect(exporter.traces).toHaveLength(0);
    });

    it("내보내기 실패를 삼키지 않는다", async () => {
        const exporter = new RecordingExporter();
        exporter.error = new Error("connection reset");

        await expect(new ExportOtlpUseCase(exporter).execute([record()])).rejects.toThrow("connection reset");
    });
});
