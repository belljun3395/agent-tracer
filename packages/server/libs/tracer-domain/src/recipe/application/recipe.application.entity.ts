import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { RecipeInjectedVia, RecipeOutcome, RecipeVerdict } from "@monitor/kernel";
import type { RecipeVerdictEvidence } from "../recipe.types.js";

@Entity({ name: "recipe_applications" })
@Index("recipe_applications_recipe", ["recipeId", "createdAt"])
@Index("recipe_applications_task", ["taskId"])
export class RecipeApplicationEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "recipe_id", type: "text" })
    recipeId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "injected_via", type: "text" })
    injectedVia!: RecipeInjectedVia;

    // 에이전트의 자기보고이며, 관측 판정인 verdict와 다른 것을 뜻하므로 합치지 않는다.
    @Column({ type: "text", nullable: true })
    outcome!: RecipeOutcome | null;

    @Column({ type: "text", nullable: true })
    note!: string | null;

    // 판정 창의 시작이 되는 recipeInjected 원장 이벤트의 식별자이며, 자기보고로 즉석 생성된 이력은 창이 없어 null이다.
    @Column({ name: "anchor_event_id", type: "text", nullable: true })
    anchorEventId!: string | null;

    // anchorEventId와 같은 원장 이벤트의 전역 seq이며, 그 이벤트는 읽기 모델 events 테이블에 없어 seq 비교로 직접 창을 연다.
    @Column({ name: "anchor_seq", type: "bigint", nullable: true })
    anchorSeq!: string | null;

    // 원장 관측으로 내린 최종 판정이며 종결 전까지 null이다.
    @Column({ type: "text", nullable: true })
    verdict!: RecipeVerdict | null;

    @Column({ name: "verdict_evidence", type: "jsonb", nullable: true })
    verdictEvidence!: RecipeVerdictEvidence | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    /** 에이전트가 스스로 보고하는 성과이며 판정을 종결시키지 않는다. */
    reportOutcome(outcome: RecipeOutcome, note: string | null): void {
        this.outcome = outcome;
        this.note = note;
    }

    /** 원장 관측(또는 관측이 불확실할 때의 자기보고 폴백)으로 판정을 종결한다. */
    resolveVerdict(verdict: RecipeVerdict, evidence: RecipeVerdictEvidence, at: Date): void {
        this.verdict = verdict;
        this.verdictEvidence = evidence;
        this.resolvedAt = at;
    }

    isVerdictResolved(): boolean {
        return this.verdict !== null;
    }
}
