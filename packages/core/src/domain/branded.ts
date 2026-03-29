/**
 * Branded / opaque ID types for compile-time safety.
 *
 * These types are structurally identical to `string` at runtime — the
 * `__brand` property exists only in the type system.  Existing code that
 * passes plain strings will continue to work; the constructors below let
 * new code be explicit about which kind of ID it is constructing.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

// ── ID types ─────────────────────────────────────────────────────────────────

export type TaskId = Brand<string, "TaskId">;
export type SessionId = Brand<string, "SessionId">;
export type EventId = Brand<string, "EventId">;
export type BookmarkId = Brand<string, "BookmarkId">;
export type QuestionId = Brand<string, "QuestionId">;
export type TodoId = Brand<string, "TodoId">;

// ── Constructor helpers ───────────────────────────────────────────────────────

/** Cast a plain string to a `TaskId`. */
export const TaskId = (s: string): TaskId => s as TaskId;

/** Cast a plain string to a `SessionId`. */
export const SessionId = (s: string): SessionId => s as SessionId;

/** Cast a plain string to an `EventId`. */
export const EventId = (s: string): EventId => s as EventId;

/** Cast a plain string to a `BookmarkId`. */
export const BookmarkId = (s: string): BookmarkId => s as BookmarkId;

/** Cast a plain string to a `QuestionId`. */
export const QuestionId = (s: string): QuestionId => s as QuestionId;

/** Cast a plain string to a `TodoId`. */
export const TodoId = (s: string): TodoId => s as TodoId;
