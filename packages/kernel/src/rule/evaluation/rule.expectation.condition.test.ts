import { describe, expect, it } from "vitest";
import { KIND } from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "~kernel/observability/semconv.const.js";
import { expectFulfilledBy } from "./rule.expectation.condition.js";
import { RULE_EXPECTATION_KIND } from "../definition/rule.vocabulary.js";

describe("expectFulfilledBy", () => {
    it("명령 기대가 단일 이벤트의 명령 증거와 일치하면 이행으로 판정한다", () => {
        expect(expectFulfilledBy(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            {
                kind: KIND.executeTool,
                metadata: {
                    [SEMCONV_ATTR.toolName]: "Bash",
                    [AGENT_TRACER_ATTR.command]: "npm run lint -- --fix",
                },
            },
        )).toBe(true);
    });
});
