/**
 * @module application/ports/bookmark-repository
 *
 * 북마크 저장소 포트.
 */

export interface BookmarkRecord {
  readonly id: string;
  readonly kind: "task" | "event";
  readonly taskId: string;
  readonly eventId?: string;
  readonly title: string;
  readonly note?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly taskTitle?: string;
  readonly eventTitle?: string;
}

export interface BookmarkSaveInput {
  readonly id: string;
  readonly taskId: string;
  readonly eventId?: string;
  readonly kind: "task" | "event";
  readonly title: string;
  readonly note?: string;
  readonly metadata: Record<string, unknown>;
}

export interface IBookmarkRepository {
  save(input: BookmarkSaveInput): Promise<BookmarkRecord>;
  findByTaskId(taskId: string): Promise<readonly BookmarkRecord[]>;
  findAll(): Promise<readonly BookmarkRecord[]>;
  delete(bookmarkId: string): Promise<void>;
}
