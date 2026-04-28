import { z } from "zod";

export const eventPatchSchema = z.object({
    displayTitle: z.union([z.string().trim().min(1), z.null()]).optional(),
}).refine((data) => data.displayTitle !== undefined, {
    message: "At least one field must be provided",
});
