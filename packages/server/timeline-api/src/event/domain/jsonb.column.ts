import type { ValueTransformer } from "typeorm";
import type { ZodType } from "zod";

export function zodJsonbTransformer<T>(schema: ZodType<T>): ValueTransformer {
    return {
        to: (value: T): T => schema.parse(value),
        from: (value: unknown): T => schema.parse(value),
    };
}
