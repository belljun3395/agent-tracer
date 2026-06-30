import { COMPLETED_TASK_STATUS } from "@monitor/shared/task/task.status.const.js";
import type { TaskStatus } from "@monitor/shared/task/task.status.const.js";

export function shouldApplyLoggedEventTaskStatusEffect(input: {
    readonly currentStatus: TaskStatus;
    readonly desiredStatus: TaskStatus;
}): boolean {
    // 완료된 태스크는 이벤트 효과로 되돌리지 않고, 실제 상태가 달라질 때만 갱신한다.
    return input.desiredStatus !== input.currentStatus &&
        input.currentStatus !== COMPLETED_TASK_STATUS;
}
