/**
 * @module infrastructure/sqlite/sqlite-transaction-runner
 *
 * 공통 트랜잭션 래퍼 유틸리티.
 */

import type Database from "better-sqlite3";

export function runTransaction<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)();
}
