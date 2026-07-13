import type { DataSource } from "typeorm";
import { checkSchemaVersion } from "./schema.version.guard.js";

const POSTGRES_UNDEFINED_TABLE = "42P01";

/** 기대하는 마이그레이션이 누락돼 부트를 fail-fast로 끝내야 할 때 던진다. */
export class SchemaOutOfDateError extends Error {
    constructor(readonly missingMigrations: readonly string[]) {
        super(`스키마가 최신이 아니다. 누락된 마이그레이션: ${missingMigrations.join(", ")}`);
        this.name = "SchemaOutOfDateError";
    }
}

/** migrations 테이블을 조회해 스키마 최신 여부만 검사하고 마이그레이션을 실행하지는 않는다. */
export async function assertSchemaUpToDate(
    dataSource: DataSource,
    expectedMigrationNames: readonly string[],
): Promise<void> {
    const appliedMigrationNames = await loadAppliedMigrationNames(dataSource);
    const result = checkSchemaVersion(appliedMigrationNames, expectedMigrationNames);
    if (!result.upToDate) throw new SchemaOutOfDateError(result.missingMigrations);
}

async function loadAppliedMigrationNames(dataSource: DataSource): Promise<string[]> {
    try {
        const rows = await dataSource.query<{ name: string }[]>("SELECT name FROM migrations");
        return rows.map((row) => row.name);
    } catch (error) {
        // 마이그레이션을 한 번도 실행하지 않은 DB에는 migrations 테이블 자체가 없다.
        if (isUndefinedTableError(error)) return [];
        throw error;
    }
}

function isUndefinedTableError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === POSTGRES_UNDEFINED_TABLE;
}
