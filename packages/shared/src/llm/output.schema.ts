import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

/**
 * Convert a zod schema into a JSON Schema for the Claude Agent SDK's
 * structured-output mode ({@link AgentQueryRequest.outputSchema}).
 *
 * - `$refStrategy: "none"` inlines sub-schemas so the payload is a single
 *   self-contained schema (no `$ref`/`$defs` for the SDK to resolve).
 * - The `$schema` dialect marker is stripped — the SDK wants a plain schema
 *   object, not a JSON Schema document.
 *
 * Cross-field refinements (`.superRefine`) and zod `.default()`s can't be
 * expressed in JSON Schema and are dropped here; re-validate the model's output
 * with the original zod schema afterward to enforce them.
 */
export function zodToOutputSchema<T extends ZodTypeAny>(schema: T): Record<string, unknown> {
    const json = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
    delete json.$schema;
    return json;
}
