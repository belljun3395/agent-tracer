import { brandString, createTrimmedBrand, hasText, StringValueObject } from "../shared/string-brands.js";
export class QuestionIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? QuestionIdValue.create(value) : undefined;
    }
}
export class TodoIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? TodoIdValue.create(value) : undefined;
    }
}
export class ModelNameValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? ModelNameValue.create(value) : undefined;
    }
}
export class ModelProviderValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? ModelProviderValue.create(value) : undefined;
    }
}
export class MessageIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? MessageIdValue.create(value) : undefined;
    }
}
export class AsyncTaskIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? AsyncTaskIdValue.create(value) : undefined;
    }
}
export class WorkItemIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? WorkItemIdValue.create(value) : undefined;
    }
}
export class GoalIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? GoalIdValue.create(value) : undefined;
    }
}
export class PlanIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? PlanIdValue.create(value) : undefined;
    }
}
export class HandoffIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? HandoffIdValue.create(value) : undefined;
    }
}
export const QuestionId = (s) => QuestionIdValue.create(s);
export const TodoId = (s) => TodoIdValue.create(s);
export const ModelName = (s) => ModelNameValue.create(s);
export const ModelProvider = (s) => ModelProviderValue.create(s);
export const MessageId = (s) => MessageIdValue.create(s);
export const AsyncTaskId = (s) => AsyncTaskIdValue.create(s);
export const WorkItemId = (s) => WorkItemIdValue.create(s);
export const GoalId = (s) => GoalIdValue.create(s);
export const PlanId = (s) => PlanIdValue.create(s);
export const HandoffId = (s) => HandoffIdValue.create(s);
//# sourceMappingURL=ids.js.map