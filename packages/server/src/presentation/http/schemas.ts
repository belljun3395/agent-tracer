/**
 * @module presentation/http/schemas
 *
 * Re-exports all Zod request schemas from the presentation layer.
 *
 * Route files inside `presentation/http/routes/` import schemas from here
 * (or directly from `../../schemas`) — this file exists as a convenient
 * sibling to `validate.ts` so that route files can do a single import:
 *
 *   import { validate } from "../validate.js";
 *   import { taskStartSchema } from "../schemas.js";
 *
 * All schemas are defined in `../schemas.ts` (presentation/schemas.ts);
 * this module simply re-exports everything from there.
 */
export * from "../schemas.js";
