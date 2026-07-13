import { DaemonHealthRepository } from "@monitor/tracer-domain";
import { CheckReadinessUseCase } from "~tracer-api/domain/health/application/query/check.readiness.usecase.js";
import { ReportDaemonHealthUseCase } from "~tracer-api/domain/health/application/command/report.daemon.health.usecase.js";
import { GetDaemonHealthUseCase } from "~tracer-api/domain/health/application/query/get.daemon.health.usecase.js";
import { HealthController } from "~tracer-api/domain/health/inbound/health.controller.js";
import { DaemonHealthController } from "~tracer-api/domain/health/inbound/daemon-health.controller.js";
import { HealthProbe } from "~tracer-api/domain/health/adapter/health.probe.js";
import { READINESS_PROBE } from "~tracer-api/domain/health/port/readiness.probe.port.js";
import { DAEMON_HEALTH_REPOSITORY } from "~tracer-api/domain/health/port/daemon-health.repository.port.js";

/** health 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const healthFeature = {
    controllers: [HealthController, DaemonHealthController],
    providers: [
        CheckReadinessUseCase,
        ReportDaemonHealthUseCase,
        GetDaemonHealthUseCase,
        HealthProbe,
        { provide: READINESS_PROBE, useExisting: HealthProbe },
        { provide: DAEMON_HEALTH_REPOSITORY, useExisting: DaemonHealthRepository },
    ],
};
