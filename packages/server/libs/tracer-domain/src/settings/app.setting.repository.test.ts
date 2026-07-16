import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { AppSettingEntity } from "./app.setting.entity.js";
import { AppSettingRepository } from "./app.setting.repository.js";
import { APP_SETTING_KEYS } from "./settings.const.js";

function setting(scope: string, key: string, value: string): AppSettingEntity {
    const entity = new AppSettingEntity();
    entity.scope = scope;
    entity.key = key;
    entity.value = value;
    entity.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    return entity;
}

describe("AppSettingRepository", () => {
    it("같은 key라도 scope가 다르면 서로 격리된 값으로 조회한다", async () => {
        const store = createInMemoryRepository<AppSettingEntity>();
        store.seed(
            setting("local", APP_SETTING_KEYS.anthropicModel, "claude-local"),
            setting("other", APP_SETTING_KEYS.anthropicModel, "claude-other"),
        );
        const repo = new AppSettingRepository(asRepository(store));

        const local = await repo.findByScopeAndKey("local", APP_SETTING_KEYS.anthropicModel);
        const other = await repo.findByScopeAndKey("other", APP_SETTING_KEYS.anthropicModel);

        expect(local?.value).toBe("claude-local");
        expect(other?.value).toBe("claude-other");
    });

    it("findAllByScope는 해당 scope의 설정만 반환한다", async () => {
        const store = createInMemoryRepository<AppSettingEntity>();
        store.seed(
            setting("local", APP_SETTING_KEYS.anthropicModel, "claude-local"),
            setting("other", APP_SETTING_KEYS.anthropicModel, "claude-other"),
        );
        const repo = new AppSettingRepository(asRepository(store));

        const items = await repo.findAllByScope("local");

        expect(items.map((item) => item.scope)).toEqual(["local"]);
    });

    it("delete는 같은 key라도 scope가 다르면 지우지 않는다", async () => {
        const store = createInMemoryRepository<AppSettingEntity>();
        store.seed(
            setting("local", APP_SETTING_KEYS.anthropicModel, "claude-local"),
            setting("other", APP_SETTING_KEYS.anthropicModel, "claude-other"),
        );
        const repo = new AppSettingRepository(asRepository(store));

        const deleted = await repo.delete("local", APP_SETTING_KEYS.anthropicModel);

        expect(deleted).toBe(true);
        expect(store.all()).toHaveLength(1);
        expect(store.all()[0]?.scope).toBe("other");
    });
});
