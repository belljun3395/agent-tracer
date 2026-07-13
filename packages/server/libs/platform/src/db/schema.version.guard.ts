export interface SchemaVersionCheckResult {
    readonly upToDate: boolean;
    readonly missingMigrations: readonly string[];
}

/** 기대하는 마이그레이션이 모두 적용됐는지 DB 접근 없이 판정한다. */
export function checkSchemaVersion(
    appliedMigrationNames: readonly string[],
    expectedMigrationNames: readonly string[],
): SchemaVersionCheckResult {
    const applied = new Set(appliedMigrationNames);
    const missingMigrations = expectedMigrationNames.filter((name) => !applied.has(name));
    return { upToDate: missingMigrations.length === 0, missingMigrations };
}
