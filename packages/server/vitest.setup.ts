import { vi } from "vitest";

/**
 * typeorm-transactional's `@Transactional()` decorator requires a
 * registered DataSource at runtime. Unit tests mock the repository ports,
 * so they have no real DataSource — and the decorator should be a no-op.
 *
 * This stub keeps `@Transactional()`, `@Propagation`, etc. importable but
 * makes them transparent at decoration time. Integration tests that need
 * the real transactional behaviour can `vi.unmock("typeorm-transactional")`
 * locally.
 */
vi.mock("typeorm-transactional", () => ({
    Transactional: () => () => undefined,
    Propagation: { REQUIRED: "REQUIRED", REQUIRES_NEW: "REQUIRES_NEW", NESTED: "NESTED", MANDATORY: "MANDATORY", NEVER: "NEVER", NOT_SUPPORTED: "NOT_SUPPORTED", SUPPORTS: "SUPPORTS" },
    IsolationLevel: { READ_UNCOMMITTED: "READ UNCOMMITTED", READ_COMMITTED: "READ COMMITTED", REPEATABLE_READ: "REPEATABLE READ", SERIALIZABLE: "SERIALIZABLE" },
    runOnTransactionCommit: (fn: () => void) => fn(),
    runOnTransactionRollback: () => undefined,
    runOnTransactionComplete: (fn: () => void) => fn(),
    initializeTransactionalContext: () => undefined,
    addTransactionalDataSources: () => undefined,
}));
