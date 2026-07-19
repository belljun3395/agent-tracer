import type { TaskId } from "~web/shared/identity.js";
import type { UpdateTaskInput, UpdateTaskResult } from "~web/entities/task/model/task.js";
import {
  deleteRequest,
  patchJson,
  postJson,
} from "~web/shared/api/client/json-methods.js";

export interface DeleteTaskResponse {
  readonly taskId: TaskId;
  readonly hidden: true;
  /** 요청된 태스크와 함께 숨겨진 서브에이전트 자손까지 전부다. */
  readonly hiddenTaskIds: readonly TaskId[];
}

export function deleteTask(taskId: TaskId): Promise<DeleteTaskResponse> {
  return deleteRequest<DeleteTaskResponse>(`/api/v1/tasks/${taskId}`);
}

export interface ArchiveTaskResponse {
  readonly taskId: TaskId;
  readonly archived: true;
}

export interface UnarchiveTaskResponse {
  readonly taskId: TaskId;
  readonly archived: false;
}

export function archiveTask(taskId: TaskId): Promise<ArchiveTaskResponse> {
  return postJson<ArchiveTaskResponse>(`/api/v1/tasks/${taskId}/archive`);
}

export function unarchiveTask(taskId: TaskId): Promise<UnarchiveTaskResponse> {
  return deleteRequest<UnarchiveTaskResponse>(
    `/api/v1/tasks/${taskId}/archive`,
  );
}

export function updateTask(
  taskId: TaskId,
  body: UpdateTaskInput,
): Promise<UpdateTaskResult> {
  return patchJson<UpdateTaskResult>(`/api/v1/tasks/${taskId}`, body);
}
