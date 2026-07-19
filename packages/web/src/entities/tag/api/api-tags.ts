import { TAGS_PATH, TASK_TAGS_PATH } from "@monitor/kernel";
import type { TagDto, TagSummaryDto } from "@monitor/kernel";
import type { TagId, TaskId } from "~web/shared/identity.js";
import type {
  TagCreateInput,
  TagRecord,
  TagsListResponse,
  TagUpdateInput,
  TasksByTagRecord,
  TaskTagsRecord,
} from "~web/entities/tag/model/tag.js";
import {
  deleteRequest,
  getJson,
  patchJson,
  patchPut,
  postJson,
} from "~web/shared/api/client/json-methods.js";
import { toTagRecord, toTagSummaryRecord } from "~web/entities/tag/api/tag.mapper.js";

export async function fetchTags(): Promise<TagsListResponse> {
  const res = await getJson<{ readonly items: readonly TagSummaryDto[] }>(TAGS_PATH);
  return { tags: res.items.map(toTagSummaryRecord) };
}

export interface CreateTagResponse {
  readonly tag: TagRecord;
}

export async function createTag(body: TagCreateInput): Promise<CreateTagResponse> {
  const res = await postJson<{ readonly tag: TagDto }>(TAGS_PATH, body);
  return { tag: toTagRecord(res.tag) };
}

export interface UpdateTagResponse {
  readonly tag: TagRecord;
}

export async function updateTag(
  tagId: TagId,
  body: TagUpdateInput,
): Promise<UpdateTagResponse> {
  const res = await patchJson<{ readonly tag: TagDto }>(`${TAGS_PATH}/${tagId}`, body);
  return { tag: toTagRecord(res.tag) };
}

export interface DeleteTagResponse {
  readonly deleted: boolean;
}

export function deleteTag(tagId: TagId): Promise<DeleteTagResponse> {
  return deleteRequest<DeleteTagResponse>(`${TAGS_PATH}/${tagId}`);
}

export async function fetchTaskTags(taskId: TaskId): Promise<TaskTagsRecord> {
  const dto = await getJson<{ readonly taskId: string; readonly tags: readonly TagDto[] }>(
    `${TASK_TAGS_PATH}?taskId=${taskId}`,
  );
  return {
    taskId: dto.taskId as TaskId,
    tags: dto.tags.map(toTagRecord),
  };
}

export async function fetchTasksByTag(tagId: TagId): Promise<TasksByTagRecord> {
  const dto = await getJson<{ readonly tagId: string; readonly taskIds: readonly string[] }>(
    `${TASK_TAGS_PATH}?tagId=${tagId}`,
  );
  return {
    tagId: dto.tagId as TagId,
    taskIds: dto.taskIds as readonly TaskId[],
  };
}

export async function setTaskTags(
  taskId: TaskId,
  tagIds: readonly TagId[],
): Promise<TaskTagsRecord> {
  const dto = await patchPut<{ readonly taskId: string; readonly tags: readonly TagDto[] }>(
    TASK_TAGS_PATH,
    { taskId, tagIds },
  );
  return {
    taskId: dto.taskId as TaskId,
    tags: dto.tags.map(toTagRecord),
  };
}
