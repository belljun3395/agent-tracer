import { type StringBrand, StringValueObject } from "../shared/string-brands.js";
export type TaskId = StringBrand<"TaskId">;
export type SessionId = StringBrand<"SessionId">;
export type EventId = StringBrand<"EventId">;
export type BookmarkId = StringBrand<"BookmarkId">;
export type RuntimeSessionId = StringBrand<"RuntimeSessionId">;
export type RuntimeSource = StringBrand<"RuntimeSource">;
export type WorkspacePath = StringBrand<"WorkspacePath">;
export type TaskSlug = StringBrand<"TaskSlug">;
export declare class TaskIdValue extends StringValueObject<"TaskId"> {
    static create(value: string): TaskId;
    static parse(value: unknown): TaskId | undefined;
}
export declare class SessionIdValue extends StringValueObject<"SessionId"> {
    static create(value: string): SessionId;
    static parse(value: unknown): SessionId | undefined;
}
export declare class EventIdValue extends StringValueObject<"EventId"> {
    static create(value: string): EventId;
    static parse(value: unknown): EventId | undefined;
}
export declare class BookmarkIdValue extends StringValueObject<"BookmarkId"> {
    static create(value: string): BookmarkId;
    static parse(value: unknown): BookmarkId | undefined;
}
export declare class RuntimeSessionIdValue extends StringValueObject<"RuntimeSessionId"> {
    static create(value: string): RuntimeSessionId;
    static parse(value: unknown): RuntimeSessionId | undefined;
}
export declare class RuntimeSourceValue extends StringValueObject<"RuntimeSource"> {
    static create(value: string): RuntimeSource;
    static parse(value: unknown): RuntimeSource | undefined;
}
export declare class WorkspacePathValue extends StringValueObject<"WorkspacePath"> {
    static create(value: string): WorkspacePath;
    static parse(value: unknown): WorkspacePath | undefined;
}
export declare class TaskSlugValue extends StringValueObject<"TaskSlug"> {
    static create(value: string): TaskSlug;
    static parse(value: unknown): TaskSlug | undefined;
}
export declare const TaskId: (s: string) => TaskId;
export declare const SessionId: (s: string) => SessionId;
export declare const EventId: (s: string) => EventId;
export declare const BookmarkId: (s: string) => BookmarkId;
export declare const RuntimeSessionId: (s: string) => RuntimeSessionId;
export declare const RuntimeSource: (s: string) => RuntimeSource;
export declare const WorkspacePath: (s: string) => WorkspacePath;
export declare const TaskSlug: (s: string) => TaskSlug;
//# sourceMappingURL=ids.d.ts.map