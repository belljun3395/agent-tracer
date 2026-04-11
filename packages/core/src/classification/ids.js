import { createTrimmedBrand, hasText, StringValueObject } from "../shared/string-brands.js";
export class RuleIdValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? RuleIdValue.create(value) : undefined;
    }
}
export class ActionNameValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? ActionNameValue.create(value) : undefined;
    }
}
export class ToolNameValue extends StringValueObject {
    static create(value) {
        return createTrimmedBrand(value);
    }
    static parse(value) {
        return hasText(value) ? ToolNameValue.create(value) : undefined;
    }
}
export const RuleId = (s) => RuleIdValue.create(s);
export const ActionName = (s) => ActionNameValue.create(s);
export const ToolName = (s) => ToolNameValue.create(s);
//# sourceMappingURL=ids.js.map