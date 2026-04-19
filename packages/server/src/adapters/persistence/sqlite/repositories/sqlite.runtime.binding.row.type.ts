import type { RuntimeBinding } from "~application/ports/repository/runtime.binding.repository.js";

export interface RuntimeSessionBindingRow {
    runtimeSource: string;
    runtimeSessionId: string;
    taskId: string;
    monitorSessionId: string | null;
    createdAt: string;
    updatedAt: string;
}

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
