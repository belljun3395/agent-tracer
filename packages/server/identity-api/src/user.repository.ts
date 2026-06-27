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

    /** 첫 온보딩 시에만 기록한다(이미 있으면 이메일만 최신화). 멱등. */
    async upsert(userId: string, email: string, createdAt: string): Promise<UserEntity> {
        const existing = await this.repo.findOne({ where: { userId } });
        if (existing) {
            if (existing.email !== email) {
                existing.email = email;
                return this.repo.save(existing);
            }
            return existing;
        }
        const entity = this.repo.create({ userId, email, createdAt });
        return this.repo.save(entity);
    }
}
