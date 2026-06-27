import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSettingEntity } from "../domain/app.setting.entity.js";

@Injectable()
export class AppSettingRepository {
    constructor(
        @InjectRepository(AppSettingEntity)
        private readonly repo: Repository<AppSettingEntity>,
    ) {}

    async findAll(): Promise<readonly AppSettingEntity[]> {
        return this.repo.find();
    }

    async findByKey(key: string): Promise<AppSettingEntity | null> {
        return this.repo.findOne({ where: { key } });
    }

    async upsert(key: string, value: string, updatedAt: string): Promise<void> {
        const existing = await this.repo.findOne({ where: { key } });
        if (existing) {
            existing.value = value;
            existing.updatedAt = updatedAt;
            await this.repo.save(existing);
            return;
        }
        const created = this.repo.create({ key, value, updatedAt });
        await this.repo.save(created);
    }

    async delete(key: string): Promise<boolean> {
        const result = await this.repo.delete({ key });
        return (result.affected ?? 0) > 0;
    }
}
