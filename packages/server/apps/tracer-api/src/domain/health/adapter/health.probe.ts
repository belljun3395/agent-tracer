import { Inject, Injectable } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { createKafkaReadinessProbe, type KafkaClient } from "@monitor/platform";
import type { ReadinessProbe } from "~tracer-api/domain/health/port/readiness.probe.port.js";
import { TRACER_DATA_SOURCE, TRACER_KAFKA } from "~tracer-api/config/tracer.datasource.token.js";

/** 저장소와 브로커 연결을 실제 프로토콜로 점검한다. */
@Injectable()
export class HealthProbe implements ReadinessProbe {
    private readonly kafkaProbe;

    constructor(
        @Inject(TRACER_DATA_SOURCE) private readonly dataSource: DataSource,
        @Inject(TRACER_KAFKA) kafka: KafkaClient,
    ) {
        this.kafkaProbe = createKafkaReadinessProbe(kafka);
    }

    async pingDb(): Promise<void> {
        await this.dataSource.query("SELECT 1");
    }

    async pingKafka(): Promise<void> {
        await this.kafkaProbe.ping();
    }
}
