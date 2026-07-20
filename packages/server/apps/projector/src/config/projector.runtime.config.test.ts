import { describe, expect, it } from "vitest";
import { loadProjectorRuntimeConfig } from "./projector.runtime.config.js";

describe("loadProjectorRuntimeConfig", () => {
    it("환경값이 없으면 projector 운영 기본값을 사용한다", () => {
        expect(loadProjectorRuntimeConfig({})).toEqual({
            taskReaper: { intervalMs: 60_000, idleMs: 180_000 },
            aiJobStepReaper: { intervalMs: 3_600_000, retentionMs: 30 * 24 * 3_600_000 },
            searchEventsReaper: { intervalMs: 6 * 3_600_000, retentionMs: 90 * 24 * 3_600_000 },
            searchOutboxDrainIntervalMs: 5_000,
            jobLeaseReapIntervalMs: 30_000,
            recipeRetireReaperIntervalMs: 3_600_000,
            eventsOtlp: undefined,
        });
    });

    it("양의 정수 환경값으로 운영 주기를 덮어쓴다", () => {
        expect(loadProjectorRuntimeConfig({
            PROJECTOR_REAP_INTERVAL_MS: "1",
            PROJECTOR_REAP_IDLE_MS: "2",
            PROJECTOR_AI_JOB_STEP_REAP_INTERVAL_MS: "3",
            PROJECTOR_AI_JOB_STEP_RETENTION_MS: "4",
            PROJECTOR_SEARCH_EVENTS_REAP_INTERVAL_MS: "5",
            PROJECTOR_SEARCH_EVENTS_RETENTION_MS: "6",
            PROJECTOR_SEARCH_OUTBOX_DRAIN_INTERVAL_MS: "7",
            PROJECTOR_JOB_LEASE_REAP_INTERVAL_MS: "8",
            PROJECTOR_RECIPE_RETIRE_REAP_INTERVAL_MS: "9",
        })).toMatchObject({
            taskReaper: { intervalMs: 1, idleMs: 2 },
            aiJobStepReaper: { intervalMs: 3, retentionMs: 4 },
            searchEventsReaper: { intervalMs: 5, retentionMs: 6 },
            searchOutboxDrainIntervalMs: 7,
            jobLeaseReapIntervalMs: 8,
            recipeRetireReaperIntervalMs: 9,
        });
    });

    it("유효하지 않은 운영 주기는 기본값으로 닫는다", () => {
        const config = loadProjectorRuntimeConfig({
            PROJECTOR_REAP_INTERVAL_MS: "0",
            PROJECTOR_REAP_IDLE_MS: "-1",
            PROJECTOR_AI_JOB_STEP_REAP_INTERVAL_MS: "not-a-number",
        });

        expect(config.taskReaper).toEqual({ intervalMs: 60_000, idleMs: 180_000 });
        expect(config.aiJobStepReaper.intervalMs).toBe(3_600_000);
    });

    it("이벤트 OTLP 대상만 공백과 마지막 슬래시를 정규화한다", () => {
        expect(loadProjectorRuntimeConfig({
            EVENTS_OTLP_ENDPOINT: " https://collector.example/v1/events/ ",
            OTEL_EXPORTER_OTLP_ENDPOINT: "https://telemetry.example",
        }).eventsOtlp).toEqual({ endpoint: "https://collector.example/v1/events" });
        expect(loadProjectorRuntimeConfig({ EVENTS_OTLP_ENDPOINT: "   " }).eventsOtlp).toBeUndefined();
    });
});
