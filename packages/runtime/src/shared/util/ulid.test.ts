import {describe, expect, it} from "vitest";
import {ensureEventId, generateUlid} from "./ulid.js";

describe("generateUlid", () => {
    it("produces a 26-char Crockford base32 id", () => {
        const id = generateUlid();
        expect(id).toHaveLength(26);
        expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("is time-sortable: a later timestamp yields a lexicographically greater prefix", () => {
        const earlier = generateUlid(1_000_000_000_000);
        const later = generateUlid(2_000_000_000_000);
        expect(later.slice(0, 10) > earlier.slice(0, 10)).toBe(true);
    });

    it("is unique across calls at the same timestamp", () => {
        const ts = 1_700_000_000_000;
        const ids = new Set(Array.from({length: 1000}, () => generateUlid(ts)));
        expect(ids.size).toBe(1000);
    });
});

describe("ensureEventId", () => {
    it("stamps a ULID id when absent", () => {
        const event: {id?: string; kind: string} = {kind: "tool.used"};
        const stamped = ensureEventId(event);
        expect(stamped.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("preserves an existing id (so retries keep the same idempotency key)", () => {
        const event: {id?: string; kind: string} = {id: "EXISTING", kind: "tool.used"};
        const stamped = ensureEventId(event);
        expect(stamped.id).toBe("EXISTING");
    });

    it("does not mutate the source event", () => {
        const source: {id?: string; kind: string} = {kind: "tool.used"};
        ensureEventId(source);
        expect("id" in source).toBe(false);
    });
});
