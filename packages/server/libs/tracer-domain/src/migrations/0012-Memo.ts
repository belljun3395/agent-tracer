import type { MigrationInterface, QueryRunner } from "typeorm";

export class Memo1784211741081 implements MigrationInterface {
    name = "Memo1784211741081";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "memos" ("id" text NOT NULL, "user_id" text NOT NULL, "task_id" text NOT NULL, "event_id" text, "body" text NOT NULL, "author" text NOT NULL, "last_edited_by" text NOT NULL, "rev" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5f005ade603ff6ea114dcacde0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "memos_live_user_task" ON "memos" ("user_id", "task_id") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "memos_event" ON "memos" ("event_id") WHERE "event_id" IS NOT NULL AND "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "memos_user_task" ON "memos" ("user_id", "task_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."memos_user_task"`);
        await queryRunner.query(`DROP INDEX "public"."memos_event"`);
        await queryRunner.query(`DROP INDEX "public"."memos_live_user_task"`);
        await queryRunner.query(`DROP TABLE "memos"`);
    }

}
