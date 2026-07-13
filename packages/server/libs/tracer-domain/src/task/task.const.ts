import { COMPLETED_TASK_STATUS, USER_TASK_ORIGIN, type TaskOrigin, type TaskStatus } from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";

// 목록 표시용 직렬화 형태는 공유 계약에서 온다(web과 동일 타입).
export type { TaskListItemDto } from "@monitor/kernel";

export const SESSION_STATUS = {
    active: "active",
    ended: "ended",
} as const;

export const SESSION_STATUSES = [SESSION_STATUS.active, SESSION_STATUS.ended] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

// (updated_at, id) 키셋 튜플이며, updated_at 단일 컬럼 커서가 같은 시각에 몰린 행 경계에서 건너뛰는 것을 id를 동률 결정자로 더해 막는다.
export interface TaskPageCursor {
    readonly updatedAt: string;
    readonly id: string;
}

// 목록 조회 필터이며, cursor는 (updated_at DESC, id DESC) 순서의 키셋 튜플로 다음 페이지를 자른다.
export interface TaskPageFilter {
    readonly status?: TaskStatus;
    readonly origin?: TaskOrigin;
    readonly archived?: boolean;
    readonly rootOnly?: boolean;
    readonly parentTaskId?: string;
    readonly cursor?: TaskPageCursor;
    readonly limit: number;
}

const CURSOR_DELIMITER = "|";

// TaskPageCursor를 API 밖으로 노출하는 불투명 문자열로 직렬화한다.
export function encodeTaskPageCursor(cursor: TaskPageCursor): string {
    return `${cursor.updatedAt}${CURSOR_DELIMITER}${cursor.id}`;
}

// encodeTaskPageCursor의 역변환이며, 형식이 어긋나면 불변식 위반으로 취급한다.
export function decodeTaskPageCursor(raw: string): TaskPageCursor {
    const delimiterIndex = raw.indexOf(CURSOR_DELIMITER);
    if (delimiterIndex === -1) throw new InvariantViolationError("task.invalid-page-cursor", 400);
    return {
        updatedAt: raw.slice(0, delimiterIndex),
        id: raw.slice(delimiterIndex + 1),
    };
}

// 작업이 레시피 스캔 앵커가 될 조건의 SQL 표현이며, archived는 호출자가 따로 정한다(보관된 작업도 앵커가 될 수 있다).
export const RECIPE_SCAN_ANCHOR_FILTER = {
    origin: USER_TASK_ORIGIN,
    status: COMPLETED_TASK_STATUS,
    rootOnly: true,
} as const satisfies Omit<TaskPageFilter, "limit">;

