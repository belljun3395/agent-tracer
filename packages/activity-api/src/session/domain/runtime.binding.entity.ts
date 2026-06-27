import { Column, Entity, PrimaryColumn } from "typeorm";
import type { RuntimeBindingSnapshot } from "../public/dto/runtime.binding.snapshot.dto.js";

@Entity({ name: "runtime_bindings_current" })
export class RuntimeBindingEntity {
    @PrimaryColumn({ name: "runtime_source", type: "text" })
    runtimeSource!: string;

    @PrimaryColumn({ name: "runtime_session_id", type: "text" })
    runtimeSessionId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "monitor_session_id", type: "text", nullable: true })
    monitorSessionId!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    /** Project this entity to the public snapshot DTO. */
    toSnapshot(): RuntimeBindingSnapshot {
        return {
            runtimeSource: this.runtimeSource.trim(),
            runtimeSessionId: this.runtimeSessionId,
            taskId: this.taskId,
            monitorSessionId: this.monitorSessionId ?? "",
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
