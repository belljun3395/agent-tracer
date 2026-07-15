import type { MigrationInterface, QueryRunner } from "typeorm";

export class AgentCompletionInbox1784140000000 implements MigrationInterface {
    name = "AgentCompletionInbox1784140000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "agent_completion_inbox" ("run_key" text NOT NULL, "token_hash" text NOT NULL, "status" text NOT NULL, "response" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_agent_completion_inbox_token_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_agent_completion_inbox_run_key" PRIMARY KEY ("run_key"))`);
        await queryRunner.query(`CREATE INDEX "agent_completion_inbox_expiry" ON "agent_completion_inbox" ("expires_at") WHERE "status" = 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."agent_completion_inbox_expiry"`);
        await queryRunner.query(`DROP TABLE "agent_completion_inbox"`);
    }
}
