import { describe, expect, it } from "vitest";
import {
    applyRecipeScanFilters,
    clampMaxCandidates,
    clampMinEventCount,
    normalizeRecipeLanguage,
    normalizeRecipeScanFilters,
} from "./recipe.scan.filters.js";

/**
 * 레시피 스캔 필터(값 객체) 비즈니스 로직 테스트.
 * 메서드명은 영어, 표시명은 한글.
 */
describe("clampMaxCandidates — 후보 상한 보정", () => {
    it("유효하지 않은 값이면 기본값 10을 쓴다", () => {
        expect(clampMaxCandidates(0)).toBe(10);
        expect(clampMaxCandidates(-3)).toBe(10);
        expect(clampMaxCandidates("nope")).toBe(10);
    });

    it("하드캡 30을 넘으면 30으로 자른다", () => {
        expect(clampMaxCandidates(100)).toBe(30);
    });

    it("범위 안의 값은 그대로 쓴다", () => {
        expect(clampMaxCandidates(7)).toBe(7);
    });
});

describe("clampMinEventCount — 최소 이벤트 수 보정", () => {
    it("유효하지 않으면 기본값 1을 쓴다", () => {
        expect(clampMinEventCount(0)).toBe(1);
        expect(clampMinEventCount("x")).toBe(1);
    });

    it("1 이상이면 그대로 쓴다", () => {
        expect(clampMinEventCount(5)).toBe(5);
    });
});

describe("normalizeRecipeScanFilters — 필터 기본값 적용", () => {
    it("빈 입력이면 completed/active 스코프 기본값으로 정규화된다", () => {
        const f = normalizeRecipeScanFilters({});
        expect(f.statusFilter).toBe("completed");
        expect(f.since).toBeNull();
        expect(f.maxCandidates).toBe(10);
        expect(f.minEventCount).toBe(1);
        expect(f.archivedScope).toBe("active");
    });
});

describe("applyRecipeScanFilters — 태스크 필터링", () => {
    const tasks = [
        { status: "completed", updatedAt: "2026-01-10" },
        { status: "running", updatedAt: "2026-01-20" },
    ];

    it("completed 필터는 완료된 태스크만 남긴다", () => {
        const out = applyRecipeScanFilters(tasks, normalizeRecipeScanFilters({ statusFilter: "completed" }));
        expect(out).toHaveLength(1);
        expect(out[0]!.status).toBe("completed");
    });

    it("since 하한보다 오래된 태스크는 제외한다", () => {
        const out = applyRecipeScanFilters(tasks, normalizeRecipeScanFilters({ statusFilter: "all", since: "2026-01-15" }));
        expect(out).toHaveLength(1);
        expect(out[0]!.updatedAt).toBe("2026-01-20");
    });
});

describe("normalizeRecipeLanguage — 출력 언어 정규화", () => {
    it("지원 언어는 소문자로 정규화한다", () => {
        expect(normalizeRecipeLanguage("KO")).toBe("ko");
    });

    it("미지원/빈 값은 auto로 떨어진다", () => {
        expect(normalizeRecipeLanguage("fr")).toBe("auto");
        expect(normalizeRecipeLanguage(null)).toBe("auto");
    });
});
