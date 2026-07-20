export const RECIPE_STATUS = {
    candidate: "candidate",
    active: "active",
    dismissed: "dismissed",
    superseded: "superseded",
    retired: "retired",
} as const;

export const RECIPE_STATUSES = [
    RECIPE_STATUS.candidate,
    RECIPE_STATUS.active,
    RECIPE_STATUS.dismissed,
    RECIPE_STATUS.superseded,
    RECIPE_STATUS.retired,
] as const;

export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_OUTCOME = {
    completed: "completed",
    abandoned: "abandoned",
    superseded: "superseded",
} as const;

export const RECIPE_OUTCOMES = [
    RECIPE_OUTCOME.completed,
    RECIPE_OUTCOME.abandoned,
    RECIPE_OUTCOME.superseded,
] as const;

export type RecipeOutcome = (typeof RECIPE_OUTCOMES)[number];

export const RECIPE_EDITOR = {
    agent: "agent",
    user: "user",
} as const;

export type RecipeEditor = (typeof RECIPE_EDITOR)[keyof typeof RECIPE_EDITOR];

/** 자기보고가 아니라 원장 관측으로 내리는 레시피 적용의 최종 판정이다. */
export const RECIPE_VERDICT = {
    followedAndHelped: "followed_and_helped",
    followedNotHelped: "followed_not_helped",
    abandoned: "abandoned",
    unknown: "unknown",
} as const;

export const RECIPE_VERDICTS = [
    RECIPE_VERDICT.followedAndHelped,
    RECIPE_VERDICT.followedNotHelped,
    RECIPE_VERDICT.abandoned,
    RECIPE_VERDICT.unknown,
] as const;

export type RecipeVerdict = (typeof RECIPE_VERDICTS)[number];
