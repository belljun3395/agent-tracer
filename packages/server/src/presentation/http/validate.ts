/**
 * @module presentation/http/validate
 *
 * Lightweight Zod-based validation middleware factory.
 *
 * Usage:
 *   router.post("/api/foo", validate(fooSchema), async (req, res) => {
 *     // req.body is guaranteed to match fooSchema
 *   });
 *
 * On validation failure the middleware short-circuits with:
 *   400 { error: "Validation failed", details: ZodIssue[] }
 *
 * On success it replaces req.body with the parsed (stripped/coerced) value
 * so downstream handlers receive the clean, type-safe payload.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema } from "zod";

/**
 * Target selects which part of the request to validate.
 * Defaults to "body".
 */
export type ValidateTarget = "body" | "params" | "query";

export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidateTarget = "body"
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.errors
      });
      return;
    }

    // Replace the target with the parsed value so handlers get
    // stripped/coerced/defaulted data rather than the raw input.
    if (target === "body") {
      req.body = result.data;
    }

    next();
  };
}
