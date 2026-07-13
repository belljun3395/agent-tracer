import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpOtlpExporter } from "~projector/domain/export/adapter/http.otlp.exporter.js";

describe("HttpOtlpExporter", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("OTLP 수신기가 거부하면 오류를 던져 Kafka 배치를 재처리시킨다", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        const exporter = new HttpOtlpExporter("http://otel-collector:4318");

        await expect(exporter.exportLogs({})).rejects.toThrow("OTLP export rejected: /v1/logs HTTP 503");
    });

    it("OTLP 네트워크 오류를 삼키지 않는다", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection reset")));
        const exporter = new HttpOtlpExporter("http://otel-collector:4318");

        await expect(exporter.exportLogs({})).rejects.toThrow("connection reset");
    });

    it("OTLP 수신 성공 뒤에만 완료한다", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);
        const exporter = new HttpOtlpExporter("http://otel-collector:4318");

        await expect(exporter.exportLogs({ body: 1 })).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://otel-collector:4318/v1/logs",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("트레이스와 로그를 각자의 OTLP 경로로 보낸다", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);
        const exporter = new HttpOtlpExporter("http://otel-collector:4318");

        await exporter.exportTraces({});

        expect(fetchMock).toHaveBeenCalledWith(
            "http://otel-collector:4318/v1/traces",
            expect.objectContaining({ method: "POST" }),
        );
    });
});
