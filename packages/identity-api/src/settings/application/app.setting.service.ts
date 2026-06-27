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

    /**
     * Public read — sensitive values are masked. Use {@link getRawValue} for
     * server-internal callers that must read the actual key (e.g., SDK agent).
     */
    async listMasked(): Promise<readonly AppSettingItem[]> {
        const entities = await this.repo.findAll();
        return entities.map((e) => ({
            key: e.key,
            maskedValue: maskSensitiveValue(e.key, e.value),
            hasValue: true,
            updatedAt: e.updatedAt,
        }));
    }

    /**
     * Server-internal: returns the unmasked value. Never expose via REST.
     */
    async getRawValue(key: string): Promise<string | null> {
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
            throw new UnsupportedSettingKeyError(key);
        }
        const trimmed = value.trim();
        if (trimmed === "") {
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
