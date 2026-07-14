import {describe, expect, it} from "vitest";
import {RefreshRuleSettingUsecase} from "~runtime/domain/rulegen/application/refresh.rule.setting.usecase.js";
import {RULE_GENERATION_MAX_RULES, RuleGenerationSettingCache} from "~runtime/domain/rulegen/model/rule.command.model.js";
import {InMemoryRuleSetting} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.setting.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

describe("RefreshRuleSettingUsecase", () => {
    it("서버 설정의 규칙 상한을 캐시에 반영한다", async () => {
        const cache = new RuleGenerationSettingCache();

        expect(await new RefreshRuleSettingUsecase(new InMemoryRuleSetting(4), cache).execute()).toBe(4);
        expect(cache.snapshot()).toBe(4);
    });

    it("설정을 읽지 못하면 직전 값을 지킨다", async () => {
        const cache = new RuleGenerationSettingCache();
        cache.replace(3);
        const failing: RuleSettingPort = {
            fetchMaxRulesPerTask: () => Promise.reject(new Error("unreachable")),
        };

        expect(await new RefreshRuleSettingUsecase(failing, cache).execute()).toBe(3);
    });

    it("설정 응답이 비면 캐시를 갈아엎지 않는다", async () => {
        const cache = new RuleGenerationSettingCache();
        cache.replace(3);

        await new RefreshRuleSettingUsecase(new InMemoryRuleSetting(null), cache).execute();

        expect(cache.snapshot()).toBe(3);
    });

    it("아무것도 못 읽었으면 기본 상한을 쓴다", () => {
        expect(new RuleGenerationSettingCache().snapshot()).toBe(RULE_GENERATION_MAX_RULES);
    });
});
