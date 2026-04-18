import { describe, expect, it } from "vitest";
import { TIMELINE_LANES } from "@monitor/web-domain";
import { getLaneTheme } from "./laneTheme.js";
describe("LANE_THEME", () => {
    it("defines a theme entry for every timeline lane", () => {
        for (const lane of TIMELINE_LANES) {
            expect(getLaneTheme(lane)).toBeDefined();
        }
    });
    it("provides semantic variables for each lane", () => {
        for (const lane of TIMELINE_LANES) {
            const theme = getLaneTheme(lane);
            expect(typeof theme.label).toBe("string");
            expect(theme.icon).toMatch(/^\/icons\/.+\.svg$/);
            expect(theme.toneVar).toMatch(/^--/);
            expect(theme.bgVar).toMatch(/^--/);
            expect(theme.borderVar).toMatch(/^--/);
        }
    });
    it("returns the expected label and icon for selected lanes", () => {
        expect(getLaneTheme("implementation")).toMatchObject({
            label: "Implementation",
            icon: "/icons/tool.svg",
            toneVar: "--implementation"
        });
        expect(getLaneTheme("questions")).toMatchObject({
            label: "Questions",
            icon: "/icons/bell.svg",
            bgVar: "--questions-bg"
        });
    });
});
