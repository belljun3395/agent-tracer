import { Client } from "pg";
import type { ApplicationConfig } from "@monitor/platform";

/** 콜드 티어 어댑터가 runtime DB에 문장을 보내는 실행 계약이다. */
export interface SqlClient {
    query(sql: string): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
}

/** 콜드 티어 실행 동안 열려 있는 runtime DB 연결이다. */
export interface RuntimeDbConnection extends SqlClient {
    close(): Promise<void>;
}

/** runtime DB 연결을 열어 콜드 티어 어댑터에 넘긴다. */
export async function openRuntimeDb(config: ApplicationConfig): Promise<RuntimeDbConnection> {
    const client = new Client({
        host: config.runtimeDb.host,
        port: config.runtimeDb.port,
        user: config.runtimeDb.username,
        password: config.runtimeDb.password,
        database: config.runtimeDb.database,
    });
    await client.connect();
    return {
        query: async (sql) => {
            const result = await client.query(sql);
            return { rows: result.rows as readonly Record<string, unknown>[] };
        },
        close: () => client.end(),
    };
}
