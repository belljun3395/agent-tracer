export type TaskId = string & { readonly __brand: "TaskId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type EventId = string & { readonly __brand: "EventId" };
export type RuleId = string & { readonly __brand: "RuleId" };
export type RuntimeSessionId = string & { readonly __brand: "RuntimeSessionId" };
export type RuntimeSource = string & { readonly __brand: "RuntimeSource" };
export type WorkspacePath = string & { readonly __brand: "WorkspacePath" };
export type TaskSlug = string & { readonly __brand: "TaskSlug" };

function brand<T extends string>(value: string): string & { readonly __brand: T } {
  return value.trim() as string & { readonly __brand: T };
}

export const TaskId = (value: string): TaskId => brand<"TaskId">(value);
export const SessionId = (value: string): SessionId => brand<"SessionId">(value);
export const EventId = (value: string): EventId => brand<"EventId">(value);
export const RuleId = (value: string): RuleId => brand<"RuleId">(value);
export const RuntimeSessionId = (value: string): RuntimeSessionId => brand<"RuntimeSessionId">(value);
export const RuntimeSource = (value: string): RuntimeSource => brand<"RuntimeSource">(value);
export const WorkspacePath = (value: string): WorkspacePath => brand<"WorkspacePath">(value);
export const TaskSlug = (value: string): TaskSlug => brand<"TaskSlug">(value);
