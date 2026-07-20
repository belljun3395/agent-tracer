import { metrics } from "@opentelemetry/api";

// OTEL_EXPORTER_OTLP_ENDPOINT가 없으면 전역 메터 프로바이더가 no-op이라 계측 호출에 비용이 없다.
const meter = metrics.getMeter("projector");

const processedCounter = meter.createCounter("pipeline_records_processed_total", {
    description: "Ledger records the projector consumed, by consumer group and outcome.",
});

const applyLatency = meter.createHistogram("pipeline_apply_latency_seconds", {
    description: "Wall-clock time from runtime-api ledger insert (received_at) to projector apply commit.",
    unit: "s",
    // CDC + Kafka 배치를 거치는 실측 지연은 수백 ms~수 초대라 기본(ms 스케일) 버킷은 해상도가 없다.
    advice: { explicitBucketBoundaries: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60] },
});

const appliedSeqGauge = meter.createGauge("pipeline_applied_seq", {
    description: "Last ledger seq committed by this consumer group — compare against runtime_ledger_max_seq for gap detection.",
});

export type PipelineConsumer = "db" | "search" | "otlp";

export interface AppliedRecord {
    readonly seq: string;
    readonly receivedAt: Date;
}

export function recordApplied(consumer: PipelineConsumer, record: AppliedRecord): void {
    processedCounter.add(1, { consumer, outcome: "applied" });
    applyLatency.record((Date.now() - record.receivedAt.getTime()) / 1000, { consumer });
    const seq = Number(record.seq);
    if (Number.isFinite(seq)) appliedSeqGauge.record(seq, { consumer });
}

export function recordSkipped(consumer: PipelineConsumer): void {
    processedCounter.add(1, { consumer, outcome: "skipped_unparseable" });
}
