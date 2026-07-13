import type {BindingStore} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";

export class InMemoryBindingStore implements BindingStorePort {
    private store: BindingStore = {};
    private lockable = true;

    constructor(initial: BindingStore = {}) {
        this.store = {...initial};
    }

    /** 잠금 경합을 재현하려고 잠금 획득을 실패시킨다. */
    jamLock(): void {
        this.lockable = false;
    }

    read(): BindingStore {
        return {...this.store};
    }

    write(store: BindingStore): void {
        this.store = {...store};
    }

    async acquireLock(): Promise<boolean> {
        return this.lockable;
    }

    releaseLock(): void {
        return;
    }
}
