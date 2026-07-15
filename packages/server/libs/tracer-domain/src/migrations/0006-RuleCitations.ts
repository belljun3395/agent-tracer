import type { MigrationInterface, QueryRunner } from "typeorm";

/** 규칙이 서버가 원장과 대조해 걸러낸 인용 턴·이벤트 식별자를 함께 소유한다. */
export class RuleCitations1784130000000 implements MigrationInterface {
    name = "RuleCitations1784130000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rules" ADD "cited_turn_ids" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "rules" ADD "cited_event_ids" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rules" DROP COLUMN "cited_event_ids"`);
        await queryRunner.query(`ALTER TABLE "rules" DROP COLUMN "cited_turn_ids"`);
    }
}
