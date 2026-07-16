import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {HttpRuleJobAdapter} from "~runtime/domain/rulegen/adapter/http.rule.job.adapter.js";
import type {RuleGenerationReport} from "~runtime/domain/rulegen/model/rule.job.model.js";

const BASE_URL = "http://127.0.0.1:3847";
const REPORT: RuleGenerationReport = {
    proposals: [],
    modelUsed: "claude",
    durationMs: 10,
    costUsd: 0.1,
    numTurns: 1,
    steps: [],
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("HttpRuleJobAdapter.reportResult", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("첫 시도가 성공하면 재시도 없이 true다", async () => {
        const fetchMock = vi.fn(async () => jsonResponse({}, 200));
        vi.stubGlobal("fetch", fetchMock);

        const ok = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").reportResult("job-1", REPORT);

        expect(ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("실패하면 선형 백오프로 REPORT_MAX_ATTEMPTS번까지 재시도하고 끝내 실패면 false다", async () => {
        const fetchMock = vi.fn(async () => jsonResponse({}, 500));
        vi.stubGlobal("fetch", fetchMock);
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        const promise = new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").reportResult("job-1", REPORT);
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(1000);
        const ok = await promise;

        expect(ok).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        stderrSpy.mockRestore();
    });

    it("두 번째 시도에서 성공하면 재시도를 멈추고 true다", async () => {
        let call = 0;
        const fetchMock = vi.fn(async () => {
            call += 1;
            return jsonResponse({}, call === 1 ? 500 : 200);
        });
        vi.stubGlobal("fetch", fetchMock);

        const promise = new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").reportResult("job-1", REPORT);
        await vi.advanceTimersByTimeAsync(500);
        const ok = await promise;

        expect(ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe("HttpRuleJobAdapter.hasActiveJob", () => {
    it("pending·running 상태는 활성 잡으로 본다", async () => {
        for (const status of ["pending", "running"]) {
            vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {job: {status}}})));

            const active = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").hasActiveJob("task-1");

            expect(active).toBe(true);
            vi.unstubAllGlobals();
        }
    });

    it("completed 같은 종결 상태는 활성 잡이 아니다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {job: {status: "completed"}}})));

        const active = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").hasActiveJob("task-1");

        expect(active).toBe(false);
    });

    it("잡이 없으면 활성 잡이 아니다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({data: {job: null}})));

        const active = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").hasActiveJob("task-1");

        expect(active).toBe(false);
    });
});

describe("HttpRuleJobAdapter.renewLease", () => {
    it("응답이 ok면 서버가 준 리스 상태를 그대로 쓴다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => jsonResponse({data: {leaseHeld: false, canceled: true}})),
        );

        const lease = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").renewLease("job-1");

        expect(lease).toEqual({leaseHeld: false, canceled: true});
    });

    it("응답이 실패면 리스를 쥔 채로 fail-soft한다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

        const lease = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").renewLease("job-1");

        expect(lease).toEqual({leaseHeld: true, canceled: false});
    });

    it("ok인데 data가 없으면 리스를 쥔 채로 방어한다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

        const lease = await new HttpRuleJobAdapter(BASE_URL, {}, "owner-1").renewLease("job-1");

        expect(lease).toEqual({leaseHeld: true, canceled: false});
    });
});
