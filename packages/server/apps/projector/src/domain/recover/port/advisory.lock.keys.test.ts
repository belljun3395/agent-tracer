import { describe, expect, it } from "vitest";
import { ADVISORY_LOCK_KEY } from "./advisory.lock.keys.js";

describe("ADVISORY_LOCK_KEY", () => {
    it("회수 작업마다 서로 다른 락 키를 준다", () => {
        const keys = Object.values(ADVISORY_LOCK_KEY);

        expect(new Set(keys).size).toBe(keys.length);
    });
});
