import { In, IsNull, type Repository } from "typeorm";
import type { TagEntity } from "./tag.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class TagRepository {
    constructor(private readonly repo: Repository<TagEntity>) {}

    async findById(id: string): Promise<TagEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // 태스크에 붙이려는 tagId들이 이 사용자의 살아 있는 태그인지 검증하는 용도다.
    async findByIds(userId: string, ids: readonly string[]): Promise<TagEntity[]> {
        if (ids.length === 0) return [];
        return this.repo.find({ where: { userId, id: In([...ids]), deletedAt: IsNull() } });
    }

    async findByName(userId: string, name: string): Promise<TagEntity | null> {
        return this.repo.findOne({ where: { userId, name, deletedAt: IsNull() } });
    }

    async listAll(userId: string): Promise<TagEntity[]> {
        return this.repo.find({ where: { userId, deletedAt: IsNull() }, order: { name: "ASC" } });
    }

    async upsert(tag: TagEntity): Promise<void> {
        await upsertByKeys(this.repo, tag, ["id"]);
    }
}
