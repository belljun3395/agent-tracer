import {describe, expect, it} from "vitest";
import {toCandidates} from "~runtime/domain/rulegen/adapter/agent.rule.generator.adapter.js";
import {
    buildRuleOutputSchema,
    RULE_OUTPUT_ROOT_KEY,
} from "~runtime/domain/rulegen/model/output.schema.model.js";

describe("buildRuleOutputSchema", () => {
    it("최상위 required와 properties 키가 RULE_OUTPUT_ROOT_KEY와 일치한다", () => {
        const schema = buildRuleOutputSchema() as {
            properties: Record<string, unknown>;
            required: readonly string[];
        };

        expect(Object.keys(schema.properties)).toEqual([RULE_OUTPUT_ROOT_KEY]);
        expect(schema.required).toEqual([RULE_OUTPUT_ROOT_KEY]);
    });
});

describe("toCandidates 왕복", () => {
    it("RULE_OUTPUT_ROOT_KEY로 담긴 배열을 그대로 돌려준다", () => {
        const structured = {[RULE_OUTPUT_ROOT_KEY]: [{name: "r"}]};

        expect(toCandidates(structured)).toEqual([{name: "r"}]);
    });

    it("잘못된 최상위 키는 빈 배열을 돌려준다", () => {
        expect(toCandidates({wrongKey: [{name: "r"}]})).toEqual([]);
    });

    it("레코드가 아닌 입력은 빈 배열을 돌려준다", () => {
        expect(toCandidates(null)).toEqual([]);
    });

    it("배열이 아닌 rules 값은 빈 배열을 돌려준다", () => {
        expect(toCandidates({rules: "notarray"})).toEqual([]);
    });
});
