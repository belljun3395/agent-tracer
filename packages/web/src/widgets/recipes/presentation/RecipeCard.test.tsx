import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskId } from "~web/shared/identity.js";
import type { Recipe } from "~web/entities/recipe/model/recipe.js";
import { RecipeCard } from "~web/widgets/recipes/presentation/RecipeCard.js";

const TASK_ID = "task-1" as TaskId;

afterEach(() => cleanup());

function recipe(): Recipe {
  return {
    id: "recipe-1",
    sourceCandidateId: null,
    sourceJobId: null,
    title: "인증 실패를 추적한다",
    intent: "인증 실패 해결",
    description: "요청과 수행 흐름과 마찰을 함께 보존한다.",
    summaryMd: "- 이벤트를 확인한다",
    request: "사용자는 로그인 실패 원인을 찾아 고쳐달라고 했다.",
    corrections: [
      {
        whatAgentDid: "처음에는 토큰 저장소만 수정했다.",
        howCorrected: "쿠키 설정 누락을 확인하고 수정했다.",
        evidence: ["event-1"],
      },
    ],
    pitfalls: [
      {
        pitfall: "같은 401이 여러 레이어에서 발생한다.",
        whyNonObvious: "표면 로그만 보면 API 라우터 문제처럼 보인다.",
        evidence: ["event-2"],
      },
    ],
    governingRules: ["rule-1"],
    steps: [],
    touchedFiles: [],
    contributingSlices: [{ taskId: TASK_ID, eventIds: ["event-1"] }],
    rev: 1,
    parentRecipeId: null,
    status: "candidate",
    userEdited: false,
    lastEditedBy: "agent",
    applicationCount: 0,
    verdicts: { followedAndHelped: 0, followedNotHelped: 0, abandoned: 0, unknown: 0 },
    language: "ko",
    rationale: "성공 흐름이 재사용 가능하다.",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("레시피 카드", () => {
  it("요청과 보정과 함정을 표시한다", () => {
    render(
      <RecipeCard
        recipe={recipe()}
        taskTitleById={new Map([[TASK_ID, "로그인 실패 수정"]])}
        footMetaAt="2026-07-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("Request")).toBeTruthy();
    expect(screen.getByText(/로그인 실패 원인/)).toBeTruthy();
    expect(screen.getByText("Corrections")).toBeTruthy();
    expect(screen.getByText(/토큰 저장소/)).toBeTruthy();
    expect(screen.getByText("Pitfalls")).toBeTruthy();
    expect(screen.getByText(/같은 401/)).toBeTruthy();
  });

  it("적용된 규칙과 승격 가능한 규칙 제안을 표시한다", () => {
    render(
      <RecipeCard
        recipe={recipe()}
        taskTitleById={new Map([[TASK_ID, "로그인 실패 수정"]])}
        footMetaAt="2026-07-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("Governing rules")).toBeTruthy();
    expect(screen.getByText("rule-1")).toBeTruthy();
  });
});
