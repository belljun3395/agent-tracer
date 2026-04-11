import { type StringBrand, StringValueObject } from "../shared/string-brands.js";
export type QuestionId = StringBrand<"QuestionId">;
export type TodoId = StringBrand<"TodoId">;
export type ModelName = StringBrand<"ModelName">;
export type ModelProvider = StringBrand<"ModelProvider">;
export type MessageId = StringBrand<"MessageId">;
export type AsyncTaskId = StringBrand<"AsyncTaskId">;
export type WorkItemId = StringBrand<"WorkItemId">;
export type GoalId = StringBrand<"GoalId">;
export type PlanId = StringBrand<"PlanId">;
export type HandoffId = StringBrand<"HandoffId">;
export declare class QuestionIdValue extends StringValueObject<"QuestionId"> {
    static create(value: string): QuestionId;
    static parse(value: unknown): QuestionId | undefined;
}
export declare class TodoIdValue extends StringValueObject<"TodoId"> {
    static create(value: string): TodoId;
    static parse(value: unknown): TodoId | undefined;
}
export declare class ModelNameValue extends StringValueObject<"ModelName"> {
    static create(value: string): ModelName;
    static parse(value: unknown): ModelName | undefined;
}
export declare class ModelProviderValue extends StringValueObject<"ModelProvider"> {
    static create(value: string): ModelProvider;
    static parse(value: unknown): ModelProvider | undefined;
}
export declare class MessageIdValue extends StringValueObject<"MessageId"> {
    static create(value: string): MessageId;
    static parse(value: unknown): MessageId | undefined;
}
export declare class AsyncTaskIdValue extends StringValueObject<"AsyncTaskId"> {
    static create(value: string): AsyncTaskId;
    static parse(value: unknown): AsyncTaskId | undefined;
}
export declare class WorkItemIdValue extends StringValueObject<"WorkItemId"> {
    static create(value: string): WorkItemId;
    static parse(value: unknown): WorkItemId | undefined;
}
export declare class GoalIdValue extends StringValueObject<"GoalId"> {
    static create(value: string): GoalId;
    static parse(value: unknown): GoalId | undefined;
}
export declare class PlanIdValue extends StringValueObject<"PlanId"> {
    static create(value: string): PlanId;
    static parse(value: unknown): PlanId | undefined;
}
export declare class HandoffIdValue extends StringValueObject<"HandoffId"> {
    static create(value: string): HandoffId;
    static parse(value: unknown): HandoffId | undefined;
}
export declare const QuestionId: (s: string) => QuestionId;
export declare const TodoId: (s: string) => TodoId;
export declare const ModelName: (s: string) => ModelName;
export declare const ModelProvider: (s: string) => ModelProvider;
export declare const MessageId: (s: string) => MessageId;
export declare const AsyncTaskId: (s: string) => AsyncTaskId;
export declare const WorkItemId: (s: string) => WorkItemId;
export declare const GoalId: (s: string) => GoalId;
export declare const PlanId: (s: string) => PlanId;
export declare const HandoffId: (s: string) => HandoffId;
//# sourceMappingURL=ids.d.ts.map