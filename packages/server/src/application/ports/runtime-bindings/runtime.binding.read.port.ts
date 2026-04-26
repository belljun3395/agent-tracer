import type { RuntimeBindingRecordPortDto } from "./dto/runtime.binding.record.port.dto.js";

export interface RuntimeBindingReadPort {
    find(runtimeSource: string, runtimeSessionId: string): Promise<RuntimeBindingRecordPortDto | null>;
    findTaskId(runtimeSource: string, runtimeSessionId: string): Promise<string | null>;
    findLatestByTaskId(taskId: string): Promise<{
        runtimeSource: string;
        runtimeSessionId: string;
    } | null>;
}
