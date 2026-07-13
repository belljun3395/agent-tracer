import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { ReadinessProbe } from "~runtime-api/domain/health/port/readiness.probe.port.js";
import { RUNTIME_DATA_SOURCE } from "~runtime-api/config/runtime.datasource.token.js";

/** 준비성 점검을 원장 DataSource의 왕복 질의로 수행한다. */
@Injectable()
export class DataSourceReadinessProbeAdapter implements ReadinessProbe {
    constructor(@Inject(RUNTIME_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async ping(): Promise<void> {
        await this.dataSource.query("SELECT 1");
    }
}
