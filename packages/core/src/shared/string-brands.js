export class StringValueObject {
    raw;
    constructor(raw) {
        this.raw = raw;
    }
    toString() {
        return this.raw;
    }
}
/**
 * Casts a validated string into a branded string type without changing content.
 */
export function brandString(value) {
    return value;
}
/**
 * Guards parsing helpers by accepting only non-empty strings.
 */
export function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
}
/**
 * Centralizes trimming so identifier factories stay consistent.
 */
export function trimValue(value) {
    return value.trim();
}
/**
 * Reuses trim-before-brand logic for identifiers that should preserve original casing.
 */
export function createTrimmedBrand(value) {
    return brandString(trimValue(value));
}
//# sourceMappingURL=string-brands.js.map