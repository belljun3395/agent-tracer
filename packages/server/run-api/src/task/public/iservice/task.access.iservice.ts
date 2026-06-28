import type { MonitoringTask } from "../types/task.types.js";
import type { TaskStatus, TaskUpsertInput } from "../dto/task.snapshot.dto.js";

// 발행 모델로 도메인 MonitoringTask를 직접 노출한다(TaskSnapshot twin·as 캐스트 제거).
// 소비자(session·turn)는 모두 run-api 내부라 패키지 경계를 넘지 않는다.
export interface ITaskAccess {
    findById(id: string): Promise<MonitoringTask | null>;
    findChildren(parentId: string): Promise<readonly MonitoringTask[]>;
    upsert(input: TaskUpsertInput): Promise<MonitoringTask>;
    updateStatus(id: string, status: TaskStatus, updatedAt: string): Promise<void>;
}
