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
