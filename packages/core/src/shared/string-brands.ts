type Brand<T, B extends string> = T & {
    readonly __brand: B;
};

export type StringBrand<B extends string> = Brand<string, B>;

export abstract class StringValueObject<B extends string> {
    protected constructor(private readonly raw: StringBrand<B>) {
    }

    toString(): string {
        return this.raw;
    }
}

/**
 * Casts a validated string into a branded string type without changing content.
 */
export function brandString<B extends string>(value: string): StringBrand<B> {
    return value as StringBrand<B>;
}

/**
 * Guards parsing helpers by accepting only non-empty strings.
 */
export function hasText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Centralizes trimming so identifier factories stay consistent.
 */
export function trimValue(value: string): string {
    return value.trim();
}

/**
 * Reuses trim-before-brand logic for identifiers that should preserve original casing.
 */
export function createTrimmedBrand<B extends string>(value: string): StringBrand<B> {
    return brandString<B>(trimValue(value));
}
