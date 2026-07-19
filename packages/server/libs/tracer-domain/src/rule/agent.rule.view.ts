import { ViewColumn, ViewEntity } from "typeorm";
import type { RuleExpectation, RuleSeverity, RuleSource } from "@monitor/kernel";

/** 에이전트 실행 백엔드가 읽는 규칙 계약이며 살아 있는 규칙만 담는다. */
@ViewEntity({
    name: "agent_rule_view",
    expression: `
        SELECT
            r.id AS id,
            r.user_id AS user_id,
            r.task_id AS task_id,
            r.name AS name,
            r.expectation AS expectation,
            r.anchor_event_id AS anchor_event_id,
            r.source AS source,
            r.severity AS severity,
            r.rationale AS rationale,
            r.signature AS signature,
            r.created_at AS created_at
        FROM rules r
        WHERE r.review_state = 'active' AND r.deleted_at IS NULL
    `,
})
export class AgentRuleView {
    @ViewColumn()
    id!: string;

    @ViewColumn({ name: "user_id" })
    userId!: string;

    @ViewColumn({ name: "task_id" })
    taskId!: string;

    @ViewColumn()
    name!: string;

    @ViewColumn()
    expectation!: RuleExpectation;

    @ViewColumn({ name: "anchor_event_id" })
    anchorEventId!: string;

    @ViewColumn()
    source!: RuleSource;

    @ViewColumn()
    severity!: RuleSeverity;

    @ViewColumn()
    rationale!: string | null;

    @ViewColumn()
    signature!: string;

    @ViewColumn({ name: "created_at" })
    createdAt!: Date;
}
