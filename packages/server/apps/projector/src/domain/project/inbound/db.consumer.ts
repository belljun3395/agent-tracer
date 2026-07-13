import { Inject, Injectable } from "@nestjs/common";
import type { KafkaConsumer, KafkaEachBatchPayload } from "@monitor/platform";
import { TOPIC } from "@monitor/kernel";
import { ApplyLedgerBatchUseCase } from "~projector/domain/project/application/apply.ledger.batch.usecase.js";
import { logError } from "~projector/support/log.js";
import { recordSkipped } from "~projector/support/metrics.js";
import { parseLedgerRecord } from "~projector/support/ledger.record.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { DB_EVENT_CONSUMER } from "~projector/support/projector.tokens.js";

// 배치 최대 크기(100건)의 절반 주기로 하트비트를 보내 처리 중 리밸런스를 막는다.
const HEARTBEAT_EVERY_RECORDS = 25;

@Injectable()
export class DbConsumer {
    constructor(
        @Inject(DB_EVENT_CONSUMER) private readonly consumer: KafkaConsumer,
        private readonly applyLedgerBatch: ApplyLedgerBatchUseCase,
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
        let sinceHeartbeat = 0;
        await this.applyLedgerBatch.execute(this.decode(batch), async () => {
            sinceHeartbeat += 1;
            if (sinceHeartbeat < HEARTBEAT_EVERY_RECORDS) return;
            await payload.heartbeat();
            sinceHeartbeat = 0;
        });
    }

    private *decode(batch: KafkaEachBatchPayload["batch"]): Iterable<LedgerRecord> {
        for (const message of batch.messages) {
            const record = parseLedgerRecord(message.value);
            if (record !== null) {
                yield record;
                continue;
            }
            logError({
                msg: "ledger.parse.skip",
                topic: batch.topic,
                partition: batch.partition,
                offset: message.offset,
            });
            recordSkipped("db");
        }
    }
}
