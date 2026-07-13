import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    RECIPE_EDITOR,
    RECIPE_STATUS,
    type RecipeEditor,
    type RecipeStatus,
} from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";
import {
    type RecipeCandidateInput,
    type RecipeRevisionInput,
    type RecipeStats,
} from "./recipe.types.js";

const MIN_APPLIED_FOR_FAILURE = 5;
const MIN_SUCCESS_RATE = 0.3;
const STALE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

@Entity({ name: "recipes" })
@Index("recipes_user_status", ["userId", "status", "updatedAt"])
@Index("recipes_live_user_status", ["userId", "status", "updatedAt"], {
    where: "\"deleted_at\" IS NULL",
})
export class RecipeEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    status!: RecipeStatus;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    intent!: string;

    @Column({ type: "text" })
    description!: string;

    @Column({ name: "summary_md", type: "text" })
    summaryMd!: string;

    @Column({ type: "text", default: "" })
    request!: string;

    @Column({ type: "jsonb", default: [] })
    corrections!: unknown[];

    @Column({ type: "jsonb", default: [] })
    pitfalls!: unknown[];

    @Column({ name: "governing_rules", type: "jsonb", default: [] })
    governingRules!: string[];

    @Column({ type: "jsonb", default: [] })
    steps!: unknown[];

    @Column({ name: "touched_files", type: "jsonb", default: [] })
    touchedFiles!: string[];

    @Column({ name: "contributing_slices", type: "jsonb", default: [] })
    contributingSlices!: unknown[];

    @Column({ type: "text", nullable: true })
    rationale!: string | null;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ type: "integer", default: 1 })
    rev!: number;

    @Column({ name: "parent_recipe_id", type: "text", nullable: true })
    parentRecipeId!: string | null;

    @Column({ name: "source_job_id", type: "text", nullable: true })
    sourceJobId!: string | null;

    @Column({ name: "user_edited", type: "boolean", default: false })
    userEdited!: boolean;

    @Column({ name: "last_edited_by", type: "text", default: RECIPE_EDITOR.agent })
    lastEditedBy!: RecipeEditor;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;

    static candidate(input: RecipeCandidateInput, now: Date): RecipeEntity {
        const recipe = new RecipeEntity();
        recipe.id = input.id;
        recipe.userId = input.userId;
        recipe.status = RECIPE_STATUS.candidate;
        recipe.title = input.title;
        recipe.intent = input.intent;
        recipe.description = input.description;
        recipe.summaryMd = input.summaryMd;
        recipe.request = input.request;
        recipe.corrections = [...input.corrections];
        recipe.pitfalls = [...input.pitfalls];
        recipe.governingRules = [...input.governingRules];
        recipe.steps = [...input.steps];
        recipe.touchedFiles = [...input.touchedFiles];
        recipe.contributingSlices = [...input.contributingSlices];
        recipe.rationale = input.rationale ?? null;
        recipe.language = input.language ?? null;
        recipe.rev = 1;
        recipe.parentRecipeId = input.parentRecipeId ?? null;
        recipe.sourceJobId = input.sourceJobId ?? null;
        recipe.userEdited = false;
        recipe.lastEditedBy = RECIPE_EDITOR.agent;
        recipe.error = null;
        recipe.createdAt = now;
        recipe.updatedAt = now;
        recipe.resolvedAt = null;
        recipe.deletedAt = null;
        return recipe;
    }

    accept(now: Date): void {
        if (this.status !== RECIPE_STATUS.candidate) throw new InvariantViolationError("recipe.not-candidate");
        this.status = RECIPE_STATUS.active;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    dismiss(now: Date): void {
        if (this.status !== RECIPE_STATUS.candidate) throw new InvariantViolationError("recipe.not-candidate");
        this.status = RECIPE_STATUS.dismissed;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    retire(now: Date): void {
        if (this.status !== RECIPE_STATUS.active) throw new InvariantViolationError("recipe.not-active");
        this.status = RECIPE_STATUS.retired;
        this.updatedAt = now;
    }

    supersede(byRecipeId: string, now: Date): void {
        if (byRecipeId.length === 0) throw new InvariantViolationError("recipe.supersede-target-missing", 400);
        this.status = RECIPE_STATUS.superseded;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    canDelete(): boolean {
        return this.status === RECIPE_STATUS.dismissed || this.status === RECIPE_STATUS.retired;
    }

    delete(now: Date): void {
        if (!this.canDelete()) throw new InvariantViolationError("recipe.not-deletable", 400);
        this.deletedAt = now;
        this.updatedAt = now;
    }

    isDeleted(): boolean {
        return this.deletedAt !== null;
    }

    isActive(): boolean {
        return this.status === RECIPE_STATUS.active;
    }

    editByUser(input: RecipeRevisionInput, now: Date): void {
        if (this.status !== RECIPE_STATUS.active) throw new InvariantViolationError("recipe.not-active");
        this.applyRevision(input);
        this.userEdited = true;
        this.lastEditedBy = RECIPE_EDITOR.user;
        this.rev += 1;
        this.updatedAt = now;
    }

    /** 에이전트는 레시피를 직접 갱신할 수 없으므로, 개정 후보가 관측한 rev를 여전히 가리키는지만 확인한다. */
    isRevisionStale(observedRev: number): boolean {
        return this.rev !== observedRev;
    }

    shouldRetire(now: Date, stats: RecipeStats): boolean {
        if (this.status !== RECIPE_STATUS.active) return false;
        const ageMs = now.getTime() - this.createdAt.getTime();
        const failsByFailure = stats.applied >= MIN_APPLIED_FOR_FAILURE && stats.successRate < MIN_SUCCESS_RATE;
        const failsByStaleness = stats.applied === 0 && ageMs > STALE_AGE_MS;
        return failsByFailure || failsByStaleness;
    }

    private applyRevision(input: RecipeRevisionInput): void {
        if (input.title !== undefined) this.title = input.title;
        if (input.intent !== undefined) this.intent = input.intent;
        if (input.description !== undefined) this.description = input.description;
        if (input.summaryMd !== undefined) this.summaryMd = input.summaryMd;
        if (input.request !== undefined) this.request = input.request;
        if (input.corrections !== undefined) this.corrections = [...input.corrections];
        if (input.pitfalls !== undefined) this.pitfalls = [...input.pitfalls];
        if (input.governingRules !== undefined) this.governingRules = [...input.governingRules];
        if (input.steps !== undefined) this.steps = [...input.steps];
        if (input.touchedFiles !== undefined) this.touchedFiles = [...input.touchedFiles];
        if (input.contributingSlices !== undefined) this.contributingSlices = [...input.contributingSlices];
        if (input.rationale !== undefined) this.rationale = input.rationale;
        if (input.language !== undefined) this.language = input.language;
        if (input.sourceJobId !== undefined) this.sourceJobId = input.sourceJobId;
    }
}
