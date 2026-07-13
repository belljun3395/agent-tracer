import type { Repository } from "typeorm";
import type { DaemonHealthEntity } from "./daemon.health.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class DaemonHealthRepository {
    constructor(private readonly repo: Repository<DaemonHealthEntity>) {}

    async findByUser(userId: string): Promise<DaemonHealthEntity | null> {
        return this.repo.findOne({ where: { userId } });
    }

    async upsert(entity: DaemonHealthEntity): Promise<void> {
        await upsertByKeys(this.repo, entity, ["userId"]);
    }
}
