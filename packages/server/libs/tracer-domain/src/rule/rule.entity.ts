import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { InvariantViolationError } from "../error/invariant.error.js";
import {
    RULE_REVIEW_STATE,
    RULE_SCOPE,
    type RuleExpectation,
    type RuleReviewState,
    type RuleScope,
    type RuleSeverity,
    RULE_SOURCE,
    type RuleSource,
    type RuleTrigger,
    isAnchoredRule,
} from "@monitor/kernel";

@Entity({ name: "rules" })
@Index("rules_user_scope", ["userId", "scope"])
@Index("rules_signature", ["userId", "signature"])
@Index("rules_anchor_event", ["anchorEventId"])
@Index("rules_live_user_scope", ["userId", "scope"], {
    where: "\"review_state\" = 'active' AND \"deleted_at\" IS NULL",
})
export class RuleEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "jsonb", default: {} })
    trigger!: RuleTrigger;

    @Column({ type: "jsonb", default: {} })
    expectation!: RuleExpectation;

    @Column({ type: "text" })
    scope!: RuleScope;

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ type: "text" })
    source!: RuleSource;

    @Column({ type: "text" })
    severity!: RuleSeverity;

    @Column({ type: "text", nullable: true })
    rationale!: string | null;

    @Column({ type: "text" })
    signature!: string;

    @Column({ name: "user_edited", type: "boolean", default: false })
    userEdited!: boolean;

    // 승인 대기 규칙은 판정기와 가드레일이 로드하지 않으며, 사람이 승인해야 발효한다.
    @Column({ name: "review_state", type: "text", default: RULE_REVIEW_STATE.active })
    reviewState!: RuleReviewState;

    @Column({ name: "last_edited_by", type: "text", default: RULE_SOURCE.agent })
    lastEditedBy!: RuleSource;

    @Column({ type: "integer", default: 1 })
    rev!: number;

    @Column({ name: "source_job_id", type: "text", nullable: true })
    sourceJobId!: string | null;

    // 규칙의 근거가 된 사용자 입력이며, 이 이벤트가 곧 트리거이므로 문구 재발화를 요구하지 않고 판정 창은 이 입력부터 시작한다.
    @Column({ name: "anchor_event_id", type: "text", nullable: true })
    anchorEventId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;

    promote(): void {
        // 이미 전역 규칙은 승격할 수 없다.
        if (this.scope === RULE_SCOPE.global) throw new InvariantViolationError("rule.already-global");
        this.scope = RULE_SCOPE.global;
        this.taskId = null;
    }

    demote(taskId: string): void {
        this.scope = RULE_SCOPE.task;
        this.taskId = taskId;
    }

    initializeProvenance(source: RuleSource): void {
        this.rev = 1;
        if (source === RULE_SOURCE.human) {
            this.userEdited = true;
            this.lastEditedBy = RULE_SOURCE.human;
            return;
        }
        this.userEdited = false;
        this.lastEditedBy = RULE_SOURCE.agent;
    }

    markEditedByUser(): void {
        this.rev += 1;
        this.userEdited = true;
        this.lastEditedBy = RULE_SOURCE.human;
    }

    softDelete(now: Date): void {
        this.deletedAt = now;
    }

    isDeleted(): boolean {
        return this.deletedAt !== null;
    }

    // 판정기·가드레일이 로드하는 것은 발효된 규칙뿐이다.
    isActive(): boolean {
        return this.reviewState === RULE_REVIEW_STATE.active;
    }

    // anchor된 규칙은 근거 입력 이후를 통째로 판정 창으로 써 다음 턴의 이행도 인정하며, anchor가 없는 규칙만 트리거 문구가 그 턴에 발화됐는지를 본다.
    isAnchored(): boolean {
        return isAnchoredRule(this);
    }

    needsReview(): boolean {
        return this.reviewState === RULE_REVIEW_STATE.pendingReview;
    }

    // 사람이 승인해야 block 규칙이 발효한다.
    approve(): void {
        if (!this.needsReview()) throw new InvariantViolationError("rule.not-pending-review");
        this.reviewState = RULE_REVIEW_STATE.active;
    }
}
