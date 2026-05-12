import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRecipeApplicationsSchema1700000014000
    implements MigrationInterface
{
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists recipe_applications (
                id              text primary key,
                recipe_id       text not null references recipes_current(id) on delete cascade,
                target_task_id  text not null references tasks_current(id) on delete cascade,
                injected_via    text not null check(injected_via in ('auto','slash_command','manual')),
                score           real,
                outcome         text check(outcome in ('completed','abandoned','superseded')),
                created_at      text not null,
                resolved_at     text
            )
        `);
        await qr.query(
            `create index if not exists idx_recipe_applications_recipe on recipe_applications(recipe_id, created_at desc)`,
        );
        await qr.query(
            `create index if not exists idx_recipe_applications_task on recipe_applications(target_task_id, created_at desc)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists recipe_applications`);
    }
}
