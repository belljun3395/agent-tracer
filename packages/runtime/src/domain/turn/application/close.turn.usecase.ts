import {bindingKey, turnStateOf} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import type {ClockPort} from "~runtime/domain/turn/port/clock.port.js";
import {buildTurnSpan, type TurnSpanInput} from "~runtime/domain/turn/model/turn.span.model.js";

/** 진행 중인 턴을 닫는 데 필요한 입력이다. */
export interface CloseTurnInput extends TurnSpanInput {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
}

/** 턴을 감싸는 span 이벤트를 원장에 남기고 그 턴 ID를 돌려준다. */
export class CloseTurnUsecase {
    constructor(
        private readonly bindings: BindingStorePort,
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
        private readonly runtimeSource: string,
    ) {}

    async execute(input: CloseTurnInput): Promise<string> {
        const binding = this.bindings.read()[bindingKey(input.runtimeSource, input.runtimeSessionId)];
        const now = this.clock.now();
        const span = buildTurnSpan(turnStateOf(binding), {
            ...input,
            ...(binding ? {sessionStartedAt: binding.createdAt} : {}),
        }, now);
        await this.sink.append(toIngestEvents(
            [span.event],
            this.runtimeSource,
            () => this.ids.next(),
            new Date(now).toISOString(),
        ));
        return span.turnId;
    }
}
