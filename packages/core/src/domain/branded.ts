type Brand<T, B extends string> = T & {
    readonly __brand: B;
};
type StringBrand<B extends string> = Brand<string, B>;

abstract class StringValueObject<B extends string> {
    protected constructor(private readonly raw: StringBrand<B>) {
    }

    toString(): string {
        return this.raw;
    }
}

/**
 * Casts a validated string into a branded string type without changing content.
 */
function brandString<B extends string>(value: string): StringBrand<B> {
    return value as StringBrand<B>;
}

/**
 * Guards parsing helpers by accepting only non-empty strings.
 */
function hasText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Centralizes trimming so identifier factories stay consistent.
 */
function trimValue(value: string): string {
    return value.trim();
}

/**
 * Converts a task title into a URL-safe slug with a bounded length.
 */
function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}

/**
 * Cleans workspace paths by collapsing repeated separators and trimming a tailing slash.
 */
function normalizeWorkspacePathValue(value: string): string {
    const normalized = value.trim().replace(/\/+/g, "/");
    return normalized.endsWith("/") && normalized !== "/"
        ? normalized.slice(0, -1)
        : normalized;
}

export type TaskId = StringBrand<"TaskId">;
export type SessionId = StringBrand<"SessionId">;
export type EventId = StringBrand<"EventId">;
export type BookmarkId = StringBrand<"BookmarkId">;
export type QuestionId = StringBrand<"QuestionId">;
export type TodoId = StringBrand<"TodoId">;
export type RuntimeSessionId = StringBrand<"RuntimeSessionId">;
export type RuntimeSource = StringBrand<"RuntimeSource">;
export type WorkspacePath = StringBrand<"WorkspacePath">;
export type TaskSlug = StringBrand<"TaskSlug">;
export type RuleId = StringBrand<"RuleId">;
export type ActionName = StringBrand<"ActionName">;
export type ToolName = StringBrand<"ToolName">;
export type ModelName = StringBrand<"ModelName">;
export type ModelProvider = StringBrand<"ModelProvider">;
export type MessageId = StringBrand<"MessageId">;
export type AsyncTaskId = StringBrand<"AsyncTaskId">;
export type WorkItemId = StringBrand<"WorkItemId">;
export type GoalId = StringBrand<"GoalId">;
export type PlanId = StringBrand<"PlanId">;
export type HandoffId = StringBrand<"HandoffId">;

export class TaskIdValue extends StringValueObject<"TaskId"> {
    static create(value: string): TaskId {
        return brandString<"TaskId">(value);
    }

    static parse(value: unknown): TaskId | undefined {
        return hasText(value) ? TaskIdValue.create(value) : undefined;
    }
}

export class SessionIdValue extends StringValueObject<"SessionId"> {
    static create(value: string): SessionId {
        return brandString<"SessionId">(value);
    }

    static parse(value: unknown): SessionId | undefined {
        return hasText(value) ? SessionIdValue.create(value) : undefined;
    }
}

export class EventIdValue extends StringValueObject<"EventId"> {
    static create(value: string): EventId {
        return brandString<"EventId">(value);
    }

    static parse(value: unknown): EventId | undefined {
        return hasText(value) ? EventIdValue.create(value) : undefined;
    }
}

export class BookmarkIdValue extends StringValueObject<"BookmarkId"> {
    static create(value: string): BookmarkId {
        return brandString<"BookmarkId">(value);
    }

    static parse(value: unknown): BookmarkId | undefined {
        return hasText(value) ? BookmarkIdValue.create(value) : undefined;
    }
}

export class QuestionIdValue extends StringValueObject<"QuestionId"> {
    static create(value: string): QuestionId {
        return brandString<"QuestionId">(value);
    }

    static parse(value: unknown): QuestionId | undefined {
        return hasText(value) ? QuestionIdValue.create(value) : undefined;
    }
}

export class TodoIdValue extends StringValueObject<"TodoId"> {
    static create(value: string): TodoId {
        return brandString<"TodoId">(value);
    }

    static parse(value: unknown): TodoId | undefined {
        return hasText(value) ? TodoIdValue.create(value) : undefined;
    }
}

export class RuntimeSessionIdValue extends StringValueObject<"RuntimeSessionId"> {
    static create(value: string): RuntimeSessionId {
        return brandString<"RuntimeSessionId">(value);
    }

    static parse(value: unknown): RuntimeSessionId | undefined {
        return hasText(value) ? RuntimeSessionIdValue.create(value) : undefined;
    }
}

export class RuntimeSourceValue extends StringValueObject<"RuntimeSource"> {
    static create(value: string): RuntimeSource {
        return brandString<"RuntimeSource">(trimValue(value));
    }

    static parse(value: unknown): RuntimeSource | undefined {
        return hasText(value) ? RuntimeSourceValue.create(value) : undefined;
    }
}

export class WorkspacePathValue extends StringValueObject<"WorkspacePath"> {
    static create(value: string): WorkspacePath {
        return brandString<"WorkspacePath">(normalizeWorkspacePathValue(value));
    }

    static parse(value: unknown): WorkspacePath | undefined {
        return hasText(value) ? WorkspacePathValue.create(value) : undefined;
    }
}

export class TaskSlugValue extends StringValueObject<"TaskSlug"> {
    static create(value: string): TaskSlug {
        return brandString<"TaskSlug">(slugify(value));
    }

    static parse(value: unknown): TaskSlug | undefined {
        return hasText(value) ? TaskSlugValue.create(value) : undefined;
    }
}

