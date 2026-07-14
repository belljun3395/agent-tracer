import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TIMELINE_EVENT_KINDS } from "@monitor/kernel";
import { RECIPE_SCAN_MAX_TURNS } from "./recipe.prompt.js";
import { RECIPE_SCAN_TOOL, RECIPE_SCAN_TOOLS } from "./recipe.tool.schema.js";

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL("../../../../../../../kernel/src/agent/__fixtures__/recipe.scan.tool.contract.json", import.meta.url),
        "utf8",
    ),
) as {
    readonly maxTurns: number;
    readonly searchEvents: { readonly required: string[]; readonly optional: string[]; readonly kinds: string[] };
};

function partitionSearchEventsFields(): { readonly required: string[]; readonly optional: string[] } {
    const spec = RECIPE_SCAN_TOOLS.find((tool) => tool.name === RECIPE_SCAN_TOOL.searchEvents);
    const shape = z.object(spec!.shape).shape;
    const required: string[] = [];
    const optional: string[] = [];
    for (const [field, schema] of Object.entries(shape)) {
        (schema.safeParse(undefined).success ? optional : required).push(field);
    }
    return { required, optional };
}

describe("recipe-scan 도구 계약", () => {
    it("턴 예산이 골든 계약과 같다", () => {
        expect(RECIPE_SCAN_MAX_TURNS).toBe(CONTRACT.maxTurns);
    });

    it("search_events의 필수와 선택 인자가 골든 계약과 같다", () => {
        const { required, optional } = partitionSearchEventsFields();

        expect(new Set(required)).toEqual(new Set(CONTRACT.searchEvents.required));
        expect(new Set(optional)).toEqual(new Set(CONTRACT.searchEvents.optional));
    });

    it("search_events가 거르는 이벤트 종류가 골든 계약과 같다", () => {
        expect([...TIMELINE_EVENT_KINDS]).toEqual(CONTRACT.searchEvents.kinds);
    });
});
