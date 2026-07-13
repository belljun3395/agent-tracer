import type { ObjectLiteral, Repository } from "typeorm";

// 자연키를 충돌 기준으로 삼는 upsert이며 jsonb 컬럼 타입과 TypeORM 부분 엔티티 타입 사이의 마찰을 흡수한다.
export async function upsertByKeys<T extends ObjectLiteral>(
    repo: Repository<T>,
    entityOrEntities: T | T[],
    conflictKeys: (keyof T & string)[],
): Promise<void> {
    await repo.upsert(entityOrEntities, conflictKeys);
}
