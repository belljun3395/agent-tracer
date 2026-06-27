import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "./user.entity.js";

@Injectable()
export class UserRepository {
    constructor(
        @InjectRepository(UserEntity)
        private readonly repo: Repository<UserEntity>,
    ) {}

    findById(userId: string): Promise<UserEntity | null> {
        return this.repo.findOne({ where: { userId } });
    }

    async upsert(userId: string, email: string, createdAt: string): Promise<UserEntity> {
        const existing = await this.repo.findOne({ where: { userId } });
        if (existing) {
            if (existing.email !== email) {
                // 같은 userId가 새 이메일로 온보딩되면 식별자는 유지하고 이메일만 최신화한다.
                existing.email = email;
                return this.repo.save(existing);
            }
            return existing;
        }
        const entity = this.repo.create({ userId, email, createdAt });
        return this.repo.save(entity);
    }
}
