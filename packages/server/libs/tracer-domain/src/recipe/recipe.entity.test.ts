import { describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "@monitor/kernel";
import { RecipeEntity } from "./recipe.entity.js";
import { EMPTY_RECIPE_STATS, type RecipeCandidateInput, type RecipeStats } from "./recipe.types.js";
import { InvariantViolationError } from "../error/invariant.error.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeInput(overrides: Partial<RecipeCandidateInput> = {}): RecipeCandidateInput {
    return {
        id: "r1",
        userId: "u1",
        title: "제목",
        intent: "intent",
        description: "설명",
        summaryMd: "요약",
        request: "사용자가 인증 실패를 고쳐달라고 요청했다.",
        corrections: [
            {
                whatAgentDid: "처음에는 로그 확인 없이 구현을 수정했다.",
                howCorrected: "이벤트 로그를 확인하고 실패 지점을 기준으로 수정했다.",
                evidence: ["event-1"],
            },
        ],
        pitfalls: [
            {
                pitfall: "같은 에러가 여러 레이어에서 발생한다.",
                whyNonObvious: "표면 메시지만 보면 라우터 문제처럼 보인다.",
                evidence: ["event-2"],
            },
        ],
        governingRules: ["rule-1"],
        steps: [],
        touchedFiles: [],
        contributingSlices: [],
        ...overrides,
    };
}

