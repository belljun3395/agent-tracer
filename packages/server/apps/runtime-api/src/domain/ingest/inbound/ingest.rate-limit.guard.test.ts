import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TokenBucketLimiter } from "@monitor/platform";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import type { IngestEventLog, RateLimitedLog } from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";
import { IngestRateLimitGuard } from "./ingest.rate-limit.guard.js";

function contextOf(userId: string, response: { setHeader: (name: string, value: string) => void }): ExecutionContext {
    const request = { headers: { [MONITOR_USER_HEADER]: userId } };
    return {
        getType: () => "http",
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
    } as unknown as ExecutionContext;
}

function makeGateLog(): { readonly gateLog: IngestGateLogService; readonly rateLimited: RateLimitedLog[] } {
    const rateLimited: RateLimitedLog[] = [];
    const ingestLog: IngestEventLog = {
        rejected: () => undefined,
        appended: () => undefined,
        appendFailed: () => undefined,
        allRejected: () => undefined,
        contractVersionRejected: () => undefined,
        batchRejected: () => undefined,
        rateLimited: (entry) => rateLimited.push(entry),
    };
    return { gateLog: new IngestGateLogService(ingestLog), rateLimited };
}

describe("IngestRateLimitGuard", () => {
    it("한도 안이면 통과시킨다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 2, refillPerMs: 0.001 });
        const { gateLog } = makeGateLog();
        const guard = new IngestRateLimitGuard(limiter, new Reflector(), gateLog, { capacity: 2, refillPerSec: 1 });
        const headers: string[][] = [];

        expect(guard.canActivate(contextOf("u1", { setHeader: (n, v) => headers.push([n, v]) }))).toBe(true);
        expect(headers).toHaveLength(0);
    });

    it("한도를 넘으면 429와 함께 Retry-After 헤더를 싣고 사용자와 한도를 로그로 남긴다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 60_000 });
        const { gateLog, rateLimited } = makeGateLog();
        const guard = new IngestRateLimitGuard(limiter, new Reflector(), gateLog, { capacity: 1, refillPerSec: 1 });
        const headers: string[][] = [];
        const responder = { setHeader: (n: string, v: string) => headers.push([n, v]) };
        expect(guard.canActivate(contextOf("u1", responder))).toBe(true);

        let thrown: unknown;
        try {
            guard.canActivate(contextOf("u1", responder));
        } catch (error) {
            thrown = error;
        }

        expect((thrown as { status?: number }).status).toBe(429);
        const retryAfter = headers.find(([name]) => name === "Retry-After");
        expect(Number(retryAfter?.[1])).toBeGreaterThan(0);
        expect(rateLimited).toHaveLength(1);
        expect(rateLimited[0]).toMatchObject({ userId: "u1", capacity: 1, refillPerSec: 1 });
    });

    it("사용자별로 한도를 독립적으로 추적한다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 60_000 });
        const { gateLog } = makeGateLog();
        const guard = new IngestRateLimitGuard(limiter, new Reflector(), gateLog, { capacity: 1, refillPerSec: 1 });
        const responder = { setHeader: () => undefined };

        expect(guard.canActivate(contextOf("u1", responder))).toBe(true);
        expect(guard.canActivate(contextOf("u2", responder))).toBe(true);
    });
});
