import {AGENT_TRACER_ATTR, GEN_AI_PROVIDER, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import type {RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import {toIngestEvent, type IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {withTags} from "~runtime/domain/ingest/model/tags.model.js";

/** 모든 이벤트에 붙는 런타임 출처 속성이다. */
export function runtimeAttributes(runtimeSource: string): Record<string, unknown> {
    return {
        [AGENT_TRACER_ATTR.runtimeSource]: runtimeSource,
        [SEMCONV_ATTR.providerName]: GEN_AI_PROVIDER.anthropic,
    };
}

/** 런타임 이벤트에 태그와 출처 속성을 붙여 원장 봉투로 감싼다. */
export function toIngestEvents(
    events: readonly RuntimeIngestEvent[],
    runtimeSource: string,
    occurredAt: string = new Date().toISOString(),
): IngestEvent[] {
    const attributes = runtimeAttributes(runtimeSource);
    return events.map((event) => toIngestEvent(
        {...event, metadata: {...withTags(event.metadata), ...attributes}},
        occurredAt,
    ));
}
