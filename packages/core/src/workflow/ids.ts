import { brandString, createTrimmedBrand, hasText, type StringBrand, StringValueObject } from "../shared/string-brands.js";

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

export const QuestionId = (s: string): QuestionId => QuestionIdValue.create(s);
export const TodoId = (s: string): TodoId => TodoIdValue.create(s);
export const ModelName = (s: string): ModelName => ModelNameValue.create(s);
export const ModelProvider = (s: string): ModelProvider => ModelProviderValue.create(s);
export const MessageId = (s: string): MessageId => MessageIdValue.create(s);
export const AsyncTaskId = (s: string): AsyncTaskId => AsyncTaskIdValue.create(s);
export const WorkItemId = (s: string): WorkItemId => WorkItemIdValue.create(s);
export const GoalId = (s: string): GoalId => GoalIdValue.create(s);
export const PlanId = (s: string): PlanId => PlanIdValue.create(s);
export const HandoffId = (s: string): HandoffId => HandoffIdValue.create(s);
