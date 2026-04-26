import { z } from "zod";

// Body must be a flat object with string keys; values can be any JSON.
// We don't restrict value types here — Plans C/D will validate their own keys.
export const updateConfigBodySchema = z
    .record(z.unknown())
    .refine((d) => Object.keys(d).length > 0, { message: "at least one key required" });

export type UpdateConfigBody = z.infer<typeof updateConfigBodySchema>;
