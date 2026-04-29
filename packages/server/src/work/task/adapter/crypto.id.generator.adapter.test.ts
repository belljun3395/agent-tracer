import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { CryptoIdGeneratorAdapter } from "./crypto.id.generator.adapter.js";
import type { IClock } from "../application/outbound/clock.port.js";

const FROZEN_MS = 1_777_000_000_000; // 2026-04-29 around

function makeClock(): IClock & { nowMs: Mock; nowIso: Mock } {
    return {
        nowMs: vi.fn(() => FROZEN_MS),
        nowIso: vi.fn(() => new Date(FROZEN_MS).toISOString()),
    };
}

describe("CryptoIdGeneratorAdapter.newUuid", () => {
    it("returns a syntactically valid UUID v4", () => {
        const adapter = new CryptoIdGeneratorAdapter(makeClock());

        const id = adapter.newUuid();

        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("yields distinct ids on repeated calls", () => {
        const adapter = new CryptoIdGeneratorAdapter(makeClock());

        const ids = new Set([adapter.newUuid(), adapter.newUuid(), adapter.newUuid()]);

        expect(ids.size).toBe(3);
    });
});

describe("CryptoIdGeneratorAdapter.newUlid", () => {
    it("calls IClock.nowMs() when no explicit timeMs is provided", () => {
        const clock = makeClock();
        const adapter = new CryptoIdGeneratorAdapter(clock);

        adapter.newUlid();

        expect(clock.nowMs).toHaveBeenCalledTimes(1);
    });

    it("does NOT call IClock.nowMs() when explicit timeMs is provided", () => {
        const clock = makeClock();
        const adapter = new CryptoIdGeneratorAdapter(clock);

        adapter.newUlid(1_700_000_000_000);

        expect(clock.nowMs).not.toHaveBeenCalled();
    });

    it("encodes the timestamp prefix (first 10 chars) deterministically for the same timeMs", () => {
        const adapter = new CryptoIdGeneratorAdapter(makeClock());

        const a = adapter.newUlid(FROZEN_MS);
        const b = adapter.newUlid(FROZEN_MS);

        // ULID = 10-char time prefix + 16-char random suffix.
        expect(a.slice(0, 10)).toBe(b.slice(0, 10));
        // Suffix should differ (random)
        expect(a.slice(10)).not.toBe(b.slice(10));
    });

    it("orders lexicographically by timestamp prefix", () => {
        const adapter = new CryptoIdGeneratorAdapter(makeClock());

        const earlier = adapter.newUlid(1_700_000_000_000);
        const later = adapter.newUlid(1_777_000_000_000);

        expect(earlier.localeCompare(later)).toBeLessThan(0);
    });

    it("returns a 26-char Crockford-base32 ULID", () => {
        const adapter = new CryptoIdGeneratorAdapter(makeClock());

        const id = adapter.newUlid(FROZEN_MS);

        expect(id).toHaveLength(26);
        expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
});
