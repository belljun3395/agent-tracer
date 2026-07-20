import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TokenBucketLimiter, type createDataSource } from "@monitor/platform";
import { IngestController } from "~runtime-api/domain/ingest/inbound/ingest.controller.js";
import { ContractVersionPipe } from "~runtime-api/domain/ingest/inbound/contract.version.pipe.js";
import { IngestBatchValidationPipe } from "~runtime-api/domain/ingest/inbound/ingest.batch.validation.pipe.js";
import {
    INGEST_RATE_LIMIT_CONFIG,
    IngestRateLimitGuard,
    resolveIngestRateLimitConfig,
    resolveIngestRateLimiter,
} from "~runtime-api/domain/ingest/inbound/ingest.rate-limit.guard.js";
import { AppendEventsUseCase } from "~runtime-api/domain/ingest/application/append.events.usecase.js";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";
import { INGEST_EVENT_LOG } from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { LEDGER_EVENT_STORE } from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";
import { StructuredIngestEventLogAdapter } from "~runtime-api/domain/ingest/adapter/structured.ingest.event.log.adapter.js";
import { TypeOrmLedgerEventStoreAdapter } from "~runtime-api/domain/ingest/adapter/typeorm.ledger.event.store.adapter.js";
import { HealthController } from "~runtime-api/domain/health/inbound/health.controller.js";
import { CheckReadinessUseCase } from "~runtime-api/domain/health/application/check.readiness.usecase.js";
import { READINESS_PROBE } from "~runtime-api/domain/health/port/readiness.probe.port.js";
import { DataSourceReadinessProbeAdapter } from "~runtime-api/domain/health/adapter/datasource.readiness.probe.adapter.js";
import { AuthGuard } from "~runtime-api/config/auth.guard.js";
import { RUNTIME_DATA_SOURCE } from "~runtime-api/config/runtime.datasource.token.js";
import { AccessLogInterceptor } from "~runtime-api/config/access.log.interceptor.js";

type LedgerDataSource = ReturnType<typeof createDataSource>;

@Module({})
export class RuntimeApiModule {
    static forRoot(dataSource: LedgerDataSource): DynamicModule {
        return {
            module: RuntimeApiModule,
            controllers: [IngestController, HealthController],
            providers: [
                { provide: RUNTIME_DATA_SOURCE, useValue: dataSource },
                TypeOrmLedgerEventStoreAdapter,
                { provide: LEDGER_EVENT_STORE, useExisting: TypeOrmLedgerEventStoreAdapter },
                DataSourceReadinessProbeAdapter,
                { provide: READINESS_PROBE, useExisting: DataSourceReadinessProbeAdapter },
                StructuredIngestEventLogAdapter,
                { provide: INGEST_EVENT_LOG, useExisting: StructuredIngestEventLogAdapter },
                IngestGateLogService,
                ContractVersionPipe,
                IngestBatchValidationPipe,
                AppendEventsUseCase,
                CheckReadinessUseCase,
                { provide: TokenBucketLimiter, useFactory: resolveIngestRateLimiter },
                { provide: INGEST_RATE_LIMIT_CONFIG, useFactory: resolveIngestRateLimitConfig },
                // 인증이 먼저 신원을 확정해야 레이트리밋이 진짜 사용자 단위로 걸린다.
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_GUARD, useClass: IngestRateLimitGuard },
                { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
            ],
        };
    }
}
