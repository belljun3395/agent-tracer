import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
    parseRecipeCandidateStatusFilter,
    parseRecipeStatusFilter,
} from "./recipe.query.filters.js";

describe("recipe query filters — 레시피 쿼리 파싱", () => {
    it("값이 없으면 기본 필터를 반환한다", () => {
        expect(parseRecipeCandidateStatusFilter(undefined)).toBe("pending");
        expect(parseRecipeStatusFilter(undefined)).toBe("active");
    });

    it("허용된 문자열만 typed filter로 반환한다", () => {
        expect(parseRecipeCandidateStatusFilter("all")).toBe("all");
        expect(parseRecipeStatusFilter("retired")).toBe("retired");
    });

    it("허용되지 않은 값이면 BadRequestException을 던진다", () => {
        expect(() => parseRecipeCandidateStatusFilter("accepted")).toThrow(BadRequestException);
        expect(() => parseRecipeStatusFilter("pending")).toThrow(BadRequestException);
    });
});