/**
 * Reuses trim-before-brand logic for identifiers that should preserve original casing.
 */
function createTrimmedBrand<B extends string>(value: string): StringBrand<B> {
    return brandString<B>(trimValue(value));
}

export class RuleIdValue extends StringValueObject<"RuleId"> {
    static create(value: string): RuleId {
        return createTrimmedBrand<"RuleId">(value);
    }

    static parse(value: unknown): RuleId | undefined {
        return hasText(value) ? RuleIdValue.create(value) : undefined;
    }
}

export class ActionNameValue extends StringValueObject<"ActionName"> {
    static create(value: string): ActionName {
        return createTrimmedBrand<"ActionName">(value);
    }

    static parse(value: unknown): ActionName | undefined {
        return hasText(value) ? ActionNameValue.create(value) : undefined;
    }
}

export class ToolNameValue extends StringValueObject<"ToolName"> {
    static create(value: string): ToolName {
        return createTrimmedBrand<"ToolName">(value);
    }

    static parse(value: unknown): ToolName | undefined {
        return hasText(value) ? ToolNameValue.create(value) : undefined;
    }
}

export class ModelNameValue extends StringValueObject<"ModelName"> {
    static create(value: string): ModelName {
        return createTrimmedBrand<"ModelName">(value);
    }

    static parse(value: unknown): ModelName | undefined {
        return hasText(value) ? ModelNameValue.create(value) : undefined;
    }
}

export class ModelProviderValue extends StringValueObject<"ModelProvider"> {
    static create(value: string): ModelProvider {
        return createTrimmedBrand<"ModelProvider">(value);
    }

    static parse(value: unknown): ModelProvider | undefined {
        return hasText(value) ? ModelProviderValue.create(value) : undefined;
    }
}

export class MessageIdValue extends StringValueObject<"MessageId"> {
    static create(value: string): MessageId {
        return createTrimmedBrand<"MessageId">(value);
    }

    static parse(value: unknown): MessageId | undefined {
        return hasText(value) ? MessageIdValue.create(value) : undefined;
    }
}

export class AsyncTaskIdValue extends StringValueObject<"AsyncTaskId"> {
    static create(value: string): AsyncTaskId {
        return createTrimmedBrand<"AsyncTaskId">(value);
    }

    static parse(value: unknown): AsyncTaskId | undefined {
        return hasText(value) ? AsyncTaskIdValue.create(value) : undefined;
    }
}

export class WorkItemIdValue extends StringValueObject<"WorkItemId"> {
    static create(value: string): WorkItemId {
        return createTrimmedBrand<"WorkItemId">(value);
    }

    static parse(value: unknown): WorkItemId | undefined {
        return hasText(value) ? WorkItemIdValue.create(value) : undefined;
    }
}

export class GoalIdValue extends StringValueObject<"GoalId"> {
    static create(value: string): GoalId {
        return createTrimmedBrand<"GoalId">(value);
    }

    static parse(value: unknown): GoalId | undefined {
        return hasText(value) ? GoalIdValue.create(value) : undefined;
    }
}

export class PlanIdValue extends StringValueObject<"PlanId"> {
    static create(value: string): PlanId {
        return createTrimmedBrand<"PlanId">(value);
    }

    static parse(value: unknown): PlanId | undefined {
        return hasText(value) ? PlanIdValue.create(value) : undefined;
    }
}

export class HandoffIdValue extends StringValueObject<"HandoffId"> {
    static create(value: string): HandoffId {
        return createTrimmedBrand<"HandoffId">(value);
    }

    static parse(value: unknown): HandoffId | undefined {
        return hasText(value) ? HandoffIdValue.create(value) : undefined;
    }
}

export const TaskId = (s: string): TaskId => TaskIdValue.create(s);
export const SessionId = (s: string): SessionId => SessionIdValue.create(s);
export const EventId = (s: string): EventId => EventIdValue.create(s);
export const BookmarkId = (s: string): BookmarkId => BookmarkIdValue.create(s);
export const QuestionId = (s: string): QuestionId => QuestionIdValue.create(s);
export const TodoId = (s: string): TodoId => TodoIdValue.create(s);
export const RuntimeSessionId = (s: string): RuntimeSessionId => RuntimeSessionIdValue.create(s);
export const RuntimeSource = (s: string): RuntimeSource => RuntimeSourceValue.create(s);
export const WorkspacePath = (s: string): WorkspacePath => WorkspacePathValue.create(s);
export const TaskSlug = (s: string): TaskSlug => TaskSlugValue.create(s);
export const RuleId = (s: string): RuleId => RuleIdValue.create(s);
export const ActionName = (s: string): ActionName => ActionNameValue.create(s);
export const ToolName = (s: string): ToolName => ToolNameValue.create(s);
export const ModelName = (s: string): ModelName => ModelNameValue.create(s);
export const ModelProvider = (s: string): ModelProvider => ModelProviderValue.create(s);
export const MessageId = (s: string): MessageId => MessageIdValue.create(s);
export const AsyncTaskId = (s: string): AsyncTaskId => AsyncTaskIdValue.create(s);
export const WorkItemId = (s: string): WorkItemId => WorkItemIdValue.create(s);
export const GoalId = (s: string): GoalId => GoalIdValue.create(s);
export const PlanId = (s: string): PlanId => PlanIdValue.create(s);
export const HandoffId = (s: string): HandoffId => HandoffIdValue.create(s);
