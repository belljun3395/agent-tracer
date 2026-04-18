import { createTrimmedBrand, hasText, type StringBrand, StringValueObject } from "../shared/string-brands.js";

export type RuleId = StringBrand<"RuleId">;
export type ActionName = StringBrand<"ActionName">;
export type ToolName = StringBrand<"ToolName">;

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

export const RuleId = (s: string): RuleId => RuleIdValue.create(s);
export const ActionName = (s: string): ActionName => ActionNameValue.create(s);
export const ToolName = (s: string): ToolName => ToolNameValue.create(s);
