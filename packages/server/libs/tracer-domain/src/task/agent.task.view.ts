import { ViewColumn, ViewEntity } from "typeorm";
import type { MonitoringTaskKind, TaskOrigin, TaskStatus } from "@monitor/kernel";

/** 에이전트 실행 백엔드가 읽는 태스크 계약이며 사용자별 표시 상태를 함께 싣는다. */
@ViewEntity({
    name: "agent_task_view",
    expression: `
        SELECT
            t.id AS id,
            t.user_id AS user_id,
            t.title AS title,
            t.status AS status,
            t.task_kind AS task_kind,
            t.origin AS origin,
            t.workspace_path AS workspace_path,
            t.parent_task_id AS parent_task_id,
            t.created_at AS created_at,
            t.updated_at AS updated_at,
            t.last_event_at AS last_event_at,
            s.custom_title AS custom_title,
            s.archived_at AS archived_at,
            s.hidden_at AS hidden_at
        FROM tasks t
        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id
    `,
})
export class AgentTaskView {
    @ViewColumn()
    id!: string;

    @ViewColumn({ name: "user_id" })
    userId!: string;

    @ViewColumn()
    title!: string;

    @ViewColumn()
    status!: TaskStatus;

    @ViewColumn({ name: "task_kind" })
    taskKind!: MonitoringTaskKind;

    @ViewColumn()
    origin!: TaskOrigin;

    @ViewColumn({ name: "workspace_path" })
    workspacePath!: string | null;

    @ViewColumn({ name: "parent_task_id" })
    parentTaskId!: string | null;

    @ViewColumn({ name: "created_at" })
    createdAt!: Date;

    @ViewColumn({ name: "updated_at" })
    updatedAt!: Date;

    @ViewColumn({ name: "last_event_at" })
    lastEventAt!: Date | null;

    // 사용자가 붙인 제목이며 없으면 title이 표시 제목이다.
    @ViewColumn({ name: "custom_title" })
    customTitle!: string | null;

    // 보관과 숨김의 판단 기준은 읽는 쪽마다 다르므로 뷰는 표시만 싣고 거르지 않는다.
    @ViewColumn({ name: "archived_at" })
    archivedAt!: Date | null;

    @ViewColumn({ name: "hidden_at" })
    hiddenAt!: Date | null;
}
