import type { AppSettingEntity } from "@monitor/tracer-domain";

export const APP_SETTING_REPOSITORY = Symbol("AppSettingRepository");

/** 민감 값의 암복호화까지 구현이 책임지는, scope별 애플리케이션 설정의 조회·저장·삭제 포트다. */
export interface AppSettingRepositoryPort {
    findAllByScope(scope: string): Promise<AppSettingEntity[]>;
    upsert(setting: AppSettingEntity): Promise<void>;
    delete(scope: string, key: string): Promise<boolean>;
}
