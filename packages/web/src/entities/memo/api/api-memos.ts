import type { EventId, TaskId } from "~web/shared/identity.js";
import type {
  MemoCreateInput,
  MemoRecord,
  MemosListResponse,
  MemoUpdateInput,
} from "~web/entities/memo/model/memo.js";
import type { MemoDto } from "@monitor/kernel";
import { deleteRequest, getJson, patchJson, postJson } from "~web/shared/api/client/json-methods.js";
import { toMemoRecord } from "~web/entities/memo/api/memo.mapper.js";

export async function fetchMemos(): Promise<MemosListResponse> {
  const res = await getJson<{ readonly items: readonly MemoDto[] }>("/api/v1/memos");
  return { memos: res.items.map(toMemoRecord) };
}

export async function fetchTaskMemos(taskId: TaskId): Promise<MemosListResponse> {
  const res = await getJson<{ readonly items: readonly MemoDto[] }>(
    `/api/v1/memos?taskId=${taskId}`,
  );
  return { memos: res.items.map(toMemoRecord) };
}

export async function fetchEventMemos(
  taskId: TaskId,
  eventId: EventId,
): Promise<MemosListResponse> {
  const res = await getJson<{ readonly items: readonly MemoDto[] }>(
    `/api/v1/memos?taskId=${taskId}&eventId=${eventId}`,
  );
  return { memos: res.items.map(toMemoRecord) };
}

export interface CreateMemoResponse {
  readonly memo: MemoRecord;
}

export function createMemo(body: MemoCreateInput): Promise<CreateMemoResponse> {
  return postJson<CreateMemoResponse>("/api/v1/memos", body);
}

export interface UpdateMemoResponse {
  readonly memo: MemoRecord;
}

export function updateMemo(
  memoId: string,
  body: MemoUpdateInput,
): Promise<UpdateMemoResponse> {
  return patchJson<UpdateMemoResponse>(`/api/v1/memos/${memoId}`, body);
}

export interface DeleteMemoResponse {
  readonly deleted: boolean;
}

export function deleteMemo(memoId: string): Promise<DeleteMemoResponse> {
  return deleteRequest<DeleteMemoResponse>(`/api/v1/memos/${memoId}`);
}
