import { vi } from "vitest";

vi.mock("typeorm-transactional", () => ({
    Transactional: () => () => undefined,
    Propagation: { REQUIRED: "REQUIRED", REQUIRES_NEW: "REQUIRES_NEW", NESTED: "NESTED", MANDATORY: "MANDATORY", NEVER: "NEVER", NOT_SUPPORTED: "NOT_SUPPORTED", SUPPORTS: "SUPPORTS" },
    IsolationLevel: { READ_UNCOMMITTED: "READ UNCOMMITTED", READ_COMMITTED: "READ COMMITTED", REPEATABLE_READ: "REPEATABLE READ", SERIALIZABLE: "SERIALIZABLE" },
    runInTransaction: <T>(fn: () => T): T => fn(),
    runOnTransactionCommit: (fn: () => void) => fn(),
    runOnTransactionRollback: () => undefined,
    runOnTransactionComplete: (fn: () => void) => fn(),
    initializeTransactionalContext: () => undefined,
    addTransactionalDataSources: () => undefined,
}));
