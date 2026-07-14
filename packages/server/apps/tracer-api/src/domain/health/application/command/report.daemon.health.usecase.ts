import { Inject, Injectable } from "@nestjs/common";
import { DaemonHealthEntity } from "@monitor/tracer-domain";
import type { DaemonHealthReportPayload, DaemonHealthSnapshotDto } from "@monitor/kernel";
import {
    DAEMON_HEALTH_REPOSITORY,
    type DaemonHealthRepositoryPort,
} from "~tracer-api/domain/health/port/daemon-health.repository.port.js";
import { CLOCK, type ClockPort } from "~tracer-api/domain/health/port/clock.port.js";
import { toDaemonHealthDto } from "~tracer-api/domain/health/model/daemon-health.model.js";

@Injectable()
export class ReportDaemonHealthUseCase {
    constructor(
        @Inject(DAEMON_HEALTH_REPOSITORY)
        private readonly daemonHealth: DaemonHealthRepositoryPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, report: DaemonHealthReportPayload): Promise<{ readonly snapshot: DaemonHealthSnapshotDto }> {
        const entity = DaemonHealthEntity.fromReport(userId, report, this.clock.now());
        await this.daemonHealth.upsert(entity);
        return { snapshot: toDaemonHealthDto(entity) };
    }
}
