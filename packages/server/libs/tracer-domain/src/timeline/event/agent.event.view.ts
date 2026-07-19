import { ViewColumn, ViewEntity } from "typeorm";
import type { EventKind } from "@monitor/kernel";

/** 에이전트 실행 백엔드가 읽는 이벤트 계약이며 노출한 열 밖은 읽히지 않는다. */
@ViewEntity({
    name: "agent_event_view",
    expression: `
        SELECT
            e.id AS id,
            e.seq AS seq,
            e.user_id AS user_id,
            e.task_id AS task_id,
            e.turn_id AS turn_id,
            e.kind AS kind,
            e.title AS title,
            e.body AS body,
            e.tool_name AS tool_name,
            e.file_paths AS file_paths,
            e.metadata AS metadata,
            e.occurred_at AS occurred_at
        FROM events e
    `,
})
export class AgentEventView {
    @ViewColumn()
    id!: string;

    // 페이지 커서로 쓰는 원장 BIGSERIAL이며 정수 범위를 넘을 수 있어 문자열로 건넨다.
    @ViewColumn()
    seq!: string;

    @ViewColumn({ name: "user_id" })
    userId!: string;

    @ViewColumn({ name: "task_id" })
    taskId!: string;

    @ViewColumn({ name: "turn_id" })
    turnId!: string | null;

    @ViewColumn()
    kind!: EventKind;

    @ViewColumn()
    title!: string;

    @ViewColumn()
    body!: string | null;

    @ViewColumn({ name: "tool_name" })
    toolName!: string | null;

    @ViewColumn({ name: "file_paths" })
    filePaths!: string[];

    @ViewColumn()
    metadata!: Record<string, unknown>;

    @ViewColumn({ name: "occurred_at" })
    occurredAt!: Date;
}
