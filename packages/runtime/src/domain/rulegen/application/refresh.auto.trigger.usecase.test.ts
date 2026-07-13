import {describe, expect, it} from "vitest";
import {RefreshAutoTriggerUsecase} from "~runtime/domain/rulegen/application/refresh.auto.trigger.usecase.js";
import {AutoTriggerSettingCache} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import {InMemoryRuleSetting} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.setting.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

describe("RefreshAutoTriggerUsecase", () => {
    it("서버 설정을 캐시에 반영한다", async () => {
        const cache = new AutoTriggerSettingCache();
        const port = new InMemoryRuleSetting({enabled: true, maxRulesPerTask: 4});

        expect(await new RefreshAutoTriggerUsecase(port, cache).execute()).toEqual({
            enabled: true,
            maxRulesPerTask: 4,
        });
        expect(cache.snapshot().enabled).toBe(true);
    });

    it("설정을 읽지 못하면 직전 값을 지킨다", async () => {
        const cache = new AutoTriggerSettingCache();
        cache.replace({enabled: true, maxRulesPerTask: 3});
        const failing: RuleSettingPort = {
            fetchAutoRuleGeneration: () => Promise.reject(new Error("unreachable")),
        };

        expect(await new RefreshAutoTriggerUsecase(failing, cache).execute()).toEqual({
            enabled: true,
            maxRulesPerTask: 3,
        });
    });

    it("설정 응답이 비면 캐시를 갈아엎지 않는다", async () => {
        const cache = new AutoTriggerSettingCache();
        cache.replace({enabled: true, maxRulesPerTask: 3});

        await new RefreshAutoTriggerUsecase(new InMemoryRuleSetting(null), cache).execute();

        expect(cache.snapshot().enabled).toBe(true);
    });
});
