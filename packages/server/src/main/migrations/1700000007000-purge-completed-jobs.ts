import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * One-time cleanup of historical `completed` rows. From this migration onward
 * the worker deletes rows on success, but databases that ran the old code may
 * carry thousands of historical entries. This migration drops them so the
 * post-tuning queue table starts fresh.
 *
 * Failed rows are preserved for debugging.
 */
export class PurgeCompletedJobs1700000007000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`delete from event_processing_jobs where status = 'completed'`);
    }

    async down(_qr: QueryRunner): Promise<void> {
        // No-op — historical row data cannot be reconstructed.
    }
}
