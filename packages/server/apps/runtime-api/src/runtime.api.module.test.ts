import { describe, expect, it } from "vitest";
import { INGEST_EVENT_LOG } from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { LEDGER_EVENT_STORE } from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";
import { StructuredIngestEventLogAdapter } from "~runtime-api/domain/ingest/adapter/structured.ingest.event.log.adapter.js";
import { TypeOrmLedgerEventStoreAdapter } from "~runtime-api/domain/ingest/adapter/typeorm.ledger.event.store.adapter.js";
import { READINESS_PROBE } from "~runtime-api/domain/health/port/readiness.probe.port.js";
import { DataSourceReadinessProbeAdapter } from "~runtime-api/domain/health/adapter/datasource.readiness.probe.adapter.js";
import { RuntimeApiModule } from "./runtime.api.module.js";

describe("RuntimeApiModule", () => {
    it("각 슬라이스의 포트를 자기 어댑터에 연결한다", () => {
        const module = RuntimeApiModule.forRoot(undefined as never);

        expect(module.providers).toEqual(expect.arrayContaining([
            { provide: LEDGER_EVENT_STORE, useExisting: TypeOrmLedgerEventStoreAdapter },
            { provide: INGEST_EVENT_LOG, useExisting: StructuredIngestEventLogAdapter },
            { provide: READINESS_PROBE, useExisting: DataSourceReadinessProbeAdapter },
        ]));
    });
});
