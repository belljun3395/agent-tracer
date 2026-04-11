type Brand<T, B extends string> = T & {
    readonly __brand: B;
};
export type StringBrand<B extends string> = Brand<string, B>;
export declare abstract class StringValueObject<B extends string> {
    private readonly raw;
    protected constructor(raw: StringBrand<B>);
    toString(): string;
}
/**
 * Casts a validated string into a branded string type without changing content.
 */
export declare function brandString<B extends string>(value: string): StringBrand<B>;
/**
 * Guards parsing helpers by accepting only non-empty strings.
 */
export declare function hasText(value: unknown): value is string;
/**
 * Centralizes trimming so identifier factories stay consistent.
 */
export declare function trimValue(value: string): string;
/**
 * Reuses trim-before-brand logic for identifiers that should preserve original casing.
 */
export declare function createTrimmedBrand<B extends string>(value: string): StringBrand<B>;
export {};
//# sourceMappingURL=string-brands.d.ts.map