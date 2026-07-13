import { Inject, Injectable } from "@nestjs/common";
import type { KafkaConsumer, KafkaEachBatchPayload } from "@monitor/platform";
import { TOPIC } from "@monitor/kernel";
import { ExportOtlpUseCase } from "~projector/domain/export/application/export.otlp.usecase.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { logError } from "~projector/support/log.js";
import { recordApplied, recordSkipped } from "~projector/support/metrics.js";
import { parseLedgerRecord } from "~projector/support/ledger.record.js";
import { OTLP_EVENT_CONSUMER } from "~projector/support/projector.tokens.js";

@Injectable()
export class OtlpConsumer {
    constructor(
        @Inject(OTLP_EVENT_CONSUMER) private readonly consumer: KafkaConsumer,
        private readonly exporter: ExportOtlpUseCase,
    ) {}

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [TOPIC.ingestEvents] });
        await this.consumer.run({ eachBatchAutoResolve: true, eachBatch: (payload) => this.onBatch(payload) });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect();
    }

    private async onBatch(payload: KafkaEachBatchPayload): Promise<void> {
        const { batch } = payload;
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
    }
}
