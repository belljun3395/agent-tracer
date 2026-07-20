import {describe, expect, it} from "vitest";
import {formatHintsContext} from "~runtime/domain/hint/model/hint.model.js";
import type {PreprocessingHint, PreprocessingHintSeverity} from "~runtime/domain/hint/model/hint.model.js";

function hint(severity: PreprocessingHintSeverity, title: string): PreprocessingHint {
    return {type: "context_pressure", severity, title, message: `${title} 본문`};
}

describe("formatHintsContext", () => {
    it("힌트가 없으면 빈 문자열이다", () => {
        expect(formatHintsContext([])).toBe("");
    });

    it("상한을 넘으면 심각한 것부터 남기고 자른다", () => {
        const context = formatHintsContext([
            hint("info", "info-1"),
            hint("info", "info-2"),
            hint("warning", "warn-1"),
            hint("info", "info-3"),
            hint("critical", "crit-1"),
        ]);

        expect(context).toContain("crit-1");
        expect(context).toContain("warn-1");
        expect(context).not.toContain("info-3");
    });
});
