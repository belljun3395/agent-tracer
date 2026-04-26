import type { InferSelectModel } from "drizzle-orm";
import type { RuntimeBinding } from "~application/ports/repository/runtime.binding.repository.js";
import type { runtimeSessionBindings } from "../schema/drizzle.schema.js";

export type RuntimeSessionBindingRow = InferSelectModel<typeof runtimeSessionBindings>;

export function mapRuntimeBindingRow(row: RuntimeSessionBindingRow): RuntimeBinding {
    return {
        runtimeSource: row.runtimeSource.trim(),
        runtimeSessionId: row.runtimeSessionId,
        taskId: row.taskId,
        monitorSessionId: row.monitorSessionId!,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
