export interface EventTypeDefinition<TType extends string = string> {
    readonly eventType: TType;
    readonly schemaVer: number;
    validate(payload: Record<string, unknown>): void;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
}

export function requireString(payload: Record<string, unknown>, key: string): void {
    if (typeof payload[key] !== "string" || payload[key].trim() === "") {
        throw new Error(`Domain event payload requires string field "${key}"`);
    }
}

export function requireNumber(payload: Record<string, unknown>, key: string): void {
    if (typeof payload[key] !== "number" || !Number.isFinite(payload[key])) {
        throw new Error(`Domain event payload requires number field "${key}"`);
    }
}

export function optionalString(payload: Record<string, unknown>, key: string): void {
    if (hasOwn(payload, key) && payload[key] != null && typeof payload[key] !== "string") {
        throw new Error(`Domain event payload field "${key}" must be a string when present`);
    }
}

export function optionalNumber(payload: Record<string, unknown>, key: string): void {
    if (hasOwn(payload, key) && payload[key] != null && (typeof payload[key] !== "number" || !Number.isFinite(payload[key]))) {
        throw new Error(`Domain event payload field "${key}" must be a number when present`);
    }
}

export function optionalArray(payload: Record<string, unknown>, key: string): void {
    if (hasOwn(payload, key) && payload[key] != null && !Array.isArray(payload[key])) {
        throw new Error(`Domain event payload field "${key}" must be an array when present`);
    }
}

export function optionalObject(payload: Record<string, unknown>, key: string): void {
    if (hasOwn(payload, key) && payload[key] != null) {
        const value = payload[key];
        if (typeof value !== "object" || Array.isArray(value)) {
            throw new Error(`Domain event payload field "${key}" must be an object when present`);
        }
    }
}

export function defineEventType<TType extends string>(
    eventType: TType,
    validate: (payload: Record<string, unknown>) => void,
    schemaVer = 1,
): EventTypeDefinition<TType> {
    return { eventType, schemaVer, validate };
}
