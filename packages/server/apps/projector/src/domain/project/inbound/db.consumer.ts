import { Inject, Injectable } from "@nestjs/common";
import type { KafkaConsumer, KafkaEachBatchPayload } from "@monitor/platform";
import { CONSUMER_GROUP, TOPIC } from "@monitor/kernel";
import { ApplyLedgerBatchUseCase } from "~projector/domain/project/application/apply.ledger.batch.usecase.js";
import { errorMessage, logError, logInfo } from "~projector/support/log.js";
import { recordSkipped } from "~projector/support/metrics.js";
import { parseLedgerRecord } from "~projector/support/ledger.record.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { DB_EVENT_CONSUMER } from "~projector/support/projector.tokens.js";

// 배치 최대 크기(100건)의 절반 주기로 하트비트를 보내 처리 중 리밸런스를 막는다.
const HEARTBEAT_EVERY_RECORDS = 25;

@Injectable()
export class DbConsumer {
    private resumeLogged = false;

    constructor(
        @Inject(DB_EVENT_CONSUMER) private readonly consumer: KafkaConsumer,
        private readonly applyLedgerBatch: ApplyLedgerBatchUseCase,
    ) {}

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [TOPIC.ingestEvents] });
        logInfo({ msg: "consumer.started", groupId: CONSUMER_GROUP.projectorDb, topic: TOPIC.ingestEvents });
        await this.consumer.run({ eachBatchAutoResolve: true, eachBatch: (payload) => this.onBatch(payload) });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect();
    }

    private async onBatch(payload: KafkaEachBatchPayload): Promise<void> {
        const { batch } = payload;
        this.logResumeOnce(batch);
        let sinceHeartbeat = 0;
        try {
            await this.applyLedgerBatch.execute(this.decode(batch), async () => {
                sinceHeartbeat += 1;
                if (sinceHeartbeat < HEARTBEAT_EVERY_RECORDS) return;
                await payload.heartbeat();
                sinceHeartbeat = 0;
            });
        } catch (error) {
            logError({
                msg: "consumer.crashed",
                groupId: CONSUMER_GROUP.projectorDb,
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
            groupId: CONSUMER_GROUP.projectorDb,
            topic: batch.topic,
            partition: batch.partition,
            seq: first?.seq ?? null,
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
