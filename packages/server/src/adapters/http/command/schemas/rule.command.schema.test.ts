import { describe, expect, it } from "vitest";
import { ruleUpdateSchema } from "./rule.command.schema.js";

describe("ruleUpdateSchema", () => {
    it("accepts rationale-only rule metadata updates", () => {
        expect(ruleUpdateSchema.parse({ rationale: "Updated reason" })).toEqual({
            rationale: "Updated reason",
        });
    });
});
