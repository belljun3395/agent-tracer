import type { TagId, TaskId } from "~web/shared/identity.js";

export interface TagRecord {
  readonly id: TagId;
  readonly userId: string;
  /** `#rrggbb` 소문자 여섯 자리다. */
  readonly color: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 태그 목록 화면은 그 태그가 몇 개의 태스크에 붙어 있는지를 함께 읽는다. */
export interface TagSummaryRecord extends TagRecord {
  readonly taskCount: number;
}

export interface TagsListResponse {
  readonly tags: readonly TagSummaryRecord[];
}

export interface TaskTagsRecord {
  readonly taskId: TaskId;
  readonly tags: readonly TagRecord[];
}

export interface TasksByTagRecord {
  readonly tagId: TagId;
  readonly taskIds: readonly TaskId[];
}

export interface TagCreateInput {
  readonly name: string;
  readonly color?: string;
  readonly description?: string | null;
}

export interface TagUpdateInput {
  readonly name?: string;
  readonly color?: string;
  readonly description?: string | null;
}
