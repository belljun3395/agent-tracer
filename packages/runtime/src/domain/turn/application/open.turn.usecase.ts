import {bindingKey, turnStateOf} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import type {ClockPort} from "~runtime/domain/turn/port/clock.port.js";
import {capTurnMessage} from "~runtime/domain/turn/model/turn.span.model.js";

/** 사용자 발화가 새 턴을 여는 데 필요한 입력이다. */
export interface OpenTurnInput {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly turnId: string;
    readonly prompt: string;
}

/** 사용자 발화로 새 턴을 열고 직전 턴 ID를 이어 붙인다. */
export class OpenTurnUsecase {
    constructor(
        private readonly bindings: BindingStorePort,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: OpenTurnInput): Promise<void> {
        if (!(await this.bindings.acquireLock())) return;
        try {
            const store = this.bindings.read();
            const key = bindingKey(input.runtimeSource, input.runtimeSessionId);
            const existing = store[key];
            if (!existing) return;
            const previous = turnStateOf(existing);
            store[key] = {
                ...existing,
                currentTurnId: input.turnId,
                turnStartedAt: new Date(this.clock.now()).toISOString(),
                turnPrompt: capTurnMessage(input.prompt),
                ...(previous ? {previousTurnId: previous.turnId} : {}),
            };
            this.bindings.write(store);
        } finally {
            this.bindings.releaseLock();
        }
    }
}
