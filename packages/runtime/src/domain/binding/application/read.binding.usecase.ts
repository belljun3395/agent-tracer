import {resolveLiveBinding, toBoundSession, type BoundSession} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";

export type {BoundSession};

/** 이미 관측된 런타임 세션의 바인딩을 조회한다. */
export class ReadBindingUsecase {
    constructor(private readonly bindings: BindingStorePort) {}

    execute(runtimeSource: string, runtimeSessionId: string): BoundSession | undefined {
        const binding = resolveLiveBinding(this.bindings.read(), runtimeSource, runtimeSessionId);
        return binding ? toBoundSession(binding) : undefined;
    }
}
