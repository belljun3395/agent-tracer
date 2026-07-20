import { Inject, Injectable } from "@nestjs/common";
import type { KafkaConsumer, KafkaEachBatchPayload } from "@monitor/platform";
import { CONSUMER_GROUP, TOPIC } from "@monitor/kernel";
import { ExportOtlpUseCase } from "~projector/domain/export/application/export.otlp.usecase.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { errorMessage, logError, logInfo } from "~projector/support/log.js";
import { recordApplied, recordSkipped } from "~projector/support/metrics.js";
import { parseLedgerRecord } from "~projector/support/ledger.record.js";
import { OTLP_EVENT_CONSUMER } from "~projector/support/projector.tokens.js";

@Injectable()
export class OtlpConsumer {
    private resumeLogged = false;

    constructor(
        @Inject(OTLP_EVENT_CONSUMER) private readonly consumer: KafkaConsumer,
        private readonly exporter: ExportOtlpUseCase,
    ) {}

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [TOPIC.ingestEvents] });
        logInfo({ msg: "consumer.started", groupId: CONSUMER_GROUP.projectorOtlp, topic: TOPIC.ingestEvents });
        await this.consumer.run({ eachBatchAutoResolve: true, eachBatch: (payload) => this.onBatch(payload) });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect();
    }

    private async onBatch(payload: KafkaEachBatchPayload): Promise<void> {
        const { batch } = payload;
        this.logResumeOnce(batch);
        try {
            const records: LedgerRecord[] = [];
            for (const message of batch.messages) {
                const record = parseLedgerRecord(message.value);
                if (record === null) {
                    logError({ msg: "ledger.parse.skip", topic: batch.topic, partition: batch.partition, offset: message.offset });
                    recordSkipped("otlp");
                    continue;
                }
                records.push(record);
            }
            if (records.length === 0) return;
            await this.exporter.execute(records);
            for (const record of records) recordApplied("otlp", record);
        } catch (error) {
            logError({
                msg: "consumer.crashed",
                groupId: CONSUMER_GROUP.projectorOtlp,
                topic: batch.topic,
                partition: batch.partition,
                error: errorMessage(error),
            });
            throw error;
        }
    }

    // 재기동 뒤 첫 배치의 시작 seq를 한 번만 남겨 마지막 적용 지점에서 이어 소비했는지 확인시킨다.
    private logResumeOnce(batch: KafkaEachBatchPayload["batch"]): void {
        if (this.resumeLogged || batch.messages.length === 0) return;
        this.resumeLogged = true;
        const first = parseLedgerRecord(batch.messages[0]?.value ?? null);
        logInfo({
            msg: "consumer.resumed",
            groupId: CONSUMER_GROUP.projectorOtlp,
            topic: batch.topic,
            partition: batch.partition,
            seq: first?.seq ?? null,
        });
    }
}
