import type { AppSettingEntity } from "@monitor/tracer-domain";
import type { AppSettingRepositoryPort } from "~tracer-api/domain/settings/port/app.setting.repository.port.js";

function rowKey(scope: string, key: string): string {
    return `${scope} ${key}`;
}

/** 설정 저장소 포트의 인메모리 대역이다. */
export class InMemoryAppSettingRepository implements AppSettingRepositoryPort {
    private readonly rows = new Map<string, AppSettingEntity>();

    seed(...settings: readonly AppSettingEntity[]): void {
        for (const setting of settings) this.rows.set(rowKey(setting.scope, setting.key), setting);
    }

    all(): readonly AppSettingEntity[] {
        return [...this.rows.values()];
    }

    findAllByScope(scope: string): Promise<AppSettingEntity[]> {
        return Promise.resolve([...this.rows.values()].filter((setting) => setting.scope === scope));
    }

    upsert(setting: AppSettingEntity): Promise<void> {
        this.rows.set(rowKey(setting.scope, setting.key), setting);
        return Promise.resolve();
    }

    delete(scope: string, key: string): Promise<boolean> {
        return Promise.resolve(this.rows.delete(rowKey(scope, key)));
    }
}
