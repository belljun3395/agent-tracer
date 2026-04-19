import type Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import { drizzleSchema, type DrizzleSchema } from "../schema/drizzle.schema.js"

export interface SqliteDatabase {
  readonly client: Database.Database
  readonly orm: BetterSQLite3Database<DrizzleSchema>
}

export type SqliteDatabaseInput = Database.Database | SqliteDatabase

export function createSqliteDatabase(client: Database.Database): SqliteDatabase {
  return {
    client,
    orm: drizzle({ client, schema: drizzleSchema })
  }
}

export function ensureSqliteDatabase(input: SqliteDatabaseInput): SqliteDatabase {
  if ("client" in input && "orm" in input) {
    return input
  }

  return createSqliteDatabase(input)
}
