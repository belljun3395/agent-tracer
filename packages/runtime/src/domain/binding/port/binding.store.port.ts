import type {BindingStore} from "~runtime/domain/binding/model/binding.model.js";

/** 단명 훅들이 함께 쓰는 바인딩 저장소이며 쓰기는 잠금 안에서만 한다. */
export interface BindingStorePort {
    read(): BindingStore;
    write(store: BindingStore): void;
    acquireLock(): Promise<boolean>;
    releaseLock(): void;
}
