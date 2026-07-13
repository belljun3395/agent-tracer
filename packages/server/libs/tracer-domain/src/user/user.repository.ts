import type { Repository } from "typeorm";
import type { UserEntity } from "./user.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class UserRepository {
    constructor(private readonly repo: Repository<UserEntity>) {}

    async findById(userId: string): Promise<UserEntity | null> {
        return this.repo.findOne({ where: { userId } });
    }

    async upsert(user: UserEntity): Promise<void> {
        await upsertByKeys(this.repo, user, ["userId"]);
    }
}
