import {
    MONITORING_TASK_KIND,
    RUNNING_TASK_STATUS,
    SERVER_SDK_TASK_ORIGIN,
    isActiveTaskStatus,
    isTerminalTaskStatus,
} from "@monitor/run-api/task/common/task.status.const.js";
import type { MonitoringTaskKind, TaskOrigin, TaskStatus } from "@monitor/run-api/task/common/task.status.const.js";

// status/taskKind/origin만 보고 판단하는 태스크 도메인 술어. 엔티티든 스냅샷이든 같은 규칙을 쓴다.
interface TaskJudgment {
    readonly status: TaskStatus;
    readonly taskKind?: MonitoringTaskKind | undefined;
    readonly origin?: TaskOrigin | undefined;
}

export function isTaskRunning(task: TaskJudgment): boolean {
    return task.status === RUNNING_TASK_STATUS;
}

export function isTaskActive(task: TaskJudgment): boolean {
    return isActiveTaskStatus(task.status);
}

export function isTaskTerminal(task: TaskJudgment): boolean {
    return isTerminalTaskStatus(task.status);
}

export function isBackgroundTask(task: TaskJudgment): boolean {
    return task.taskKind === MONITORING_TASK_KIND.background;
}

export function isPrimaryTask(task: TaskJudgment): boolean {
    return task.taskKind === MONITORING_TASK_KIND.primary;
}

// 아직 실행 중인 백그라운드 태스크 — 세션 종료 시 cascade 완료 대상.
export function isRunningBackgroundTask(task: TaskJudgment): boolean {
    return isBackgroundTask(task) && isTaskRunning(task);
}

// 아직 실행 중인 server-sdk 태스크 — reaper가 멈춘 태스크로 회수하는 대상.
export function isRunningServerSdkTask(task: TaskJudgment): boolean {
    return task.origin === SERVER_SDK_TASK_ORIGIN && isTaskRunning(task);
}
