import {RULES_ALL_PATH} from "@monitor/kernel/api/rule.query.const.js";
import {afterEach, describe, expect, it, vi} from "vitest";
import {HttpRuleSourceAdapter} from "~runtime/domain/guardrail/adapter/http.rule.source.adapter.js";

const BASE_URL = "http://127.0.0.1:3847";

afterEach(() => {
    vi.unstubAllGlobals();
});

function stubFetch(items: readonly unknown[]): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({data: {items}}), {
        status: 200,
        headers: {"content-type": "application/json"},
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("서버 규칙 조회 어댑터", () => {
    it("태스크 문맥 없이 사용자의 모든 규칙을 요구하는 경로로 부른다", async () => {
        const fetchMock = stubFetch([]);

        await new HttpRuleSourceAdapter(BASE_URL, {}).fetchAll();

        expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}${RULES_ALL_PATH}`);
    });

    it("태스크와 근거 입력이 없는 규칙은 집행할 수 없으므로 버린다", async () => {
        stubFetch([
            {id: "rule-1", name: "규칙", expectation: {kind: "action", tool: "command"}},
            {
                id: "rule-2",
                name: "규칙",
                expectation: {kind: "action", tool: "command"},
                taskId: "task-1",
                anchorEventId: "event-1",
            },
        ]);

        const rules = await new HttpRuleSourceAdapter(BASE_URL, {}).fetchAll();

        expect(rules.map((rule) => rule.id)).toEqual(["rule-2"]);
    });
});
