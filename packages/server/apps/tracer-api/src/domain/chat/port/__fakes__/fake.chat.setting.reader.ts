import { AppSettingEntity } from "@monitor/tracer-domain";
import type { ChatSettingReaderPort } from "~tracer-api/domain/chat/port/setting.reader.port.js";

/** 설정 읽기 포트의 대역이며, 생성자로 넘긴 값을 scope·key와 무관하게 그대로 되돌린다. */
export class FakeChatSettingReader implements ChatSettingReaderPort {
    calls = 0;

    constructor(private readonly setting: AppSettingEntity | null = null) {}

    findByScopeAndKey(): Promise<AppSettingEntity | null> {
        this.calls += 1;
        return Promise.resolve(this.setting);
    }
}

export function chatApiKeySetting(value: string): AppSettingEntity {
    const setting = new AppSettingEntity();
    setting.scope = "local";
    setting.key = "anthropic.api_key";
    setting.value = value;
    setting.updatedAt = new Date();
    return setting;
}
