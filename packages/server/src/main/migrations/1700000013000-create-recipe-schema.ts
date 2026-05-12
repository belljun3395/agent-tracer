import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRecipeSchema1700000013000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists recipe_scan_jobs (
                id                  text primary key,
                status              text not null check(status in ('pending','processing','completed','failed')),
                attempts            integer not null default 0,
                error               text,
                candidates_created  integer not null default 0,
                tasks_scanned       integer not null default 0,
                filters_json        text not null default '{}',
                language            text,
                model_used          text,
                duration_ms         integer,
                created_at          text not null,
                updated_at          text not null,
                started_at          text,
                completed_at        text
            )
        `);
        await qr.query(
            `create index if not exists idx_recipe_scan_jobs_status on recipe_scan_jobs(status, created_at)`,
        );

        await qr.query(`
            create table if not exists recipe_candidates (
                id                          text primary key,
                job_id                      text not null references recipe_scan_jobs(id) on delete cascade,
                title                       text not null,
                intent                      text not null,
                description                 text not null,
                summary_md                  text not null,
                steps_json                  text not null default '[]',
                touched_files_json          text not null default '[]',
                contributing_slices_json    text not null,
                rationale                   text not null,
                language                    text,
                parent_recipe_id            text,
                status                      text not null check(status in ('pending','accepted','dismissed','failed')),
                error                       text,
                created_at                  text not null,
                resolved_at                 text
            )
        `);
        await qr.query(
            `create index if not exists idx_recipe_candidates_status on recipe_candidates(status, created_at desc)`,
        );
        await qr.query(
            `create index if not exists idx_recipe_candidates_job on recipe_candidates(job_id)`,
        );

        await qr.query(`
            create table if not exists recipes_current (
                id                          text primary key,
                source_candidate_id         text references recipe_candidates(id) on delete set null,
                title                       text not null,
                intent                      text not null,
                description                 text not null,
                summary_md                  text not null,
                steps_json                  text not null default '[]',
                touched_files_json          text not null default '[]',
                contributing_slices_json    text not null,
                rev                         integer not null default 1,
                parent_recipe_id            text references recipes_current(id) on delete set null,
                status                      text not null check(status in ('active','superseded','retired')),
                applied_count               integer not null default 0,
                success_count               integer not null default 0,
                language                    text,
                created_at                  text not null,
                updated_at                  text not null
            )
        `);
        await qr.query(
            `create index if not exists idx_recipes_current_status on recipes_current(status, updated_at desc)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists recipes_current`);
        await qr.query(`drop table if exists recipe_candidates`);
        await qr.query(`drop table if exists recipe_scan_jobs`);
    }
}
