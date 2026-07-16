import type { MigrationInterface, QueryRunner } from "typeorm";

/** 파일 친화도는 소비자가 없어 수집을 멈추고 쌓인 행을 함께 버린다. */
export class DropFileAffinity1784150000000 implements MigrationInterface {
    name = "DropFileAffinity1784150000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "file_affinity_summary"`);
    }

    public down(): Promise<void> {
        return Promise.reject(new Error("버린 파일 친화도는 되돌릴 수 없다"));
    }
}
