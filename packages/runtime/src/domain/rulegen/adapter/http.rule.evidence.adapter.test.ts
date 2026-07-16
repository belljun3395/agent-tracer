import {afterEach, describe, expect, it, vi} from "vitest";
import {HttpRuleEvidenceAdapter} from "~runtime/domain/rulegen/adapter/http.rule.evidence.adapter.js";
import {RuleEvidenceHttpError} from "~runtime/domain/rulegen/port/rule.evidence.port.js";

const BASE_URL = "http://127.0.0.1:3847";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("HttpRuleEvidenceAdapter.fetchEvents", () => {
    it("nextCursor를 따라 다음 페이지를 이어 부르고 커서가 끊기면 멈춘다", async () => {
        const fetchMock = vi.fn(async (url: string) => {
            if (!url.includes("cursor=")) {
                return jsonResponse({data: {items: [{id: "e1", kind: "tool_call"}], nextCursor: "cursor-2"}});
            }
            return jsonResponse({data: {items: [{id: "e2", kind: "tool_call"}], nextCursor: null}});
        });
        vi.stubGlobal("fetch", fetchMock);

        const events = await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 10);

        expect(events.map((event) => event.eventId)).toEqual(["e1", "e2"]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=cursor-2");
    });

    it("limit으로 최근 N개만 남긴다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                jsonResponse({
                    data: {
                        items: [
                            {id: "e1", kind: "k"},
                            {id: "e2", kind: "k"},
                            {id: "e3", kind: "k"},
                        ],
                        nextCursor: null,
                    },
                }),
            ),
        );

        const events = await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 2);

        expect(events.map((event) => event.eventId)).toEqual(["e2", "e3"]);
    });

    it("페이지 상한에 닿으면 커서가 계속 있어도 멈춘다", async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse({data: {items: [{id: "e", kind: "k"}], nextCursor: "always-more"}}),
        );
        vi.stubGlobal("fetch", fetchMock);

        await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 1000);

        expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it("data가 없는 응답은 빈 목록으로 방어한다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

        const events = await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 10);

        expect(events).toEqual([]);
    });

    it("호출자가 signal을 안 주면 기본 타임아웃으로 AbortSignal.timeout을 쓴다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {items: [], nextCursor: null}})));
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

        await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 10);

        expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    });

    it("호출자가 signal을 주면 그 signal을 그대로 쓰고 기본 타임아웃을 만들지 않는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {items: [], nextCursor: null}})));
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
        const controller = new AbortController();

        await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 10, controller.signal);

        expect(timeoutSpy).not.toHaveBeenCalled();
    });

    it("응답이 실패면 자원 이름을 담아 던진다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

        await expect(new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchEvents("task-1", 10)).rejects.toThrow(
            RuleEvidenceHttpError,
        );
    });
});

describe("HttpRuleEvidenceAdapter.fetchTurns / fetchExistingRules", () => {
    it("fetchTurns는 items를 턴 근거로 옮긴다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                jsonResponse({data: {items: [{id: "turn-1", askedText: "요구했다", turnIndex: 1}]}}),
            ),
        );

        const turns = await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchTurns("task-1");

        expect(turns).toEqual([
            {turnId: "turn-1", turnIndex: 1, askedText: "요구했다", assistantSummary: ""},
        ]);
    });

    it("fetchExistingRules는 items가 없으면 빈 목록이다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

        const rules = await new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchExistingRules();

        expect(rules).toEqual([]);
    });

    it("응답 실패는 existing rule 자원 이름으로 던진다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 404)));

        await expect(new HttpRuleEvidenceAdapter(BASE_URL, {}).fetchExistingRules()).rejects.toThrow(
            RuleEvidenceHttpError,
        );
    });
});
