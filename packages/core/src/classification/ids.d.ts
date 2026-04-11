import { type StringBrand, StringValueObject } from "../shared/string-brands.js";
export type RuleId = StringBrand<"RuleId">;
export type ActionName = StringBrand<"ActionName">;
export type ToolName = StringBrand<"ToolName">;
export declare class RuleIdValue extends StringValueObject<"RuleId"> {
    static create(value: string): RuleId;
    static parse(value: unknown): RuleId | undefined;
}
export declare class ActionNameValue extends StringValueObject<"ActionName"> {
    static create(value: string): ActionName;
    static parse(value: unknown): ActionName | undefined;
}
export declare class ToolNameValue extends StringValueObject<"ToolName"> {
    static create(value: string): ToolName;
    static parse(value: unknown): ToolName | undefined;
}
export declare const RuleId: (s: string) => RuleId;
export declare const ActionName: (s: string) => ActionName;
export declare const ToolName: (s: string) => ToolName;
//# sourceMappingURL=ids.d.ts.map