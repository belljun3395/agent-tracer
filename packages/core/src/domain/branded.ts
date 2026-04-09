type Brand<T, B extends string> = T & {
    readonly __brand: B;
};
export type TaskId = Brand<string, "TaskId">;
export type SessionId = Brand<string, "SessionId">;
export type EventId = Brand<string, "EventId">;
export type BookmarkId = Brand<string, "BookmarkId">;
export type QuestionId = Brand<string, "QuestionId">;
export type TodoId = Brand<string, "TodoId">;
export const TaskId = (s: string): TaskId => s as TaskId;
export const SessionId = (s: string): SessionId => s as SessionId;
export const EventId = (s: string): EventId => s as EventId;
export const BookmarkId = (s: string): BookmarkId => s as BookmarkId;
export const QuestionId = (s: string): QuestionId => s as QuestionId;
export const TodoId = (s: string): TodoId => s as TodoId;
