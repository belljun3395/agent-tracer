import { AppSettingEntity } from "@monitor/tracer-domain";
import type { SettingReaderPort } from "~tracer-api/domain/job/port/setting.reader.port.js";

const SEEDED_AT = new Date("2026-01-01T00:00:00.000Z");

/** 설정 포트의 인메모리 대역이다. */
export class InMemorySettingReader implements SettingReaderPort {
    private readonly rows = new Map<string, string>();

    constructor(values: ReadonlyMap<string, string> = new Map()) {
        for (const [key, value] of values) this.rows.set(key, value);
    }

    seed(key: string, value: string): void {
        this.rows.set(key, value);
    }

    findAllByScope(_scope: string): Promise<AppSettingEntity[]> {
        return Promise.resolve([...this.rows].map(([key, value]) => {
            const setting = new AppSettingEntity();
            setting.key = key;
            setting.value = value;
            setting.updatedAt = SEEDED_AT;
            return setting;
        }));
    }
}
