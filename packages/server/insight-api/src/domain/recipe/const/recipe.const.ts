export const RECIPE_STATUS = {
    active: "active",
    superseded: "superseded",
    retired: "retired",
} as const;

export const RECIPE_STATUSES = [
    RECIPE_STATUS.active,
    RECIPE_STATUS.superseded,
    RECIPE_STATUS.retired,
] as const;

export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_CANDIDATE_STATUS = {
    pending: "pending",
    accepted: "accepted",
    dismissed: "dismissed",
    failed: "failed",
} as const;

export const RECIPE_CANDIDATE_STATUSES = [
    RECIPE_CANDIDATE_STATUS.pending,
    RECIPE_CANDIDATE_STATUS.accepted,
    RECIPE_CANDIDATE_STATUS.dismissed,
    RECIPE_CANDIDATE_STATUS.failed,
] as const;

export type RecipeCandidateStatus = (typeof RECIPE_CANDIDATE_STATUSES)[number];
