import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSettingEntity } from "../domain/app.setting.entity.js";
import { decryptSettingValue, encryptSettingValue } from "../domain/app.setting.cipher.js";
import { SENSITIVE_SETTING_KEYS } from "../domain/app.setting.keys.js";

@Injectable()
export class AppSettingRepository {
    constructor(
        @InjectRepository(AppSettingEntity)
        private readonly repo: Repository<AppSettingEntity>,
    ) {}

    async findAll(): Promise<readonly AppSettingEntity[]> {
        const entities = await this.repo.find();
        return entities.map((e) => this.decrypted(e));
    }

    async findByKey(key: string): Promise<AppSettingEntity | null> {
        const entity = await this.repo.findOne({ where: { key } });
        return entity ? this.decrypted(entity) : null;
    }

    async upsert(key: string, value: string, updatedAt: string): Promise<void> {
        const storedValue = SENSITIVE_SETTING_KEYS.has(key) ? encryptSettingValue(value) : value;
        const existing = await this.repo.findOne({ where: { key } });
        if (existing) {
            existing.value = storedValue;
            existing.updatedAt = updatedAt;
            await this.repo.save(existing);
            return;
        }
        const created = this.repo.create({ key, value: storedValue, updatedAt });
        await this.repo.save(created);
    }

    async delete(key: string): Promise<boolean> {
        const result = await this.repo.delete({ key });
        return (result.affected ?? 0) > 0;
    }

    private decrypted(entity: AppSettingEntity): AppSettingEntity {
        if (SENSITIVE_SETTING_KEYS.has(entity.key)) {
            entity.value = decryptSettingValue(entity.value);
        }
        return entity;
    }
}
