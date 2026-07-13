import { isSensitiveSettingKey } from "@monitor/tracer-domain";
import type { SettingDto } from "@monitor/kernel";

export type { SettingDto };

const MASK_DOT_COUNT = 8;

/** 민감 키의 값만 끝 4자를 남기고 가리며 그 밖의 키는 원문을 그대로 노출한다. */
export function maskValue(key: string, value: string): string {
    if (!isSensitiveSettingKey(key)) return value;
    if (value.length <= 4) return "•".repeat(value.length);
    return "•".repeat(MASK_DOT_COUNT) + value.slice(-4);
}
