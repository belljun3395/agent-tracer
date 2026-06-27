import type { RuntimeBindingLatestForTask } from "../dto/runtime.binding.snapshot.dto.js";

/**
 * Public iservice for read-only runtime binding lookups consumed by other modules.
 */
export interface IRuntimeBindingLookup {
    findLatestByTaskId(taskId: string): Promise<RuntimeBindingLatestForTask | null>;
}
