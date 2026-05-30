import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { addTransactionalDataSource } from "typeorm-transactional";
import { AppConfigService } from "~config/app-config.service.js";
import { serializeDataSourceWrites } from "./write-serializer.js";

/**
 * TypeORM DataSource for module entities (subscribers, write-side projections).
 * There is exactly ONE better-sqlite3 connection: the driver is fully
 * synchronous and serializes every statement on the Node event loop. WAL mode
 * (configured below) buys crash-durability and reduced fsync — NOT in-process
 * reader/writer parallelism, since a single connection cannot run concurrently
 * with itself. This is a single-instance, single-writer design; see
 * docs/runtime-server-technical-review for the scaling boundary.
 *
 * The DataSource is registered with `typeorm-transactional` so any
 * `@Transactional()` method or `runInTransaction()` call automatically
 * propagates the transactional EntityManager through AsyncLocalStorage —
 * injected `Repository<T>` instances participate in the transaction without
 * an explicit `manager` parameter.
 */
@Module({})
export class TypeOrmDatabaseModule {
    static forRoot(): DynamicModule {
        return {
            module: TypeOrmDatabaseModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    inject: [AppConfigService],
                    useFactory: (appConfig: AppConfigService) => ({
                        type: "better-sqlite3",
                        database: appConfig.resolveDatabasePath(),
                        autoLoadEntities: true,
                        // Fresh-start model: the schema is derived directly from
                        // the @Entity classes — there are no migrations. Any DDL
                        // that cannot be expressed as an entity (the FTS5 search
                        // index) is ensured idempotently in dataSourceFactory.
                        synchronize: true,
                        logging: false,
                    }),
                    dataSourceFactory: async (config) => {
                        if (!config) {
                            throw new Error("TypeORM dataSource config is required");
                        }
                        const dataSource = await new DataSource(config).initialize();
                        await applySqlitePragmas(dataSource);
                        await ensureSearchFtsSchema(dataSource);
                        // Serialize top-level transactions on the single SQLite
                        // connection (wrap AFTER the transactional patch so it
                        // wraps the funnel typeorm-transactional actually calls).
                        return serializeDataSourceWrites(addTransactionalDataSource(dataSource));
                    },
                }),
            ],
            exports: [TypeOrmModule],
        };
    }
}

/**
 * Apply SQLite runtime tuning. Run once at boot; the settings persist for the
 * lifetime of the database file (journal_mode) or the connection (others).
 *
 * Trade-offs:
 *   - `journal_mode=WAL`: readers and a single writer run concurrently. Adds
 *     two sidecar files (`*-wal`, `*-shm`); backups must include them or use
 *     the sqlite3 `.backup` command.
 *   - `synchronous=NORMAL`: WAL still survives application crashes; only loses
 *     the most recent transactions on a power loss / OS crash. Local-only
 *     dev/monitoring tool — this trade is the SQLite-recommended default.
 *   - `cache_size=-65536`: 64 MB page cache (negative = kibibytes).
 *   - `mmap_size`: 256 MB memory-mapped reads; speeds up large scans.
 *   - `temp_store=MEMORY`: temp tables for sorts/joins stay in RAM.
 *
 * Override the pragmas at runtime via env var if needed (rarely useful in
 * practice; documented in docs/guide/perf-tuning.md).
 */
/**
 * Ensure the FTS5 search index exists. This is the one piece of schema that
 * cannot be derived from an @Entity (a virtual table + sync triggers), so it
 * is created idempotently at boot instead of via a migration. Runs after
 * `synchronize` has created the `search_documents` source table.
 *
 * `search_documents_fts` is an external-content FTS5 table over
 * `search_documents.search_text`; the AFTER INSERT/UPDATE/DELETE triggers keep
 * the inverted index in sync. The search endpoint MATCHes this index instead
 * of loading every document into JS for substring scoring.
 */
async function ensureSearchFtsSchema(dataSource: DataSource): Promise<void> {
    await dataSource.query(`
        create virtual table if not exists search_documents_fts using fts5(
            search_text,
            content='search_documents',
            content_rowid='rowid',
            tokenize='unicode61 remove_diacritics 1'
        )
    `);
    await dataSource.query(`
        insert into search_documents_fts(rowid, search_text)
        select rowid, search_text from search_documents
        where not exists (
            select 1 from search_documents_fts f where f.rowid = search_documents.rowid
        )
    `);
    await dataSource.query(`
        create trigger if not exists trg_search_documents_ai
        after insert on search_documents begin
            insert into search_documents_fts(rowid, search_text) values (new.rowid, new.search_text);
        end
    `);
    await dataSource.query(`
        create trigger if not exists trg_search_documents_ad
        after delete on search_documents begin
            insert into search_documents_fts(search_documents_fts, rowid, search_text)
            values('delete', old.rowid, old.search_text);
        end
    `);
    await dataSource.query(`
        create trigger if not exists trg_search_documents_au
        after update on search_documents begin
            insert into search_documents_fts(search_documents_fts, rowid, search_text)
            values('delete', old.rowid, old.search_text);
            insert into search_documents_fts(rowid, search_text)
            values(new.rowid, new.search_text);
        end
    `);
}

async function applySqlitePragmas(dataSource: DataSource): Promise<void> {
    await dataSource.query("PRAGMA journal_mode = WAL");
    await dataSource.query("PRAGMA synchronous = NORMAL");
    // Make the wait-on-lock window explicit rather than relying on the driver's
    // implicit 5000ms default. A writer that meets a held lock waits up to this
    // long instead of failing instantly with SQLITE_BUSY. Note: this does NOT
    // cover write-after-read upgrades (SQLITE_BUSY_SNAPSHOT is returned
    // immediately) — write paths should begin with an immediate transaction.
    await dataSource.query("PRAGMA busy_timeout = 5000");
    // Bound WAL growth: checkpoint roughly every 1000 pages (~4MB) so the -wal
    // sidecar cannot grow without bound under sustained writes.
    await dataSource.query("PRAGMA wal_autocheckpoint = 1000");
    await dataSource.query("PRAGMA cache_size = -65536");
    await dataSource.query("PRAGMA mmap_size = 268435456");
    await dataSource.query("PRAGMA temp_store = MEMORY");
}
