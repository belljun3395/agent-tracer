import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Client, Connection } from "@temporalio/client";

const DEFAULT_ADDRESS = "localhost:7233";

// Temporal 연결을 한 번만 맺어 디스패처들이 공유한다.
@Injectable()
export class TemporalClientProvider implements OnApplicationShutdown {
    private connection: Connection | null = null;
    private client: Client | null = null;

    async get(): Promise<Client> {
        if (this.client) return this.client;
        const address = process.env["TEMPORAL_ADDRESS"] ?? DEFAULT_ADDRESS;
        this.connection = await Connection.connect({ address });
        this.client = new Client({ connection: this.connection });
        return this.client;
    }

    async onApplicationShutdown(): Promise<void> {
        await this.connection?.close();
    }
}
