import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

export function zodToOutputSchema<T extends ZodTypeAny>(schema: T): Record<string, unknown> {
    const json = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
    delete json.$schema;
    return json;
}
