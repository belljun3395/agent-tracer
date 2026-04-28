import { Injectable } from "@nestjs/common";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";
import type {
    RuntimeBindingSnapshot,
    RuntimeBindingUpsertInput,
} from "../public/dto/runtime.binding.snapshot.dto.js";
import { RuntimeBindingRepository } from "../repository/runtime.binding.repository.js";

/**
 * Service for runtime binding management.
 *
 * Used internally by session usecases. Also bound to the public
 * RUNTIME_BINDING_LOOKUP token — external consumers see only the narrow
 * IRuntimeBindingLookup interface (findLatestByTaskId), even though this
 * service has more methods.
 */
@Injectable()
export class RuntimeBindingService {
    constructor(private readonly repo: RuntimeBindingRepository) {}

    async findActive(
        runtimeSource: string,
        runtimeSessionId: string,
    ): Promise<RuntimeBindingSnapshot | null> {
        const entity = await this.repo.findActive(runtimeSource, runtimeSessionId);
        return entity ? entity.toSnapshot() : null;
    }

    async findTaskId(
        runtimeSource: string,
        runtimeSessionId: string,
    ): Promise<string | null> {
        const entity = await this.repo.findByKey(runtimeSource, runtimeSessionId);
        return entity?.taskId ?? null;
    }

    async upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBindingSnapshot> {
        const now = new Date().toISOString();
        const existing = await this.repo.findByKey(input.runtimeSource, input.runtimeSessionId);
        const entity = existing ?? new RuntimeBindingEntity();
        entity.runtimeSource = input.runtimeSource;
        entity.runtimeSessionId = input.runtimeSessionId;
        entity.taskId = input.taskId;
        entity.monitorSessionId = input.monitorSessionId;
        entity.updatedAt = now;
        if (!existing) entity.createdAt = now;
        const saved = await this.repo.save(entity);
        return saved.toSnapshot();
    }

    async clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void> {
        const entity = await this.repo.findByKey(runtimeSource, runtimeSessionId);
        if (!entity) return;
        entity.monitorSessionId = null;
        entity.updatedAt = new Date().toISOString();
        await this.repo.save(entity);
    }

    async delete(runtimeSource: string, runtimeSessionId: string): Promise<void> {
        await this.repo.delete(runtimeSource, runtimeSessionId);
    }
}
