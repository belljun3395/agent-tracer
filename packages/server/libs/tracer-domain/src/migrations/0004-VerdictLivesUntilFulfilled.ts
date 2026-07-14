import type { MigrationInterface, QueryRunner } from "typeorm";

export class VerdictLivesUntilFulfilled1784110000000 implements MigrationInterface {
    name = 'VerdictLivesUntilFulfilled1784110000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 판정은 규칙과 원장에서 다시 만들어지는 파생물이며, 턴마다 쌓인 옛 행은 새 키에 담을 수 없다.
        await queryRunner.query(`DELETE FROM "verdicts"`);
        await queryRunner.query(`UPDATE "turns" SET "aggregate_verdict" = NULL, "rules_evaluated_count" = 0`);
        await queryRunner.query(`DROP INDEX "public"."verdicts_rule"`);
        await queryRunner.query(`ALTER TABLE "verdicts" ADD "severity" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "verdicts" ADD "nudge_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "verdicts" DROP CONSTRAINT "PK_5d051270f382903e2e74591304e"`);
        await queryRunner.query(`ALTER TABLE "verdicts" ADD CONSTRAINT "PK_e25657217794135c688d2379760" PRIMARY KEY ("rule_id")`);
        await queryRunner.query(`CREATE INDEX "verdicts_turn" ON "verdicts" ("turn_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."verdicts_turn"`);
        await queryRunner.query(`ALTER TABLE "verdicts" DROP CONSTRAINT "PK_e25657217794135c688d2379760"`);
        await queryRunner.query(`ALTER TABLE "verdicts" ADD CONSTRAINT "PK_5d051270f382903e2e74591304e" PRIMARY KEY ("rule_id", "turn_id")`);
        await queryRunner.query(`ALTER TABLE "verdicts" DROP COLUMN "nudge_count"`);
        await queryRunner.query(`ALTER TABLE "verdicts" DROP COLUMN "severity"`);
        await queryRunner.query(`CREATE INDEX "verdicts_rule" ON "verdicts" ("rule_id") `);
    }

}
