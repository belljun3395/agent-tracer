import { Injectable } from "@nestjs/common";
import { AppSettingRepository } from "../repository/app.setting.repository.js";
import {
    APP_SETTING_KEYS,
    isSettingKeySupported,
    maskSensitiveValue,
} from "../domain/app.setting.keys.js";

export interface AppSettingItem {
    readonly key: string;
    readonly maskedValue: string;
    readonly hasValue: true;
    readonly updatedAt: string;
}

@Injectable()
export class AppSettingService {
    constructor(private readonly repo: AppSettingRepository) {}

    async listMasked(): Promise<readonly AppSettingItem[]> {
        const entities = await this.repo.findAll();
        return entities.map((e) => ({
            key: e.key,
            maskedValue: maskSensitiveValue(e.key, e.value),
            hasValue: true,
            updatedAt: e.updatedAt,
        }));
    }

    async getRawValue(key: string): Promise<string | null> {
        // 지원하지 않는 키는 저장소를 조회하지 않고 없는 설정으로 취급한다.
        if (!isSettingKeySupported(key)) return null;
        const entity = await this.repo.findByKey(key);
        return entity?.value ?? null;
    }

    async getAnthropicApiKey(): Promise<string | null> {
        return this.getRawValue(APP_SETTING_KEYS.anthropicApiKey);
    }

    async getAnthropicModel(): Promise<string | null> {
        return this.getRawValue(APP_SETTING_KEYS.anthropicModel);
    }

    async set(key: string, value: string): Promise<AppSettingItem> {
        if (!isSettingKeySupported(key)) {
            // 허용 목록 밖의 설정은 런타임 정책으로 쓰이지 않으므로 저장하지 않는다.
            throw new UnsupportedSettingKeyError(key);
        }
        const trimmed = value.trim();
        if (trimmed === "") {
            // 빈 문자열은 설정 해제와 구분되지 않으므로 값으로 저장하지 않는다.
            throw new InvalidSettingValueError(key, "value must not be empty");
        }
        const updatedAt = new Date().toISOString();
        await this.repo.upsert(key, trimmed, updatedAt);
        return {
            key,
            maskedValue: maskSensitiveValue(key, trimmed),
            hasValue: true,
            updatedAt,
        };
    }

    async delete(key: string): Promise<boolean> {
        if (!isSettingKeySupported(key)) {
            // 허용 목록 밖의 설정 삭제 요청도 잘못된 키로 처리한다.
            throw new UnsupportedSettingKeyError(key);
        }
        return this.repo.delete(key);
    }
}

export class UnsupportedSettingKeyError extends Error {
    constructor(public readonly key: string) {
        super(`Unsupported setting key: ${key}`);
        this.name = "UnsupportedSettingKeyError";
    }
}

export class InvalidSettingValueError extends Error {
    constructor(public readonly key: string, message: string) {
        super(message);
        this.name = "InvalidSettingValueError";
    }
}
