import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamSchema } from "~tracer-api/support/path-param.schema.js";

export const pathParamPipe = new SchemaValidationPipe<string>(
    pathParamSchema,
    "validation_error",
    "Invalid path parameter",
);
