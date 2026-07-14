import type { MigrationInterface, QueryRunner } from "typeorm";

/** 잡 피드백은 어떤 조회에도 쓰이지 않아 수집을 멈추고 쌓인 행을 함께 버린다. */
export class DropJobFeedback1784120000000 implements MigrationInterface {
    name = "DropJobFeedback1784120000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."job_feedback_job_ts"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."job_feedback_user_ts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "job_feedback"`);
    }

    public down(): Promise<void> {
        return Promise.reject(new Error("버린 피드백은 되돌릴 수 없다"));
    }
}
