import type { MigrationInterface, QueryRunner } from "typeorm";

/** 기존 설치가 원장 파티션을 자동 분리하지 않도록 보존 정책만 비활성화한다. */
export class DisableLedgerPartitionRetention1784170000000 implements MigrationInterface {
    name = "DisableLedgerPartitionRetention1784170000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE partman.part_config
            SET retention = NULL,
                retention_keep_table = false,
                retention_keep_index = false
            WHERE parent_table = 'public.events'
        `);
    }

    /** 롤백 시 자동 데이터 분리를 되살리지 않는다. */
    public down(queryRunner: QueryRunner): Promise<void> {
        void queryRunner;
        return Promise.resolve();
    }
}
