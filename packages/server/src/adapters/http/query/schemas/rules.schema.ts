import type { Rule } from "~domain/verification/index.js";

/**
 * HTTP response shape for `GET /api/rules` when called without filters.
 * The top-level `{ ok, data }` envelope is applied by the interceptor;
 * this type describes the `data` payload only.
 */
export interface RulesOverviewResponse {
    readonly pending: readonly Rule[];
    readonly active: readonly Rule[];
    readonly rejected: readonly Rule[];
}

/** HTTP response shape for `GET /api/rules` with any filter applied. */
export interface RulesFilteredResponse {
    readonly rules: readonly Rule[];
}
