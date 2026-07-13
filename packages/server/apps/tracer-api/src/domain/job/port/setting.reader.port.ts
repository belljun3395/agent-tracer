import type { AppSettingEntity } from "@monitor/tracer-domain";

export const SETTING_READER = Symbol("SettingReader");

/** 잡 실행에 필요한 앱 설정을 읽는 애플리케이션 포트다. */
export interface SettingReaderPort {
    findAll(): Promise<AppSettingEntity[]>;
}
