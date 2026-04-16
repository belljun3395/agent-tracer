import { describe, expect, it } from "vitest";

import { writeSearchParam } from "./urlState.js";

describe("writeSearchParam", () => {
    it("sets a key when it is missing", () => {
        const result = writeSearchParam(new URLSearchParams(), "task", "a");
        expect(result.get("task")).toBe("a");
    });

    it("replaces an existing value while preserving other keys", () => {
        const input = new URLSearchParams("task=a&tab=overview");
        const result = writeSearchParam(input, "task", "b");
        expect(result.get("task")).toBe("b");
        expect(result.get("tab")).toBe("overview");
    });

    it("deletes the key when next is null", () => {
        const input = new URLSearchParams("task=a&tab=overview");
        const result = writeSearchParam(input, "task", null);
        expect(result.has("task")).toBe(false);
        expect(result.get("tab")).toBe("overview");
    });

    it("deletes the key when next is an empty string", () => {
        const input = new URLSearchParams("task=a");
        const result = writeSearchParam(input, "task", "");
        expect(result.has("task")).toBe(false);
    });

    it("does not mutate the input", () => {
        const input = new URLSearchParams("task=a");
        writeSearchParam(input, "task", "b");
        expect(input.get("task")).toBe("a");
    });
});
