import type { MigrationInterface, QueryRunner } from "typeorm";

export class ChatExecution1784679243725 implements MigrationInterface {
    name = "ChatExecution1784679243725";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_executions" ("id" text NOT NULL, "user_id" text NOT NULL, "thread_id" text NOT NULL, "user_message_id" text NOT NULL, "client_request_id" text NOT NULL, "input_hash" text NOT NULL, "status" text NOT NULL, "requested_backend" text, "model" text, "language" text, "draft_text" text NOT NULL DEFAULT '', "draft_seq" integer NOT NULL DEFAULT '0', "assistant_message_id" text, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b19fabec39c49adaa81f4a3a0b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "chat_executions_idempotency" ON "chat_executions" ("user_id", "thread_id", "client_request_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "chat_executions_running_thread" ON "chat_executions" ("thread_id") WHERE "status" = 'running'`);
        await queryRunner.query(`CREATE INDEX "chat_executions_user_status_updated" ON "chat_executions" ("user_id", "status", "updated_at") `);
        await queryRunner.query(`CREATE INDEX "chat_executions_thread_created" ON "chat_executions" ("thread_id", "created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."chat_executions_thread_created"`);
        await queryRunner.query(`DROP INDEX "public"."chat_executions_user_status_updated"`);
        await queryRunner.query(`DROP INDEX "public"."chat_executions_running_thread"`);
        await queryRunner.query(`DROP INDEX "public"."chat_executions_idempotency"`);
        await queryRunner.query(`DROP TABLE "chat_executions"`);
    }
}