describe("RecipeEntity", () => {
    describe("candidate", () => {
        it("candidate 상태로 새 레시피를 만든다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(recipe.status).toBe(RECIPE_STATUS.candidate);
            expect(recipe.rev).toBe(1);
            expect(recipe.resolvedAt).toBeNull();
            expect(recipe.request).toBe("사용자가 인증 실패를 고쳐달라고 요청했다.");
            expect(recipe.corrections).toHaveLength(1);
            expect(recipe.pitfalls).toHaveLength(1);
            expect(recipe.governingRules).toEqual(["rule-1"]);
        });
    });

    describe("accept", () => {
        it("candidate 레시피를 채택하면 active가 되고 resolvedAt이 채워진다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            const acceptedAt = new Date("2026-01-01T00:05:00.000Z");
            recipe.accept(acceptedAt);
            expect(recipe.status).toBe(RECIPE_STATUS.active);
            expect(recipe.resolvedAt).toEqual(acceptedAt);
        });

        it("candidate가 아닌 레시피를 채택하려 하면 예외를 던진다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            expect(() => recipe.accept(NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("dismiss", () => {
        it("candidate 레시피를 기각하면 dismissed가 된다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.dismiss(NOW);
            expect(recipe.status).toBe(RECIPE_STATUS.dismissed);
        });

        it("candidate가 아닌 레시피를 기각하려 하면 예외를 던진다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            expect(() => recipe.dismiss(NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("retire", () => {
        it("active 레시피를 폐기하면 retired가 된다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            recipe.retire(NOW);
            expect(recipe.status).toBe(RECIPE_STATUS.retired);
        });

        it("active가 아닌 레시피를 폐기하려 하면 예외를 던진다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(() => recipe.retire(NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("supersede", () => {
        it("대체 레시피 id 없이 대체하려 하면 예외를 던진다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(() => recipe.supersede("", NOW)).toThrow(InvariantViolationError);
        });

        it("대체 레시피 id가 있으면 superseded로 바뀐다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.supersede("r2", NOW);
            expect(recipe.status).toBe(RECIPE_STATUS.superseded);
        });
    });

    describe("isActive", () => {
        it("status가 active면 true를 반환한다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            expect(recipe.isActive()).toBe(true);
        });

        it("status가 candidate면 false를 반환한다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(recipe.isActive()).toBe(false);
        });
    });

    describe("provenance", () => {
        it("사용자 편집은 userEdited를 세우고 rev를 올린다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            recipe.editByUser(
                {
                    title: "사용자 제목",
                    intent: "사용자 intent",
                    description: "사용자 설명",
                    summaryMd: "- 사용자 수정",
                },
                new Date("2026-01-01T00:10:00.000Z"),
            );

            expect(recipe.title).toBe("사용자 제목");
            expect(recipe.rev).toBe(2);
            expect(recipe.userEdited).toBe(true);
            expect(recipe.lastEditedBy).toBe("user");
        });

        it("활성 상태가 아닌 레시피는 사용자가 편집할 수 없다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(() => recipe.editByUser({ title: "사용자 제목" }, NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("isRevisionStale", () => {
        it("관측한 rev가 현재 rev와 같으면 stale이 아니다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(recipe.isRevisionStale(1)).toBe(false);
        });

        it("관측한 rev 이후 레시피가 바뀌었으면 stale이다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            recipe.editByUser({ title: "사용자 제목" }, NOW);
            expect(recipe.isRevisionStale(1)).toBe(true);
        });
    });

    describe("shouldRetire", () => {
        function activeRecipe(createdAt: Date): RecipeEntity {
            const recipe = RecipeEntity.candidate(makeInput(), createdAt);
            recipe.accept(createdAt);
            return recipe;
        }

        function stats(overrides: Partial<RecipeStats> = {}): RecipeStats {
            return { ...EMPTY_RECIPE_STATS, ...overrides };
        }

        it("active가 아니면 통계와 무관하게 false를 반환한다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            expect(recipe.shouldRetire(NOW, stats({ decidedCount: 10, successRate: 0 }))).toBe(false);
        });

        it("종결 판정이 충분히 쌓였고 성공률이 낮으면 폐기 대상이다", () => {
            const recipe = activeRecipe(NOW);
            expect(recipe.shouldRetire(NOW, stats({ applicationCount: 5, decidedCount: 5, successRate: 0.2 }))).toBe(true);
        });

        it("성공률이 충분히 높으면 종결 판정이 많아도 폐기 대상이 아니다", () => {
            const recipe = activeRecipe(NOW);
            expect(recipe.shouldRetire(NOW, stats({ applicationCount: 10, decidedCount: 10, successRate: 0.8 }))).toBe(false);
        });

        it("한 번도 당겨지지 않고(적용 행 0) 오래됐으면 폐기 대상이다", () => {
            const oldCreatedAt = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
            const recipe = activeRecipe(oldCreatedAt);
            expect(recipe.shouldRetire(NOW, stats())).toBe(true);
        });

        it("한 번도 당겨지지 않았어도 아직 오래되지 않았으면 폐기 대상이 아니다", () => {
            const recipe = activeRecipe(NOW);
            expect(recipe.shouldRetire(NOW, stats())).toBe(false);
        });

        it("당겨졌으나 판정이 전부 unknown이면 오래돼도 폐기 대상이 아니다", () => {
            const oldCreatedAt = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
            const recipe = activeRecipe(oldCreatedAt);
            const stale = stats({ applicationCount: 3, decidedCount: 0, successRate: 0 });
            expect(recipe.shouldRetire(NOW, stale)).toBe(false);
        });
    });

    describe("delete", () => {
        it("기각된 레시피를 지우면 isDeleted가 true가 된다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.dismiss(NOW);
            recipe.delete(NOW);
            expect(recipe.isDeleted()).toBe(true);
        });

        it("폐기된 레시피도 지울 수 있다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.accept(NOW);
            recipe.retire(NOW);
            expect(recipe.canDelete()).toBe(true);
        });

        it("후보와 활성 레시피는 지울 수 없다", () => {
            const candidate = RecipeEntity.candidate(makeInput(), NOW);
            expect(candidate.canDelete()).toBe(false);
            candidate.accept(NOW);
            expect(candidate.canDelete()).toBe(false);
        });

        it("대체된 레시피는 계보 노드라 지울 수 없다", () => {
            const recipe = RecipeEntity.candidate(makeInput(), NOW);
            recipe.supersede("r2", NOW);
            expect(recipe.canDelete()).toBe(false);
            expect(() => recipe.delete(NOW)).toThrow(InvariantViolationError);
        });

        it("갓 만든 후보는 삭제 상태가 아니다", () => {
            expect(RecipeEntity.candidate(makeInput(), NOW).isDeleted()).toBe(false);
        });
    });
});
