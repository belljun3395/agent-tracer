import { Client, Connection } from "@temporalio/client";
import { loadApplicationConfig } from "../config/application.config.loader.js";

export interface TemporalHandle {
    readonly connection: Connection;
    readonly client: Client;
}

/** 호출자가 종료 시 connection.close()로 직접 정리해야 하는 Temporal 연결을 만든다. */
export async function createTemporalConnection(): Promise<TemporalHandle> {
    const { temporal } = loadApplicationConfig();
    const connection = await Connection.connect({ address: temporal.address });
    const client = new Client({ connection, namespace: temporal.namespace });
    return { connection, client };
}
