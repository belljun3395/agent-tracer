import type { MigrationInterface, QueryRunner } from "typeorm";

export class RuleAnchoredToOneUtterance1784100000000 implements MigrationInterface {
    name = 'RuleAnchoredToOneUtterance1784100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 태스크나 근거 입력이 없는 규칙은 새 계약에서 판정 창을 만들 수 없어 남길 수 없다.
        await queryRunner.query(`DELETE FROM "verdicts" WHERE "rule_id" IN (SELECT "id" FROM "rules" WHERE "task_id" IS NULL OR "anchor_event_id" IS NULL)`);
        await queryRunner.query(`DELETE FROM "rules" WHERE "task_id" IS NULL OR "anchor_event_id" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."rules_live_user_scope"`);
        await queryRunner.query(`DROP INDEX "public"."rules_user_scope"`);
        await queryRunner.query(`ALTER TABLE "rules" DROP COLUMN "trigger"`);
        await queryRunner.query(`ALTER TABLE "rules" DROP COLUMN "scope"`);
        await queryRunner.query(`ALTER TABLE "rules" ALTER COLUMN "task_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "rules" ALTER COLUMN "anchor_event_id" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "rules_live_user_task" ON "rules" ("user_id", "task_id") WHERE "review_state" = 'active' AND "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "rules_user_task" ON "rules" ("user_id", "task_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."rules_user_task"`);
        await queryRunner.query(`DROP INDEX "public"."rules_live_user_task"`);
        await queryRunner.query(`ALTER TABLE "rules" ALTER COLUMN "anchor_event_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "rules" ALTER COLUMN "task_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "rules" ADD "scope" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "rules" ADD "trigger" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "rules_user_scope" ON "rules" ("scope", "user_id") `);
        await queryRunner.query(`CREATE INDEX "rules_live_user_scope" ON "rules" ("scope", "user_id") WHERE ((review_state = 'active'::text) AND (deleted_at IS NULL))`);
    }

}
