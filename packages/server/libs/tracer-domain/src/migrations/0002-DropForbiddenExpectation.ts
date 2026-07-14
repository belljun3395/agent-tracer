import type { MigrationInterface, QueryRunner } from "typeorm";

/** 규칙 어휘에서 금지 조항이 사라져 이미 저장된 규칙과 판정을 새 어휘로 한 번에 옮긴다. */
export class DropForbiddenExpectation1784090000000 implements MigrationInterface {
    name = "DropForbiddenExpectation1784090000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 금지만 말하는 규칙은 새 어휘로 옮길 수 없어 소프트 삭제한다.
        await queryRunner.query(`
            UPDATE "rules"
            SET "deleted_at" = now()
            WHERE "expectation" ->> 'kind' = 'forbidden' AND "deleted_at" IS NULL
        `);
        // 의무와 금지를 함께 걸었던 규칙은 의무만 남긴다.
        await queryRunner.query(`
            UPDATE "rules"
            SET "expectation" = "expectation" - 'forbiddenMatches',
                "signature" = regexp_replace("signature", ',"forbiddenMatches":\\[[^\\]]*\\]\\}$', '}')
            WHERE "expectation" ? 'forbiddenMatches' AND "expectation" ->> 'kind' <> 'forbidden'
        `);
        await queryRunner.query(`
            UPDATE "verdicts"
            SET "evidence" = "evidence" - 'forbiddenPattern'
            WHERE "evidence" ? 'forbiddenPattern'
        `);
    }

    public down(): Promise<void> {
        return Promise.reject(new Error("금지 조항 어휘는 되돌릴 수 없다"));
    }
}
