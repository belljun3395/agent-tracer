import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";

/** 끝난 런타임 세션의 바인딩을 지워 같은 세션 ID가 옛 태스크로 되살아나지 않게 한다. */
export class ReleaseBindingUsecase {
    constructor(private readonly bindings: BindingStorePort) {}

    async execute(runtimeSource: string, runtimeSessionId: string): Promise<boolean> {
        const key = bindingKey(runtimeSource, runtimeSessionId);
        if (!(await this.bindings.acquireLock())) return false;
        try {
            const store = this.bindings.read();
            if (store[key] === undefined) return false;
            delete store[key];
            this.bindings.write(store);
            return true;
        } finally {
            this.bindings.releaseLock();
        }
    }
}
