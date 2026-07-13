import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitLedger1783960000000 implements MigrationInterface {
    name = "InitLedger1783960000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS partman`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman`);

        // 파티션 키인 occurred_at은 PK에 포함돼야 하고 seq는 identity라 값 자체가 전역 유일하다.
        await queryRunner.query(`
            CREATE TABLE events (
                id             text NOT NULL,
                seq            bigint GENERATED ALWAYS AS IDENTITY,
                user_id        text NOT NULL,
                task_id        text NOT NULL,
                session_id     text,
                kind           text NOT NULL,
                occurred_at    timestamptz NOT NULL,
                received_at    timestamptz NOT NULL DEFAULT now(),
                payload        jsonb NOT NULL,
                trace_id       text NOT NULL,
                span_id        text NOT NULL,
                parent_span_id text,
                PRIMARY KEY (id, occurred_at)
            ) PARTITION BY RANGE (occurred_at)
        `);
        await queryRunner.query(`CREATE INDEX events_task_seq ON events (task_id, seq)`);
        await queryRunner.query(`CREATE INDEX events_seq ON events (seq)`);
        await queryRunner.query(`CREATE INDEX events_trace ON events (trace_id)`);

        // 미래 파티션은 run_maintenance가 미리 만든다.
        await queryRunner.query(`
            SELECT partman.create_parent(
                p_parent_table := 'public.events',
                p_control := 'occurred_at',
                p_interval := '1 month'
            )
        `);
        // 만료 파티션은 드롭하지 않고 분리만 하며 콜드 티어가 내보낸 뒤 드롭한다.
        await queryRunner.query(`
            UPDATE partman.part_config
            SET retention = '3 months', retention_keep_table = true, retention_keep_index = false
            WHERE parent_table = 'public.events'
        `);

        // Debezium이 파티션 루트에서 변경을 캡처하도록 퍼블리케이션을 루트 기준으로 만든다.
        await queryRunner.query(`DROP PUBLICATION IF EXISTS dbz_runtime`);
        await queryRunner.query(
            `CREATE PUBLICATION dbz_runtime FOR TABLE public.events WITH (publish_via_partition_root = true)`,
        );

        // 시간 파티션 PK에는 occurred_at이 포함되므로 이벤트 ID 멱등성은 이 테이블이 소유한다.
        await queryRunner.query(`
            CREATE TABLE event_ingest_keys (
                id            text PRIMARY KEY,
                first_seen_at timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(
            `CREATE INDEX event_ingest_keys_first_seen_at_idx ON event_ingest_keys (first_seen_at)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS event_ingest_keys_first_seen_at_idx`);
        await queryRunner.query(`DROP TABLE IF EXISTS event_ingest_keys`);
        await queryRunner.query(`DROP PUBLICATION IF EXISTS dbz_runtime`);
        await queryRunner.query(`SELECT partman.undo_partition('public.events', p_keep_table := false)`);
        await queryRunner.query(`DROP TABLE IF EXISTS events`);
    }
}
