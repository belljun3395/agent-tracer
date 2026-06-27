import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    FileAffinityEntity,
    type FileAffinityRole,
} from "../domain/file.affinity.entity.js";

@Injectable()
export class FileAffinityRepository {
    constructor(
        @InjectRepository(FileAffinityEntity)
        private readonly repo: Repository<FileAffinityEntity>,
    ) {}

    async upsertIncrement(input: {
        filePath: string;
        intentLabel: string;
        role: FileAffinityRole;
        lastSeenAt: string;
    }): Promise<void> {
        const existing = await this.repo.findOne({
            where: {
                filePath: input.filePath,
                intentLabel: input.intentLabel,
                role: input.role,
            },
        });
        if (existing) {
            await this.repo.update(
                {
                    filePath: input.filePath,
                    intentLabel: input.intentLabel,
                    role: input.role,
                },
                {
                    openCount: existing.openCount + 1,
                    lastSeenAt: input.lastSeenAt,
                },
            );
            return;
        }
        await this.repo.save(
            this.repo.create({
                filePath: input.filePath,
                intentLabel: input.intentLabel,
                role: input.role,
                openCount: 1,
                lastSeenAt: input.lastSeenAt,
            }),
        );
    }

    async listByIntent(
        intentLabel: string,
        limit: number,
    ): Promise<readonly FileAffinityEntity[]> {
        return this.repo
            .createQueryBuilder("f")
            .where("f.intentLabel = :intent", { intent: intentLabel })
            .orderBy("f.openCount", "DESC")
            .limit(limit)
            .getMany();
    }

    async listIntentsForFile(
        filePath: string,
    ): Promise<readonly FileAffinityEntity[]> {
        return this.repo
            .createQueryBuilder("f")
            .where("f.filePath = :p", { p: filePath })
            .orderBy("f.openCount", "DESC")
            .getMany();
    }
}
