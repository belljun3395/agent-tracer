import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "./rate.limiter.js";

describe("TokenBucketLimiter", () => {
    it("용량만큼은 즉시 허용한다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 3, refillPerMs: 0.001 });
        const now = 0;
        expect(limiter.consume("u1", now).allowed).toBe(true);
        expect(limiter.consume("u1", now).allowed).toBe(true);
        expect(limiter.consume("u1", now).allowed).toBe(true);
    });

    it("용량을 넘으면 거부하고 Retry-After에 쓸 대기시간을 준다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 1000 });
        const now = 0;
        expect(limiter.consume("u1", now).allowed).toBe(true);
        const rejected = limiter.consume("u1", now);
        expect(rejected.allowed).toBe(false);
        expect(rejected.retryAfterMs).toBeGreaterThan(0);
    });

    it("시간이 지나면 토큰이 다시 채워진다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 1000 });
        expect(limiter.consume("u1", 0).allowed).toBe(true);
        expect(limiter.consume("u1", 500).allowed).toBe(false);
        expect(limiter.consume("u1", 1000).allowed).toBe(true);
    });

    it("사용자별로 버킷을 독립적으로 추적한다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 1000 });
        expect(limiter.consume("u1", 0).allowed).toBe(true);
        expect(limiter.consume("u2", 0).allowed).toBe(true);
        expect(limiter.consume("u1", 0).allowed).toBe(false);
    });

    it("추적 상한을 넘으면 가장 오래된 버킷부터 지워 메모리를 무한히 늘리지 않는다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 1 / 1000, maxTrackedKeys: 2 });
        expect(limiter.consume("u1", 0).allowed).toBe(true);
        expect(limiter.consume("u2", 10).allowed).toBe(true);
        expect(limiter.consume("u3", 20).allowed).toBe(true);
        expect(limiter.consume("u1", 20).allowed).toBe(true);
    });
});
