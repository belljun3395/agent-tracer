import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

export const pathParamSchema = z.string().refine((value) => value.trim().length > 0, {
    message: "Path parameter cannot be blank",
});

export const pathParamPipe = new ZodValidationPipe<string>(pathParamSchema, "Invalid path parameter");
