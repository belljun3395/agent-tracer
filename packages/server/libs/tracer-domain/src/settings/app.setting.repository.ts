import type { Repository } from "typeorm";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@monitor/platform";
import { AppSettingEntity } from "./app.setting.entity.js";
import { isSensitiveSettingKey } from "./settings.const.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class AppSettingRepository {
    constructor(private readonly repo: Repository<AppSettingEntity>) {}

    async findAllByScope(scope: string): Promise<AppSettingEntity[]> {
        const entities = await this.repo.find({ where: { scope } });
        return entities.map((entity) => this.decrypted(entity));
    }

    async findByScopeAndKey(scope: string, key: string): Promise<AppSettingEntity | null> {
        const entity = await this.repo.findOne({ where: { scope, key } });
        return entity ? this.decrypted(entity) : null;
    }

    async upsert(setting: AppSettingEntity): Promise<void> {
        const stored = new AppSettingEntity();
        stored.scope = setting.scope;
        stored.key = setting.key;
        stored.value = isSensitiveSettingKey(setting.key) ? encryptSecret(setting.value) : setting.value;
        stored.updatedAt = setting.updatedAt;
        await upsertByKeys(this.repo, stored, ["scope", "key"]);
    }

    async delete(scope: string, key: string): Promise<boolean> {
        const result = await this.repo.delete({ scope, key });
        return (result.affected ?? 0) > 0;
    }

    private decrypted(entity: AppSettingEntity): AppSettingEntity {
        if (isSensitiveSettingKey(entity.key) && isEncryptedSecret(entity.value)) {
            entity.value = decryptSecret(entity.value);
        }
        return entity;
    }
}
