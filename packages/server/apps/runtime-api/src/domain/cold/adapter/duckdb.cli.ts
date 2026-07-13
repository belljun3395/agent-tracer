import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** DuckDB CLI로 SQL을 실행한다. */
export type DuckdbRunner = (bin: string, sql: string) => Promise<void>;

/** 비밀값을 프로세스 인자에 노출하지 않으려고 SQL을 파일로 건네 실행한다. */
export const runDuckdb: DuckdbRunner = async (bin, sql) => {
    const file = path.join(os.tmpdir(), `cold-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
    await fs.writeFile(file, sql, { mode: 0o600 });
    try {
        await execFileAsync(bin, [":memory:", "-c", `.read ${file}`]);
    } finally {
        await fs.rm(file, { force: true });
    }
};
