type Brand<T, B extends string> = T & {
    readonly __brand: B;
};
type StringBrand<B extends string> = Brand<string, B>;
abstract class StringValueObject<B extends string> {
    protected constructor(private readonly raw: StringBrand<B>) { }
    get value(): StringBrand<B> {
        return this.raw;
    }
    toString(): string {
        return this.raw;
    }
    toJSON(): string {
        return this.raw;
    }
    equals(other: StringValueObject<B> | StringBrand<B> | string | null | undefined): boolean {
        if (other === undefined || other === null) {
            return false;
        }
        return this.raw === (typeof other === "string" ? other : other.value);
    }
}
function brandString<B extends string>(value: string): StringBrand<B> {
    return value as StringBrand<B>;
}
function hasText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
function trimValue(value: string): string {
    return value.trim();
}
function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}
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
    private constructor(value: TaskId) {
        super(value);
    }
    static create(value: string): TaskId {
        return brandString<"TaskId">(value);
    }
    static parse(value: unknown): TaskId | undefined {
        return hasText(value) ? TaskIdValue.create(value) : undefined;
    }
    static wrap(value: TaskId): TaskIdValue {
        return new TaskIdValue(value);
    }
}
export class SessionIdValue extends StringValueObject<"SessionId"> {
    private constructor(value: SessionId) {
        super(value);
    }
    static create(value: string): SessionId {
        return brandString<"SessionId">(value);
    }
    static parse(value: unknown): SessionId | undefined {
        return hasText(value) ? SessionIdValue.create(value) : undefined;
    }
    static wrap(value: SessionId): SessionIdValue {
        return new SessionIdValue(value);
    }
}
export class EventIdValue extends StringValueObject<"EventId"> {
    private constructor(value: EventId) {
        super(value);
    }
    static create(value: string): EventId {
        return brandString<"EventId">(value);
    }
    static parse(value: unknown): EventId | undefined {
        return hasText(value) ? EventIdValue.create(value) : undefined;
    }
    static wrap(value: EventId): EventIdValue {
        return new EventIdValue(value);
    }
}
export class BookmarkIdValue extends StringValueObject<"BookmarkId"> {
    private constructor(value: BookmarkId) {
        super(value);
    }
    static create(value: string): BookmarkId {
        return brandString<"BookmarkId">(value);
    }
    static parse(value: unknown): BookmarkId | undefined {
        return hasText(value) ? BookmarkIdValue.create(value) : undefined;
    }
    static wrap(value: BookmarkId): BookmarkIdValue {
        return new BookmarkIdValue(value);
    }
}
export class QuestionIdValue extends StringValueObject<"QuestionId"> {
    private constructor(value: QuestionId) {
        super(value);
    }
    static create(value: string): QuestionId {
        return brandString<"QuestionId">(value);
    }
    static parse(value: unknown): QuestionId | undefined {
        return hasText(value) ? QuestionIdValue.create(value) : undefined;
    }
    static wrap(value: QuestionId): QuestionIdValue {
        return new QuestionIdValue(value);
    }
}
export class TodoIdValue extends StringValueObject<"TodoId"> {
    private constructor(value: TodoId) {
        super(value);
    }
    static create(value: string): TodoId {
        return brandString<"TodoId">(value);
    }
    static parse(value: unknown): TodoId | undefined {
        return hasText(value) ? TodoIdValue.create(value) : undefined;
    }
    static wrap(value: TodoId): TodoIdValue {
        return new TodoIdValue(value);
    }
}
export class RuntimeSessionIdValue extends StringValueObject<"RuntimeSessionId"> {
    private constructor(value: RuntimeSessionId) {
        super(value);
    }
    static create(value: string): RuntimeSessionId {
        return brandString<"RuntimeSessionId">(value);
    }
    static parse(value: unknown): RuntimeSessionId | undefined {
        return hasText(value) ? RuntimeSessionIdValue.create(value) : undefined;
    }
    static wrap(value: RuntimeSessionId): RuntimeSessionIdValue {
        return new RuntimeSessionIdValue(value);
    }
}
export class RuntimeSourceValue extends StringValueObject<"RuntimeSource"> {
    private constructor(value: RuntimeSource) {
        super(value);
    }
    static create(value: string): RuntimeSource {
        return brandString<"RuntimeSource">(trimValue(value));
    }
    static parse(value: unknown): RuntimeSource | undefined {
        return hasText(value) ? RuntimeSourceValue.create(value) : undefined;
    }
    static wrap(value: RuntimeSource): RuntimeSourceValue {
        return new RuntimeSourceValue(value);
    }
}
export class WorkspacePathValue extends StringValueObject<"WorkspacePath"> {
    private constructor(value: WorkspacePath) {
        super(value);
    }
    static create(value: string): WorkspacePath {
        return brandString<"WorkspacePath">(normalizeWorkspacePathValue(value));
    }
    static parse(value: unknown): WorkspacePath | undefined {
        return hasText(value) ? WorkspacePathValue.create(value) : undefined;
    }
    static wrap(value: WorkspacePath): WorkspacePathValue {
        return new WorkspacePathValue(value);
    }
}
export class TaskSlugValue extends StringValueObject<"TaskSlug"> {
    private constructor(value: TaskSlug) {
        super(value);
    }
    static create(value: string): TaskSlug {
        return brandString<"TaskSlug">(slugify(value));
    }
    static fromTitle(value: string): TaskSlug {
        return TaskSlugValue.create(value);
    }
    static parse(value: unknown): TaskSlug | undefined {
        return hasText(value) ? TaskSlugValue.create(value) : undefined;
    }
    static wrap(value: TaskSlug): TaskSlugValue {
        return new TaskSlugValue(value);
    }
}
function createTrimmedBrand<B extends string>(value: string): StringBrand<B> {
    return brandString<B>(trimValue(value));
}
export class RuleIdValue extends StringValueObject<"RuleId"> {
    private constructor(value: RuleId) {
        super(value);
    }
    static create(value: string): RuleId {
        return createTrimmedBrand<"RuleId">(value);
    }
    static parse(value: unknown): RuleId | undefined {
        return hasText(value) ? RuleIdValue.create(value) : undefined;
    }
    static wrap(value: RuleId): RuleIdValue {
        return new RuleIdValue(value);
    }
}
export class ActionNameValue extends StringValueObject<"ActionName"> {
    private constructor(value: ActionName) {
        super(value);
    }
    static create(value: string): ActionName {
        return createTrimmedBrand<"ActionName">(value);
    }
    static parse(value: unknown): ActionName | undefined {
        return hasText(value) ? ActionNameValue.create(value) : undefined;
    }
    static wrap(value: ActionName): ActionNameValue {
        return new ActionNameValue(value);
    }
}
export class ToolNameValue extends StringValueObject<"ToolName"> {
    private constructor(value: ToolName) {
        super(value);
    }
    static create(value: string): ToolName {
        return createTrimmedBrand<"ToolName">(value);
    }
    static parse(value: unknown): ToolName | undefined {
        return hasText(value) ? ToolNameValue.create(value) : undefined;
    }
    static wrap(value: ToolName): ToolNameValue {
        return new ToolNameValue(value);
    }
}
export class ModelNameValue extends StringValueObject<"ModelName"> {
    private constructor(value: ModelName) {
        super(value);
    }
    static create(value: string): ModelName {
        return createTrimmedBrand<"ModelName">(value);
    }
    static parse(value: unknown): ModelName | undefined {
        return hasText(value) ? ModelNameValue.create(value) : undefined;
    }
    static wrap(value: ModelName): ModelNameValue {
        return new ModelNameValue(value);
    }
}
export class ModelProviderValue extends StringValueObject<"ModelProvider"> {
    private constructor(value: ModelProvider) {
        super(value);
    }
    static create(value: string): ModelProvider {
        return createTrimmedBrand<"ModelProvider">(value);
    }
    static parse(value: unknown): ModelProvider | undefined {
        return hasText(value) ? ModelProviderValue.create(value) : undefined;
    }
    static wrap(value: ModelProvider): ModelProviderValue {
        return new ModelProviderValue(value);
    }
}
export class MessageIdValue extends StringValueObject<"MessageId"> {
    private constructor(value: MessageId) {
        super(value);
    }
    static create(value: string): MessageId {
        return createTrimmedBrand<"MessageId">(value);
    }
    static parse(value: unknown): MessageId | undefined {
        return hasText(value) ? MessageIdValue.create(value) : undefined;
    }
    static wrap(value: MessageId): MessageIdValue {
        return new MessageIdValue(value);
    }
}
export class AsyncTaskIdValue extends StringValueObject<"AsyncTaskId"> {
    private constructor(value: AsyncTaskId) {
        super(value);
    }
    static create(value: string): AsyncTaskId {
        return createTrimmedBrand<"AsyncTaskId">(value);
    }
    static parse(value: unknown): AsyncTaskId | undefined {
        return hasText(value) ? AsyncTaskIdValue.create(value) : undefined;
    }
    static wrap(value: AsyncTaskId): AsyncTaskIdValue {
        return new AsyncTaskIdValue(value);
    }
}
export class WorkItemIdValue extends StringValueObject<"WorkItemId"> {
    private constructor(value: WorkItemId) {
        super(value);
    }
    static create(value: string): WorkItemId {
        return createTrimmedBrand<"WorkItemId">(value);
    }
    static parse(value: unknown): WorkItemId | undefined {
        return hasText(value) ? WorkItemIdValue.create(value) : undefined;
    }
    static wrap(value: WorkItemId): WorkItemIdValue {
        return new WorkItemIdValue(value);
    }
}
export class GoalIdValue extends StringValueObject<"GoalId"> {
    private constructor(value: GoalId) {
        super(value);
    }
    static create(value: string): GoalId {
        return createTrimmedBrand<"GoalId">(value);
    }
    static parse(value: unknown): GoalId | undefined {
        return hasText(value) ? GoalIdValue.create(value) : undefined;
    }
    static wrap(value: GoalId): GoalIdValue {
        return new GoalIdValue(value);
    }
}
export class PlanIdValue extends StringValueObject<"PlanId"> {
    private constructor(value: PlanId) {
        super(value);
    }
    static create(value: string): PlanId {
        return createTrimmedBrand<"PlanId">(value);
    }
    static parse(value: unknown): PlanId | undefined {
        return hasText(value) ? PlanIdValue.create(value) : undefined;
    }
    static wrap(value: PlanId): PlanIdValue {
        return new PlanIdValue(value);
    }
}
export class HandoffIdValue extends StringValueObject<"HandoffId"> {
    private constructor(value: HandoffId) {
        super(value);
    }
    static create(value: string): HandoffId {
        return createTrimmedBrand<"HandoffId">(value);
    }
    static parse(value: unknown): HandoffId | undefined {
        return hasText(value) ? HandoffIdValue.create(value) : undefined;
    }
    static wrap(value: HandoffId): HandoffIdValue {
        return new HandoffIdValue(value);
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
