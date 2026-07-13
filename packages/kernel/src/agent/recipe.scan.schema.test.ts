import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recipeCandidateSchema, recipeCandidatesListSchema } from "./recipe.scan.schema.js";

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: "인증 실패를 추적한다",
        intent: "사용자 지시와 이벤트 흐름을 바탕으로 인증 실패 해결 절차를 재사용한다.",
        description: "인증 실패가 반복될 때 요청, 성공 흐름, 마찰을 함께 보존한다.",
        summary_md: "- 사용자 요청을 확인한다\n- 실패 로그를 따라간다",
        request: "사용자는 로그인 실패 원인을 찾아 고쳐달라고 했다.",
        corrections: [
            {
                whatAgentDid: "초기에 토큰 저장소만 수정했다.",
                howCorrected: "이벤트 타임라인에서 쿠키 설정 누락을 확인하고 수정했다.",
                evidence: ["event-1"],
            },
        ],
        pitfalls: [
            {
                pitfall: "동일한 401이 여러 레이어에서 발생한다.",
                whyNonObvious: "표면 에러만 보면 API 라우터 문제처럼 보인다.",
                evidence: ["event-2"],
            },
        ],
        governing_rules: ["rule-1"],
        revises_recipe_id: "recipe-old",
        contributing_slices: [{ taskId: "task-1", eventIds: ["event-1"] }],
        rationale: "앵커 태스크의 성공 과정이 재사용 가능한 절차를 담고 있다.",
        ...overrides,
    };
}

describe("recipeCandidateSchema", () => {
    it("요청과 보정과 함정 필드를 구조화해 받는다", () => {
        const parsed = recipeCandidateSchema.parse(candidate());

        expect(parsed.request).toContain("로그인 실패");
        expect(parsed.corrections[0]?.whatAgentDid).toContain("토큰 저장소");
        expect(parsed.pitfalls[0]?.whyNonObvious).toContain("API 라우터");
    });

    it("적용된 규칙과 새 규칙 제안을 구조화해 받는다", () => {
        const parsed = recipeCandidateSchema.parse(candidate());

        expect(parsed.governing_rules).toEqual(["rule-1"]);
        expect(parsed.revises_recipe_id).toBe("recipe-old");
    });

    it("correction의 evidence가 비어 있으면 거부한다", () => {
        expect(() =>
            recipeCandidateSchema.parse(
                candidate({ corrections: [{ whatAgentDid: "x", howCorrected: "y", evidence: [] }] }),
            ),
        ).toThrow();
    });

    it("pitfall의 evidence가 비어 있으면 거부한다", () => {
        expect(() =>
            recipeCandidateSchema.parse(
                candidate({ pitfalls: [{ pitfall: "x", whyNonObvious: "y", evidence: [] }] }),
            ),
        ).toThrow();
    });
});

describe("recipeCandidatesListSchema", () => {
    it("단일 앵커 스캔은 후보를 최대 1개만 허용한다", () => {
        expect(() =>
            recipeCandidatesListSchema.parse({
                recipes: [candidate({ title: "a" }), candidate({ title: "b" })],
            }),
        ).toThrow();
    });

    it("실행 백엔드와 공유하는 결과 계약 픽스처를 허용한다", () => {
        const fixture = JSON.parse(
            readFileSync(new URL("./__fixtures__/recipe.scan.result.json", import.meta.url), "utf8"),
        ) as unknown;

        expect(recipeCandidatesListSchema.parse(fixture).recipes[0]?.title).toBe("Add a safe migration");
    });
});
