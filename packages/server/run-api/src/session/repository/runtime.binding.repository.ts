import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";
import type { RuntimeBindingLatestForTask } from "../public/dto/runtime.binding.snapshot.dto.js";
import type { IRuntimeBindingLookup } from "../public/iservice/runtime.binding.lookup.iservice.js";

@Injectable()
export class RuntimeBindingRepository implements IRuntimeBindingLookup {
    constructor(
        @InjectRepository(RuntimeBindingEntity)
        private readonly repo: Repository<RuntimeBindingEntity>,
    ) {}

    async findActive(
        runtimeSource: string,
        runtimeSessionId: string,
    ): Promise<RuntimeBindingEntity | null> {
        return this.repo.findOne({
            where: {
                runtimeSource,
                runtimeSessionId,
                monitorSessionId: Not(IsNull()),
            },
        });
    }

    async findByKey(
        runtimeSource: string,
        runtimeSessionId: string,
    ): Promise<RuntimeBindingEntity | null> {
        return this.repo.findOne({
            where: { runtimeSource, runtimeSessionId },
        });
    }

    async findLatestByTaskId(taskId: string): Promise<RuntimeBindingLatestForTask | null> {
        const entity = await this.repo.findOne({
            where: { taskId },
            order: { updatedAt: "DESC" },
        });
        if (!entity) return null;
        return {
            runtimeSource: entity.runtimeSource,
            runtimeSessionId: entity.runtimeSessionId,
        };
    }

    async save(entity: RuntimeBindingEntity): Promise<RuntimeBindingEntity> {
        return this.repo.save(entity);
    }

    async delete(runtimeSource: string, runtimeSessionId: string): Promise<void> {
        await this.repo.delete({ runtimeSource, runtimeSessionId });
    }
}
