import { Inject, Injectable } from "@nestjs/common";
import type { DaemonHealthSnapshotDto } from "@monitor/kernel";
import {
    DAEMON_HEALTH_REPOSITORY,
    type DaemonHealthRepositoryPort,
} from "~tracer-api/domain/health/port/daemon-health.repository.port.js";
import { toDaemonHealthDto } from "~tracer-api/domain/health/model/daemon-health.model.js";

@Injectable()
export class GetDaemonHealthUseCase {
    constructor(
        @Inject(DAEMON_HEALTH_REPOSITORY)
        private readonly daemonHealth: DaemonHealthRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly snapshot: DaemonHealthSnapshotDto | null }> {
        const entity = await this.daemonHealth.findByUser(userId);
        return { snapshot: entity ? toDaemonHealthDto(entity) : null };
    }
}
