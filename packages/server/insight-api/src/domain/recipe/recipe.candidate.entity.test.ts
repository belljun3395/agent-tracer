import { describe, expect, it } from "vitest";
import { RecipeCandidateEntity } from "@monitor/insight-api/domain/recipe/recipe.candidate.entity.js";

function makeCandidate(status: RecipeCandidateEntity["status"]): RecipeCandidateEntity {
    return Object.assign(new RecipeCandidateEntity(), { status });
}

describe("RecipeCandidateEntity 제안 상태", () => {
    it("pending이면 아직 처리 대기 상태다", () => {
        expect(makeCandidate("pending").isPending()).toBe(true);
        expect(makeCandidate("pending").isResolved()).toBe(false);
    });

    it("accepted/dismissed/failed는 모두 종료(resolved) 상태다", () => {
        for (const status of ["accepted", "dismissed", "failed"] as const) {
            expect(makeCandidate(status).isPending()).toBe(false);
            expect(makeCandidate(status).isResolved()).toBe(true);
        }
    });
});
