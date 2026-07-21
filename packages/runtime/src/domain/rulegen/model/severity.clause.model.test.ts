import {describe, expect, it} from "vitest";
import {RULEGEN_MODE} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    buildSeverityGuidance,
    SEVERITY_CLAUSE,
    SEVERITY_HEADING,
} from "~runtime/domain/rulegen/model/severity.clause.model.js";

describe("buildSeverityGuidance", () => {
    it("세 심각도 절은 모드와 무관하게 같다", () => {
        const manual = buildSeverityGuidance(RULEGEN_MODE.manual);
        const recent = buildSeverityGuidance(RULEGEN_MODE.recent);

        for (const clause of Object.values(SEVERITY_CLAUSE)) {
            expect(manual).toContain(clause);
            expect(recent).toContain(clause);
        }
    });

    it("문턱 문구만 모드에 따라 갈린다", () => {
        const manual = buildSeverityGuidance(RULEGEN_MODE.manual);
        const recent = buildSeverityGuidance(RULEGEN_MODE.recent);

        expect(manual).toContain(SEVERITY_HEADING.manual);
        expect(manual).not.toContain(SEVERITY_HEADING.recent);
        expect(recent).toContain(SEVERITY_HEADING.recent);
        expect(recent).not.toContain(SEVERITY_HEADING.manual);
    });
});
