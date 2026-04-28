/**
 * Public error classes — re-exported for cross-module callers (e.g. the
 * platform exception filter) so internal `common/turn.partition.errors.ts`
 * stays internal.
 */
export {
    TaskNotFoundError,
    TurnPartitionVersionMismatchError,
} from "../common/turn.partition.errors.js";
