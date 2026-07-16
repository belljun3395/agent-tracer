import {
    mostRecentActiveBinding,
    toBoundSession,
    type BoundSession,
} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";

/** MCP 도구처럼 자기 런타임 세션을 모르는 호출자를 위해 가장 최근 활성 바인딩을 태스크로 추정한다. */
export class FindActiveBindingUsecase {
    constructor(private readonly bindings: BindingStorePort) {}

    execute(): BoundSession | undefined {
        const binding = mostRecentActiveBinding(this.bindings.read());
        return binding ? toBoundSession(binding) : undefined;
    }
}
