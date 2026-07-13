import { describe, expect, it } from "vitest";
import { contractVersionFieldSchema } from "./contract.version.schema.js";
import { UNKNOWN_CONTRACT_VERSION } from "./contract.version.const.js";

describe("contractVersionFieldSchema", () => {
    it("값이 있으면 그대로 통과시킨다", () => {
        expect(contractVersionFieldSchema.parse("0.5.0")).toBe("0.5.0");
    });

    it("값이 없으면 unknown으로 정규화한다", () => {
        expect(contractVersionFieldSchema.parse(undefined)).toBe(UNKNOWN_CONTRACT_VERSION);
    });
});
