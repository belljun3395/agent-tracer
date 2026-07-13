import type { Repository } from "typeorm";
import type { FileAffinityEntity } from "./file.affinity.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class FileAffinityRepository {
    constructor(private readonly repo: Repository<FileAffinityEntity>) {}

    async findByIntent(intentLabel: string, limit: number): Promise<FileAffinityEntity[]> {
        return this.repo.find({
            where: { intentLabel },
            order: { openCount: "DESC" },
            take: limit,
        });
    }

    async upsert(summary: FileAffinityEntity): Promise<void> {
        await upsertByKeys(this.repo, summary, ["filePath", "intentLabel", "role"]);
    }
}
