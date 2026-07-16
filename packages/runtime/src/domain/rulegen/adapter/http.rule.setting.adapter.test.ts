import {afterEach, describe, expect, it, vi} from "vitest";
import {HttpRuleSettingAdapter} from "~runtime/domain/rulegen/adapter/http.rule.setting.adapter.js";

const BASE_URL = "http://127.0.0.1:3847";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("HttpRuleSettingAdapter.fetchMaxRulesPerTask", () => {
    it("설정 목록에서 ruleGen.maxRulesPerTask 항목을 찾아 파싱한다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                jsonResponse({
                    data: {
                        items: [
                            {key: "anthropic.model", maskedValue: "claude-x"},
                            {key: "ruleGen.maxRulesPerTask", maskedValue: "5"},
                        ],
                    },
                }),
            ),
        );

        const maxRules = await new HttpRuleSettingAdapter(BASE_URL, {}).fetchMaxRulesPerTask();

        expect(maxRules).toBe(5);
    });

    it("항목이 없으면 기본 상한으로 떨어진다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => jsonResponse({data: {items: [{key: "anthropic.model", maskedValue: "claude-x"}]}})),
        );

        const maxRules = await new HttpRuleSettingAdapter(BASE_URL, {}).fetchMaxRulesPerTask();

        expect(maxRules).toBe(2);
    });

    it("items 자체가 없으면 null이다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {}})));

        const maxRules = await new HttpRuleSettingAdapter(BASE_URL, {}).fetchMaxRulesPerTask();

        expect(maxRules).toBeNull();
    });

    it("data 자체가 없어도 null이다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

        const maxRules = await new HttpRuleSettingAdapter(BASE_URL, {}).fetchMaxRulesPerTask();

        expect(maxRules).toBeNull();
    });

    it("응답 실패면 getJson이 null을 주므로 items도 null 취급이다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

        const maxRules = await new HttpRuleSettingAdapter(BASE_URL, {}).fetchMaxRulesPerTask();

        expect(maxRules).toBeNull();
    });
});
