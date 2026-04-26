import type { RuntimeBindingRecordPortDto } from "./dto/runtime.binding.record.port.dto.js";
import type { RuntimeBindingUpsertPortDto } from "./dto/runtime.binding.upsert.port.dto.js";

export interface RuntimeBindingWritePort {
    upsert(input: RuntimeBindingUpsertPortDto): Promise<RuntimeBindingRecordPortDto>;
    clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void>;
    delete(runtimeSource: string, runtimeSessionId: string): Promise<void>;
}
