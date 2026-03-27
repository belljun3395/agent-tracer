/**
 * @module infrastructure/otel/sqlite-observer
 *
 * BetterSqlite3 Database를 감싸 쿼리 실행 시간을 측정한다.
 * SLOW_QUERY_THRESHOLD_MS 초과 시 console.warn을 출력한다.
 */
import type Database from "better-sqlite3";
import type { Histogram } from "@opentelemetry/api";
import { getMeter } from "./otel-setup.js";

const SLOW_QUERY_THRESHOLD_MS = 50;
const SQL_FINGERPRINT_LENGTH = 80;

function getHistogram(): Histogram {
  return getMeter().createHistogram("sqlite.query.duration", {
    description: "Duration of SQLite query execution in milliseconds",
    unit: "ms",
  });
}

function fingerprint(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().slice(0, SQL_FINGERPRINT_LENGTH);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawStmt = Record<string, any>;

function wrapStatement(stmt: RawStmt, histogram: Histogram, sql: string): RawStmt {
  const fp = fingerprint(sql);

  function time<T>(op: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const durationMs = performance.now() - start;
      histogram.record(durationMs, { sql_fingerprint: fp, operation: op });
      if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(`[sqlite] slow query (${durationMs.toFixed(1)}ms) [${op}]: ${fp}`);
      }
    }
  }

  const proxy = Object.create(stmt as object) as RawStmt;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  proxy["run"] = (...args: unknown[]) => time("run", () => (stmt["run"] as (...a: unknown[]) => unknown)(...args));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  proxy["get"] = (...args: unknown[]) => time("get", () => (stmt["get"] as (...a: unknown[]) => unknown)(...args));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  proxy["all"] = (...args: unknown[]) => time("all", () => (stmt["all"] as (...a: unknown[]) => unknown)(...args));

  return proxy;
}

export function instrumentDb(db: Database.Database): Database.Database {
  const histogram = getHistogram();
  const originalPrepare = db.prepare.bind(db);

  Object.defineProperty(db, "prepare", {
    value: (sql: string) => {
      const stmt = originalPrepare(sql) as RawStmt;
      return wrapStatement(stmt, histogram, sql);
    },
    writable: true,
    configurable: true,
  });

  return db;
}
