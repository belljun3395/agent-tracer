import {describe, expect, it} from "vitest";
import {uuidFromSeed} from "~shared/hook-runtime/local-daemon.js";

const UUID_V5_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidFromSeed", () => {
    it("returns RFC 4122-conformant version 5 UUIDs", () => {
        const id = uuidFromSeed("session:claude-code:abc-123");
        expect(id).toMatch(UUID_V5_REGEX);
    });

    it("is deterministic for the same seed", () => {
        const seed = "task:claude-code:zzz";
        expect(uuidFromSeed(seed)).toBe(uuidFromSeed(seed));
    });

    it("returns distinct UUIDs for different seeds", () => {
        expect(uuidFromSeed("a")).not.toBe(uuidFromSeed("b"));
    });
});
