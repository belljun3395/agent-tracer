import type { RuntimeBindingLatestForTask } from "../dto/runtime.binding.snapshot.dto.js";

export interface IRuntimeBindingLookup {
    findLatestByTaskId(taskId: string): Promise<RuntimeBindingLatestForTask | null>;
}
