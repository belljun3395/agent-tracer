import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { RecipeInjectedVia, RecipeOutcome } from "@monitor/kernel";

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

    @Column({ type: "text", nullable: true })
    outcome!: RecipeOutcome | null;

    @Column({ type: "text", nullable: true })
    note!: string | null;

    // recipeInjected 원장 이벤트의 식별자이며, 자기보고로 즉석 생성된 이력은 이벤트가 없어 null이다.
    @Column({ name: "anchor_event_id", type: "text", nullable: true })
    anchorEventId!: string | null;

    // anchorEventId와 같은 원장 이벤트의 전역 seq이며, 그 이벤트는 읽기 모델 events 테이블에 없어 이 열로 직접 보관한다.
    @Column({ name: "anchor_seq", type: "bigint", nullable: true })
    anchorSeq!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    /** 에이전트가 스스로 보고하는 성과이며 사용량과 함께 레시피 성과를 재는 신호다. */
    reportOutcome(outcome: RecipeOutcome, note: string | null): void {
        this.outcome = outcome;
        this.note = note;
    }
}
