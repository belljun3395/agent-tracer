import { DataSource } from "typeorm";
import { ContentBlobEntity } from "~activity/event/domain/event-store/content.blob.entity.js";
import { EventLogEntity } from "~activity/event/domain/event-store/event.log.entity.js";
import { EventStoreService } from "~activity/event/repository/event-store/event.store.service.js";
import { SystemClockAdapter } from "~activity/event/adapter/system.clock.adapter.js";
import { CryptoIdGeneratorAdapter } from "~activity/event/adapter/crypto.id.generator.adapter.js";

async function main(): Promise<void> {
    const [databasePath, aggregateId, fromEventId] = process.argv.slice(2);
    if (!databasePath || !aggregateId) {
        process.stderr.write("Usage: tsx packages/server/src/main/replay-events.ts <sqlite-db-path> <aggregate-id> [from-event-id]\n");
        process.exitCode = 1;
        return;
    }

    const dataSource = new DataSource({
        type: "better-sqlite3",
        database: databasePath,
        entities: [EventLogEntity, ContentBlobEntity],
        synchronize: false,
        logging: false,
    });
    await dataSource.initialize();
    try {
        const clock = new SystemClockAdapter();
        const store = new EventStoreService(
            dataSource.getRepository(EventLogEntity),
            dataSource.getRepository(ContentBlobEntity),
            clock,
            new CryptoIdGeneratorAdapter(clock),
        );
        for await (const event of store.readAggregate(aggregateId, fromEventId)) {
            process.stdout.write(`${JSON.stringify(event)}\n`);
        }
    } finally {
        await dataSource.destroy();
    }
}

void main();
