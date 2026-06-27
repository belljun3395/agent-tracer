import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { parseCleanupSuggestionStatusFilter } from "./cleanup.query.filters.js";

describe("parseCleanupSuggestionStatusFilter — 정리 제안 상태 쿼리", () => {
    it("값이 없으면 pending을 기본값으로 쓴다", () => {
        expect(parseCleanupSuggestionStatusFilter(undefined)).toBe("pending");
    });

    it("허용된 상태 필터만 반환한다", () => {
        expect(parseCleanupSuggestionStatusFilter("all")).toBe("all");
    });

    it("허용되지 않은 값이면 BadRequestException을 던진다", () => {
        expect(() => parseCleanupSuggestionStatusFilter("accepted")).toThrow(BadRequestException);
    });
});
