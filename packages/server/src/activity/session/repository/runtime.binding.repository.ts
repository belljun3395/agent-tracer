import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";

@Injectable()
export class RuntimeBindingRepository {
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

    async findLatestByTaskId(
        taskId: string,
    ): Promise<RuntimeBindingEntity | null> {
        return this.repo.findOne({
            where: { taskId },
            order: { updatedAt: "DESC" },
        });
    }

    async save(entity: RuntimeBindingEntity): Promise<RuntimeBindingEntity> {
        return this.repo.save(entity);
    }

    async delete(runtimeSource: string, runtimeSessionId: string): Promise<void> {
        await this.repo.delete({ runtimeSource, runtimeSessionId });
    }
}
